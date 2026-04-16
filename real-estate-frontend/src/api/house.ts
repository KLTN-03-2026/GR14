import apiClient from './client';

export const houseApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/houses', { params }),
    getMyHouses: (params?: Record<string, unknown>) => 
        apiClient.get('/houses/me/assigned', { params }),
    getById: (id: number) =>
        apiClient.get(`/houses/${id}`),

    create: (data: FormData) =>
        apiClient.post('/houses', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    update: (id: number, data: FormData) =>
        apiClient.put(`/houses/${id}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    delete: (id: number) =>
        apiClient.delete(`/houses/${id}`),
};
