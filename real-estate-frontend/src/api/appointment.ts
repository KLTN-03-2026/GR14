import apiClient from './client';

export const appointmentApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/appointments', { params }),

    getById: (id: number) =>
        apiClient.get(`/appointments/${id}`),

    getByEmployee: (employeeId: number) =>
        apiClient.get(`/appointments/employee/${employeeId}`),

    create: (data: Record<string, unknown>) =>
        apiClient.post('/appointments', data),

    adminCreate: (data: Record<string, unknown>) =>
        apiClient.post('/appointments/admin', data),

    update: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/appointments/${id}`, data),

    delete: (id: number) =>
        apiClient.delete(`/appointments/${id}`),

    approve: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/appointments/${id}/approve`, data),

    cancel: (id: number, data?: Record<string, unknown>) =>
        apiClient.put(`/appointments/${id}/cancel`, data || {}),

    assignEmployee: (id: number, employeeId: number) =>
        apiClient.put(`/appointments/${id}/assign`, { employeeId }),

    updateActualStatus: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/appointments/${id}/actual-status`, data),
};
