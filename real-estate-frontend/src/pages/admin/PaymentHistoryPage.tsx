import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { paymentApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils';
import type { Payment } from '@/types';
import { Badge, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

type PaymentRow = Payment & {
    user?: {
        id: number;
        fullName: string;
        email: string;
    };
    subscription?: {
        post?: {
            id: number;
            title: string;
        };
        package?: {
            name: string;
        };
    };
};

const PAYMENT_STATUS_MAP: Record<number, { label: string; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark' }> = {
    0: { label: 'Chờ thanh toán', color: 'info' },
    1: { label: 'Thành công', color: 'success' },
    2: { label: 'Thất bại', color: 'error' },
    3: { label: 'Đã hủy', color: 'light' },
};

const PaymentHistoryPage: React.FC = () => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const loadPayments = useCallback(async () => {
        setLoading(true);
        try {
            // Dùng getAllPayments (admin) để xem toàn bộ hệ thống, không phải chỉ của admin
            const res = await paymentApi.getAllPayments({ page, limit: 10 });
            setPayments(res.data.data || []);
            setTotal(res.data.meta?.total || 0);
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const columns: Column<PaymentRow>[] = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 60,
        },
        {
            title: 'Khách hàng',
            key: 'user',
            render: (_, record: PaymentRow) =>
                record.user
                    ? `${record.user.fullName} (${record.user.email})`
                    : '—',
        },
        {
            title: 'Tin đăng',
            key: 'post',
            render: (_, record: PaymentRow) =>
                record.subscription?.post
                    ? `#${record.subscription.post.id} - ${record.subscription.post.title}`
                    : '—',
        },
        {
            title: 'Gói VIP',
            key: 'package',
            render: (_, record: PaymentRow) =>
                record.subscription?.package ? (
                    <Badge color="warning">{record.subscription.package.name}</Badge>
                ) : (
                    '—'
                ),
        },
        {
            title: 'Số tiền',
            dataIndex: 'amount',
            render: (val: number) => formatCurrency(val),
        },
        {
            title: 'Phương thức',
            dataIndex: 'paymentMethod',
            render: (val: string) => (
                <Badge color={val === 'vnpay' ? 'info' : 'primary'}>
                    {val === 'vnpay' ? 'VNPay' : val === 'momo' ? 'MoMo' : val?.toUpperCase() || '—'}
                </Badge>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (val: number) => {
                const s = PAYMENT_STATUS_MAP[val] || { label: 'Không rõ', color: 'light' as const };
                return <Badge color={s.color}>{s.label}</Badge>;
            },
        },
        {
            title: 'Ngày thanh toán',
            dataIndex: 'paidAt',
            render: (val: string) => (val ? formatDateTime(val) : '—'),
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            render: (val: string) => formatDateTime(val),
        },
    ];

    return (
        <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                Lịch sử thanh toán
            </h2>

            <DataTable
                columns={columns}
                dataSource={payments}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    total,
                    pageSize: 10,
                    onChange: setPage,
                    showTotal: (t) => `Tổng ${t} thanh toán`,
                }}
            />
        </div>
    );
};

export default PaymentHistoryPage;
