import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { ChatDto } from './dto/chat.dto';

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

type ParsedIntent = {
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    sourceType?: 'house' | 'land' | 'post';
    requiredKeyword?: string;
};

type VectorHit = {
    id: number;
    score: number;
    payload: Record<string, unknown>;
};

type ChatSourcePayload = Record<string, unknown>;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    private readonly frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    private readonly qdrantUrl = process.env.QDRANT_URL || 'http://real-estate-qdrant:6333';
    private readonly ollamaUrl = process.env.OLLAMA_URL || 'http://real-estate-ollama:11434';
    private readonly ragCollection = process.env.RAG_COLLECTION || 'real_estate_rag';
    private readonly chatModel = process.env.CHAT_MODEL || process.env.DEFAULT_OLLAMA_MODEL || 'qwen2.5:7b';
    private readonly embedModel = process.env.EMBED_MODEL || 'nomic-embed-text';
    private readonly retrievalTopK = Number(process.env.RAG_TOP_K || 4);
    private readonly contextTopK = Number(process.env.RAG_CONTEXT_K || 2);
    private readonly minScore = Number(process.env.RAG_MIN_SCORE || 0.2);
    private readonly embedConcurrency = Number(process.env.EMBED_CONCURRENCY || 8);
    private readonly chatHistoryTurns = Number(process.env.RAG_HISTORY_TURNS || 4);
    private readonly chatHistoryMaxTurns = Number(process.env.RAG_HISTORY_MAX_TURNS || 20);
    private readonly chatSummaryMaxChars = Number(process.env.RAG_HISTORY_SUMMARY_CHARS || 1000);
    private readonly retrievalCandidateMultiplier = Number(process.env.RAG_CANDIDATE_MULTIPLIER || 10);
    private readonly maxPromptDescriptionChars = Number(process.env.RAG_DESCRIPTION_CHARS || 80);
    private readonly chatNumPredict = Number(process.env.CHAT_NUM_PREDICT || 256);
    private readonly embedCacheTtlSec = Number(process.env.EMBED_QUERY_CACHE_TTL || 600);
    private readonly responseCacheTtlSec = Number(process.env.RAG_RESPONSE_CACHE_TTL || 120);
    private readonly enableLlm = String(process.env.RAG_ENABLE_LLM || 'true').toLowerCase() !== 'false';
    private readonly fastMode = String(process.env.RAG_FAST_MODE || 'true').toLowerCase() === 'true';
    private readonly ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 9000);
    private readonly qdrantTimeoutMs = Number(process.env.QDRANT_TIMEOUT_MS || 2500);
    private readonly embedTimeoutMs = Number(process.env.EMBED_TIMEOUT_MS || 5000);
    private readonly logTimings = String(process.env.RAG_LOG_TIMINGS || 'false').toLowerCase() === 'true';

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

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

        const points = await this.mapWithConcurrency(docs, this.embedConcurrency, async (doc) => {
            const vector = await this.embed(doc.text);
            return { id: doc.id, vector, payload: doc.payload };
        });

        const batchSize = 32;
        for (let i = 0; i < points.length; i += batchSize) {
            const batch = points.slice(i, i + batchSize);
            await axios.put(`${this.qdrantUrl}/collections/${this.ragCollection}/points?wait=true`, {
                points: batch,
            });
        }

        this.logger.log(`Indexed ${points.length} records into ${this.ragCollection}`);

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
        const hasIntentFilter = Boolean(intent.location) || intent.minPrice !== undefined || intent.maxPrice !== undefined;
        const noDataAnswer = 'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.';

        const normalizedQuestion = this.normalizeText(question);
        const responseCacheKey = `ai:chat:resp:${encodeURIComponent(normalizedQuestion).slice(0, 200)}`;
        const memoryKey = `ai:chat:${sessionId}`;
        const summaryKey = `ai:chat:summary:${sessionId}`;
        const memory = (await this.redis.get<ChatTurn[]>(memoryKey)) ?? [];
        const summaryMemory = (await this.redis.get<string>(summaryKey)) ?? '';
        const recentMemory = memory.slice(-Math.max(0, this.chatHistoryTurns));
        const cacheStartedAt = Date.now();
        const cachedResponse = await this.redis.get<{
            answer: string;
            sources: ChatSourcePayload[];
            relatedSources?: ChatSourcePayload[];
            confidence: number;
        }>(responseCacheKey);
        timings.cacheMs = Date.now() - cacheStartedAt;
        if (cachedResponse) {
            const updated = await this.updateConversationMemory(memoryKey, summaryKey, memory, summaryMemory, question, cachedResponse.answer);
            if (this.logTimings) {
                this.logger.log(
                    `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs}ms source=cache session=${sessionId}`,
                );
            }
            return {
                ok: true,
                sessionId,
                answer: cachedResponse.answer,
                structured: null,
                intent,
                confidence: cachedResponse.confidence,
                sources: cachedResponse.sources,
                relatedSources: cachedResponse.relatedSources ?? [],
                memoryTurns: updated.newMemory.length,
            };
        }

        const candidateLimit = hasIntentFilter
            ? Math.max(this.retrievalTopK * this.retrievalCandidateMultiplier, this.retrievalTopK * 3)
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
            this.logger.warn(`Vector search failed, fallback to DB intent search: ${this.stringifyError(error)}`);
        }

        const filterStartedAt = Date.now();
        const intentFilteredHits = this.applyIntentFilter(rawHits, intent);
        const strongHits = intentFilteredHits.filter((h) => Number(h.score || 0) >= this.minScore);
        timings.filterMs = Date.now() - filterStartedAt;

        let hits: VectorHit[] = strongHits;
        if (hits.length === 0 && intentFilteredHits.length > 0) {
            // Keep best intent-matched results even when score is below strict threshold.
            hits = intentFilteredHits.slice(0, this.retrievalTopK);
        }

        if (hits.length === 0 && hasIntentFilter) {
            const dbFallbackStartedAt = Date.now();
            const dbFallbackHits = await this.findDbCandidatesByIntent(intent, Math.max(this.retrievalTopK, 8));
            timings.dbFallbackMs = Date.now() - dbFallbackStartedAt;
            relatedPool.push(...dbFallbackHits);
            if (dbFallbackHits.length > 0) {
                hits = dbFallbackHits;
            }
        }

        let relatedSources = this.buildRelatedSources(relatedPool, hits, intent, 3);
        if (relatedSources.length < 3) {
            const dbRelated = await this.findRelatedFromDb(intent, hits, relatedSources, 3 - relatedSources.length);
            relatedSources = [...relatedSources, ...dbRelated].slice(0, 3);
        }

        // Keep prompt context compact for latency and stable generation quality.
        hits = hits
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
            .slice(0, Math.max(1, this.contextTopK));

        if (hits.length === 0) {
            const updated = await this.updateConversationMemory(memoryKey, summaryKey, memory, summaryMemory, question, noDataAnswer);
            if (this.logTimings) {
                this.logger.log(
                    `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms source=no-data session=${sessionId}`,
                );
            }
            return {
                ok: true,
                answer: noDataAnswer,
                sources: [],
                relatedSources,
                confidence: 0,
                sessionId,
                intent,
                memoryTurns: updated.newMemory.length,
            };
        }

        // Fast mode skips LLM generation for better UX latency.
        if (this.fastMode || !this.enableLlm) {
            const fastAnswerStartedAt = Date.now();
            const answer = this.toFastAnswer(hits);
            timings.fastAnswerMs = Date.now() - fastAnswerStartedAt;
            const updated = await this.updateConversationMemory(memoryKey, summaryKey, memory, summaryMemory, question, answer);
            await this.redis.set(
                responseCacheKey,
                {
                    answer,
                    sources: hits.map((h) => ({ ...h.payload, score: h.score })),
                    relatedSources,
                    confidence: hits[0]?.score || 0,
                },
                this.responseCacheTtlSec,
            );

            if (this.logTimings) {
                this.logger.log(
                    `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms fastAnswer=${timings.fastAnswerMs ?? 0}ms source=fast-mode session=${sessionId}`,
                );
            }

            return {
                ok: true,
                sessionId,
                answer,
                structured: null,
                intent,
                confidence: hits[0]?.score || 0,
                sources: hits.map((h) => ({ ...h.payload, score: h.score })),
                relatedSources,
                memoryTurns: updated.newMemory.length,
            };
        }

        const context = hits
            .map((hit, idx) => {
                const p = hit.payload || {};
                const description = String(p.description || '');
                const shortDescription = description.length > this.maxPromptDescriptionChars
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

        const promptParts = [
            'Ban la tro ly bat dong san. Tra loi bang TIENG VIET va CHI dung du lieu trong CONTEXT.',
            'Tra ve JSON hop le theo schema: {"summary":"string","recommendations":[{"title":"string","location":"string","price":"number","area":"number","reason":"string","source":"string","url":"string"}],"followUp":"string"}.',
            'Neu khong du thong tin, tra ve: {"summary":"Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.","recommendations":[],"followUp":""}.',
        ];

        if (recentMemory.length > 0) {
            promptParts.push(`Lich su ngan: ${recentMemory.map((x) => `${x.role}: ${x.text}`).join(' || ')}`);
        }

        if (summaryMemory) {
            promptParts.push(`Tong ket hoi thoai truoc do: ${summaryMemory}`);
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
            this.logger.warn(`LLM generate timeout/error, fallback to fast answer: ${this.stringifyError(error)}`);
            structured = null;
            answer = this.toFastAnswer(hits);
        }

        const updated = await this.updateConversationMemory(memoryKey, summaryKey, memory, summaryMemory, question, answer);
        await this.redis.set(
            responseCacheKey,
            {
                answer,
                sources: hits.map((h) => ({ ...h.payload, score: h.score })),
                relatedSources,
                confidence: hits[0]?.score || 0,
            },
            this.responseCacheTtlSec,
        );

        if (this.logTimings) {
            this.logger.log(
                `chat timing: total=${Date.now() - chatStartedAt}ms cache=${timings.cacheMs ?? 0}ms embed=${timings.embedMs ?? 0}ms search=${timings.searchMs ?? 0}ms filter=${timings.filterMs ?? 0}ms dbFallback=${timings.dbFallbackMs ?? 0}ms llm=${timings.llmMs ?? 0}ms source=llm session=${sessionId}`,
            );
        }

        return {
            ok: true,
            sessionId,
            answer,
            structured,
            intent,
            confidence: hits[0]?.score || 0,
            sources: hits.map((h) => ({ ...h.payload, score: h.score })),
            relatedSources,
            memoryTurns: updated.newMemory.length,
        };
    }

    private async updateConversationMemory(
        memoryKey: string,
        summaryKey: string,
        memory: ChatTurn[],
        summaryMemory: string,
        question: string,
        answer: string,
    ): Promise<{ newMemory: ChatTurn[]; newSummary: string }> {
        const userTurn: ChatTurn = { role: 'user', text: question, at: new Date().toISOString() };
        const assistantTurn: ChatTurn = { role: 'assistant', text: answer, at: new Date().toISOString() };

        const newMemory: ChatTurn[] = [...memory, userTurn, assistantTurn].slice(-Math.max(2, this.chatHistoryMaxTurns));

        const compactUser = this.compactMemoryText(question, 120);
        const compactAssistant = this.compactMemoryText(answer, 180);
        const newSummaryPiece = `U: ${compactUser} | A: ${compactAssistant}`;

        let newSummary = summaryMemory ? `${summaryMemory} || ${newSummaryPiece}` : newSummaryPiece;
        if (newSummary.length > this.chatSummaryMaxChars) {
            newSummary = `...${newSummary.slice(-(this.chatSummaryMaxChars - 3))}`;
        }

        await this.redis.set(memoryKey, newMemory, 24 * 60 * 60);
        await this.redis.set(summaryKey, newSummary, 24 * 60 * 60);

        return { newMemory, newSummary };
    }

    private compactMemoryText(value: string, limit: number): string {
        const oneLine = String(value || '')
            .replace(/\s+/g, ' ')
            .trim();

        if (oneLine.length <= limit) return oneLine;
        return `${oneLine.slice(0, Math.max(0, limit - 3))}...`;
    }

    private async findDbCandidatesByIntent(intent: ParsedIntent, limit: number): Promise<VectorHit[]> {
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
            ...houses.map((h) => this.houseToDoc(h)).map((d) => ({ id: d.id, score: 0.15, payload: d.payload })),
            ...lands.map((l) => this.landToDoc(l)).map((d) => ({ id: d.id, score: 0.15, payload: d.payload })),
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
            this.logger.warn(`ensureCollection warning: ${this.stringifyError(error)}`);
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
            description: house.description || '',
            url: `${this.frontendUrl}/houses/${house.id}`,
        };

        const text = [
            `Loai: Nha`,
            `Tieu de: ${payload.title}`,
            `Vi tri: ${payload.street}, ${payload.ward}, ${payload.district}, ${payload.city}`,
            `Gia: ${payload.price}`,
            `Dien tich: ${payload.area}`,
            `Mo ta: ${String(house.description || '')}`,
        ].join('\n');

        return { id, text, payload };
    }

    private landToDoc(land: Record<string, unknown>): IndexedDoc {
        const id = 2_000_000 + Number(land.id || 0);
        const price = this.toNumber(land.price);
        const area = this.toNumber(land.area);

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
            description: land.description || '',
            url: `${this.frontendUrl}/lands/${land.id}`,
        };

        const text = [
            `Loai: Dat`,
            `Tieu de: ${payload.title}`,
            `Vi tri: ${payload.street}, ${payload.ward}, ${payload.district}, ${payload.city}`,
            `Gia: ${payload.price}`,
            `Dien tich: ${payload.area}`,
            `Mo ta: ${String(land.description || '')}`,
        ].join('\n');

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
        const intent: ParsedIntent = {};

        const rangeMatch = normalized.match(/tu\s+([0-9.,]+)\s*(ty|trieu|tr)?\s+(den|toi|-)\s+([0-9.,]+)\s*(ty|trieu|tr)?/);
        if (rangeMatch) {
            const min = this.toVnd(rangeMatch[1], rangeMatch[2]);
            const max = this.toVnd(rangeMatch[4], rangeMatch[5]);
            if (min !== undefined && max !== undefined) {
                intent.minPrice = Math.min(min, max);
                intent.maxPrice = Math.max(min, max);
            }
        }

        const underMatch = normalized.match(/(duoi|nho hon|<|<=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/);
        if (underMatch) {
            const max = this.toVnd(underMatch[2], underMatch[3]);
            if (max !== undefined) intent.maxPrice = max;
        }

        const overMatch = normalized.match(/(tren|lon hon|>|>=)\s*([0-9.,]+)\s*(ty|trieu|tr)?/);
        if (overMatch) {
            const min = this.toVnd(overMatch[2], overMatch[3]);
            if (min !== undefined) intent.minPrice = min;
        }

        const locationMatch = normalized.match(/(?:o|tai|khu vuc|gan)\s+([a-z0-9\s]+)$/);
        if (locationMatch) {
            const location = locationMatch[1].trim();
            if (location.length >= 2) intent.location = location;
        }

        if (/\b(chung cu|can ho|apartment)\b/.test(normalized)) {
            intent.sourceType = 'house';
        } else if (/\b(nha|biet thu|townhouse)\b/.test(normalized)) {
            intent.sourceType = 'house';
        } else if (/\b(dat|nen)\b/.test(normalized)) {
            intent.sourceType = 'land';
        }

        if (/\b(nong nghiep|vuon|trong cay)\b/.test(normalized)) {
            // Keep land-type preference but avoid strict keyword hard filter,
            // because many valid land records do not explicitly contain "nong nghiep" text.
            intent.sourceType = 'land';
        }

        return intent;
    }

    private applyIntentFilter<T extends { payload: Record<string, unknown> }>(hits: T[], intent: ParsedIntent): T[] {
        const hasPriceFilter = intent.minPrice !== undefined || intent.maxPrice !== undefined;
        const hasLocationFilter = Boolean(intent.location);
        const hasSourceFilter = Boolean(intent.sourceType) || Boolean(intent.requiredKeyword);
        if (!hasPriceFilter && !hasLocationFilter && !hasSourceFilter) return hits;

        const filtered = hits.filter((hit) => {
            const payload = hit.payload || {};
            const price = this.toNumber(payload.price);

            if (intent.minPrice !== undefined && price < intent.minPrice) return false;
            if (intent.maxPrice !== undefined && price > intent.maxPrice) return false;

            if (intent.location) {
                const searchable = [
                    payload.city,
                    payload.district,
                    payload.ward,
                    payload.street,
                ]
                    .map((x) => this.normalizeText(String(x || '')))
                    .join(' ');

                if (!searchable.includes(this.normalizeText(intent.location))) return false;
            }

            if (intent.sourceType) {
                const source = String(payload.source || '');
                if (source !== intent.sourceType) return false;
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
        const locationNeedle = intent.location ? this.normalizeText(intent.location) : '';

        let candidates = pool.filter((h) => !primaryIds.has(String(h.id)));

        if (intent.sourceType) {
            const differentType = candidates.filter((h) => String(h.payload?.source || '') !== intent.sourceType);
            const sameType = candidates.filter((h) => String(h.payload?.source || '') === intent.sourceType);
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

            const weakLocation = candidates.filter((h) => !strongLocation.includes(h));
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
                    const tokenHits = tokens.filter((t) => loc.includes(t) || txt.includes(t)).length;
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
        if (normalizedUnit === 'trieu' || normalizedUnit === 'tr') return amount * 1_000_000;

        // Default to ty if user says "6" in real-estate context.
        return amount >= 1000 ? amount : amount * 1_000_000_000;
    }

    private tryParseJson(raw: string): Record<string, unknown> | null {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
            return null;
        } catch {
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                try {
                    const sliced = raw.slice(jsonStart, jsonEnd + 1);
                    const parsed = JSON.parse(sliced);
                    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
                } catch {
                    return null;
                }
            }
            return null;
        }
    }

    private toDisplayAnswer(structured: Record<string, unknown> | null, raw: string): string {
        if (!structured) return raw;

        const summary = String(structured.summary || '').trim();
        const recs = Array.isArray(structured.recommendations)
            ? structured.recommendations as Array<Record<string, unknown>>
            : [];
        const followUp = String(structured.followUp || '').trim();

        const lines: string[] = [];
        if (summary) lines.push(summary);

        if (recs.length > 0) {
            lines.push('');
            lines.push('Gợi ý:');
            recs.slice(0, 5).forEach((r, idx) => {
                lines.push(this.formatSuggestionBlock(idx + 1, {
                    title: r.title,
                    location: r.location,
                    price: r.price,
                    area: r.area,
                    url: r.url,
                    source: r.source,
                    sourceId: r.sourceId,
                    reason: r.reason,
                }));
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
            lines.push(this.formatSuggestionBlock(idx + 1, {
                title: r.title,
                location: `${String(r.district || 'N/A')}, ${String(r.city || 'N/A')}`,
                price: r.price,
                area: r.area,
                url: r.url,
                source: r.source,
                sourceId: r.sourceId,
            }));
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

        const lines: string[] = [];
        lines.push(`${index}. ${title}`);
        lines.push(`   - ${location}`);
        lines.push(`   - Giá: ${price}`);
        lines.push(`   - Diện tích: ${area}`);
        if (reason) lines.push(`   - Lý do: ${reason}`);
        if (url) {
            lines.push(`   - Xem chi tiết: ${url}`);
        }

        return lines.join('\n');
    }

    private normalizeDetailUrl(url: unknown, source: unknown, sourceId: unknown): string {
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

    private async mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
        const safeConcurrency = Math.max(1, Number.isFinite(concurrency) ? Math.floor(concurrency) : 4);
        const results: R[] = new Array(items.length);
        let current = 0;

        const worker = async () => {
            while (current < items.length) {
                const index = current;
                current += 1;
                results[index] = await mapper(items[index], index);
            }
        };

        await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, () => worker()));
        return results;
    }
}
