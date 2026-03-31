import apiClient from './client';

export const recommendationApi = {
    getHouseRecommendations: (limit = 5) =>
        apiClient.get('/recommendations/houses', { params: { limit } }),

    getLandRecommendations: (limit = 5) =>
        apiClient.get('/recommendations/lands', { params: { limit } }),

    getAIRecommendations: (limit = 10) =>
        apiClient.get('/recommendations/ai', { params: { limit } }),

    trackBehavior: (data: { action: string; houseId?: number; landId?: number }) =>
        apiClient.post('/recommendations/track', data),
};
