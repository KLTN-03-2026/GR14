import { Tag } from 'antd';

interface Props {
  status: number;
}

// Map status → label + color
const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: 'Chờ thanh toán', color: 'default' },        // pending
  1: { label: 'Đã thanh toán', color: 'green' },           // paid
  2: { label: 'Yêu cầu hoàn tiền', color: 'orange' },      // refund_requested
  3: { label: 'Đã hoàn tiền', color: 'red' },              // refunded
  4: { label: 'Hết hạn', color: 'volcano' },               // expired
  5: { label: 'Hoàn tất', color: 'blue' },                 // completed
};

const DepositStatusBadge = ({ status }: Props) => {
  const statusInfo = STATUS_MAP[status] || {
    label: 'Không xác định',
    color: 'default',
  };

  return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
};

export default DepositStatusBadge;