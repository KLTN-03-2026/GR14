import React from 'react';
import { Button } from 'antd';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPayNow: () => void;
  depositId?: string | number | null;
  amount?: number | null;
  propertyTitle?: string;
  propertyImage?: string;
}

const fmt = (v?: number | null) => (v ? new Intl.NumberFormat('vi-VN').format(v) + ' đ' : '—');

const DepositCreatedModal = ({
  visible,
  onClose,
  onPayNow,
  depositId,
  amount,
  propertyTitle,
  propertyImage,
}: Props) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[1600] flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.45)' }}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-6">
        <div className="flex items-start gap-4">
          {propertyImage ? (
            <img src={propertyImage} alt={propertyTitle} className="w-20 h-16 object-cover rounded-md" />
          ) : (
            <div className="w-20 h-16 rounded-md bg-gray-100" />
          )}

          <div className="flex-1">
            <h3 className="text-lg font-semibold">Yêu cầu đặt cọc đã tạo</h3>
            <p className="text-sm text-gray-500 mt-1">Mã cọc: <span className="font-medium">{depositId || '—'}</span></p>
            <p className="text-sm text-gray-500 mt-1">Số tiền: <span className="font-medium text-orange-600">{fmt(amount)}</span></p>
            {propertyTitle && <p className="text-sm text-gray-600 mt-2">BĐS: {propertyTitle}</p>}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button block type="primary" onClick={onPayNow} style={{ background: '#f97316', borderColor: '#f97316' }}>
            Thanh toán ngay
          </Button>
          <Button block onClick={onClose}>
            Thanh toán sau
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DepositCreatedModal;
