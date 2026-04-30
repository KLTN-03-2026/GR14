import apiClient from './client';

export const appointmentApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/appointments', { params }),

    getById: (id: number) =>
        apiClient.get(`/appointments/${id}`),

    getByEmployee: (employeeId: number) =>
        apiClient.get(`/appointments/employee/${employeeId}`),

    getMyAssigned: () =>
        apiClient.get('/appointments/me/assigned'),

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

    autoAssign: (id: number) =>
        apiClient.put(`/appointments/${id}/auto-assign`),

    suggestSlots: (id: number) =>
        apiClient.get(`/appointments/${id}/suggest-slots`),

    getCalendarEvents: (params: { start: string; end: string; employeeId?: number }) =>
        apiClient.get('/appointments/calendar/events', { params }),

    moveCalendarAppointment: (id: number, data: { appointmentDate: string; employeeId?: number }) =>
        apiClient.put(`/appointments/${id}/calendar-move`, data),

    markFirstContact: (id: number, firstContactAt?: string) =>
        apiClient.put(`/appointments/${id}/first-contact`, firstContactAt ? { firstContactAt } : {}),

    updateActualStatus: (id: number, data: Record<string, unknown>) =>
        apiClient.put(`/appointments/${id}/actual-status`, data),

    getMyAppointments: (params?: { status?: number }) =>
        apiClient.get('/appointments/me', { params }),
};