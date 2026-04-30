// src/hooks/useDeposit.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depositApi } from '@/api/deposit';          
import type { CreateDepositRequest } from '../types/deposit';

export const useDeposit = () => {
  const queryClient = useQueryClient();

  // Hook tạo đặt cọc
  const createDeposit = useMutation({
    mutationFn: (payload: CreateDepositRequest) => depositApi.createDeposit(payload),

    onSuccess: (response) => {                          
      if (response.data?.data?.paymentUrl) {
  window.location.href = response.data.data.paymentUrl;
      } else {
        alert('Tạo yêu cầu đặt cọc thành công!');
      }
    },

    onError: (error: any) => {
      const message = 
        error.response?.data?.message || 
        'Không thể tạo yêu cầu đặt cọc. Vui lòng thử lại!';
      alert(message);
      console.error(error);
    },
  });

  // Hook lấy danh sách cọc của tôi
  const getMyDeposits = (page: number = 1, limit: number = 10) => {
    return useQuery({
      queryKey: ['my-deposits', page, limit],
      queryFn: () => depositApi.getMyDeposits(page, limit),
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    });
  };

  // Hook lấy chi tiết một giao dịch cọc
  const getDepositDetail = (depositId: number | null | undefined) => {
    return useQuery({
      queryKey: ['deposit-detail', depositId],
      queryFn: () => depositApi.getDepositById(depositId!),
      enabled: !!depositId,
      staleTime: 1000 * 60 * 2,
    });
  };

  // Hook yêu cầu hoàn tiền
  const requestRefund = useMutation({
    mutationFn: ({ depositId, refundAccountInfo }: { 
      depositId: number; 
      refundAccountInfo: string; 
    }) => depositApi.requestRefund(depositId, refundAccountInfo),

    onSuccess: (_, { depositId }) => {
      queryClient.invalidateQueries({ queryKey: ['deposit-detail', depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      alert('Gửi yêu cầu hoàn tiền thành công!');
    },

    onError: (error: any) => {
      const message = error.response?.data?.message || 'Không thể gửi yêu cầu hoàn tiền';
      alert(message);
    },
  });

  return {
    createDeposit,
    getMyDeposits,
    getDepositDetail,
    requestRefund,
  };
};