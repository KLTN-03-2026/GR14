import apiClient from './client';

export const landApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/lands', { params }),
    getMyLands: (params?: Record<string, unknown>) =>
        apiClient.get('/lands/me/assigned', { params }),

    getById: (id: number) =>
        apiClient.get(`/lands/${id}`),

    create: (data: FormData) =>
        apiClient.post('/lands', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    update: (id: number, data: FormData) =>
        apiClient.put(`/lands/${id}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    delete: (id: number) =>
        apiClient.delete(`/lands/${id}`),
};
