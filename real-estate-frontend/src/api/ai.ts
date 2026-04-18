import apiClient from './client';
import axios from 'axios';

export interface ChatSource {
    source?: 'house' | 'land' | 'post';
    sourceId?: number;
    title: string;
    price?: number;
    area?: number;
    city?: string;
    district?: string;
    ward?: string;
    street?: string;
    score?: number;
}

export interface ChatIntent {
    type?: string;
    compareIds?: number[];
    sourceType?: 'house' | 'land' | 'post';
    location?: string;
    minPrice?: number;
    maxPrice?: number;
}

export interface ChatResponseData {
    ok?: boolean;
    sessionId?: string;
    answer: string;
    sources: ChatSource[];
    confidence?: number;
    memoryTurns?: number;
    intent?: ChatIntent;
    relatedSources?: ChatSource[];
    suggestedQuestions?: string[];
}

export interface GenerateDescriptionPayload {
    tone: 'polite' | 'friendly';
    postType: string;
    title: string;
    city?: string;
    district?: string;
    ward?: string;
    address?: string;
    price?: number;
    area?: number;
    bedrooms?: number;
    bathrooms?: number;
    floors?: number;
    frontWidth?: number;
    landLength?: number;
    landType?: string;
    direction?: string;
    legalStatus?: string;
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    startDate?: string;
    endDate?: string;
    discountCode?: string;
    contactPhone?: string;
    contactLink?: string;
}

const N8N_CHAT_WEBHOOK_URL = import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL || '/webhook/chat';

const pickTrimmed = (obj: Record<string, unknown> | undefined, key: string): unknown => {
    if (!obj) return undefined;
    if (key in obj) return obj[key];

    const foundKey = Object.keys(obj).find((k) => k.trim() === key);
    return foundKey ? obj[foundKey] : undefined;
};

const normalizeChatPayload = (raw: unknown): ChatResponseData => {
    const root = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | undefined;

    const answer = pickTrimmed(root, 'answer');
    const sources = pickTrimmed(root, 'sources');
    const intent = pickTrimmed(root, 'intent');
    const relatedSources = pickTrimmed(root, 'relatedSources');
    const suggestedQuestions = pickTrimmed(root, 'suggestedQuestions');
    const memoryTurns = pickTrimmed(root, 'memoryTurns');
    const confidence = pickTrimmed(root, 'confidence');
    const sessionId = pickTrimmed(root, 'sessionId');
    const ok = pickTrimmed(root, 'ok');

    return {
        answer:
            typeof answer === 'string' && answer.trim().length > 0
                ? answer
                : 'Hien tai minh chua tim thay bat dong san nao phu hop voi yeu cau cua ban.',
        sources: Array.isArray(sources) ? (sources as ChatSource[]) : [],
        relatedSources: Array.isArray(relatedSources) ? (relatedSources as ChatSource[]) : [],
        suggestedQuestions: Array.isArray(suggestedQuestions) ? (suggestedQuestions as string[]) : undefined,
        intent: (intent as ChatIntent | undefined) ?? undefined,
        memoryTurns: typeof memoryTurns === 'number' ? memoryTurns : undefined,
        confidence: typeof confidence === 'number' ? confidence : undefined,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        ok: typeof ok === 'boolean' ? ok : undefined,
    };
};

const hasChatSchema = (raw: unknown): boolean => {
    const root = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | undefined;
    if (!root) return false;

    const hasAnswer = typeof pickTrimmed(root, 'answer') === 'string';
    const hasControlFields =
        pickTrimmed(root, 'ok') !== undefined ||
        pickTrimmed(root, 'sessionId') !== undefined ||
        pickTrimmed(root, 'sources') !== undefined ||
        pickTrimmed(root, 'relatedSources') !== undefined ||
        pickTrimmed(root, 'confidence') !== undefined;

    return hasAnswer && hasControlFields;
};

export const aiApi = {
    chat: async (question: string, sessionId: string): Promise<ChatResponseData> => {
        try {
            const webhookResponse = await axios.post(
                N8N_CHAT_WEBHOOK_URL,
                { question, sessionId },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 15000,
                },
            );

            if (hasChatSchema(webhookResponse.data)) {
                return normalizeChatPayload(webhookResponse.data);
            }

            console.warn('n8n webhook returned legacy/incomplete schema, fallback to backend /ai/chat');
        } catch (error) {
            console.warn('n8n webhook unavailable, fallback to backend /ai/chat', error);
        }

        const backendResponse = await apiClient.post('/ai/chat', {
            question,
            sessionId,
        });

        return normalizeChatPayload(backendResponse.data);
    },
    generateDescription: async (payload: GenerateDescriptionPayload): Promise<{ description: string }> => {
        const response = await apiClient.post('/ai/generate-description', payload);
        return response.data;
    },
};
