// src/api/deposit.ts
import apiClient from './client';
import type {
  CreateDepositRequest,
  DepositResponse,
  MyDepositsResponse,
  DepositDetail,
  RequestRefundRequest,
} from '../types/deposit';

export const depositApi = {
  /**
   * POST /deposits
   * Tạo yêu cầu đặt cọc → trả về paymentUrl để redirect
   */
  createDeposit: (payload: CreateDepositRequest) =>
    apiClient.post<DepositResponse>('/deposits', payload),

  /**
   * GET /deposits/my
   * Lấy danh sách cọc của tôi
   */
  getMyDeposits: (page = 1, limit = 10) =>
    apiClient.get<MyDepositsResponse>('/deposits/my', { params: { page, limit } }),

  /**
   * GET /deposits/:id
   * Lấy chi tiết một giao dịch cọc
   */
  getDepositById: (id: number) =>
    apiClient.get<DepositDetail>(`/deposits/${id}`),

  /**
   * POST /deposits/:id/refund
   * Yêu cầu hoàn tiền
   */
  requestRefund: (depositId: number, refundAccountInfo: string) => {
    const payload: RequestRefundRequest = { refundAccountInfo };
    return apiClient.post(`/deposits/${depositId}/refund`, payload);
  },
  // src/api/deposit.ts — thêm vào object depositApi

getAdminRefunds: (params: { page?: number; limit?: number; status?: number }) =>
  apiClient.get('/deposits/admin/refunds', { params }),

adminProcessRefund: (id: number, body: { approve: boolean; adminNote?: string }) =>
  apiClient.patch(`/deposits/${id}/refund`, body),
};
