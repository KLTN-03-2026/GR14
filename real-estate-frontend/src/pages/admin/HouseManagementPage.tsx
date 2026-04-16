import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { houseApi, propertyCategoryApi } from '@/api';
import { formatCurrency, formatArea } from '@/utils';
import type { House, PropertyCategory } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/Table';
import ImageLightbox from '@/components/ui/ImageLightbox';
import Modal from '@/components/ui/Modal';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import DetailDrawer from '@/components/ui/DetailDrawer';
import HouseDetailPanel from '@/components/common/HouseDetailPanel';
import type { Column } from '@/components/ui/Table';

const HouseManagementPage: React.FC = () => {
    const ACTIVE_STATUS = 1;
    const SOLD_STATUS = 0;

    const navigate = useNavigate();
    const { hasRole } = useAuthStore();
    const isEmployee = hasRole('EMPLOYEE');
    const [houses, setHouses] = useState<House[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<number>(ACTIVE_STATUS);
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [categories, setCategories] = useState<PropertyCategory[]>([]);
    const [activeCount, setActiveCount] = useState(0);
    const [soldCount, setSoldCount] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<House | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [detailItem, setDetailItem] = useState<House | null>(null);

    const houseCategories = categories.filter((c) => c.categoryType === 'HOUSE');

    const loadCategories = useCallback(async () => {
        try {
            const res = await propertyCategoryApi.getAll();
            setCategories(res.data.data || res.data);
        } catch {
            toast.error('Lỗi tải danh mục');
        }
    }, []);

    const loadHouses = useCallback(async () => {
        setLoading(true);
        try {
            const listParams: Record<string, unknown> = {
                page,
                limit: DEFAULT_PAGE_SIZE,
                status: statusFilter,
            };
            if (search) listParams.search = search;
            if (categoryFilter) listParams.categoryId = Number(categoryFilter);

            const countParams = (status: number): Record<string, unknown> => {
                const params: Record<string, unknown> = { page: 1, limit: 1, status };
                if (search) params.search = search;
                if (categoryFilter) params.categoryId = Number(categoryFilter);
                return params;
            };

            const fetchMethod = isEmployee ? houseApi.getMyHouses : houseApi.getAll;

            const [listRes, activeRes, soldRes] = await Promise.all([
                fetchMethod(listParams),
                fetchMethod(countParams(ACTIVE_STATUS)),
                fetchMethod(countParams(SOLD_STATUS)),
            ]);

            const data = listRes.data;
            const activeData = activeRes.data;
            const soldData = soldRes.data;

            const getTotalItems = (responseData: unknown): number => {
                const payload = responseData as { totalItems?: number; meta?: { total?: number } };
                return payload.totalItems || payload.meta?.total || 0;
            };

            setHouses(data.data || data);
            setTotal(getTotalItems(data));
            setActiveCount(getTotalItems(activeData));
            setSoldCount(getTotalItems(soldData));
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, categoryFilter]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    useEffect(() => {
        loadHouses();
    }, [loadHouses]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await houseApi.delete(deleteTarget.id);
            toast.success('Xóa thành công');
            setDeleteModalOpen(false);
            setDeleteTarget(null);
            loadHouses();
        } catch {
            toast.error('Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const columns: Column<House>[] = [
        { title: 'Mã', dataIndex: 'code', key: 'code', width: 100 },
        {
            title: 'Ảnh',
            dataIndex: 'images',
            key: 'images',
            width: 110,
            render: (images: House['images']) => {
                if (!images?.length) return <span className="text-gray-300 text-xs">Chưa có</span>;
                return (
                    <div className="flex items-center gap-1">
                        <img
                            src={images[0].url}
                            alt=""
                            className="w-[60px] h-[50px] object-cover rounded cursor-zoom-in"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImages(images.map((img) => img.url));
                                setPreviewIndex(0);
                                setPreviewOpen(true);
                            }}
                        />
                        {images.length > 1 && (
                            <span className="text-[11px] text-white bg-brand-500 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                                +{images.length - 1}
                            </span>
                        )}
                    </div>
                );
            },
        },
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title', ellipsis: true },
        {
            title: 'Địa chỉ',
            key: 'address',
            width: 280,
            render: (_: unknown, record: House) => {
                const line1 = [record.houseNumber, record.street].filter(Boolean).join(' ');
                const line2 = record.ward || '';
                const line3 = [record.district, record.city].filter(Boolean).join(', ');

                if (!line1 && !line2 && !line3) return '—';

                return (
                    <div className="leading-6">
                        {line1 && <div>{line1}</div>}
                        {line2 && <div>{line2}</div>}
                        {line3 && <div>{line3}</div>}
                    </div>
                );
            },
        },
        {
            title: 'Giá',
            dataIndex: 'price',
            key: 'price',
            render: (price: number) => formatCurrency(price),
        },
        {
            title: 'Diện tích',
            dataIndex: 'area',
            key: 'area',
            render: (area: number) => formatArea(area),
        },
        {
            title: 'Danh mục',
            render: (_: unknown, record: House) => record.category?.name || '—',
            key: 'category',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => (
                <Badge color={status === 1 ? 'success' : 'error'}>
                    {status === 1 ? 'Hoạt động' : 'Đã bán'}
                </Badge>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 200,
            render: (_: unknown, record: House) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                        size="sm"
                        variant="outline"
                        iconOnly
                        ariaLabel="Sửa"
                        onClick={() => navigate(`/admin/houses/${record.id}/edit`)}
                        startIcon={
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        }
                    />
                    <Button
                        size="sm"
                        variant="danger"
                        iconOnly
                        ariaLabel="Xóa"
                        onClick={() => {
                            setDeleteTarget(record);
                            setDeleteModalOpen(true);
                        }}
                        startIcon={
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        }
                    />
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800 m-0">Quản lý nhà</h3>
                <Button
                    variant="primary"
                    iconOnly
                    ariaLabel="Thêm mới"
                    onClick={() => navigate('/admin/houses/create')}
                    startIcon={
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    }
                />
            </div>

            <div className="mb-6 space-y-3">
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => { setStatusFilter(1); setPage(1); }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${statusFilter === ACTIVE_STATUS
                            ? 'bg-brand-500 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Hoạt động ({activeCount})
                    </button>
                    <button
                        onClick={() => { setStatusFilter(SOLD_STATUS); setPage(1); }}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${statusFilter === SOLD_STATUS
                            ? 'bg-brand-500 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Đã bán ({soldCount})
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full min-w-0">
                    <div className="w-full sm:max-w-[220px]">
                        <select
                            className="admin-control admin-filter-input h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">Tất cả danh mục</option>
                            {houseCategories.map((category) => (
                                <option key={category.id} value={String(category.id)}>{category.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full sm:max-w-[400px]">
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[1280px]">
                    <DataTable
                        columns={columns}
                        dataSource={houses}
                        rowKey="id"
                        loading={loading}
                        onRow={(record) => ({ onClick: () => setDetailItem(record) })}
                        pagination={{
                            current: page,
                            total,
                            pageSize: DEFAULT_PAGE_SIZE,
                            onChange: setPage,
                            showTotal: (total: number) => `Tổng ${total} bản ghi`,
                        }}
                    />
                </div>
            </div>

            <ImageLightbox
                isOpen={previewOpen}
                images={previewImages}
                initialIndex={previewIndex}
                onClose={() => setPreviewOpen(false)}
            />

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => {
                    if (!deleting) {
                        setDeleteModalOpen(false);
                        setDeleteTarget(null);
                    }
                }}
                title="Xác nhận xóa nhà"
                width="max-w-md"
                footer={(
                    <>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setDeleteTarget(null);
                            }}
                            disabled={deleting}
                        >
                            Hủy
                        </Button>
                        <Button variant="danger" onClick={handleDelete} loading={deleting}>
                            Xóa
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn xóa nhà
                    {' '}
                    <span className="font-semibold text-gray-900">{deleteTarget?.title}</span>
                    ?
                </p>
            </Modal>

            <LoadingOverlay
                visible={deleting}
                title="Đang xóa nhà"
                description="Vui lòng đợi hệ thống xử lý ảnh và dữ liệu..."
            />

            <DetailDrawer
                isOpen={!!detailItem}
                onClose={() => setDetailItem(null)}
                title={detailItem ? `Chi tiết: ${detailItem.title}` : 'Chi tiết nhà'}
            >
                {detailItem && <HouseDetailPanel house={detailItem} />}
            </DetailDrawer>
        </div>
    );
};

export default HouseManagementPage;
