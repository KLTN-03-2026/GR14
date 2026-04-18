import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { paymentApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils';
import type { Payment } from '@/types';
import { Badge, DataTable, DetailDrawer } from '@/components/ui';
import type { Column } from '@/components/ui';
import PaymentDetailPanel from '@/components/common/PaymentDetailPanel';

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

    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [detailItem, setDetailItem] = useState<PaymentRow | null>(null);

    const loadPayments = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: 10 };
            if (search) params.search = search;
            if (methodFilter) params.method = methodFilter;
            if (statusFilter !== '') params.status = statusFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await paymentApi.getAllPayments(params);
            setPayments(res.data.data || []);
            setTotal(res.data.meta?.total || 0);
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [page, search, methodFilter, statusFilter, startDate, endDate]);

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

            <div className="mb-6 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3 w-full flex-wrap">
                    <div className="w-full sm:max-w-[220px]">
                        <input
                            type="text"
                            placeholder="Tìm kiếm khách hàng/email..."
                            className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div className="w-full sm:max-w-[180px]">
                        <select
                            className="admin-control admin-filter-input h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={methodFilter}
                            onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">Tất cả phương thức</option>
                            <option value="vnpay">VNPay</option>
                            <option value="momo">MoMo</option>
                        </select>
                    </div>
                    <div className="w-full sm:max-w-[180px]">
                        <select
                            className="admin-control admin-filter-input h-[42px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="0">Chờ thanh toán</option>
                            <option value="1">Thành công</option>
                            <option value="2">Thất bại</option>
                            <option value="3">Đã hủy</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                            type="date"
                            className="admin-control admin-filter-input h-[42px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                        />
                        <span className="text-gray-500">-</span>
                        <input
                            type="date"
                            className="admin-control admin-filter-input h-[42px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                        />
                        <button
                            type="button"
                            className="ml-2 h-[42px] px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300 flex items-center justify-center whitespace-nowrap"
                            onClick={() => {
                                setSearch('');
                                setMethodFilter('');
                                setStatusFilter('');
                                setStartDate('');
                                setEndDate('');
                                setPage(1);
                            }}
                        >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Mặc định
                        </button>
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                dataSource={payments}
                rowKey="id"
                loading={loading}
                onRow={(record) => ({ onClick: () => setDetailItem(record as PaymentRow) })}
                pagination={{
                    current: page,
                    total,
                    pageSize: 10,
                    onChange: setPage,
                    showTotal: (t) => `Tổng ${t} thanh toán`,
                }}
            />

            <DetailDrawer
                isOpen={!!detailItem}
                onClose={() => setDetailItem(null)}
                title={detailItem ? `Chi tiết giao dịch #${detailItem.id}` : 'Chi tiết giao dịch'}
            >
                {detailItem && <PaymentDetailPanel payment={detailItem} />}
            </DetailDrawer>
        </div>
    );
};

export default PaymentHistoryPage;
