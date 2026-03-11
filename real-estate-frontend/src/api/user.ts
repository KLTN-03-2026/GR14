import apiClient from './client';

export const userApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/users', { params }),

    getById: (id: number) =>
        apiClient.get(`/users/${id}`),

    checkPhone: (phone: string) =>
        apiClient.get('/users/check-phone', { params: { phone } }),

    create: (data: Record<string, unknown>) =>
        apiClient.post('/users', data),

    update: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/users/${id}`, data),

    delete: (id: number) =>
        apiClient.delete(`/users/${id}`),
};

export const customerApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/customers', { params }),

    getById: (id: number) =>
        apiClient.get(`/customers/${id}`),
};

export const employeeApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/employees', { params }),

    getById: (id: number) =>
        apiClient.get(`/employees/${id}`),

    create: (data: Record<string, unknown>) =>
        apiClient.post('/employees', data),

    update: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/employees/${id}`, data),

    delete: (id: number) =>
        apiClient.delete(`/employees/${id}`),
};
