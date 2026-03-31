import apiClient from './client';

export const vipPackageApi = {
    // Public endpoints
    getAll: (page = 1, limit = 10) =>
        apiClient.get('/vip-packages', { params: { page, limit } }),

    getById: (id: number) =>
        apiClient.get(`/vip-packages/${id}`),

    // Admin endpoints
    create: (data: Record<string, unknown>) =>
        apiClient.post('/vip-packages', data),

    update: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/vip-packages/${id}`, data),

    delete: (id: number) =>
        apiClient.delete(`/vip-packages/${id}`),

    // Subscriptions
    getAllSubscriptions: (page = 1, limit = 10, status?: number) =>
        apiClient.get('/vip-packages/admin/subscriptions', {
            params: { page, limit, ...(status !== undefined && { status }) },
        }),

    getMySubscriptions: (page = 1, limit = 10) =>
        apiClient.get('/vip-packages/my/subscriptions', { params: { page, limit } }),
};
