import apiClient from './client';
import type { CreatePaymentRequest } from '@/types';

export const paymentApi = {
    // VIP Packages
    getPackages: (params?: Record<string, unknown>) =>
        apiClient.get('/vip-packages', { params }),

    getPackageById: (id: number) =>
        apiClient.get(`/vip-packages/${id}`),

    // Payment
    createPayment: (data: CreatePaymentRequest) =>
        apiClient.post('/payment/create', data),

    /** Lấy payment của user hiện tại (dùng cho trang cá nhân) */
    getMyPayments: (params?: Record<string, unknown>) =>
        apiClient.get('/payment/my', { params }),

    /** Lấy toàn bộ payment trong hệ thống – chỉ ADMIN (dùng cho admin panel) */
    getAllPayments: (params?: Record<string, unknown>) =>
        apiClient.get('/payment/admin/all', { params }),

    getPaymentById: (id: number) =>
        apiClient.get(`/payment/${id}`),

    // Mock/Test – backend đã guard @Roles('ADMIN')
    simulateSuccess: (paymentId: number) =>
        apiClient.post(`/payment/${paymentId}/simulate-success`),

    // VIP Subscriptions
    getMySubscriptions: (params?: Record<string, unknown>) =>
        apiClient.get('/vip-packages/my/subscriptions', { params }),

    cancelSubscription: (id: number) =>
        apiClient.post(`/vip-packages/subscriptions/${id}/cancel`),

    verifyVNPayReturn: (queryString: string) =>
        apiClient.get(`/payment/vnpay-return${queryString}`),

    getPostVipPackages: () =>
        apiClient.get('/vip-packages', { params: { type: 'post', limit: 100 } }),
};