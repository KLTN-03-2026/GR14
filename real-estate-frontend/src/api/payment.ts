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

    getMyPayments: (params?: Record<string, unknown>) =>
        apiClient.get('/payment/my', { params }),

    getPaymentById: (id: number) =>
        apiClient.get(`/payment/${id}`),

    // Mock/Test
    simulateSuccess: (paymentId: number) =>
        apiClient.post(`/payment/${paymentId}/simulate-success`),

    // VIP Subscriptions
    getMySubscriptions: (params?: Record<string, unknown>) =>
        apiClient.get('/vip-packages/my/subscriptions', { params }),

    cancelSubscription: (id: number) =>
        apiClient.post(`/vip-packages/subscriptions/${id}/cancel`),

    verifyVNPayReturn: (queryString: string) => 
        apiClient.get(`/payment/vnpay-return${queryString}`),
};