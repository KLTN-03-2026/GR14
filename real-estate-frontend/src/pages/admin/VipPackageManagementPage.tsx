import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { vipPackageApi } from '@/api';
import { Button, Modal } from '@/components/ui';
import Badge from '@/components/ui/Badge';

interface VipPackage {
    id: number;
    name: string;
    description?: string;
    durationDays: number;
    price: string | number;
    packageType: string;
    priorityLevel: number;
    features?: string;
    status: number;
    createdAt: string;
}

type FeatureFlags = {
    highlight: boolean;
    topPost: boolean;
    featured: boolean;
    urgent: boolean;
    badge: string;
};

const tierLabelByPriority: Record<number, string> = {
    1: 'Cơ bản',
    2: 'Tiêu chuẩn',
    3: 'Nâng cao',
    4: 'Premium',
};

const parseFeatures = (raw?: string): FeatureFlags => {
    if (!raw?.trim()) {
        return { highlight: false, topPost: false, featured: false, urgent: false, badge: '' };
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
            highlight: parsed.highlight === true,
            topPost: parsed.topPost === true,
            featured: parsed.featured === true,
            urgent: parsed.urgent === true,
            badge: typeof parsed.badge === 'string' ? parsed.badge : '',
        };
    } catch {
        return { highlight: false, topPost: false, featured: false, urgent: false, badge: '' };
    }
};

const VipPackageManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [packages, setPackages] = useState<VipPackage[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [packageToDelete, setPackageToDelete] = useState<VipPackage | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [activeTab, setActiveTab] = useState<'ALL' | 'POST_VIP' | 'ACCOUNT_VIP'>('ALL');
    const limit = 10;

    const loadPackages = async () => {
        setLoading(true);
        try {
            const res = await vipPackageApi.getAll(page, limit);
            const data = res.data.data || res.data;
            setPackages(Array.isArray(data) ? data : [data]);
            setTotal(res.data.meta?.total || 0);
        } catch (error) {
            console.error('Error loading packages:', error);
            toast.error('Không tải được danh sách gói VIP');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPackages();
    }, [page]);

    const handleDelete = async (id: number) => {
        setDeleting(true);
        try {
            await vipPackageApi.delete(id);
            toast.success('Xóa thành công');
            setPackageToDelete(null);
            loadPackages();
        } catch (error) {
            console.error('Error deleting package:', error);
            toast.error('Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Gói VIP</h1>
                    <p className="mt-1 text-sm text-gray-500">Tạo và quản lý các gói nâng cao độ hiển thị bài đăng</p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => navigate('/admin/vip-packages/create')}
                >
                    Tạo gói VIP mới
                </Button>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-start w-max border border-gray-200">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'ALL' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Tất cả
                </button>
                <button
                    onClick={() => setActiveTab('POST_VIP')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'POST_VIP' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Nổi bật bài đăng
                </button>
                <button
                    onClick={() => setActiveTab('ACCOUNT_VIP')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'ACCOUNT_VIP' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Nâng tài khoản
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Đang tải...</div>
                ) : packages.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Chưa có gói VIP nào</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Tên gói</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Phân loại</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Thời hạn</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Giá (VNĐ)</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Mức độ ưu tiên</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Quyền lợi</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Trạng thái</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(activeTab === 'ALL' ? packages : packages.filter(p => p.packageType === activeTab)).map((pkg) => {
                                    const features = parseFeatures(pkg.features);
                                    const featureChips = [
                                        features.highlight ? 'Nổi bật' : null,
                                        features.topPost ? 'Top danh sách' : null,
                                        features.featured ? 'Featured' : null,
                                        features.urgent ? 'Khẩn' : null,
                                    ].filter(Boolean) as string[];

                                    return (
                                        <tr key={pkg.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-gray-900">{pkg.name}</p>
                                                    <p className="text-xs text-gray-500">{pkg.description || 'Không có mô tả'}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge color={pkg.packageType === 'ACCOUNT_VIP' ? 'primary' : 'warning'} className="whitespace-nowrap">
                                                    {pkg.packageType === 'ACCOUNT_VIP' ? 'Nâng tài khoản' : 'Nổi bật bài'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {pkg.durationDays} ngày
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-semibold">
                                                {Number(pkg.price).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                                        Mức {pkg.priorityLevel}
                                                    </span>
                                                    <p className="text-xs text-gray-500">{tierLabelByPriority[pkg.priorityLevel] || 'Tùy chỉnh'}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {featureChips.length === 0 && (
                                                        <span className="text-xs text-gray-500">Không có</span>
                                                    )}
                                                    {featureChips.map((chip) => (
                                                        <span key={chip} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                                            {chip}
                                                        </span>
                                                    ))}
                                                    {features.badge && (
                                                        <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
                                                            {features.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge color={pkg.status === 1 ? 'success' : 'error'} className="whitespace-nowrap">
                                                    {pkg.status === 1 ? 'Hoạt động' : 'Không hoạt động'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        iconOnly
                                                        ariaLabel="Sửa"
                                                        onClick={() => navigate(`/admin/vip-packages/${pkg.id}/edit`)}
                                                        startIcon={
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        }
                                                    >
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        iconOnly
                                                        ariaLabel="Xóa"
                                                        onClick={() => setPackageToDelete(pkg)}
                                                        startIcon={
                                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        }
                                                    >
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                    >
                        Trước
                    </Button>
                    <span className="text-sm text-gray-700">
                        Trang {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                    >
                        Tiếp
                    </Button>
                </div>
            )}

            <Modal
                isOpen={!!packageToDelete}
                onClose={() => {
                    if (!deleting) setPackageToDelete(null);
                }}
                title="Xác nhận xóa gói VIP"
                width="max-w-md"
                footer={(
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setPackageToDelete(null)}
                            disabled={deleting}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="danger"
                            loading={deleting}
                            onClick={() => packageToDelete && handleDelete(packageToDelete.id)}
                        >
                            Xóa gói
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn xóa gói
                    {' '}
                    <span className="font-semibold text-gray-900">{packageToDelete?.name}</span>
                    ?
                </p>
                <p className="mt-2 text-xs text-gray-500">
                    Hành động này sẽ chuyển gói về trạng thái không hoạt động.
                </p>
            </Modal>
        </div>
    );
};

export default VipPackageManagementPage;
