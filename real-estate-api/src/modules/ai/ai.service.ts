import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { AiChatCompareService } from './ai-chat-compare.service';
import { DescriptionGeneratorService } from './services';

type IndexedDoc = {
  id: number;
  text: string;
  payload: Record<string, unknown>;
};

type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
};

type IntentType =
  | 'search_property'
  | 'recommend_property'
  | 'qa_real_estate'
  | 'compare_property'
  | 'generate_content'
  | 'booking'
  | 'upgrade_account'
  | 'upgrade_listing'
  | 'post_guide'
  | 'greeting'
  | 'unknown';

type ParsedIntent = {
  type: IntentType;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  sourceType?: 'house' | 'land' | 'post';
  requiredKeyword?: string;
  compareIds?: number[];
  compareDescriptions?: string[]; // named property descriptions to search separately
};

type VectorHit = {
  id: number;
  score: number;
  payload: Record<string, unknown>;
};

type ChatSourcePayload = Record<string, unknown>;

type ConversationState = {
  memoryKey: string;
  summaryKey: string;
  memory: ChatTurn[];
  summaryMemory: string;
};

type ChatResponsePayload = {
  answer: string;
  structured: Record<string, unknown> | null;
  intent: ParsedIntent;
  confidence: number;
  sources: ChatSourcePayload[];
  relatedSources: ChatSourcePayload[];
  suggestedQuestions: string[];
};

type ChatResult = {
  ok: true;
  sessionId: string;
  answer: string;
  structured: Record<string, unknown> | null;
  intent: ParsedIntent;
  confidence: number;
  sources: ChatSourcePayload[];
  relatedSources: ChatSourcePayload[];
  suggestedQuestions: string[];
  memoryTurns: number;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:3000';
  private readonly qdrantUrl =
    process.env.QDRANT_URL || 'http://real-estate-qdrant:6333';
  private readonly ollamaUrl =
    process.env.OLLAMA_URL || 'http://real-estate-ollama:11434';
  private readonly ragCollection =
    process.env.RAG_COLLECTION || 'real_estate_rag';
  private readonly chatModel =
    process.env.CHAT_MODEL || process.env.DEFAULT_OLLAMA_MODEL || 'qwen2.5:7b';
  private readonly embedModel = process.env.EMBED_MODEL || 'nomic-embed-text';
  private readonly retrievalTopK = Number(process.env.RAG_TOP_K || 4);
  private readonly contextTopK = Number(process.env.RAG_CONTEXT_K || 2);
  private readonly minScore = Number(process.env.RAG_MIN_SCORE || 0.2);
  private readonly embedConcurrency = Number(
    process.env.EMBED_CONCURRENCY || 8,
  );
  private readonly chatHistoryTurns = Number(
    process.env.RAG_HISTORY_TURNS || 4,
  );
  private readonly chatHistoryMaxTurns = Number(
    process.env.RAG_HISTORY_MAX_TURNS || 20,
  );
  private readonly chatSummaryMaxChars = Number(
    process.env.RAG_HISTORY_SUMMARY_CHARS || 1000,
  );
  private readonly retrievalCandidateMultiplier = Number(
    process.env.RAG_CANDIDATE_MULTIPLIER || 10,
  );
  private readonly maxPromptDescriptionChars = Number(
    process.env.RAG_DESCRIPTION_CHARS || 80,
  );
  private readonly chatNumPredict = Number(process.env.CHAT_NUM_PREDICT || 256);
  private readonly embedCacheTtlSec = Number(
    process.env.EMBED_QUERY_CACHE_TTL || 600,
  );
  private readonly responseCacheTtlSec = Number(
    process.env.RAG_RESPONSE_CACHE_TTL || 120,
  );
  private readonly enableLlm =
    String(process.env.RAG_ENABLE_LLM || 'true').toLowerCase() !== 'false';
  private readonly fastMode =
    String(process.env.RAG_FAST_MODE || 'true').toLowerCase() === 'true';
  private readonly ollamaTimeoutMs = Number(
    process.env.OLLAMA_TIMEOUT_MS || 9000,
  );
  private readonly qdrantTimeoutMs = Number(
    process.env.QDRANT_TIMEOUT_MS || 2500,
  );
  private readonly embedTimeoutMs = Number(
    process.env.EMBED_TIMEOUT_MS || 5000,
  );
  private readonly logTimings =
    String(process.env.RAG_LOG_TIMINGS || 'false').toLowerCase() === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly compareService: AiChatCompareService,
    private readonly descriptionGeneratorService: DescriptionGeneratorService,
  ) { }

  async indexOne(type: 'house' | 'land' | 'post', id: number): Promise<void> {
    try {
      let doc: IndexedDoc;

      if (type === 'house') {
        const house = await this.prisma.house.findUnique({ where: { id } });
        if (!house || house.status !== 1) return;
        doc = this.houseToDoc(house as Record<string, unknown>);
      } else if (type === 'land') {
        const land = await this.prisma.land.findUnique({ where: { id } });
        if (!land || land.status !== 1) return;
        doc = this.landToDoc(land as Record<string, unknown>);
      } else {
        const post = await this.prisma.post.findUnique({ where: { id } });
        if (!post || post.status !== 2) return;
        doc = this.postToDoc(post as Record<string, unknown>);
      }

      await this.ensureCollection(768);
      const vector = await this.embed(doc.text);
      await axios.put(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points?wait=true`,
        {
          points: [{ id: doc.id, vector, payload: doc.payload }],
        },
      );
      this.logger.log(`Indexed ${type}:${id} (qdrant id=${doc.id})`);
    } catch (error) {
      this.logger.warn(
        `indexOne(${type}:${id}) failed: ${this.stringifyError(error)}`,
      );
    }
  }

  async indexData(limit = 200) {
    const [houses, lands, posts] = await Promise.all([
      this.prisma.house.findMany({
        where: { status: 1 },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.land.findMany({
        where: { status: 1 },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.post.findMany({
        where: { status: 2 },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(limit, 100),
      }),
    ]);

    const docs: IndexedDoc[] = [
      ...houses.map((h) => this.houseToDoc(h)),
      ...lands.map((l) => this.landToDoc(l)),
      ...posts.map((p) => this.postToDoc(p)),
    ];

    if (docs.length === 0) {
      return {
        ok: false,
        indexed: 0,
        message: 'No records found to index',
      };
    }

    await this.ensureCollection(768);

    const points = await this.mapWithConcurrency(
      docs,
      this.embedConcurrency,
      async (doc) => {
        const vector = await this.embed(doc.text);
        return { id: doc.id, vector, payload: doc.payload };
      },
    );

    const batchSize = 32;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await axios.put(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points?wait=true`,
        {
          points: batch,
        },
      );
    }

    this.logger.log(
      `Indexed ${points.length} records into ${this.ragCollection}`,
    );

    return {
      ok: true,
      indexed: points.length,
      houses: houses.length,
      lands: lands.length,
      posts: posts.length,
      collection: this.ragCollection,
    };
  }

  async chat(dto: ChatDto) {
    const chatStartedAt = Date.now();
    const timings: Record<string, number> = {};
    const question = dto.question.trim();
    const sessionId = dto.sessionId.trim();
    const intent = this.parseIntent(question);
    const hasIntentFilter =
      Boolean(intent.location) ||
      intent.minPrice !== undefined ||
      intent.maxPrice !== undefined ||
      Boolean(intent.sourceType);
    const noDataAnswer =
      'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.';

    // Fetch conversation state early (needed for multi-turn flows)
    const conversationEarly = await this.getConversationState(sessionId);

    const generateContentResponse = await this.handleGenerateContentFlow(
      sessionId,
      question,
      intent,
      conversationEarly,
    );
    if (generateContentResponse) return generateContentResponse;

    // Handle intents that don't need RAG lookup
    const directResponse = this.handleDirectIntent(intent, question);
    if (directResponse) {
      return this.returnChatWithMemory(sessionId, question, conversationEarly, {
        answer: directResponse.answer,
        structured: null,
        intent,
        confidence: 1,
        sources: [],
        relatedSources: [],
        suggestedQuestions: directResponse.suggestedQuestions,
      });
    }

    const compareResponse = await this.handleCompareFlow(
      sessionId,
      question,
      intent,
      conversationEarly,
    );
    if (compareResponse) return compareResponse;

    const normalizedQuestion = this.normalizeText(question);
    // Follow-up questions depend on conversation context, so they must not share
    // a global cache key with other sessions that asked the same literal question.
    const isFollowUp =
      conversationEarly.memory.length > 0 &&
      /\b(do|kia|tren|day|vua xem|vua tim|cai do|nha do|tin do|can do|no|chung|nhung|nay voi|voi nhau|hai cai|2 cai)\b/.test(
        normalizedQuestion,
      );
    const responseCacheKey = isFollowUp
      ? `ai:chat:resp:${sessionId}:${encodeURIComponent(normalizedQuestion).slice(0, 160)}`
      : `ai:chat:resp:${encodeURIComponent(normalizedQuestion).slice(0, 200)}`;
    const conversation = conversationEarly;
    const recentMemory = conversation.memory.slice(
      -Math.max(0, this.chatHistoryTurns),
    );
    const cachedResponse = await this.tryCachedChatResponse(
      sessionId,
      question,
      intent,
      responseCacheKey,
      conversation,
      timings,
      chatStartedAt,
    );
    if (cachedResponse) return cachedResponse;

    const candidateLimit = hasIntentFilter
      ? Math.max(
        this.retrievalTopK * this.retrievalCandidateMultiplier,
        this.retrievalTopK * 3,
      )
      : this.retrievalTopK;

    let rawHits: VectorHit[] = [];
    const relatedPool: VectorHit[] = [];
    try {
      const embedStartedAt = Date.now();
      const queryVector = await this.getCachedQueryEmbedding(question);
      timings.embedMs = Date.now() - embedStartedAt;

      const searchStartedAt = Date.now();
      const searchResp = await axios.post(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points/search`,
        {
          vector: queryVector,
          limit: candidateLimit,
          with_payload: true,
        },
        { timeout: this.qdrantTimeoutMs },
      );
      timings.searchMs = Date.now() - searchStartedAt;

      rawHits = (searchResp.data?.result || []) as VectorHit[];
      relatedPool.push(...rawHits);
    } catch (error) {
      this.logger.warn(
        `Vector search failed, fallback to DB intent search: ${this.stringifyError(error)}`,
      );
    }

    const filterStartedAt = Date.now();
    const intentFilteredHits = this.applyIntentFilter(rawHits, intent);
    const strongHits = intentFilteredHits.filter(
      (h) => Number(h.score || 0) >= this.minScore,
    );
    timings.filterMs = Date.now() - filterStartedAt;

    let hits: VectorHit[] = strongHits;
    if (hits.length === 0 && intentFilteredHits.length > 0) {
      // Keep best intent-matched results even when score is below strict threshold.
      hits = intentFilteredHits.slice(0, this.retrievalTopK);
    }

    if (hits.length === 0 && hasIntentFilter) {
      const dbFallbackStartedAt = Date.now();
      const dbFallbackHits = await this.findDbCandidatesByIntent(
        intent,
        Math.max(this.retrievalTopK, 8),
      );
      timings.dbFallbackMs = Date.now() - dbFallbackStartedAt;
      relatedPool.push(...dbFallbackHits);
      if (dbFallbackHits.length > 0) {
        hits = dbFallbackHits;
      }
    }

    let relatedSources = this.buildRelatedSources(relatedPool, hits, intent, 3);
    if (relatedSources.length < 3) {
      const dbRelated = await this.findRelatedFromDb(
        intent,
        hits,
        relatedSources,
        3 - relatedSources.length,
      );
      relatedSources = [...relatedSources, ...dbRelated].slice(0, 3);
    }

    // Keep prompt context compact for latency and stable generation quality.
    hits = hits
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, Math.max(1, this.contextTopK));

    if (hits.length === 0) {
      if (this.logTimings) {
        this.logger.log(
          `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms source=no-data session=${sessionId}`,
        );
      }
      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: noDataAnswer,
        structured: null,
        intent,
        confidence: 0,
        sources: [],
        relatedSources,
        suggestedQuestions: [
          'Tìm nhà dưới 3 tỷ',
          'Tìm đất nền giá rẻ',
          'Kinh nghiệm mua nhà lần đầu',
        ],
      });
    }

    const defaultSuggestions = this.buildSuggestedQuestions(intent, hits);

    // Fast mode skips LLM generation for better UX latency.
    if (this.fastMode || !this.enableLlm) {
      const fastAnswerStartedAt = Date.now();
      const answer = this.toFastAnswer(hits);
      timings.fastAnswerMs = Date.now() - fastAnswerStartedAt;
      await this.redis.set(
        responseCacheKey,
        {
          answer,
          sources: hits.map((h) => ({ ...h.payload, score: h.score })),
          relatedSources,
          suggestedQuestions: defaultSuggestions,
          confidence: hits[0]?.score || 0,
        },
        this.responseCacheTtlSec,
      );

      if (this.logTimings) {
        this.logger.log(
          `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms fastAnswer=${timings.fastAnswerMs ?? 0}ms source=fast-mode session=${sessionId}`,
        );
      }

      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer,
        structured: null,
        intent,
        confidence: hits[0]?.score || 0,
        sources: hits.map((h) => ({ ...h.payload, score: h.score })),
        relatedSources,
        suggestedQuestions: defaultSuggestions,
      });
    }

    const context = hits
      .map((hit, idx) => {
        const p = hit.payload || {};
        const description = String(p.description || '');
        const shortDescription =
          description.length > this.maxPromptDescriptionChars
            ? `${description.slice(0, this.maxPromptDescriptionChars)}...`
            : description;

        return [
          `#${idx + 1} score=${hit.score.toFixed(4)}`,
          `${String(p.title || '')}`,
          `${String(p.district || '')}, ${String(p.city || '')}`,
          `gia=${String(p.price || '')} dt=${String(p.area || '')}`,
          `src=${String(p.source || '')}:${String(p.sourceId || '')}`,
          `url=${String(p.url || '')}`,
          `mota=${shortDescription}`,
        ].join(' | ');
      })
      .join('\n\n');

    const intentInstructions = this.buildIntentInstructions(intent);

    const promptParts = [
      '===SYSTEM===',
      'Ban la tro ly AI tu van bat dong san chuyen nghiep cho nen tang Real Estate Viet Nam.',
      'LUON tra loi bang TIENG VIET. Giong dieu than thien, ro rang, chuyen nghiep.',
      '',
      '===NHIEM VU===',
      `Intent hien tai: ${intent.type}`,
      intentInstructions,
      '',
      '===QUY TAC CHUNG===',
      '1. Chi dung du lieu tu CONTEXT de goi y BDS. Khong duoc bịa thong tin.',
      '2. Neu context co BDS, PHAI goi y cu the voi ly do ro rang (vi tri, gia, dien tich, tien ich).',
      '3. Moi goi y can co sourceId de nguoi dung co the xem chi tiet hoac so sanh.',
      '4. Neu khong du du lieu, tra loi trung thuc va huong dan nguoi dung.',
      '5. Luon them suggestedQuestions phu hop voi nhu cau nguoi dung.',
      '',
      '===DINH DANG TRA LOI (JSON BAT BUOC)===',
      'Tra ve JSON chinh xac theo schema:',
      '{"summary":"string","recommendations":[{"title":"string","location":"string","price":number,"area":number,"bedrooms":number,"floors":number,"direction":"string","reason":"string","source":"string","sourceId":number,"url":"string"}],"followUp":"string","suggestedQuestions":["string"]}',
      'Trong do:',
      '- summary: tom tat ngan gon ve ket qua tim kiem',
      '- recommendations: danh sach BDS phu hop (toi da 3), PHAI co sourceId',
      '- reason: ly do cu the tai sao BDS nay phu hop voi nhu cau nguoi dung',
      '- followUp: goi y tiep theo hoac cau hoi lam ro nhu cau',
      '- suggestedQuestions: 2-3 cau hoi goi y tiep theo',
      'Neu khong tim thay BDS nao: {"summary":"Hien tai minh chua tim thay BDS phu hop. Ban co the mo ta them nhu cau?","recommendations":[],"followUp":"","suggestedQuestions":["Tim nha duoi 3 ty","Tim dat nen gia re"]}',
    ];

    if (recentMemory.length > 0) {
      promptParts.push(
        `Lich su ngan: ${recentMemory.map((x) => `${x.role}: ${x.text}`).join(' || ')}`,
      );
    }

    if (conversation.summaryMemory) {
      promptParts.push(
        `Tong ket hoi thoai truoc do: ${conversation.summaryMemory}`,
      );
    }

    if (hasIntentFilter) {
      promptParts.push(`Intent: ${JSON.stringify(intent)}`);
    }

    promptParts.push(`CONTEXT:\n${context}`);
    promptParts.push(`CAU_HOI: ${question}`);

    const prompt = promptParts.join('\n\n');

    let answer = noDataAnswer;
    let structured: Record<string, unknown> | null = null;
    try {
      const llmStartedAt = Date.now();
      const genResp = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.chatModel,
          prompt,
          stream: false,
          options: {
            num_predict: this.chatNumPredict,
            temperature: 0.2,
          },
        },
        { timeout: this.ollamaTimeoutMs },
      );
      timings.llmMs = Date.now() - llmStartedAt;

      const rawAnswer = String(genResp.data?.response || noDataAnswer);
      structured = this.tryParseJson(rawAnswer);
      answer = this.toDisplayAnswer(structured, rawAnswer);
    } catch (error) {
      this.logger.warn(
        `LLM generate timeout/error, fallback to fast answer: ${this.stringifyError(error)}`,
      );
      structured = null;
      answer = this.toFastAnswer(hits);
    }

    // Extract suggestedQuestions from LLM structured output if available
    const llmSuggestions = Array.isArray(structured?.suggestedQuestions)
      ? (structured.suggestedQuestions as string[])
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 3)
      : [];
    const suggestedQuestions =
      llmSuggestions.length > 0 ? llmSuggestions : defaultSuggestions;

    await this.redis.set(
      responseCacheKey,
      {
        answer,
        sources: hits.map((h) => ({ ...h.payload, score: h.score })),
        relatedSources,
        suggestedQuestions,
        confidence: hits[0]?.score || 0,
      },
      this.responseCacheTtlSec,
    );

    if (this.logTimings) {
      this.logger.log(
        `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms llm=${timings.llmMs ?? 0}ms source=llm session=${sessionId}`,
      );
    }

    return this.returnChatWithMemory(sessionId, question, conversation, {
      answer,
      structured,
      intent,
      confidence: hits[0]?.score || 0,
      sources: hits.map((h) => ({ ...h.payload, score: h.score })),
      relatedSources,
      suggestedQuestions,
    });
  }

  private async getConversationState(
    sessionId: string,
  ): Promise<ConversationState> {
    const memoryKey = `ai:chat:${sessionId}`;
    const summaryKey = `ai:chat:summary:${sessionId}`;
    const memory = (await this.redis.get<ChatTurn[]>(memoryKey)) ?? [];
    const summaryMemory = (await this.redis.get<string>(summaryKey)) ?? '';

    return {
      memoryKey,
      summaryKey,
      memory,
      summaryMemory,
    };
  }

  private async returnChatWithMemory(
    sessionId: string,
    question: string,
    conversation: ConversationState,
    payload: ChatResponsePayload,
  ): Promise<ChatResult> {
    const updated = await this.updateConversationMemory(
      conversation.memoryKey,
      conversation.summaryKey,
      conversation.memory,
      conversation.summaryMemory,
      question,
      payload.answer,
    );

    return {
      ok: true,
      sessionId,
      ...payload,
      memoryTurns: updated.newMemory.length,
    };
  }

  private async handleGenerateContentFlow(
    sessionId: string,
    question: string,
    intent: ParsedIntent,
    conversation: ConversationState,
  ): Promise<ChatResult | null> {
    const shouldBypassContentFollowUp = [
      'compare_property',
      'booking',
      'upgrade_account',
      'upgrade_listing',
      'post_guide',
      'qa_real_estate',
      'greeting',
    ].includes(intent.type);

    if (
      this.isFollowUpToContentGeneration(conversation.memory) &&
      intent.type !== 'generate_content'
    ) {
      if (shouldBypassContentFollowUp) {
        return null;
      }

      const genAnswer =
        await this.descriptionGeneratorService.generatePropertyDescription(
          question,
          conversation,
        );
      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: genAnswer,
        structured: null,
        intent: { type: 'generate_content' },
        confidence: 1,
        sources: [],
        relatedSources: [],
        suggestedQuestions: [
          'Chỉnh sửa thêm mô tả này',
          'Tìm nhà dưới 3 tỷ',
          'So sánh 2 bất động sản phù hợp nhất',
        ],
      });
    }

    if (intent.type !== 'generate_content') return null;

    if (!this.hasPropertyDetails(question)) {
      const askAnswer = [
        'Mình sẽ giúp bạn soạn bài đăng bất động sản chuyên nghiệp!',
        '',
        'Bạn vui lòng cung cấp thông tin sau:',
        '- **Loại BĐS**: nhà phố / căn hộ / biệt thự / đất nền...',
        '- **Địa chỉ**: số nhà, đường, phường/xã, quận/huyện, tỉnh/thành',
        '- **Diện tích**: diện tích đất, diện tích sàn (m²)',
        '- **Giá**: giá bán hoặc giá cho thuê',
        '- **Số phòng ngủ, phòng tắm, số tầng** (nếu có)',
        '- **Hướng nhà/đất** (nếu biết)',
        '- **Pháp lý**: sổ hồng, sổ đỏ, đang chờ sổ...',
        '- **Điểm nổi bật**: tiện ích xung quanh, đặc điểm đặc biệt...',
        '',
        'Chỉ cần cung cấp thông tin trên, mình sẽ soạn bài đăng chất lượng cho bạn ngay!',
      ].join('\n');
      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: askAnswer,
        structured: null,
        intent,
        confidence: 1,
        sources: [],
        relatedSources: [],
        suggestedQuestions: [
          'Nhà phố 3PN 80m2 quận 7 TP.HCM giá 5 tỷ, sổ hồng',
          'Đất nền 120m2 Bình Dương 2 tỷ',
          'Căn hộ 2PN 65m2 Đà Nẵng 2.5 tỷ',
        ],
      });
    }

    const genAnswer =
      await this.descriptionGeneratorService.generatePropertyDescription(
        question,
        conversation,
      );
    return this.returnChatWithMemory(sessionId, question, conversation, {
      answer: genAnswer,
      structured: null,
      intent,
      confidence: 1,
      sources: [],
      relatedSources: [],
      suggestedQuestions: [
        'Chỉnh sửa thêm mô tả này',
        'Tìm nhà dưới 3 tỷ',
        'So sánh 2 bất động sản phù hợp nhất',
      ],
    });
  }

  private async handleCompareFlow(
    sessionId: string,
    question: string,
    intent: ParsedIntent,
    conversation: ConversationState,
  ): Promise<ChatResult | null> {
    if (intent.type !== 'compare_property') return null;

    if (intent.compareIds && intent.compareIds.length >= 2) {
      const compareAnswer = await this.compareService.buildCompareAnswer(
        intent.compareIds,
      );
      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: compareAnswer.answer,
        structured: null,
        intent,
        confidence: 1,
        sources: compareAnswer.sources,
        relatedSources: [],
        suggestedQuestions: compareAnswer.suggestedQuestions,
      });
    }

    // Strategy 1: user named two specific properties — search each separately
    if (intent.compareDescriptions && intent.compareDescriptions.length >= 2) {
      const idA = await this.compareService.findIdByDescription(
        intent.compareDescriptions[0],
      );
      const idB = await this.compareService.findIdByDescription(
        intent.compareDescriptions[1],
        idA ?? undefined,
      );
      if (idA !== null && idB !== null && idA !== idB) {
        const compareAnswer = await this.compareService.buildCompareAnswer([
          idA,
          idB,
        ]);
        return this.returnChatWithMemory(sessionId, question, conversation, {
          answer: compareAnswer.answer,
          structured: null,
          intent,
          confidence: 1,
          sources: compareAnswer.sources,
          relatedSources: [],
          suggestedQuestions: compareAnswer.suggestedQuestions,
        });
      }
    }

    // Strategy 2: referential language — use IDs from history
    if (
      !intent.compareDescriptions ||
      intent.compareDescriptions.length === 0
    ) {
      const historyIds = this.compareService.extractIdsFromHistory(
        conversation.memory,
      );
      if (historyIds.length >= 2) {
        const compareAnswer = await this.compareService.buildCompareAnswer(
          historyIds.slice(0, 3),
        );
        return this.returnChatWithMemory(sessionId, question, conversation, {
          answer: compareAnswer.answer,
          structured: null,
          intent,
          confidence: 1,
          sources: compareAnswer.sources,
          relatedSources: [],
          suggestedQuestions: compareAnswer.suggestedQuestions,
        });
      }
    }

    // Strategy 3: use filters to find candidates in DB
    const hasFilter =
      Boolean(intent.location) ||
      intent.minPrice !== undefined ||
      intent.maxPrice !== undefined ||
      Boolean(intent.sourceType);
    if (hasFilter) {
      const candidates = await this.findDbCandidatesByIntent(intent, 5);
      if (candidates.length >= 2) {
        const ids = candidates
          .slice(0, 3)
          .map((c) => Number(c.payload?.sourceId))
          .filter((id) => Number.isFinite(id) && id > 0);
        if (ids.length >= 2) {
          const compareAnswer =
            await this.compareService.buildCompareAnswer(ids);
          return this.returnChatWithMemory(sessionId, question, conversation, {
            answer: compareAnswer.answer,
            structured: null,
            intent,
            confidence: 1,
            sources: compareAnswer.sources,
            relatedSources: [],
            suggestedQuestions: compareAnswer.suggestedQuestions,
          });
        }
      }
    }

    const compareFailAnswer =
      'Mình chưa tìm thấy đủ thông tin để so sánh 2 bất động sản bạn yêu cầu. Bạn có thể:\n' +
      '- Gửi lại link của từng bất động sản cần so sánh\n' +
      '- Hoặc mô tả chi tiết hơn về địa chỉ từng BDS (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành)';
    return this.returnChatWithMemory(sessionId, question, conversation, {
      answer: compareFailAnswer,
      structured: null,
      intent,
      confidence: 0,
      sources: [],
      relatedSources: [],
      suggestedQuestions: [
        'Tìm nhà dưới 3 tỷ',
        'So sánh 2 bất động sản đang xem',
        'Kinh nghiệm mua nhà lần đầu',
      ],
    });
  }

  private async tryCachedChatResponse(
    sessionId: string,
    question: string,
    intent: ParsedIntent,
    responseCacheKey: string,
    conversation: ConversationState,
    timings: Record<string, number>,
    chatStartedAt: number,
  ): Promise<ChatResult | null> {
    const cacheStartedAt = Date.now();
    const cachedResponse = await this.redis.get<{
      answer: string;
      sources: ChatSourcePayload[];
      relatedSources?: ChatSourcePayload[];
      confidence: number;
      suggestedQuestions?: string[];
    }>(responseCacheKey);
    timings.cacheMs = Date.now() - cacheStartedAt;

    if (!cachedResponse) return null;

    if (this.logTimings) {
      this.logger.log(
        `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs}ms source=cache session=${sessionId}`,
      );
    }

    return this.returnChatWithMemory(sessionId, question, conversation, {
      answer: cachedResponse.answer,
      structured: null,
      intent,
      confidence: cachedResponse.confidence,
      sources: cachedResponse.sources,
      relatedSources: cachedResponse.relatedSources ?? [],
      suggestedQuestions: cachedResponse.suggestedQuestions ?? [],
    });
  }

  private async updateConversationMemory(
    memoryKey: string,
    summaryKey: string,
    memory: ChatTurn[],
    summaryMemory: string,
    question: string,
    answer: string,
  ): Promise<{ newMemory: ChatTurn[]; newSummary: string }> {
    const userTurn: ChatTurn = {
      role: 'user',
      text: question,
      at: new Date().toISOString(),
    };
    const assistantTurn: ChatTurn = {
      role: 'assistant',
      text: answer,
      at: new Date().toISOString(),
    };

    const newMemory: ChatTurn[] = [...memory, userTurn, assistantTurn].slice(
      -Math.max(2, this.chatHistoryMaxTurns),
    );

    const compactUser = this.compactMemoryText(question, 120);
    const compactAssistant = this.compactMemoryText(answer, 180);
    const newSummaryPiece = `U: ${compactUser} | A: ${compactAssistant}`;

    let newSummary = summaryMemory
      ? `${summaryMemory} || ${newSummaryPiece}`
      : newSummaryPiece;
    if (newSummary.length > this.chatSummaryMaxChars) {
      newSummary = `...${newSummary.slice(-(this.chatSummaryMaxChars - 3))}`;
    }

    await this.redis.set(memoryKey, newMemory, 24 * 60 * 60);
    await this.redis.set(summaryKey, newSummary, 24 * 60 * 60);

    return { newMemory, newSummary };
  }

  /**
   * Parse "so sánh <A> với <B>" into two property description strings.
   * Works on the raw (non-normalized) question to preserve property names.
   * Returns [] if the parts look like referential words ("nhà này", "cái đó", etc.)
   * rather than actual property descriptions.
   */
  private parseCompareDescriptions(question: string): string[] {
    // Remove leading compare trigger words
    const stripped = question
      .replace(
        /^(so\s+s[aá]nh|compare|so\s+v[oớ]i|h[aã]y\s+so\s+s[aá]nh)\s*/i,
        '',
      )
      .trim();

    // Split by connectors: " với ", " và ", " vs ", " or ", " hoặc "
    const splitRegex = /\s+(?:với|và|vs|or|hoặc)\s+/i;
    const parts = stripped
      .split(splitRegex)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (parts.length < 2) return [];

    // Referential words that mean "this one", "that one" — not actual property names
    const referentialPattern =
      /^(nh[aà]\s+n[aà]y|c[aá]i\s+n[aà]y|c[aá]n\s+n[aà]y|nh[aà]\s+[kđ][oóò]|c[aá]i\s+[kđ][oóò]|nh[aà]\s+kia|c[aá]i\s+kia|c[aá]i\s+tr[eê]n|c[aá]i\s+d[uư][oớ]i|hai\s+c[aá]i|2\s+c[aá]i|chu[nǹ]g|[cđ]h[uú]ng|nh[uư]ng\s+c[aá]i|v[uừ]a\s+tim|v[uừ]a\s+xem)$/i;

    const descriptions = parts.filter(
      (p) => !referentialPattern.test(p.trim()) && p.length >= 4,
    );

    return descriptions.length >= 2 ? descriptions.slice(0, 2) : [];
  }

  private buildIntentInstructions(intent: ParsedIntent): string {
    switch (intent.type) {
      case 'search_property':
        return [
          'NHIEM VU: Tim kiem BDS phu hop voi yeu cau.',
          'Phan tich: loai BDS (nha/dat), vi tri, khoang gia, dien tich, so phong.',
          'Giai thich ro tai sao moi BDS trong CONTEXT phu hop voi nhu cau.',
          intent.maxPrice
            ? `Ngan sach toi da: ${this.formatVnd(intent.maxPrice)}. Chi goi y BDS trong ngan sach.`
            : '',
          intent.location ? `Vi tri yeu cau: ${intent.location}.` : '',
        ]
          .filter(Boolean)
          .join('\n');

      case 'recommend_property':
        return [
          'NHIEM VU: Tu van va goi y BDS phu hop nhat voi nhu cau.',
          'Phan tich ky: ngan sach, so thanh vien gia dinh, vi tri uu tien, tien ich can thiet.',
          'Giai thich CHI TIET ly do goi y: vi tri tien loi, gia hop ly, dien tich du rong, tien ich gan.',
          'Neu thieu thong tin (ngan sach, vi tri), dat cau hoi lam ro trong followUp.',
          intent.maxPrice
            ? `Ngan sach nguoi dung: ${this.formatVnd(intent.maxPrice)}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

      case 'compare_property':
        return [
          'NHIEM VU: So sanh cac BDS trong CONTEXT theo tieu chi ro rang.',
          'So sanh theo: gia, gia/m², dien tich, vi tri, so phong ngu, uu/nhuoc diem.',
          'Ket luan: BDS nao phu hop nhat cho nhu cau gi cu the.',
          'Trong summary neu ro BDS nao re nhat, rong nhat, gia/m² tot nhat.',
        ].join('\n');

      case 'recommend_property':
        return 'NHIEM VU: Tu van BDS phu hop. Phan tich ngan sach, vi tri, nhu cau gia dinh. Giai thich ro ly do goi y.';

      default:
        return 'NHIEM VU: Tra loi cau hoi va goi y BDS phu hop tu CONTEXT.';
    }
  }

  private handleDirectIntent(
    intent: ParsedIntent,
    question: string,
  ): { answer: string; suggestedQuestions: string[] } | null {
    if (intent.type === 'greeting') {
      return {
        answer:
          'Xin chào! Mình là trợ lý AI bất động sản. Mình có thể giúp bạn tìm nhà, đất, tư vấn giá, hoặc giải đáp thắc mắc về bất động sản. Bạn cần hỗ trợ gì?',
        suggestedQuestions: [
          'Tìm nhà dưới 3 tỷ ở Đà Nẵng',
          'Sổ hồng là gì?',
          'Tìm đất nền giá rẻ',
          'Cách đặt lịch hẹn xem nhà',
          'Cách nâng cấp tài khoản VIP',
          'Gợi ý viết mô tả đăng bán nhà',
        ],
      };
    }

    if (intent.type === 'qa_real_estate') {
      const qaAnswer = this.answerQA(question);
      if (qaAnswer) return qaAnswer;
    }

    if (intent.type === 'booking') {
      return {
        answer: [
          '📅 **Hướng dẫn đặt lịch xem nhà/đất:**',
          '',
          '1. Mở trang **chi tiết** của bất động sản bạn muốn xem',
          `2. Bấm nút **"Đặt lịch xem"**`,
          '3. Chọn **ngày**, **khung giờ** và **thời lượng** muốn xem',
          '4. Xác nhận thông tin để gửi lịch',
          '',
          '**Cần chuẩn bị:**',
          '- Ngày muốn xem',
          '- Khung giờ cụ thể',
          '- Thời lượng dự kiến',
          '',
          'Sau khi đặt, nhân viên sẽ xác nhận lịch qua điện thoại. Bạn cần hỗ trợ tìm BĐS để đặt lịch không?',
        ].join('\n'),
        suggestedQuestions: [
          'Tìm nhà dưới 3 tỷ để xem',
          'Tìm đất nền Bình Dương',
          'Nhà cho thuê giá rẻ',
        ],
      };
    }

    if (intent.type === 'upgrade_account') {
      return {
        answer: [
          '👑 **Nâng cấp tài khoản VIP – Quyền lợi & Hướng dẫn:**',
          '',
          '**Quyền lợi tài khoản VIP:**',
          '✅ Đăng tin bất động sản không giới hạn',
          '✅ Tin đăng được hiển thị ưu tiên trên trang chủ & kết quả tìm kiếm',
          '✅ Hỗ trợ tư vấn từ chuyên viên BĐS',
          '✅ Truy cập báo cáo thị trường & thống kê chuyên sâu',
          '✅ Badge VIP nổi bật trên hồ sơ cá nhân',
          '',
          '**Cách nâng cấp:**',
          `1. Đăng nhập → Vào **Hồ sơ cá nhân**`,
          '2. Chọn mục **"Nâng cấp VIP"**',
          '3. Chọn gói phù hợp → Thanh toán → Kích hoạt ngay',
          '',
          'Bạn có câu hỏi về các gói VIP không?',
        ].join('\n'),
        suggestedQuestions: [
          'Hướng dẫn đăng bài viết BĐS',
          'Tìm đất nền giá rẻ',
          'Tìm nhà dưới 5 tỷ',
        ],
      };
    }

    if (intent.type === 'upgrade_listing') {
      return {
        answer:
          'Hiện chatbot chưa hỗ trợ hướng dẫn nâng cấp tin đăng trong luồng chat này. Bạn có thể thao tác trực tiếp trong trang quản lý tin đăng.',
        suggestedQuestions: [
          'Tìm nhà dưới 5 tỷ',
          'So sánh 2 bất động sản phù hợp nhất',
          'Nâng cấp tài khoản VIP',
        ],
      };
    }

    if (intent.type === 'post_guide') {
      return {
        answer:
          'Hiện chatbot chưa hỗ trợ hướng dẫn đăng bài trong luồng chat này.',
        suggestedQuestions: [
          'Tìm nhà dưới 3 tỷ',
          'So sánh 2 bất động sản đang xem',
          'Nâng cấp tài khoản VIP',
        ],
      };
    }

    if (intent.type === 'compare_property') {
      if (intent.compareIds && intent.compareIds.length >= 2) {
        // IDs were parsed — let RAG handle it with context
        return null;
      }
      // No explicit IDs — fall through to RAG search so the chatbot
      // can find matching properties and present them for comparison
      // instead of just showing instructions.
      return null;
    }

    return null;
  }

  /**
   * Returns true if the last assistant message in memory was asking the user
   * to supply property details for content generation.
   */
  private isFollowUpToContentGeneration(memory: ChatTurn[]): boolean {
    const lastAssistant = [...memory]
      .reverse()
      .find((t) => t.role === 'assistant');
    if (!lastAssistant) return false;
    const triggers = [
      'Loại BĐS',
      'soạn bài đăng',
      'Đặc điểm nổi bật',
      'mình sẽ soạn',
      'tạo mô tả',
      'Mình cần bạn cung cấp thông tin',
      'Chỉ cần cung cấp thông tin',
      'soạn bài đăng chất lượng cho bạn ngay',
      'soạn bài đăng bất động sản chuyên nghiệp',
    ];
    return triggers.some((t) => lastAssistant.text.includes(t));
  }

  /**
   * Returns true if the user's message contains enough property details
   * (location, area, price, room count, etc.) to generate a listing description.
   */
  private hasPropertyDetails(question: string): boolean {
    // If message is substantively long, assume it has details
    if (question.trim().length > 100) return true;

    const normalized = this.normalizeText(question);

    const hasLocation =
      /\b(quan|huyen|phuong|xa|duong|tinh|tp|thanh pho|ha noi|ho chi minh|da nang|binh duong|dong nai|vung tau|hue|can tho|nha trang)\b/.test(
        normalized,
      );
    const hasArea = /\b(\d+\s*m2|\d+\s*m²|\d+\s*met vuong|dien tich)\b/.test(
      normalized,
    );
    const hasPrice = /\b\d+(\.\d+)?\s*(ty|trieu|tr)\b/.test(normalized);
    const hasRooms =
      /\b(\d+\s*(phong ngu|pn|phong|tang)|so phong|so tang)\b/.test(normalized);
    const hasPropertyType =
      /\b(nha pho|can ho|biet thu|dat nen|chung cu|shophouse|nha cap 4)\b/.test(
        normalized,
      );

    const detailCount = [
      hasLocation,
      hasArea,
      hasPrice,
      hasRooms,
      hasPropertyType,
    ].filter(Boolean).length;
    return detailCount >= 2;
  }

  private answerQA(
    question: string,
  ): { answer: string; suggestedQuestions: string[] } | null {
    const normalized = this.normalizeText(question);
    const qaBank: {
      pattern: RegExp;
      answer: string;
      suggestedQuestions: string[];
    }[] = [
        {
          pattern: /\bso hong\b/,
          answer:
            'Sổ hồng (Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất) là văn bản pháp lý do Nhà nước cấp cho chủ sở hữu bất động sản. Đây là giấy tờ quan trọng nhất khi mua bán nhà đất, giúp đảm bảo quyền lợi hợp pháp của người sở hữu.\n\nLưu ý khi mua nhà:\n- Kiểm tra sổ hồng chính chủ\n- Xác minh thông tin trên sổ với thực tế\n- Kiểm tra có bị thế chấp hay tranh chấp không',
          suggestedQuestions: [
            'Sổ đỏ khác sổ hồng thế nào?',
            'Thủ tục mua bán nhà đất',
            'Tìm nhà có sổ hồng',
          ],
        },
        {
          pattern: /\bso do\b/,
          answer:
            'Sổ đỏ là tên gọi dân gian của Giấy chứng nhận quyền sử dụng đất (bìa đỏ). Hiện nay, sổ đỏ và sổ hồng đã được hợp nhất thành một loại giấy chứng nhận duy nhất, thường gọi chung là "sổ hồng".\n\nSự khác biệt trước đây:\n- Sổ đỏ: cấp cho đất không có nhà\n- Sổ hồng: cấp cho nhà ở và đất ở đô thị',
          suggestedQuestions: [
            'Sổ hồng là gì?',
            'Thủ tục sang tên sổ đỏ',
            'Tìm đất nền có sổ',
          ],
        },
        {
          pattern: /\b(cong chung|thu tuc|sang ten)\b/,
          answer:
            'Thủ tục công chứng mua bán nhà đất gồm các bước chính:\n1. Hai bên thỏa thuận giá và điều khoản\n2. Chuẩn bị hồ sơ: CMND/CCCD, sổ hồng, hợp đồng mua bán\n3. Công chứng hợp đồng tại văn phòng công chứng\n4. Nộp thuế (thuế thu nhập cá nhân 2%, lệ phí trước bạ 0.5%)\n5. Đăng ký sang tên tại Văn phòng đăng ký đất đai\n\nThời gian: khoảng 15-30 ngày làm việc.',
          suggestedQuestions: [
            'Phí công chứng bao nhiêu?',
            'Tìm nhà ở Đà Nẵng',
            'Kinh nghiệm mua nhà lần đầu',
          ],
        },
        {
          pattern:
            /\b(thue|phi|le phi|truoc ba)\b.*\b(mua|ban|nha|dat)\b|\b(mua|ban|nha|dat)\b.*\b(thue|phi|le phi)\b/,
          answer:
            'Các loại thuế/phí khi mua bán bất động sản:\n- Thuế thu nhập cá nhân (TNCN): 2% giá bán (người bán chịu)\n- Lệ phí trước bạ: 0.5% giá trị BĐS (người mua chịu)\n- Phí công chứng: theo biểu phí quy định\n- Phí thẩm định hồ sơ: khoảng 0.15% giá trị BĐS\n\nLưu ý: Một số trường hợp được miễn thuế TNCN (nhà duy nhất, sở hữu trên 5 năm...).',
          suggestedQuestions: [
            'Thủ tục mua bán nhà đất',
            'Sổ hồng là gì?',
            'Tìm nhà dưới 3 tỷ',
          ],
        },
        {
          pattern:
            /\b(kinh nghiem|luu y|loi khuyen)\b.*\b(mua)\b|\b(mua)\b.*\b(lan dau|luu y|kinh nghiem)\b/,
          answer:
            'Kinh nghiệm mua nhà lần đầu:\n1. Xác định ngân sách rõ ràng (bao gồm phí phát sinh)\n2. Ưu tiên vị trí: gần trường học, bệnh viện, chợ\n3. Kiểm tra pháp lý: sổ hồng, quy hoạch, tranh chấp\n4. Xem nhà thực tế nhiều lần, nhiều thời điểm\n5. Kiểm tra kết cấu, hệ thống điện nước\n6. So sánh giá với khu vực lân cận\n7. Thương lượng giá hợp lý\n8. Sử dụng dịch vụ công chứng uy tín\n\nĐừng vội vàng, hãy tìm hiểu kỹ trước khi quyết định!',
          suggestedQuestions: [
            'Tìm nhà dưới 3 tỷ',
            'Sổ hồng là gì?',
            'Thủ tục mua bán nhà đất',
          ],
        },
        {
          pattern: /\b(phong thuy|feng\s*shui|huong nha|tuoi)\b/,
          answer:
            'Phong thủy khi mua nhà là yếu tố nhiều người Việt quan tâm:\n- Hướng nhà: nên chọn hướng hợp tuổi gia chủ\n- Hình dáng đất: vuông vức là tốt nhất\n- Đường vào nhà: tránh ngõ cụt, đường đâm thẳng vào nhà\n- Xung quanh: tránh gần nghĩa trang, bệnh viện, đường cao tốc\n\nTuy nhiên, vị trí, giá cả và pháp lý vẫn là yếu tố quan trọng nhất khi quyết định mua.',
          suggestedQuestions: [
            'Tìm nhà hướng Đông',
            'Kinh nghiệm mua nhà lần đầu',
            'Tìm đất nền giá rẻ',
          ],
        },
      ];

    for (const qa of qaBank) {
      if (qa.pattern.test(normalized)) {
        return { answer: qa.answer, suggestedQuestions: qa.suggestedQuestions };
      }
    }

    return null;
  }

  private buildSuggestedQuestions(
    intent: ParsedIntent,
    hits: VectorHit[],
  ): string[] {
    const suggestions: string[] = [];
    const firstHit = hits[0]?.payload;

    // Suggest comparing when multiple results are found
    if (hits.length >= 2) {
      const id1 = Number(hits[0]?.payload?.sourceId);
      const id2 = Number(hits[1]?.payload?.sourceId);
      if (Number.isFinite(id1) && id1 > 0 && Number.isFinite(id2) && id2 > 0) {
        suggestions.push('So sánh 2 bất động sản phù hợp nhất');
      }
    }

    if (firstHit) {
      const city = String(firstHit.city || '');
      const source = String(firstHit.source || '');
      if (city) {
        suggestions.push(
          `Tìm ${source === 'land' ? 'đất' : 'nhà'} khác ở ${city}`,
        );
      }
    }

    if (intent.minPrice || intent.maxPrice) {
      suggestions.push('Xem thêm bất động sản giá tương tự');
    } else {
      suggestions.push('Tìm nhà dưới 3 tỷ');
    }

    if (!intent.location) {
      suggestions.push('Tìm bất động sản ở Đà Nẵng');
    }

    if (suggestions.length < 3) {
      suggestions.push('Kinh nghiệm mua nhà lần đầu');
    }

    return suggestions.slice(0, 3);
  }

  private compactMemoryText(value: string, limit: number): string {
    const oneLine = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (oneLine.length <= limit) return oneLine;
    return `${oneLine.slice(0, Math.max(0, limit - 3))}...`;
  }

  private async findDbCandidatesByIntent(
    intent: ParsedIntent,
    limit: number,
  ): Promise<VectorHit[]> {
    const houseWhere: Record<string, unknown> = { status: 1 };
    const landWhere: Record<string, unknown> = { status: 1 };

    if (intent.minPrice !== undefined || intent.maxPrice !== undefined) {
      houseWhere.price = {
        ...(intent.minPrice !== undefined ? { gte: intent.minPrice } : {}),
        ...(intent.maxPrice !== undefined ? { lte: intent.maxPrice } : {}),
      };
      landWhere.price = {
        ...(intent.minPrice !== undefined ? { gte: intent.minPrice } : {}),
        ...(intent.maxPrice !== undefined ? { lte: intent.maxPrice } : {}),
      };
    }

    const fetchLimit = Math.max(limit * 20, 120);

    const [houses, lands] = await Promise.all([
      this.prisma.house.findMany({
        where: houseWhere,
        orderBy: { updatedAt: 'desc' },
        take: fetchLimit,
      }),
      this.prisma.land.findMany({
        where: landWhere,
        orderBy: { updatedAt: 'desc' },
        take: fetchLimit,
      }),
    ]);

    const docs: VectorHit[] = [
      ...houses
        .map((h) => this.houseToDoc(h))
        .map((d) => ({ id: d.id, score: 0.15, payload: d.payload })),
      ...lands
        .map((l) => this.landToDoc(l))
        .map((d) => ({ id: d.id, score: 0.15, payload: d.payload })),
    ];

    const locationFiltered = this.applyIntentFilter(docs, intent);
    return locationFiltered.slice(0, limit);
  }

  private async ensureCollection(size: number) {
    try {
      await axios.put(`${this.qdrantUrl}/collections/${this.ragCollection}`, {
        vectors: { size, distance: 'Cosine' },
      });
    } catch (error) {
      this.logger.warn(
        `ensureCollection warning: ${this.stringifyError(error)}`,
      );
    }
  }

  private async embed(input: string): Promise<number[]> {
    const resp = await axios.post(
      `${this.ollamaUrl}/api/embed`,
      {
        model: this.embedModel,
        input,
      },
      { timeout: this.embedTimeoutMs },
    );

    const vector = resp.data?.embeddings?.[0] || resp.data?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Embedding vector is empty');
    }

    return vector;
  }

  private async getCachedQueryEmbedding(question: string): Promise<number[]> {
    const normalized = this.normalizeText(question);
    const cacheKey = `ai:embed:q:${encodeURIComponent(normalized).slice(0, 200)}`;
    const cached = await this.redis.get<number[]>(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const vector = await this.embed(question);
    await this.redis.set(cacheKey, vector, this.embedCacheTtlSec);
    return vector;
  }

  private houseToDoc(house: Record<string, unknown>): IndexedDoc {
    const id = 1_000_000 + Number(house.id || 0);
    const price = this.toNumber(house.price);
    const area = this.toNumber(house.area);
    const bedrooms = Number(house.bedrooms ?? 0);
    const bathrooms = Number(house.bathrooms ?? 0);
    const floors = Number(house.floors ?? 0);
    const direction = String(house.direction || '');

    const payload: Record<string, unknown> = {
      source: 'house',
      sourceId: house.id,
      title: house.title || '',
      city: house.city || '',
      district: house.district || '',
      ward: house.ward || '',
      street: house.street || '',
      price,
      area,
      bedrooms,
      bathrooms,
      floors,
      direction,
      description: house.description || '',
      url: `${this.frontendUrl}/houses/${house.id}`,
    };

    const text = [
      `Loai: Nha`,
      `Tieu de: ${payload.title}`,
      `Vi tri: ${payload.street}, ${payload.ward}, ${payload.district}, ${payload.city}`,
      `Gia: ${payload.price}`,
      `Dien tich: ${payload.area}`,
      bedrooms > 0 ? `Phong ngu: ${bedrooms}` : '',
      bathrooms > 0 ? `Phong tam: ${bathrooms}` : '',
      floors > 0 ? `So tang: ${floors}` : '',
      direction ? `Huong: ${direction}` : '',
      `Mo ta: ${String(house.description || '')}`,
    ]
      .filter(Boolean)
      .join('\n');

    return { id, text, payload };
  }

  private landToDoc(land: Record<string, unknown>): IndexedDoc {
    const id = 2_000_000 + Number(land.id || 0);
    const price = this.toNumber(land.price);
    const area = this.toNumber(land.area);
    const direction = String(land.direction || '');
    const legalStatus = String(land.legalStatus || land.legal_status || '');
    const landType = String(land.landType || land.land_type || '');
    const frontWidth = this.toNumber(land.frontWidth ?? land.front_width);

    const payload: Record<string, unknown> = {
      source: 'land',
      sourceId: land.id,
      title: land.title || '',
      city: land.city || '',
      district: land.district || '',
      ward: land.ward || '',
      street: land.street || '',
      price,
      area,
      direction,
      legalStatus,
      landType,
      frontWidth,
      description: land.description || '',
      url: `${this.frontendUrl}/lands/${land.id}`,
    };

    const text = [
      `Loai: Dat`,
      `Tieu de: ${payload.title}`,
      `Vi tri: ${payload.street}, ${payload.ward}, ${payload.district}, ${payload.city}`,
      `Gia: ${payload.price}`,
      `Dien tich: ${payload.area}`,
      direction ? `Huong: ${direction}` : '',
      legalStatus ? `Phap ly: ${legalStatus}` : '',
      landType ? `Loai dat: ${landType}` : '',
      frontWidth > 0 ? `Mat tien: ${frontWidth}m` : '',
      `Mo ta: ${String(land.description || '')}`,
    ]
      .filter(Boolean)
      .join('\n');

    return { id, text, payload };
  }

  private postToDoc(post: Record<string, unknown>): IndexedDoc {
    const id = 3_000_000 + Number(post.id || 0);
    const price = this.toNumber(post.price);
    const area = this.toNumber(post.area);

    const payload: Record<string, unknown> = {
      source: 'post',
      sourceId: post.id,
      title: post.title || '',
      city: post.city || '',
      district: post.district || '',
      ward: post.ward || '',
      street: post.address || '',
      price,
      area,
      description: post.description || '',
      url: `${this.frontendUrl}/posts/${post.id}`,
    };

    const text = [
      `Loai: Bai dang`,
      `Tieu de: ${payload.title}`,
      `Vi tri: ${payload.street}, ${payload.ward}, ${payload.district}, ${payload.city}`,
      `Gia: ${payload.price}`,
      `Dien tich: ${payload.area}`,
      `Mo ta: ${String(post.description || '')}`,
    ].join('\n');

    return { id, text, payload };
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const num = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(num) ? num : 0;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private parseIntent(question: string): ParsedIntent {
    const normalized = this.normalizeText(question);
    const intent: ParsedIntent = { type: 'unknown' };

    // --- Classify intent type ---
    if (/^(xin chao|hello|hi|hey|chao ban|chao|alo)\b/.test(normalized)) {
      intent.type = 'greeting';
      return intent;
    }

    if (/\b(so sanh|compare|khac nhau|giong nhau)\b/.test(normalized)) {
      intent.type = 'compare_property';
      // Only match explicit property IDs: preceded by 'id', 'ma tin', 'so', 'can', 'tin'
      // OR large numbers (>=100) that can't be district/ward numbers
      const explicitIdMatches = normalized.match(
        /\b(?:id|ma tin|ma|so|can|tin)\s*(\d+)\b/gi,
      );
      const largeNumbers = [...normalized.matchAll(/\b(\d{3,})\b/g)].map(
        (m: RegExpMatchArray) => m[1],
      );
      const allIds = [
        ...(explicitIdMatches ?? []).map((m) => m.replace(/\D/g, '')),
        ...largeNumbers,
      ]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
      if (allIds.length >= 2) {
        intent.compareIds = [...new Set(allIds)].slice(0, 5);
      } else {
        // Try to extract two property descriptions: "so sánh <A> với <B>"
        const descParts = this.parseCompareDescriptions(question);
        if (descParts.length >= 2) {
          intent.compareDescriptions = descParts;
        }
      }
    } else if (
      /\b(so sanh|compare)\b.*\b(nha nay|cai nay|can nay|tin nay|nha do|cai do|can do|tin do|nha kia|cai kia|2 cai|hai cai|nhung cai|chung|vua tim|vua xem|tren|do|chung|nay voi|voi nhau)\b|\b(nha nay|cai nay|hai cai|2 cai|vua tim)\b.*\b(so sanh|compare|voi|va)\b/.test(
        normalized,
      )
    ) {
      // Referential compare: user is referring to properties seen in recent chat history
      intent.type = 'compare_property';
    } else if (
      /\b(dat lich|book|hen|xem nha|lich hen|lich xem)\b/.test(normalized)
    ) {
      intent.type = 'booking';
    } else if (
      /\b(nang cap|upgrade|vip|premium|pro)\b/.test(normalized) &&
      /\b(tai khoan|account)\b/.test(normalized)
    ) {
      intent.type = 'upgrade_account';
    } else if (
      /\b(nang cap|upgrade|vip|premium|day tin|tin noi bat)\b/.test(
        normalized,
      ) &&
      /\b(tin|listing|bai dang)\b/.test(normalized)
    ) {
      intent.type = 'upgrade_listing';
    } else if (
      /\b(huong dan dang|cach dang|dang bai|dang tin|lam sao dang|muon dang)\b/.test(
        normalized,
      ) &&
      !/\b(viet|tao|soan|mo ta|gen)\b/.test(normalized)
    ) {
      intent.type = 'post_guide';
    } else if (
      /\b(viet bai|tao bai|generate|soan noi dung|viet mo ta|tao mo ta|gen mo ta|soan mo ta)\b/.test(
        normalized,
      ) ||
      (/\b(viet|soan|tao|gen|giup)\b/.test(normalized) &&
        /\b(mo ta|bai dang|noi dung|bai viet)\b/.test(normalized)) ||
      (/\bmo ta\b/.test(normalized) && /\b(ban|cho thue)\b/.test(normalized))
    ) {
      intent.type = 'generate_content';
    } else if (
      /\b(la gi|nghia la|the nao|thu tuc|phap ly|so hong|so do|cong chung|phi)\b/.test(
        normalized,
      ) &&
      !/\b(tim|mua|ban|gia|ty|trieu)\b/.test(normalized)
    ) {
      intent.type = 'qa_real_estate';
    } else if (
      /\b(kinh nghiem|luu y|loi khuyen)\b/.test(normalized) &&
      !/\b(tim|gia|ty|trieu)\b/.test(normalized)
    ) {
      // "kinh nghiem mua nha" is a QA even though it contains "mua"
      intent.type = 'qa_real_estate';
    } else if (
      /\b(nen mua|goi y|tu van|recommend|phu hop|nhu cau)\b/.test(normalized)
    ) {
      intent.type = 'recommend_property';
    } else if (
      /\b(tim|search|can|mua|ban|thue|cho thue|gia|ty|trieu|dat|nha|can ho|chung cu)\b/.test(
        normalized,
      )
    ) {
      intent.type = 'search_property';
    }

    // --- Parse price filters ---
    const rangeMatch = normalized.match(
      /tu\s+([0-9.,]+)\s*(ty|trieu|tr)?\s+(den|toi|-)\s+([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (rangeMatch) {
      const min = this.toVnd(rangeMatch[1], rangeMatch[2]);
      const max = this.toVnd(rangeMatch[4], rangeMatch[5]);
      if (min !== undefined && max !== undefined) {
        intent.minPrice = Math.min(min, max);
        intent.maxPrice = Math.max(min, max);
      }
    }

    const underMatch = normalized.match(
      /(duoi|nho hon|<|<=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (underMatch) {
      const max = this.toVnd(underMatch[2], underMatch[3]);
      if (max !== undefined) intent.maxPrice = max;
    }

    const overMatch = normalized.match(
      /(tren|lon hon|>|>=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/,
    );
    if (overMatch) {
      const min = this.toVnd(overMatch[2], overMatch[3]);
      if (min !== undefined) intent.minPrice = min;
    }

    // Budget phrasing: "có X tỷ", "ngân sách X tỷ", "khoảng X tỷ", "tầm X tỷ"
    if (intent.maxPrice === undefined && intent.minPrice === undefined) {
      const budgetMatch = normalized.match(
        /(?:co|ngan sach|khoang|tam|budget)\s+([0-9.,]+)\s*(ty|trieu|tr)?/,
      );
      if (budgetMatch) {
        const budget = this.toVnd(budgetMatch[1], budgetMatch[2]);
        if (budget !== undefined) intent.maxPrice = budget;
      }
    }

    // Bare price like "2 tỷ" or "500 triệu" without a qualifier
    if (intent.maxPrice === undefined && intent.minPrice === undefined) {
      const bareMatch = normalized.match(/\b([0-9.,]+)\s*(ty|trieu|tr)\b/);
      if (bareMatch) {
        const price = this.toVnd(bareMatch[1], bareMatch[2]);
        if (price !== undefined) {
          // Treat bare price as maxPrice (budget ceiling) for search/recommend
          if (
            /\b(tim|can|mua|co|ngan sach|nen mua|goi y|tu van)\b/.test(
              normalized,
            )
          ) {
            intent.maxPrice = price;
          }
        }
      }
    }

    // For price-containing queries, default to search/recommend if not yet classified
    if (
      intent.type === 'unknown' &&
      (intent.minPrice !== undefined || intent.maxPrice !== undefined)
    ) {
      intent.type = 'search_property';
    }

    // --- Parse location ---
    const locationMatch = normalized.match(
      /(?:o|tai|khu vuc|gan)\s+([a-z0-9\s]+)$/,
    );
    if (locationMatch) {
      const location = locationMatch[1].trim();
      if (location.length >= 2) intent.location = location;
    }

    // --- Parse source type ---
    if (/\b(chung cu|can ho|apartment)\b/.test(normalized)) {
      intent.sourceType = 'house';
    } else if (/\b(nha|biet thu|townhouse)\b/.test(normalized)) {
      intent.sourceType = 'house';
    } else if (/\b(dat|nen)\b/.test(normalized)) {
      intent.sourceType = 'land';
    }

    if (/\b(nong nghiep|vuon|trong cay)\b/.test(normalized)) {
      intent.sourceType = 'land';
    }

    // --- Parse required keyword (property feature filter) ---
    const requiredKeywordMap: Array<[RegExp, string]> = [
      [/\b(mat tien|mat duong|truoc mat|thoang mat|lo goc)\b/, 'mat tien'],
      [/\b(hem ngo|hem xe|hem|ngo)\b/, 'hem'],
      [/\b(view bien|nhin bien|gan bien|ven bien)\b/, 'bien'],
      [/\b(gara|garage|san xe o to)\b/, 'gara'],
      [/\b(san vuon|co vuon|vuon rau)\b/, 'vuon'],
      [/\b(ho boi|boi loi)\b/, 'ho boi'],
      [/\b(thang may|elevator)\b/, 'thang may'],
      [/\b(nha pho|lien ke)\b/, 'nha pho'],
    ];
    for (const [pattern, kw] of requiredKeywordMap) {
      if (pattern.test(normalized)) {
        intent.requiredKeyword = kw;
        break;
      }
    }

    return intent;
  }

  private applyIntentFilter<T extends { payload: Record<string, unknown> }>(
    hits: T[],
    intent: ParsedIntent,
  ): T[] {
    const hasPriceFilter =
      intent.minPrice !== undefined || intent.maxPrice !== undefined;
    const hasLocationFilter = Boolean(intent.location);
    const hasSourceFilter =
      Boolean(intent.sourceType) || Boolean(intent.requiredKeyword);
    if (!hasPriceFilter && !hasLocationFilter && !hasSourceFilter) return hits;

    const filtered = hits.filter((hit) => {
      const payload = hit.payload || {};
      const price = this.toNumber(payload.price);

      // When a price filter is active, exclude items with unknown/zero price
      // because they cannot be verified against the user's budget.
      if (hasPriceFilter && price <= 0) return false;

      if (intent.minPrice !== undefined && price < intent.minPrice)
        return false;
      if (intent.maxPrice !== undefined && price > intent.maxPrice)
        return false;

      if (intent.location) {
        const searchable = [
          payload.city,
          payload.district,
          payload.ward,
          payload.street,
        ]
          .map((x) => this.normalizeText(String(x || '')))
          .join(' ');

        if (!searchable.includes(this.normalizeText(intent.location)))
          return false;
      }

      if (intent.sourceType) {
        const source = String(payload.source || '');
        if (source !== intent.sourceType) return false;
      }

      if (intent.requiredKeyword) {
        const needle = this.normalizeText(intent.requiredKeyword);
        const haystack = [
          payload.title,
          payload.description,
          payload.street,
          payload.ward,
          payload.district,
        ]
          .map((x) => this.normalizeText(String(x || '')))
          .join(' ');
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });

    return filtered;
  }

  private buildRelatedSources(
    pool: VectorHit[],
    primaryHits: VectorHit[],
    intent: ParsedIntent,
    limit = 3,
  ): ChatSourcePayload[] {
    if (pool.length === 0 || limit <= 0) return [];

    const primaryIds = new Set(primaryHits.map((h) => String(h.id)));
    const dedupe = new Set<string>();
    const locationNeedle = intent.location
      ? this.normalizeText(intent.location)
      : '';

    let candidates = pool.filter((h) => !primaryIds.has(String(h.id)));

    if (intent.sourceType) {
      const differentType = candidates.filter(
        (h) => String(h.payload?.source || '') !== intent.sourceType,
      );
      const sameType = candidates.filter(
        (h) => String(h.payload?.source || '') === intent.sourceType,
      );
      candidates = [...differentType, ...sameType];
    }

    if (locationNeedle) {
      const strongLocation = candidates.filter((h) => {
        const p = h.payload || {};
        const loc = [p.city, p.district, p.ward, p.street]
          .map((x) => this.normalizeText(String(x || '')))
          .join(' ');
        return loc.includes(locationNeedle);
      });

      const weakLocation = candidates.filter(
        (h) => !strongLocation.includes(h),
      );
      candidates = [...strongLocation, ...weakLocation];
    }

    const out: ChatSourcePayload[] = [];
    for (const hit of candidates) {
      const p = hit.payload || {};
      const key = `${String(p.source || '')}:${String(p.sourceId || hit.id)}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      out.push({ ...p, score: hit.score });
      if (out.length >= limit) break;
    }

    return out;
  }

  private async findRelatedFromDb(
    intent: ParsedIntent,
    primaryHits: VectorHit[],
    existingRelated: ChatSourcePayload[],
    limit: number,
  ): Promise<ChatSourcePayload[]> {
    if (limit <= 0) return [];

    const [houses, lands] = await Promise.all([
      this.prisma.house.findMany({
        where: { status: 1 },
        orderBy: { updatedAt: 'desc' },
        take: 120,
      }),
      this.prisma.land.findMany({
        where: { status: 1 },
        orderBy: { updatedAt: 'desc' },
        take: 120,
      }),
    ]);

    const docs: ChatSourcePayload[] = [
      ...houses.map((h) => this.houseToDoc(h).payload),
      ...lands.map((l) => this.landToDoc(l).payload),
    ];

    const excluded = new Set<string>();
    primaryHits.forEach((h) => {
      const p = h.payload || {};
      excluded.add(`${String(p.source || '')}:${String(p.sourceId || '')}`);
    });
    existingRelated.forEach((p) => {
      excluded.add(`${String(p.source || '')}:${String(p.sourceId || '')}`);
    });

    const tokens = (intent.location || '')
      .split(/\s+/)
      .map((x) => this.normalizeText(x))
      .filter((x) => x.length >= 2);

    return docs
      .filter((p) => {
        const key = `${String(p.source || '')}:${String(p.sourceId || '')}`;
        return !excluded.has(key);
      })
      .map((p) => {
        const source = String(p.source || '');
        const loc = [p.city, p.district, p.ward, p.street]
          .map((x) => this.normalizeText(String(x || '')))
          .join(' ');
        const txt = [p.title, p.description]
          .map((x) => this.normalizeText(String(x || '')))
          .join(' ');

        let score = 0;
        if (intent.sourceType && source !== intent.sourceType) score += 2;
        if (intent.sourceType && source === intent.sourceType) score += 1;

        if (tokens.length > 0) {
          const tokenHits = tokens.filter(
            (t) => loc.includes(t) || txt.includes(t),
          ).length;
          score += tokenHits;
        }

        return { payload: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.payload);
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toVnd(amountText: string, unit?: string): number | undefined {
    const amount = Number(String(amountText).replace(/,/g, '.'));
    if (!Number.isFinite(amount)) return undefined;

    const normalizedUnit = (unit || '').toLowerCase();
    if (normalizedUnit === 'ty') return amount * 1_000_000_000;
    if (normalizedUnit === 'trieu' || normalizedUnit === 'tr')
      return amount * 1_000_000;

    // Default to ty if user says "6" in real-estate context.
    return amount >= 1000 ? amount : amount * 1_000_000_000;
  }

  private tryParseJson(raw: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object')
        return parsed as Record<string, unknown>;
      return null;
    } catch {
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try {
          const sliced = raw.slice(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(sliced);
          if (parsed && typeof parsed === 'object')
            return parsed as Record<string, unknown>;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private toDisplayAnswer(
    structured: Record<string, unknown> | null,
    raw: string,
  ): string {
    if (!structured) return raw;

    const summary = String(structured.summary || '').trim();
    const recs = Array.isArray(structured.recommendations)
      ? (structured.recommendations as Array<Record<string, unknown>>)
      : [];
    const followUp = String(structured.followUp || '').trim();

    const lines: string[] = [];
    if (summary) lines.push(summary);

    if (recs.length > 0) {
      lines.push('');
      lines.push('Gợi ý:');
      recs.slice(0, 5).forEach((r, idx) => {
        lines.push(
          this.formatSuggestionBlock(idx + 1, {
            title: r.title,
            location: r.location,
            price: r.price,
            area: r.area,
            bedrooms: r.bedrooms,
            floors: r.floors,
            direction: r.direction,
            url: r.url,
            source: r.source,
            sourceId: r.sourceId,
            reason: r.reason,
          }),
        );
      });
    }

    if (followUp) {
      lines.push('');
      lines.push(`Gợi ý tiếp: ${followUp}`);
    }

    return lines.join('\n').trim() || raw;
  }

  private toFastAnswer(hits: VectorHit[]): string {
    const recs = hits.slice(0, 3).map((h) => h.payload || {});
    if (recs.length === 0) {
      return 'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.';
    }

    const first = recs[0];
    const lines: string[] = [];
    lines.push(`Mình tìm thấy ${recs.length} gợi ý phù hợp nhất.`);
    lines.push('');
    lines.push('Gợi ý:');

    recs.forEach((r, idx) => {
      lines.push(
        this.formatSuggestionBlock(idx + 1, {
          title: r.title,
          location:
            [r.street, r.ward, r.district, r.city].filter(Boolean).join(', ') ||
            `${String(r.district || 'N/A')}, ${String(r.city || 'N/A')}`,
          price: r.price,
          area: r.area,
          bedrooms: r.bedrooms,
          floors: r.floors,
          direction: r.direction,
          url: r.url,
          source: r.source,
          sourceId: r.sourceId,
        }),
      );
    });

    lines.push('');
    lines.push(
      `Bạn muốn mình lọc kỹ hơn theo khu vực ${String(first.city || '')} hoặc theo khoảng giá cụ thể không?`,
    );

    return lines.join('\n').trim();
  }

  private formatSuggestionBlock(
    index: number,
    item: {
      title?: unknown;
      location?: unknown;
      price?: unknown;
      area?: unknown;
      bedrooms?: unknown;
      floors?: unknown;
      direction?: unknown;
      url?: unknown;
      source?: unknown;
      sourceId?: unknown;
      reason?: unknown;
    },
  ): string {
    const title = String(item.title || 'N/A');
    const location = String(item.location || 'N/A');
    const price = this.formatVnd(item.price);
    const area = this.formatArea(item.area);
    const url = this.normalizeDetailUrl(item.url, item.source, item.sourceId);
    const reason = String(item.reason || '').trim();
    const bedrooms = Number(item.bedrooms ?? 0);
    const floors = Number(item.floors ?? 0);
    const direction = String(item.direction || '').trim();

    const sourceId = Number(item.sourceId);
    const sourceLabel = String(item.source || '').toUpperCase();
    const hasDetail = Number.isFinite(sourceId) && sourceId > 0;

    const lines: string[] = [];
    lines.push(`${index}. ${sourceLabel ? `${sourceLabel} ` : ''}${title}`);
    lines.push(`   - ${location}`);
    lines.push(`   - Giá: ${price}`);
    lines.push(`   - Diện tích: ${area}`);
    if (bedrooms > 0) lines.push(`   - Phòng ngủ: ${bedrooms} phòng`);
    if (floors > 0) lines.push(`   - Số tầng: ${floors}`);
    if (direction) lines.push(`   - Hướng: ${direction}`);
    if (reason) lines.push(`   - Lý do: ${reason}`);
    if (url && hasDetail) lines.push(`   - Xem chi tiết: ${url}`);

    return lines.join('\n');
  }

  private normalizeDetailUrl(
    url: unknown,
    source: unknown,
    sourceId: unknown,
  ): string {
    const src = String(source || '').toLowerCase();
    const id = Number(sourceId);
    const sourceRoute: Record<string, string> = {
      house: 'houses',
      land: 'lands',
      post: 'posts',
    };

    if (Number.isFinite(id) && id > 0 && sourceRoute[src]) {
      return `${this.frontendUrl}/${sourceRoute[src]}/${id}`;
    }

    const rawUrl = String(url || '').trim();
    if (!rawUrl) return '';

    const apiMatch = rawUrl.match(/\/api\/(houses|lands|posts)\/(\d+)/i);
    if (apiMatch) {
      return `${this.frontendUrl}/${apiMatch[1].toLowerCase()}/${apiMatch[2]}`;
    }

    return rawUrl;
  }

  private formatVnd(value: unknown): string {
    const amount = this.toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} VNĐ`;
  }

  private formatArea(value: unknown): string {
    const area = this.toNumber(value);
    if (!Number.isFinite(area) || area <= 0) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(area)} m²`;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const safeConcurrency = Math.max(
      1,
      Number.isFinite(concurrency) ? Math.floor(concurrency) : 4,
    );
    const results: R[] = new Array(items.length);
    let current = 0;

    const worker = async () => {
      while (current < items.length) {
        const index = current;
        current += 1;
        results[index] = await mapper(items[index], index);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(safeConcurrency, items.length) }, () =>
        worker(),
      ),
    );
    return results;
  }

  async generateDescription(
    dto: GenerateDescriptionDto,
    userId?: number,
    roles: string[] = [],
  ): Promise<{ description: string }> {
    // ADMIN và EMPLOYEE không cần VIP — bypass luôn
    const isPrivileged = roles.includes('ADMIN') || roles.includes('EMPLOYEE');

    if (!isPrivileged && userId) {
      // Chỉ CUSTOMER mới cần kiểm tra VIP
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isVip: true, vipExpiry: true },
      });

      const isVipActive =
        user?.isVip === true &&
        user.vipExpiry !== null &&
        user.vipExpiry !== undefined &&
        new Date(user.vipExpiry) > new Date();

      if (!isVipActive) {
        throw new ForbiddenException(
          'Tính năng tạo mô tả tự động bằng AI chỉ dành cho tài khoản VIP. Vui lòng nâng cấp tài khoản.',
        );
      }
    }

    return this.descriptionGeneratorService.generateDescription(dto);
  }
}

