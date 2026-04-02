import apiClient from './client';

export const roleApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/roles', { params }),

    getById: (id: number) =>
        apiClient.get(`/roles/${id}`),

    create: (data: Record<string, unknown>) =>
        apiClient.post('/roles', data),

    update: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/roles/${id}`, data),

    delete: (id: number) =>
        apiClient.delete(`/roles/${id}`),
};

export const propertyCategoryApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/property-categories', { params }),

    getById: (id: number) =>
        apiClient.get(`/property-categories/${id}`),

    create: (data: Record<string, unknown>) =>
        apiClient.post('/property-categories', data),

    update: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/property-categories/${id}`, data),

    delete: (id: number) =>
        apiClient.delete(`/property-categories/${id}`),
};

export const favoriteApi = {
    getAll: () =>
        apiClient.get('/favorites'),

    addHouse: (houseId: number) =>
        apiClient.post(`/favorites/house/${houseId}`),

    addLand: (landId: number) =>
        apiClient.post(`/favorites/land/${landId}`),

    removeHouse: (houseId: number) =>
        apiClient.delete(`/favorites/house/${houseId}`),

    removeLand: (landId: number) =>
        apiClient.delete(`/favorites/land/${landId}`),
};

export const featuredApi = {
    getAll: () =>
        apiClient.get('/featured'),

    getPosts: (limit = 4) =>
        apiClient.get('/featured/posts', { params: { limit } }),
};

export const profileApi = {
    getProfile: () =>
        apiClient.get('/profile'),

    updateProfile: (data: FormData | Record<string, unknown>) =>
        apiClient.put('/profile', data, {
            headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
        }),

    changePassword: (data: { oldPassword: string; newPassword: string }) =>
        apiClient.put('/profile/change-password', data),
};
