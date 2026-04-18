import { formatCurrency, formatDateTime } from '@/utils';
import Badge from '@/components/ui/Badge';

interface PaymentRow {
    id: number;
    amount: number;
    paymentMethod: string;
    status: number;
    transactionId?: string;
    paidAt?: string;
    createdAt: string;
    user?: {
        id: number;
        fullName: string;
        email: string;
    };
    subscription?: {
        id: number;
        post?: {
            id: number;
            title: string;
        };
        package?: {
            name: string;
        };
    };
}

interface Props { payment: PaymentRow; }

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <dt className="w-40 flex-shrink-0 text-sm font-medium text-gray-500">{label}</dt>
        <dd className="flex-1 text-sm text-gray-900 break-words">{value ?? <span className="text-gray-300">—</span>}</dd>
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-500">{title}</h3>
        <dl>{children}</dl>
    </div>
);

const PAYMENT_STATUS_MAP: Record<number, { label: string; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark' }> = {
    0: { label: 'Chờ thanh toán', color: 'info' },
    1: { label: 'Thành công', color: 'success' },
    2: { label: 'Thất bại', color: 'error' },
    3: { label: 'Đã hủy', color: 'light' },
};

const PaymentDetailPanel: React.FC<Props> = ({ payment }) => {
    const statusInfo = PAYMENT_STATUS_MAP[payment.status] || { label: 'Không rõ', color: 'light' };

    return (
        <div>
            <Section title="Thông tin giao dịch">
                <Row label="Mã giao dịch (ID)" value={`#${payment.id}`} />
                <Row label="Mã tham chiếu (Gateway)" value={payment.transactionId} />
                <Row label="Số tiền" value={<span className="font-bold text-gray-900">{formatCurrency(payment.amount)}</span>} />
                <Row label="Phương thức" value={
                    <Badge color={payment.paymentMethod === 'vnpay' ? 'info' : 'primary'}>
                        {payment.paymentMethod?.toUpperCase()}
                    </Badge>
                } />
                <Row label="Trạng thái" value={
                    <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                } />
            </Section>

            <Section title="Thông tin người dùng">
                <Row label="ID Người dùng" value={payment.user?.id ? `#${payment.user.id}` : undefined} />
                <Row label="Họ tên" value={payment.user?.fullName} />
                <Row label="Email" value={payment.user?.email} />
            </Section>

            <Section title="Thông tin dịch vụ">
                {payment.subscription?.package ? (
                    <Row label="Gói dịch vụ" value={<span className="font-semibold">{payment.subscription.package.name}</span>} />
                ) : (
                    <Row label="Gói dịch vụ" value="N/A" />
                )}
                {payment.subscription?.post && (
                    <>
                        <Row label="ID Bài đăng" value={`#${payment.subscription.post.id}`} />
                        <Row label="Tiêu đề bài đăng" value={payment.subscription.post.title} />
                    </>
                )}
            </Section>

            <Section title="Thời gian">
                <Row label="Ngày tạo" value={formatDateTime(payment.createdAt)} />
                <Row label="Ngày thanh toán" value={payment.paidAt ? formatDateTime(payment.paidAt) : undefined} />
            </Section>
        </div>
    );
};

export default PaymentDetailPanel;
