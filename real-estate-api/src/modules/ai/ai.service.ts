import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { AiChatCompareService } from './ai-chat-compare.service';
import {
  DescriptionGeneratorService,
  AiQAService,
  UserProfileService,
  MarketInsightService,
  ConsultationFlowService,
  FinancingAdvisorService,
} from './services';
import {
  IndexedDoc,
  ChatTurn,
  IntentType,
  ParsedIntent,
  VectorHit,
  ChatSourcePayload,
  ConversationState,
  ChatResponsePayload,
  ChatResult,
} from './types/ai.types';
import { AiUtils } from './utils/ai.utils';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly frontendUrl =
    process.env.FRONTEND_URL || 'http://localhost:3000';
  private readonly qdrantUrl =
    process.env.QDRANT_URL || 'http://real-estate-qdrant:6333';
  private readonly ollamaUrl =
    process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
  private readonly ragCollection =
    process.env.RAG_COLLECTION || 'real_estate_rag';
  // Gemini config (LLM chat only — embedding still uses Ollama nomic-embed-text)
  private readonly geminiApiKey = process.env.GEMINI_API_KEY || '';
  private readonly geminiChatModel =
    process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.5-flash';
  private readonly geminiApiBase =
    process.env.GEMINI_API_URL ||
    'https://generativelanguage.googleapis.com/v1beta';
  // Ollama embed model (lightweight ~274MB, runs fine on VPS)
  private readonly embedModel = process.env.EMBED_MODEL || 'nomic-embed-text';
  private readonly retrievalTopK = Number(process.env.RAG_TOP_K || 8);
  private readonly contextTopK = Number(process.env.RAG_CONTEXT_K || 5);
  private readonly minScore = Number(process.env.RAG_MIN_SCORE || 0.18);
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
    process.env.RAG_DESCRIPTION_CHARS || 120,
  );
  private readonly embedCacheTtlSec = Number(
    process.env.EMBED_QUERY_CACHE_TTL || 600,
  );
  private readonly responseCacheTtlSec = Number(
    process.env.RAG_RESPONSE_CACHE_TTL || 120,
  );
  private readonly lastSourcesTtlSec = Number(
    process.env.RAG_LAST_SOURCES_TTL || 1800,
  );
  private readonly enableChatCache = false;
  private readonly enableLastSources = true;
  private readonly enableLlm =
    String(process.env.RAG_ENABLE_LLM || 'true').toLowerCase() !== 'false';
  // Fast mode disabled by default — Gemini needs to reason for accurate results
  private readonly fastMode =
    String(process.env.RAG_FAST_MODE || 'false').toLowerCase() === 'true';
  private readonly geminiTimeoutMs = Number(
    process.env.GEMINI_TIMEOUT_MS || 15000,
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
    private readonly qaService: AiQAService,
    private readonly userProfileService: UserProfileService,
    private readonly marketInsightService: MarketInsightService,
    private readonly consultationFlowService: ConsultationFlowService,
    private readonly financingAdvisorService: FinancingAdvisorService,
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
      const sparse = AiUtils.buildBm25SparseVector(doc.text);
      await axios.put(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points?wait=true`,
        {
          points: [
            {
              id: doc.id,
              vector: {
                dense: vector,
                ...(sparse.indices.length > 0
                  ? { sparse: { indices: sparse.indices, values: sparse.values } }
                  : {}),
              },
              payload: doc.payload,
            },
          ],
        },
      );
      this.logger.log(`Indexed ${type}:${id} (qdrant id=${doc.id})`);
    } catch (error) {
      this.logger.warn(
        `indexOne(${type}:${id}) failed: ${AiUtils.stringifyError(error)}`,
      );
    }
  }

  async indexData(limit = 200) {
    const [houses, lands, posts] = await Promise.all([
      this.prisma.house.findMany({
        where: { status: 1 },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          images: {
            take: 1,
            orderBy: { position: 'asc' },
            select: { url: true },
          },
        },
      }),
      this.prisma.land.findMany({
        where: { status: 1 },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          images: {
            take: 1,
            orderBy: { position: 'asc' },
            select: { url: true },
          },
        },
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
        const sparse = AiUtils.buildBm25SparseVector(doc.text);
        return {
          id: doc.id,
          vector: {
            dense: vector,
            ...(sparse.indices.length > 0
              ? { sparse: { indices: sparse.indices, values: sparse.values } }
              : {}),
          },
          payload: doc.payload,
        };
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
    const intent = await AiUtils.parseIntent(question);
    this.logger.log(
      `[INTENT] "${question.slice(0, 60)}" → ${intent.type} | loc=${intent.location} | max=${intent.maxPrice} | purpose=${intent.purpose}${intent.expandedQuery ? ` | expanded="${intent.expandedQuery.slice(0, 50)}"` : ''}`,
    );
    const normalizedQuestion = AiUtils.normalizeText(question);
    const hasIntentFilter =
      Boolean(intent.location) ||
      intent.minPrice !== undefined ||
      intent.maxPrice !== undefined ||
      Boolean(intent.sourceType);
    const noDataAnswer =
      'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.';
    const isContextualCompare = intent.type === 'compare_property';
    const isContextualFollowUp = /\b(vua tim|vua xem)\b/.test(
      normalizedQuestion,
    );
    const shouldUseCache =
      this.enableChatCache &&
      (intent.type === 'qa_real_estate' || intent.type === 'greeting') &&
      !isContextualCompare &&
      !isContextualFollowUp;
    const shouldStoreLastSources =
      this.enableLastSources &&
      (intent.type === 'search_property' ||
        intent.type === 'recommend_property');

    // Fetch conversation state early (needed for multi-turn flows)
    const conversationEarly = await this.getConversationState(sessionId);

    // Handle consultation flow FIRST (multi-step wizard)
    // Must run before content generation to avoid consultation answers being
    // intercepted by the generate-content follow-up detector.
    const consultationResponse = await this.handleConsultationFlow(
      sessionId,
      question,
      intent,
      conversationEarly,
    );
    if (consultationResponse) return consultationResponse;

    // Detect user dislike and mark properties
    await this.handleDislikeDetection(sessionId, question, conversationEarly);

    // Handle intents that don't need RAG lookup
    const directResponse = await this.handleDirectIntent(
      intent,
      question,
      sessionId,
    );
    if (directResponse) {
      // Learn from interaction
      await this.userProfileService.learnFromInteraction(
        sessionId,
        intent,
        [],
        question,
      );
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

    // Follow-up questions depend on conversation context — always include sessionId
    // to prevent cross-session cache pollution with identical question strings.
    const responseCacheKey = `ai:chat:resp:${sessionId}:${encodeURIComponent(normalizedQuestion).slice(0, 160)}`;
    const conversation = conversationEarly;
    const recentMemory = conversation.memory.slice(
      -Math.max(0, this.chatHistoryTurns),
    );
    if (shouldUseCache) {
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
    }

    const candidateLimit = hasIntentFilter
      ? Math.max(
        this.retrievalTopK * this.retrievalCandidateMultiplier,
        this.retrievalTopK * 3,
      )
      : this.retrievalTopK;

    let rawHits: VectorHit[] = [];
    const relatedPool: VectorHit[] = [];
    // Build Qdrant metadata filter for more precise retrieval
    const qdrantFilter = this.buildQdrantFilter(intent);
    try {
      const embedStartedAt = Date.now();
      // Query Expansion: use LLM-generated optimized query for embedding
      // when available, otherwise fall back to the original question.
      const searchText = intent.expandedQuery || question;
      const queryVector = await this.getCachedQueryEmbedding(searchText);
      const querySparse = AiUtils.buildBm25SparseVector(searchText);
      timings.embedMs = Date.now() - embedStartedAt;

      const searchStartedAt = Date.now();
      // Hybrid Search: combine Dense (semantic) + Sparse (BM25 keyword) vectors
      // using Qdrant's query API with Reciprocal Rank Fusion (RRF)
      const hasSparse = querySparse.indices.length > 0;
      const prefetch: any[] = [
        {
          query: queryVector,
          using: 'dense',
          limit: candidateLimit,
          ...(qdrantFilter ? { filter: qdrantFilter } : {}),
        },
      ];
      if (hasSparse) {
        prefetch.push({
          query: { indices: querySparse.indices, values: querySparse.values },
          using: 'sparse',
          limit: candidateLimit,
          ...(qdrantFilter ? { filter: qdrantFilter } : {}),
        });
      }

      const searchResp = await axios.post(
        `${this.qdrantUrl}/collections/${this.ragCollection}/points/query`,
        {
          prefetch,
          query: { fusion: 'rrf' },
          limit: candidateLimit,
          with_payload: true,
        },
        { timeout: this.qdrantTimeoutMs },
      );
      timings.searchMs = Date.now() - searchStartedAt;

      rawHits = (searchResp.data?.result?.points || searchResp.data?.result || []) as VectorHit[];
      relatedPool.push(...rawHits);
    } catch (error) {
      this.logger.warn(
        `Vector search failed, fallback to DB intent search: ${AiUtils.stringifyError(error)}`,
      );
    }

    const filterStartedAt = Date.now();
    const intentFilteredHits = this.applyIntentFilter(rawHits, intent);
    const minScoreSafe = Math.max(this.minScore, 0.12);
    const strongHits = intentFilteredHits.filter(
      (h) => Number(h.score || 0) >= minScoreSafe,
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

    // Secondary DB fallback: only when no location constraint is present.
    // Otherwise we would pollute results with unrelated cities.
    if (hits.length === 0 && !intent.location) {
      this.logger.warn(
        `All retrieval paths returned 0 hits for "${question.slice(0, 60)}", using recent DB fallback`,
      );
      const dbFallbackStartedAt = Date.now();
      const emergencyHits = await this.findDbCandidatesByIntent(
        {
          type: intent.type || 'search_property',
          sourceType: intent.sourceType,
        },
        Math.max(this.retrievalTopK, 8),
      );
      timings.dbFallbackMs = Date.now() - dbFallbackStartedAt;
      relatedPool.push(...emergencyHits);
      if (emergencyHits.length > 0) {
        hits = emergencyHits;
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

    // Filter out disliked properties from user profile
    const userProfile = await this.userProfileService.getProfile(sessionId);
    hits = this.userProfileService.filterSeenProperties(hits, userProfile);

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
      const answer = AiUtils.toFastAnswer(hits, intent);
      timings.fastAnswerMs = Date.now() - fastAnswerStartedAt;
      const sources = hits.map((h) => ({ ...h.payload, score: h.score }));
      if (shouldStoreLastSources && sources.length > 0) {
        await this.storeLastSources(sessionId, sources);
      }
      if (shouldUseCache) {
        await this.redis.set(
          responseCacheKey,
          {
            answer,
            sources,
            relatedSources,
            suggestedQuestions: defaultSuggestions,
            confidence: hits[0]?.score || 0,
          },
          this.responseCacheTtlSec,
        );
      }

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
        sources,
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
        const bedrooms = Number(p.bedrooms ?? 0);
        const floors = Number(p.floors ?? 0);
        const direction = String(p.direction || '');

        const details = [
          `#${idx + 1}`,
          `loai=${String(p.source || '')}`,
          `id=${String(p.sourceId || '')}`,
          `tieu_de=${String(p.title || '')}`,
          `dia_chi=${[p.street, p.ward, p.district, p.city].filter(Boolean).join(', ')}`,
          `gia=${AiUtils.formatVnd(p.price)}`,
          `dien_tich=${AiUtils.formatArea(p.area)}`,
        ];
        if (bedrooms > 0) details.push(`phong_ngu=${bedrooms}`);
        if (floors > 0) details.push(`so_tang=${floors}`);
        if (direction) details.push(`huong=${direction}`);
        details.push(`url=${String(p.url || '')}`);
        if (shortDescription) details.push(`mo_ta=${shortDescription}`);

        return details.join(' | ');
      })
      .join('\n');

    const intentInstructions = AiUtils.buildIntentInstructions(intent);

    // Build system instruction (proper Vietnamese, separated from user content)
    const profileContext =
      this.userProfileService.buildProfileContext(userProfile);
    const systemInstruction = [
      'Bạn là trợ lý AI tư vấn bất động sản CHUYÊN NGHIỆP cho nền tảng Real Estate Việt Nam.',
      'LUÔN trả lời bằng TIẾNG VIỆT có dấu. Giọng điệu thân thiện, chuyên nghiệp.',
      '',
      profileContext
        ? `=== THÔNG TIN KHÁCH HÀNG ===\n${profileContext}\nHãy cá nhân hóa tư vấn dựa trên thông tin này.`
        : '',
      '',
      `Nhiệm vụ: ${intent.type}`,
      intentInstructions,
      '',
      '=== QUY TẮC ƯU TIÊN ===',
      '1. Ưu tiên dữ liệu từ CONTEXT. Không bịa chi tiết cụ thể (giá/diện tích/địa chỉ/ID).',
      '2. KIỂM TRA GIÁ: nếu yêu cầu "dưới X tỷ" → chỉ gợi ý BĐS giá ≤ X tỷ.',
      '3. KIỂM TRA LOẠI: "đất nền" → loại=land, "nhà" → loại=house.',
      '4. KIỂM TRA VỊ TRÍ: ưu tiên BĐS đúng khu vực yêu cầu.',
      '5. Nếu thiếu BĐS phù hợp → summary nói rõ + hỏi lại 1-2 tiêu chí để làm rõ hơn, recommendations rỗng [].',
      '6. Mỗi recommendation có "reason" là một mô tả cực kỳ ngắn gọn và thuyết phục, nêu bật lý do tại sao khách nên chọn BĐS này (ưu điểm vượt trội).',
      '7. Mỗi recommendation giữ đúng sourceId và source từ CONTEXT.',
      '8. suggestedQuestions liên quan nhu cầu hiện tại.',
      '',
      '=== ĐỊNH DẠNG JSON ===',
      '{"summary":"string","recommendations":[{"title":"string","location":"string","price":number,"area":number,"bedrooms":number,"floors":number,"direction":"string","reason":"string","source":"string","sourceId":number,"url":"string"}],"followUp":"string","suggestedQuestions":["string"]}',
    ]
      .filter(Boolean)
      .join('\n');

    // Build multi-turn contents for proper Gemini conversation context
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> =
      [];

    // Add conversation history as multi-turn messages (proper Gemini format)
    if (recentMemory.length > 0) {
      for (const turn of recentMemory) {
        const geminiRole = turn.role === 'assistant' ? 'model' : 'user';
        // Compact history turns to save tokens
        const compactText = AiUtils.compactMemoryText(turn.text, 300);
        contents.push({ role: geminiRole, parts: [{ text: compactText }] });
      }
    }

    // Build the current user message with context
    const userMessageParts: string[] = [];
    if (conversation.summaryMemory) {
      userMessageParts.push(
        `Tóm tắt hội thoại trước: ${conversation.summaryMemory}`,
      );
    }
    if (hasIntentFilter) {
      userMessageParts.push(`Intent đã phân tích: ${JSON.stringify(intent)}`);
    }
    userMessageParts.push(`CONTEXT:\n${context}`);
    userMessageParts.push(`CÂU HỎI: ${question}`);

    contents.push({
      role: 'user',
      parts: [{ text: userMessageParts.join('\n\n') }],
    });

    let answer = noDataAnswer;
    let structured: Record<string, unknown> | null = null;
    try {
      const llmStartedAt = Date.now();
      const text = await AiUtils.generateLlmResponse(
        contents,
        systemInstruction,
        {
          temperature: 0.1,
          maxTokens: 2048,
          timeout: this.geminiTimeoutMs,
          isJson: true,
        },
      );

      timings.llmMs = Date.now() - llmStartedAt;

      // Handle blocked / empty response from LLM
      if (!text) {
        this.logger.warn(
          `LLM response blocked or empty, fallback to fast answer`,
        );
        structured = null;
        answer = AiUtils.toFastAnswer(hits, intent);
      } else {
        const rawAnswer = String(text || noDataAnswer);
        structured = AiUtils.tryParseJson(rawAnswer);
        if (structured) {
          answer = AiUtils.toDisplayAnswer(structured);
        } else {
          // Parse failed (truncated/malformed JSON) — use clean fast answer from vector hits
          this.logger.warn(
            `LLM JSON parse failed, using fast answer. Raw (first 150 chars): ${rawAnswer.slice(0, 150)}`,
          );
          answer = AiUtils.toFastAnswer(hits, intent);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Gemini LLM timeout/error, fallback to fast answer: ${AiUtils.stringifyError(error)}`,
      );
      structured = null;
      answer = AiUtils.toFastAnswer(hits, intent);
    }

    // Extract suggestedQuestions from LLM structured output if available
    const llmSuggestions = Array.isArray(structured?.suggestedQuestions)
      ? (structured.suggestedQuestions as string[])
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 3)
      : [];
    const suggestedQuestions =
      llmSuggestions.length > 0 ? llmSuggestions : defaultSuggestions;

    const sources = hits.map((h) => ({ ...h.payload, score: h.score }));
    if (shouldStoreLastSources && sources.length > 0) {
      await this.storeLastSources(sessionId, sources);
    }
    if (shouldUseCache) {
      await this.redis.set(
        responseCacheKey,
        {
          answer,
          sources,
          relatedSources,
          suggestedQuestions,
          confidence: hits[0]?.score || 0,
        },
        this.responseCacheTtlSec,
      );
    }

    if (this.logTimings) {
      this.logger.log(
        `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms llm=${timings.llmMs ?? 0}ms source=llm session=${sessionId}`,
      );
    }

    // Learn from this interaction for personalization
    const viewedIds = sources
      .map((s) => Number(s['sourceId']))
      .filter((id) => Number.isFinite(id) && id > 0);
    await this.userProfileService.learnFromInteraction(
      sessionId,
      intent,
      viewedIds,
      question,
    );

    return this.returnChatWithMemory(sessionId, question, conversation, {
      answer,
      structured,
      intent,
      confidence: hits[0]?.score || 0,
      sources,
      relatedSources,
      suggestedQuestions,
    });
  }

  private lastSourcesKey(sessionId: string): string {
    return `ai:chat:lastSources:${sessionId}`;
  }

  private async storeLastSources(
    sessionId: string,
    sources: ChatSourcePayload[],
  ): Promise<void> {
    const compact = sources
      .map((s) => ({
        source: s.source,
        sourceId: s.sourceId,
        title: s.title,
        price: s.price,
        area: s.area,
        city: s.city,
        district: s.district,
        ward: s.ward,
        street: s.street,
        url: s.url,
      }))
      .filter(
        (s) => Number.isFinite(Number(s.sourceId)) && Number(s.sourceId) > 0,
      )
      .slice(0, 5);

    if (compact.length === 0) return;

    await this.redis.set(
      this.lastSourcesKey(sessionId),
      { at: new Date().toISOString(), sources: compact },
      this.lastSourcesTtlSec,
    );
  }

  private async getLastSources(
    sessionId: string,
  ): Promise<ChatSourcePayload[]> {
    const cached = await this.redis.get<{ sources?: ChatSourcePayload[] }>(
      this.lastSourcesKey(sessionId),
    );
    return cached?.sources ?? [];
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
    // Enrich the answer text stored in memory with source metadata
    // so extractIdsFromHistory can find property IDs for compare flows.
    let memoryAnswer = payload.answer;
    if (payload.sources && payload.sources.length > 0) {
      const sourceRefs = payload.sources
        .filter((s) => {
          const id = Number(s.sourceId);
          return Number.isFinite(id) && id > 0;
        })
        .map((s) => {
          const src = String(s.source || 'house');
          const id = Number(s.sourceId);
          const route =
            src === 'land' ? 'lands' : src === 'post' ? 'posts' : 'houses';
          return `[ID ${id} - ${this.frontendUrl}/${route}/${id}]`;
        });
      if (sourceRefs.length > 0) {
        memoryAnswer += `\n(Nguồn: ${sourceRefs.join(', ')})`;
      }
    }

    const updated = await this.updateConversationMemory(
      conversation.memoryKey,
      conversation.summaryKey,
      conversation.memory,
      conversation.summaryMemory,
      question,
      memoryAnswer,
    );

    return {
      ok: true,
      sessionId,
      ...payload,
      memoryTurns: updated.newMemory.length,
    };
  }

  private async handleCompareFlow(
    sessionId: string,
    question: string,
    intent: ParsedIntent,
    conversation: ConversationState,
  ): Promise<ChatResult | null> {
    if (intent.type !== 'compare_property') return null;

    // Helper to return compare result with AI reasoning
    const returnCompare = async (ids: number[]) => {
      const { active, stale } = await this.compareService.filterActiveIds(ids);
      if (active.length < 2) {
        const staleAnswer =
          stale.length > 0
            ? 'Một số bất động sản đã hết hoặc đã bị xóa. Bạn vui lòng tìm lại để mình so sánh chính xác hơn.'
            : 'Mình chưa tìm thấy đủ bất động sản để so sánh. Bạn có thể gửi link chi tiết hoặc mô tả ngắn từng BĐS.';

        return this.returnChatWithMemory(sessionId, question, conversation, {
          answer: staleAnswer,
          structured: null,
          intent,
          confidence: 0,
          sources: [],
          relatedSources: [],
          suggestedQuestions: [
            'Tìm nhà dưới 3 tỷ',
            'Tìm đất nền giá rẻ',
            'So sánh 2 bất động sản vừa tìm',
          ],
        });
      }

      const compareAnswer =
        await this.compareService.buildCompareAnswer(active);

      // Enrich with AI reasoning via Gemini for expert analysis
      let enrichedAnswer = compareAnswer.answer;
      if (
        this.enableLlm &&
        this.geminiApiKey &&
        compareAnswer.sources.length >= 2
      ) {
        const aiAnalysis = await this.getCompareAIAnalysis(
          compareAnswer.sources,
          question,
        );
        if (aiAnalysis) {
          enrichedAnswer = `${compareAnswer.answer}\n\n${aiAnalysis}`;
        }
      }

      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: enrichedAnswer,
        structured: null,
        intent,
        confidence: 1,
        sources: compareAnswer.sources,
        relatedSources: [],
        suggestedQuestions: compareAnswer.suggestedQuestions,
      });
    };

    if (
      this.enableLastSources &&
      (!intent.compareIds || intent.compareIds.length === 0) &&
      (!intent.compareDescriptions || intent.compareDescriptions.length === 0)
    ) {
      // Strategy -1: compare from last search sources (recently returned results)
      const lastSources = await this.getLastSources(sessionId);
      const lastIds = lastSources
        .map((s) => Number(s.sourceId))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (lastIds.length >= 2) {
        return returnCompare(lastIds.slice(0, 5));
      }
    }

    // Strategy 0: explicit IDs parsed from the question
    if (intent.compareIds && intent.compareIds.length >= 2) {
      return returnCompare(intent.compareIds);
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
        return returnCompare([idA, idB]);
      }

      // Strategy 1.5: If description matching failed, try extracting
      // multiple prices from the full question and match each to a property.
      // This handles "Đất Hòa Vang 2.050.000.000 đ so sánh với Đất Hòa Vang 2.100.000.000 đ"
      this.logger.log(
        `Compare Strategy 1 partial fail: idA=${idA} idB=${idB}, trying multi-price extraction`,
      );
    }

    // Strategy 1.5: Extract all prices from the full question and find matching properties
    {
      const allPrices = AiUtils.extractAllPricesFromText(question);
      if (allPrices.length >= 2) {
        const sourceType =
          this.compareService.extractSourceTypeFromText(question);
        const locationTokens =
          this.compareService.extractLocationTokens(question);

        const foundIds: number[] = [];
        const usedIds = new Set<number>();

        for (const price of allPrices.slice(0, 3)) {
          // Build a synthetic description for each price
          const syntheticDesc = [
            sourceType === 'land' ? 'Đất' : sourceType === 'house' ? 'Nhà' : '',
            ...locationTokens.slice(0, 5),
            price.toString(),
          ]
            .filter(Boolean)
            .join(' ');

          const id = await this.compareService.findByPriceAndLocation(
            // Use original question fragments for better location matching
            `${syntheticDesc} ${question}`.slice(0, 300),
            usedIds.size > 0 ? [...usedIds][0] : undefined,
          );

          if (id !== null && !usedIds.has(id)) {
            foundIds.push(id);
            usedIds.add(id);
          }

          if (foundIds.length >= 2) break;
        }

        if (foundIds.length >= 2) {
          this.logger.log(
            `Compare Strategy 1.5 success: found ids=${foundIds.join(',')} via multi-price extraction`,
          );
          return returnCompare(foundIds);
        }
      }
    }

    // Strategy 2: referential language or fallback — always try IDs from history
    // when earlier strategies didn't return a result
    {
      const historyIds = this.compareService.extractIdsFromHistory(
        conversation.memory,
      );
      if (historyIds.length >= 2) {
        return returnCompare(historyIds.slice(0, 3));
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
          return returnCompare(ids);
        }
      }
    }

    // Strategy 4: last resort — extract any prices from the full question
    // and search broadly for properties matching those prices
    {
      const allPrices = AiUtils.extractAllPricesFromText(question);
      const sourceType =
        this.compareService.extractSourceTypeFromText(question);

      if (allPrices.length >= 1 || sourceType) {
        // Build a broader intent from the question
        const broadIntent: ParsedIntent = {
          type: 'compare_property',
          sourceType: sourceType || intent.sourceType,
        };

        if (allPrices.length >= 2) {
          broadIntent.minPrice = Math.min(...allPrices) * 0.9;
          broadIntent.maxPrice = Math.max(...allPrices) * 1.1;
        } else if (allPrices.length === 1) {
          broadIntent.minPrice = allPrices[0] * 0.8;
          broadIntent.maxPrice = allPrices[0] * 1.2;
        }

        const candidates = await this.findDbCandidatesByIntent(broadIntent, 10);
        if (candidates.length >= 2) {
          const ids = candidates
            .slice(0, 3)
            .map((c) => Number(c.payload?.sourceId))
            .filter((id) => Number.isFinite(id) && id > 0);
          if (ids.length >= 2) {
            this.logger.log(
              `Compare Strategy 4 success: found ids=${ids.join(',')} via broad price search`,
            );
            return returnCompare(ids);
          }
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

    const compactUser = AiUtils.compactMemoryText(question, 120);
    const compactAssistant = AiUtils.compactMemoryText(answer, 180);
    const newSummaryPiece = `U: ${compactUser} | A: ${compactAssistant}`;

    let newSummary = summaryMemory
      ? `${summaryMemory} || ${newSummaryPiece}`
      : newSummaryPiece;
    if (newSummary.length > this.chatSummaryMaxChars) {
      newSummary = `${newSummary.slice(0, this.chatSummaryMaxChars - 3)}...`;
    }

    await this.redis.set(memoryKey, newMemory, 24 * 60 * 60);
    await this.redis.set(summaryKey, newSummary, 24 * 60 * 60);

    return { newMemory, newSummary };
  }

  private async handleDirectIntent(
    intent: ParsedIntent,
    question: string,
    sessionId?: string,
  ): Promise<{ answer: string; suggestedQuestions: string[] } | null> {
    if (intent.type === 'greeting') {
      // Personalize greeting if we know the user
      let greetingPrefix = 'Xin chào! Mình là trợ lý AI bất động sản.';
      if (sessionId) {
        const profile = await this.userProfileService.getProfile(sessionId);
        if (profile.interactionCount > 0) {
          greetingPrefix = 'Chào bạn quay lại! 👋';
          const hints: string[] = [];
          if (profile.preferredAreas.length > 0) {
            hints.push(
              `khu vực ${profile.preferredAreas[profile.preferredAreas.length - 1]}`,
            );
          }
          if (profile.budgetMax) {
            hints.push(`ngân sách ${AiUtils.formatVnd(profile.budgetMax)}`);
          }
          if (hints.length > 0) {
            greetingPrefix += ` Mình nhớ bạn đang quan tâm ${hints.join(', ')}.`;
          }
        }
      }
      return {
        answer: `${greetingPrefix} Mình có thể giúp bạn:\n\n🔍 **Tìm kiếm** nhà, đất phù hợp nhu cầu\n📊 **Phân tích thị trường** giá cả khu vực\n💰 **Tư vấn tài chính** vay vốn, trả góp\n🏦 **Tư vấn đầu tư** BĐS sinh lời\n⚖️ **Hướng dẫn pháp lý** thủ tục mua bán\n\nBạn cần hỗ trợ gì?`,
        suggestedQuestions: [
          'Tư vấn cho mình mua nhà',
          'Phân tích thị trường BĐS Đà Nẵng',
          'Tìm nhà dưới 3 tỷ',
          'Tính khả năng vay mua nhà',
          'Kinh nghiệm đầu tư BĐS',
          'Sổ hồng là gì?',
        ],
      };
    }

    // ─── Market Analysis ────────────────────────────────────────────
    if (intent.type === 'market_analysis') {
      const answer = await this.marketInsightService.buildMarketAnalysisAnswer(
        question,
        intent.location,
        intent.sourceType === 'post' ? undefined : intent.sourceType,
      );
      return {
        answer,
        suggestedQuestions: [
          intent.location
            ? `Tìm nhà ở ${intent.location}`
            : 'Tìm nhà dưới 3 tỷ',
          'Tư vấn đầu tư BĐS',
          'Tính khả năng vay mua nhà',
        ],
      };
    }

    // ─── Investment Advice ──────────────────────────────────────────
    if (intent.type === 'investment_advice') {
      const answer = await this.marketInsightService.buildInvestmentAdvice(
        question,
        intent.location,
        intent.maxPrice,
        intent.sourceType === 'post' ? undefined : intent.sourceType,
      );
      return {
        answer,
        suggestedQuestions: [
          'Phân tích thị trường khu vực Đà Nẵng',
          'Tìm đất nền đầu tư giá tốt',
          'Tính khả năng vay mua nhà',
        ],
      };
    }

    // ─── Financing Advice ──────────────────────────────────────────
    if (intent.type === 'financing_advice') {
      const answer =
        await this.financingAdvisorService.buildFinancingAnswer(question);
      return {
        answer,
        suggestedQuestions: [
          'Tìm nhà phù hợp ngân sách',
          'Kinh nghiệm mua nhà lần đầu',
          'Tư vấn đầu tư BĐS',
        ],
      };
    }

    if (intent.type === 'qa_real_estate') {
      const qaAnswer = this.qaService.answerQA(question);
      if (qaAnswer) return qaAnswer;

      // Gemini QA fallback: answer knowledge questions not in static bank
      const geminiQA = await this.qaService.answerQAWithGemini(question);
      if (geminiQA) {
        return {
          answer: geminiQA,
          suggestedQuestions: [
            'Sổ hồng là gì?',
            'Tìm nhà dưới 3 tỷ',
            'Kinh nghiệm mua nhà lần đầu',
          ],
        };
      }
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
          'Để nâng cấp tin đăng (đẩy tin, tin nổi bật), bạn vui lòng truy cập vào phần **[Quản lý tin đăng](/my-posts)** của mình, chọn tin cần nâng cấp và bấm vào nút "Nâng cấp" nhé.',
        suggestedQuestions: [
          'Tìm nhà dưới 5 tỷ',
          'So sánh 2 bất động sản phù hợp nhất',
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
   * Handle multi-step consultation flow.
   */
  private async handleConsultationFlow(
    sessionId: string,
    question: string,
    intent: ParsedIntent,
    conversation: ConversationState,
  ): Promise<ChatResult | null> {
    // Check if there's an active consultation
    const currentState = await this.consultationFlowService.getState(sessionId);

    if (
      currentState &&
      currentState.step !== 'idle' &&
      currentState.step !== 'completed'
    ) {
      // Escape hatch: If user explicitly starts over with a greeting or a strong different intent
      const breakoutIntents = [
        'greeting',
        'search_property',
        'recommend_property',
        'market_analysis',
        'investment_advice',
        'financing_advice',
        'qa_real_estate',
        'compare_property',
        'booking',
        'upgrade_account',
        'upgrade_listing',
      ];

      if (breakoutIntents.includes(intent.type)) {
        await this.consultationFlowService.clearState(sessionId);
        return null; // Let the main flow handle the new intent
      }

      // If user asks for consultation AGAIN, restart the consultation
      if (intent.type === 'consultation') {
        await this.consultationFlowService.clearState(sessionId);
        const profile = await this.userProfileService.getProfile(sessionId);
        const startAnswer =
          await this.consultationFlowService.startConsultation(
            sessionId,
            profile,
          );

        return this.returnChatWithMemory(sessionId, question, conversation, {
          answer: startAnswer,
          structured: null,
          intent: { type: 'consultation' },
          confidence: 1,
          sources: [],
          relatedSources: [],
          suggestedQuestions: [],
        });
      }

      // Continue existing consultation
      const result = await this.consultationFlowService.processAnswer(
        sessionId,
        question,
        currentState,
      );

      if (result.completed && result.intent) {
        // Consultation completed - trigger a search with gathered criteria
        // Save the consultation summary in memory, then let the main chat flow handle the search
        const summaryAnswer = result.answer;
        await this.returnChatWithMemory(sessionId, question, conversation, {
          answer: summaryAnswer,
          structured: null,
          intent: result.intent,
          confidence: 1,
          sources: [],
          relatedSources: [],
          suggestedQuestions: [],
        });

        // Now execute the search with the consultation-derived intent
        const searchDto: ChatDto = {
          sessionId,
          question: this.buildConsultationSearchQuery(result.state),
        };
        return this.chat(searchDto);
      }

      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: result.answer,
        structured: null,
        intent: { type: 'consultation' },
        confidence: 1,
        sources: [],
        relatedSources: [],
        suggestedQuestions: ['Hủy tư vấn'],
      });
    }

    // Start new consultation ONLY when intent is explicitly 'consultation'.
    // Do NOT use isConsultationTrigger fallback here — it was too aggressive
    // and matched search queries like "đất nền đầu tư" (nen dau tu).
    if (intent.type === 'consultation') {
      const profile = await this.userProfileService.getProfile(sessionId);
      const startAnswer = await this.consultationFlowService.startConsultation(
        sessionId,
        profile,
      );

      return this.returnChatWithMemory(sessionId, question, conversation, {
        answer: startAnswer,
        structured: null,
        intent: { type: 'consultation' },
        confidence: 1,
        sources: [],
        relatedSources: [],
        suggestedQuestions: [],
      });
    }

    return null;
  }

  /**
   * Build a search query from consultation state.
   */
  private buildConsultationSearchQuery(state: any): string {
    const parts: string[] = ['Tìm'];
    if (state.propertyType === 'land') parts.push('đất');
    else parts.push('nhà');

    if (state.location) parts.push(`ở ${state.location}`);
    if (state.budgetMax) {
      const label =
        state.budgetMax >= 1_000_000_000
          ? `${(state.budgetMax / 1_000_000_000).toFixed(1).replace('.0', '')} tỷ`
          : `${Math.round(state.budgetMax / 1_000_000)} triệu`;
      parts.push(`dưới ${label}`);
    }
    if (state.bedrooms) parts.push(`${state.bedrooms} phòng ngủ`);
    if (state.additionalCriteria && state.additionalCriteria !== 'khong co') {
      parts.push(state.additionalCriteria);
    }

    return parts.join(' ');
  }

  /**
   * Detect if user dislikes current results and mark properties accordingly.
   */
  private async handleDislikeDetection(
    sessionId: string,
    question: string,
    conversation: ConversationState,
  ): Promise<void> {
    if (!this.userProfileService.detectDislike(question)) return;

    // Get IDs from the last assistant response
    const lastAssistant = [...conversation.memory]
      .reverse()
      .find((t) => t.role === 'assistant');
    if (!lastAssistant) return;

    const idMatches = lastAssistant.text.matchAll(/\bID\s+(\d+)\b/gi);
    const ids: number[] = [];
    for (const match of idMatches) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }

    if (ids.length > 0) {
      await this.userProfileService.markDisliked(sessionId, ids);
      this.logger.log(
        `[PROFILE] Marked ${ids.length} properties as disliked for session ${sessionId}`,
      );
    }
  }

  private buildSuggestedQuestions(
    intent: ParsedIntent,
    hits: VectorHit[],
  ): string[] {
    const suggestions: string[] = [];
    const firstHit = hits[0]?.payload;

    // User-friendly compare suggestion (no raw IDs exposed)
    // Backend Strategy 2 will extract IDs from recent chat history automatically
    if (hits.length >= 2) {
      suggestions.push('So sánh các bất động sản vừa tìm');
    }

    if (firstHit) {
      const city = String(firstHit.city || '');
      const district = String(firstHit.district || '');
      const source = String(firstHit.source || '');
      const locationLabel = district || city;
      if (locationLabel) {
        suggestions.push(
          `Tìm ${source === 'land' ? 'đất' : 'nhà'} khác ở ${locationLabel}`,
        );
      }
    }

    if (intent.maxPrice) {
      const priceLabel =
        intent.maxPrice >= 1_000_000_000
          ? `${(intent.maxPrice / 1_000_000_000).toFixed(1).replace('.0', '')} tỷ`
          : `${Math.round(intent.maxPrice / 1_000_000)} triệu`;
      suggestions.push(`Tìm nhà dưới ${priceLabel}`);
    } else if (intent.minPrice) {
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

  private async findDbCandidatesByIntent(
    intent: ParsedIntent,
    limit: number,
  ): Promise<VectorHit[]> {
    const priceFilter: Record<string, unknown> | undefined =
      intent.minPrice !== undefined || intent.maxPrice !== undefined
        ? {
          ...(intent.minPrice !== undefined ? { gte: intent.minPrice } : {}),
          ...(intent.maxPrice !== undefined ? { lte: intent.maxPrice } : {}),
        }
        : undefined;

    const locationStopTokens = new Set([
      'tp',
      'thanh',
      'pho',
      'tinh',
      'quan',
      'huyen',
      'phuong',
      'xa',
      'thi',
      'tran',
    ]);
    const normalizedLocation = intent.location
      ? AiUtils.normalizeText(intent.location)
      : '';
    const locationTokens = (intent.locationTokens || [])
      .map((t) => AiUtils.normalizeText(t))
      .filter((t) => t.length >= 2 && !locationStopTokens.has(t));

    // Transaction type heuristic: rent prices are typically < 100M/month
    const rentPriceGuard =
      intent.transactionType === 'rent' && !priceFilter
        ? { lte: 100_000_000 }
        : undefined;

    const buildWhere = () => {
      const where: Record<string, unknown> = { status: 1 };
      if (priceFilter) where.price = priceFilter;
      else if (rentPriceGuard) where.price = rentPriceGuard;

      // Push location filter to SQL level so we don't miss results
      // from the target location when other cities dominate recent records.
      if (intent.location) {
        where['OR'] = [
          { city: { contains: intent.location } },
          { district: { contains: intent.location } },
          { ward: { contains: intent.location } },
          { street: { contains: intent.location } },
        ];
      }

      return where;
    };

    const fetchLimit = Math.max(limit * 30, 200);

    const [houses, lands] = await Promise.all([
      intent.sourceType !== 'land'
        ? this.prisma.house.findMany({
          where: buildWhere(),
          orderBy: { updatedAt: 'desc' },
          take: fetchLimit,
          include: {
            images: {
              take: 1,
              orderBy: { position: 'asc' },
              select: { url: true },
            },
          },
        })
        : Promise.resolve([]),
      intent.sourceType !== 'house'
        ? this.prisma.land.findMany({
          where: buildWhere(),
          orderBy: { updatedAt: 'desc' },
          take: fetchLimit,
          include: {
            images: {
              take: 1,
              orderBy: { position: 'asc' },
              select: { url: true },
            },
          },
        })
        : Promise.resolve([]),
    ]);

    // If strict query returned nothing and we had location filters, do not
    // fall back to location-agnostic results.
    if (houses.length === 0 && lands.length === 0 && normalizedLocation) {
      return [];
    }

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
      // Create collection with Named Vectors (dense + sparse) for Hybrid Search
      await axios.put(`${this.qdrantUrl}/collections/${this.ragCollection}`, {
        vectors: {
          dense: { size, distance: 'Cosine' },
        },
        sparse_vectors: {
          sparse: {},
        },
      });
    } catch (error) {
      this.logger.warn(
        `ensureCollection warning: ${AiUtils.stringifyError(error)}`,
      );
    }

    // Create payload indexes for efficient Qdrant metadata filtering
    const keywordFields = ['source', 'city', 'district', 'ward'];
    for (const field of keywordFields) {
      try {
        await axios.put(
          `${this.qdrantUrl}/collections/${this.ragCollection}/index`,
          { field_name: field, field_schema: 'keyword' },
        );
      } catch {
        // Index may already exist — safe to ignore
      }
    }
    try {
      await axios.put(
        `${this.qdrantUrl}/collections/${this.ragCollection}/index`,
        { field_name: 'price', field_schema: 'float' },
      );
    } catch {
      // Index may already exist
    }
  }

  private async embed(input: string): Promise<number[]> {
    // Use Ollama nomic-embed-text for embedding (lightweight, runs on VPS)
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
    const normalized = AiUtils.normalizeText(question);
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
    const price = AiUtils.toNumber(house.price);
    const area = AiUtils.toNumber(house.area);
    const bedrooms = Number(house.bedrooms ?? 0);
    const bathrooms = Number(house.bathrooms ?? 0);
    const floors = Number(house.floors ?? 0);
    const direction = String(house.direction || '');

    // Extract first image URL from images array if available
    const images = Array.isArray(house.images) ? house.images : [];
    const firstImage =
      images.length > 0
        ? String((images[0] as Record<string, unknown>)?.url || '')
        : '';

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
      imageUrl: firstImage || null,
      url: `${this.frontendUrl}/houses/${house.id}`,
    };

    // Truncate description to keep total embed text within nomic-embed-text context limit.
    // Structured fields (title, price, area, location) are always fully preserved.
    const desc = String(house.description || '');
    const shortDesc = desc.length > 4000 ? `${desc.slice(0, 4000)}…` : desc;

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
      shortDesc ? `Mo ta: ${shortDesc}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { id, text, payload };
  }

  private landToDoc(land: Record<string, unknown>): IndexedDoc {
    const id = 2_000_000 + Number(land.id || 0);
    const price = AiUtils.toNumber(land.price);
    const area = AiUtils.toNumber(land.area);
    const direction = String(land.direction || '');
    const legalStatus = String(land.legalStatus || land.legal_status || '');
    const landType = String(land.landType || land.land_type || '');
    const frontWidth = AiUtils.toNumber(land.frontWidth ?? land.front_width);

    // Extract first image URL from images array if available
    const images = Array.isArray(land.images) ? land.images : [];
    const firstImage =
      images.length > 0
        ? String((images[0] as Record<string, unknown>)?.url || '')
        : '';

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
      imageUrl: firstImage || null,
      url: `${this.frontendUrl}/lands/${land.id}`,
    };

    const descLand = String(land.description || '');
    const shortDescLand = descLand.length > 4000 ? `${descLand.slice(0, 4000)}…` : descLand;

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
      shortDescLand ? `Mo ta: ${shortDescLand}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { id, text, payload };
  }

  private postToDoc(post: Record<string, unknown>): IndexedDoc {
    const id = 3_000_000 + Number(post.id || 0);
    const price = AiUtils.toNumber(post.price);
    const area = AiUtils.toNumber(post.area);

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

    const descPost = String(post.description || '');
    const shortDescPost = descPost.length > 4000 ? `${descPost.slice(0, 4000)}…` : descPost;

    const text = [
      `Loai: Bai dang`,
      `Tieu de: ${payload.title}`,
      `Vi tri: ${payload.street}, ${payload.ward}, ${payload.district}, ${payload.city}`,
      `Gia: ${payload.price}`,
      `Dien tich: ${payload.area}`,
      shortDescPost ? `Mo ta: ${shortDescPost}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { id, text, payload };
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
    const hasTransactionFilter = Boolean(intent.transactionType);
    if (
      !hasPriceFilter &&
      !hasLocationFilter &&
      !hasSourceFilter &&
      !hasTransactionFilter
    )
      return hits;

    const locationStopTokens = new Set([
      'tp',
      'thanh',
      'pho',
      'tinh',
      'quan',
      'huyen',
      'phuong',
      'xa',
      'thi',
      'tran',
    ]);
    const normalizedLocation = intent.location
      ? AiUtils.normalizeText(intent.location)
      : '';
    const locationTokens = (intent.locationTokens || [])
      .map((t) => AiUtils.normalizeText(t))
      .filter((t) => t.length >= 2 && !locationStopTokens.has(t));

    const filtered = hits.filter((hit) => {
      const payload = hit.payload || {};
      const price = AiUtils.toNumber(payload.price);

      // When a price filter is active, exclude items with unknown/zero price
      // because they cannot be verified against the user's budget.
      if (hasPriceFilter && price <= 0) return false;

      if (intent.minPrice !== undefined && price < intent.minPrice)
        return false;
      if (intent.maxPrice !== undefined && price > intent.maxPrice)
        return false;

      // Token-based fuzzy location matching: pass if ANY location token is found
      if (hasLocationFilter) {
        const searchable = [
          payload.city,
          payload.district,
          payload.ward,
          payload.street,
          payload.title,
        ]
          .map((x) => AiUtils.normalizeText(String(x || '')))
          .join(' ');

        if (normalizedLocation && searchable.includes(normalizedLocation)) {
          // Full phrase matched
        } else if (locationTokens.length > 0) {
          const matchCount = locationTokens.filter((t) =>
            searchable.includes(t),
          ).length;
          const threshold = Math.max(1, Math.ceil(locationTokens.length * 0.7));
          if (matchCount < threshold) return false;
        } else {
          return false;
        }
      }

      if (intent.sourceType) {
        const source = String(payload.source || '');
        if (source !== intent.sourceType) return false;
      }

      if (intent.requiredKeyword) {
        const needle = AiUtils.normalizeText(intent.requiredKeyword);
        const haystack = [
          payload.title,
          payload.description,
          payload.street,
          payload.ward,
          payload.district,
        ]
          .map((x) => AiUtils.normalizeText(String(x || '')))
          .join(' ');
        if (!haystack.includes(needle)) return false;
      }

      // Transaction type heuristic filter
      if (intent.transactionType) {
        const titleNorm = AiUtils.normalizeText(String(payload.title || ''));
        const descNorm = AiUtils.normalizeText(
          String(payload.description || '').slice(0, 200),
        );
        const combined = `${titleNorm} ${descNorm}`;

        if (intent.transactionType === 'rent') {
          // For rent: prefer items with rent keywords OR price < 100M (monthly rent range)
          const hasRentKeyword = /\b(cho thue|thue|rent)\b/.test(combined);
          const isRentPrice = price > 0 && price < 100_000_000;
          if (!hasRentKeyword && !isRentPrice) return false;
        } else if (intent.transactionType === 'sale') {
          // For sale: exclude items explicitly marked as rent
          const isExplicitRent =
            /\b(cho thue)\b/.test(combined) &&
            !/\b(ban|de ban)\b/.test(combined);
          if (isExplicitRent) return false;
        }
      }

      return true;
    });

    return filtered;
  }

  /**
   * Build Qdrant metadata filter to push filtering into the vector search
   * instead of filtering client-side after retrieval.
   */
  private buildQdrantFilter(
    intent: ParsedIntent,
  ): Record<string, unknown> | null {
    const must: Array<Record<string, unknown>> = [];

    if (intent.sourceType) {
      must.push({ key: 'source', match: { value: intent.sourceType } });
    }

    if (intent.minPrice !== undefined || intent.maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (intent.minPrice !== undefined) range.gte = intent.minPrice;
      if (intent.maxPrice !== undefined) range.lte = intent.maxPrice;
      must.push({ key: 'price', range });
    }

    // Location filter: match city OR district OR ward using keyword index.
    // Uses 'should' (OR) so a match on any field passes the filter.
    if (intent.location) {
      const locDisplay = intent.location;
      must.push({
        should: [
          { key: 'city', match: { value: locDisplay } },
          { key: 'district', match: { value: locDisplay } },
          { key: 'ward', match: { value: locDisplay } },
        ],
      });
    }

    if (must.length === 0) return null;
    return { must };
  }

  /**
   * Call Gemini to produce expert AI analysis for property comparison.
   * Returns a formatted analysis paragraph or null if the call fails.
   */
  private async getCompareAIAnalysis(
    sources: ChatSourcePayload[],
    question: string,
  ): Promise<string | null> {
    try {
      const propertyDescriptions = sources
        .map((s, idx) => {
          const price = AiUtils.formatVnd(s.price);
          const area = AiUtils.formatArea(s.area);
          const location = [s.street, s.ward, s.district, s.city]
            .filter(Boolean)
            .join(', ');
          const bedrooms = Number(s.bedrooms ?? 0);
          const floors = Number(s.floors ?? 0);
          const details = [
            `Giá: ${price}`,
            `Diện tích: ${area}`,
            bedrooms > 0 ? `${bedrooms} phòng ngủ` : '',
            floors > 0 ? `${floors} tầng` : '',
          ]
            .filter(Boolean)
            .join(', ');
          return `BĐS ${idx + 1}: ${String(s.title || 'N/A')} | ${location} | ${details}`;
        })
        .join('\n');

      const prompt = [
        'Phân tích so sánh các bất động sản sau:',
        propertyDescriptions,
        '',
        `Câu hỏi của khách: ${question}`,
        '',
        'Yêu cầu:',
        '1. Phân tích ưu/nhược điểm từng BĐS (giá, vị trí, diện tích, giá/m²)',
        '2. Đề xuất BĐS phù hợp nhất và lý do cụ thể',
        '3. Trả lời ngắn gọn, dưới 150 từ, bằng tiếng Việt có dấu',
        '4. Dùng gạch đầu dòng cho dễ đọc',
      ].join('\n');

      const text = await AiUtils.generateLlmResponse(
        prompt,
        'Bạn là chuyên gia phân tích bất động sản Việt Nam. Trả lời ngắn gọn, chuyên nghiệp, tiếng Việt có dấu.',
        {
          temperature: 0.3,
          maxTokens: 1024,
          timeout: Math.max(this.geminiTimeoutMs, 25000),
        },
      );

      return text && text.length > 20 ? `**📊 Phân tích AI:**\n${text}` : null;
    } catch (error) {
      this.logger.warn(
        `Compare AI analysis failed: ${AiUtils.stringifyError(error)}`,
      );
      return null;
    }
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
      ? AiUtils.normalizeText(intent.location)
      : '';

    let candidates = pool.filter((h) => !primaryIds.has(String(h.id)));

    if (intent.sourceType) {
      const differentType = candidates.filter(
        (h) => String(h.payload?.source || '') !== intent.sourceType,
      );
      const sameType = candidates.filter(
        (h) => String(h.payload?.source || '') === intent.sourceType,
      );
      candidates = [...sameType, ...differentType];
    }

    if (locationNeedle) {
      const strongLocation = candidates.filter((h) => {
        const p = h.payload || {};
        const loc = [p.city, p.district, p.ward, p.street]
          .map((x) => AiUtils.normalizeText(String(x || '')))
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
      .map((x) => AiUtils.normalizeText(x))
      .filter((x) => x.length >= 2);

    return docs
      .filter((p) => {
        const key = `${String(p.source || '')}:${String(p.sourceId || '')}`;
        return !excluded.has(key);
      })
      .map((p) => {
        const source = String(p.source || '');
        const loc = [p.city, p.district, p.ward, p.street]
          .map((x) => AiUtils.normalizeText(String(x || '')))
          .join(' ');
        const txt = [p.title, p.description]
          .map((x) => AiUtils.normalizeText(String(x || '')))
          .join(' ');

        let score = 0;
        if (intent.sourceType && source === intent.sourceType) score += 2;
        if (intent.sourceType && source !== intent.sourceType) score -= 1;

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

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
    delayMs = 0,
  ): Promise<R[]> {
    const safeConcurrency = Math.max(
      1,
      Number.isFinite(concurrency) ? Math.floor(concurrency) : 2,
    );
    const results: R[] = new Array(items.length);
    let current = 0;

    const worker = async () => {
      while (current < items.length) {
        const index = current;
        current += 1;
        results[index] = await mapper(items[index], index);
        if (delayMs > 0 && current < items.length) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
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
