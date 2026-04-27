import apiClient from './client';

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

/**
 * Last line of defense: if the answer looks like raw JSON,
 * replace it with a clean fallback so the user never sees JSON in the chat.
 */
const sanitizeAnswer = (text: string): string => {
    const trimmed = text.trim();
    // Detect raw JSON: starts with { or ``` or looks like a JSON object
    if (
        trimmed.startsWith('{') ||
        trimmed.startsWith('```') ||
        trimmed.startsWith('[') ||
        /^["']?\s*\{/.test(trimmed)
    ) {
        return 'Mình đã tìm thấy một số bất động sản phù hợp. Bạn có thể xem chi tiết bên dưới.';
    }
    return text;
};

const normalizeChatPayload = (raw: unknown): ChatResponseData => {
    const root = ((raw as { data?: unknown })?.data ?? raw) as Record<string, unknown> | undefined;
    if (!root) {
        return {
            answer: 'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.',
            sources: [],
        };
    }

    const pick = (key: string): unknown => {
        if (key in root) return root[key];
        const found = Object.keys(root).find((k) => k.trim() === key);
        return found ? root[found] : undefined;
    };

    const answer = pick('answer');
    const sources = pick('sources');
    const intent = pick('intent');
    const relatedSources = pick('relatedSources');
    const suggestedQuestions = pick('suggestedQuestions');
    const memoryTurns = pick('memoryTurns');
    const confidence = pick('confidence');
    const sessionId = pick('sessionId');
    const ok = pick('ok');

    const rawAnswer =
        typeof answer === 'string' && answer.trim().length > 0
            ? answer
            : 'Hiện tại mình chưa tìm thấy bất động sản nào phù hợp với yêu cầu của bạn.';

    return {
        answer: sanitizeAnswer(rawAnswer),
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

export const aiApi = {
    chat: async (question: string, sessionId: string): Promise<ChatResponseData> => {
        const response = await apiClient.post('/ai/chat', {
            question,
            sessionId,
        });

        return normalizeChatPayload(response.data);
    },
    generateDescription: async (payload: GenerateDescriptionPayload): Promise<{ description: string }> => {
        const response = await apiClient.post('/ai/generate-description', payload);
        return response.data;
    },
};
