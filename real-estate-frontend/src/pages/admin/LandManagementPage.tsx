import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { landApi } from '@/api';
import { formatCurrency, formatArea } from '@/utils';
import type { Land } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import { Button, Badge, DataTable, ImageLightbox } from '@/components/ui';
import type { Column } from '@/components/ui';

const LandManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [lands, setLands] = useState<Land[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);

    const loadLands = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;
            const res = await landApi.getAll(params);
            const data = res.data;
            setLands(data.data || data);
            setTotal(data.totalItems || data.meta?.total || 0);
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadLands();
    }, [loadLands]);

    const handleDelete = async (id: number) => {
        try {
            await landApi.delete(id);
            toast.success('Xóa thành công');
            loadLands();
        } catch {
            toast.error('Xóa thất bại');
        }
    };

    const columns: Column<Land>[] = [
        { title: 'Mã', dataIndex: 'code', key: 'code', width: 100 },
        {
            title: 'Ảnh',
            dataIndex: 'images',
            key: 'images',
            width: 110,
            render: (images: Land['images']) => {
                if (!images?.length) return <span className="text-gray-300 text-xs">Chưa có</span>;
                return (
                    <div className="flex items-center gap-1">
                        <img
                            src={images[0].url}
                            alt=""
                            className="w-[60px] h-[50px] object-cover rounded cursor-zoom-in"
                            onClick={() => {
                                setPreviewImages(images.map((img) => img.url));
                                setPreviewIndex(0);
                                setPreviewOpen(true);
                            }}
                        />
                        {images.length > 1 && (
                            <span className="text-[11px] text-white bg-brand-500 rounded-full px-1.5 py-px whitespace-nowrap">
                                +{images.length - 1}
                            </span>
                        )}
                    </div>
                );
            },
        },
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title', ellipsis: true },
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
            title: 'Loại đất',
            dataIndex: 'landType',
            key: 'landType',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => (
                <Badge color={status === 1 ? 'success' : 'error'}>
                    {status === 1 ? 'Hoạt động' : 'Ẩn'}
                </Badge>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 200,
            render: (_: unknown, record: Land) => (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        iconOnly
                        ariaLabel="Sửa"
                        startIcon={(
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        )}
                        onClick={() => navigate(`/admin/lands/${record.id}/edit`)}
                    />
                    <Button
                        size="sm"
                        variant="danger"
                        iconOnly
                        ariaLabel="Xóa"
                        startIcon={(
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        )}
                        onClick={() => {
                            if (window.confirm('Bạn có chắc muốn xóa?')) {
                                handleDelete(record.id);
                            }
                        }}
                    />
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Quản lý đất</h3>
                <Button
                    variant="primary"
                    iconOnly
                    ariaLabel="Thêm mới"
                    onClick={() => navigate('/admin/lands/create')}
                    startIcon={
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                    }
                />
            </div>

            <div className="mb-4 w-full min-w-0 sm:max-w-[400px]">
                <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            <DataTable
                columns={columns}
                dataSource={lands}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    total,
                    pageSize: DEFAULT_PAGE_SIZE,
                    onChange: setPage,
                    showTotal: (total) => `Tổng ${total} bản ghi`,
                }}
            />

            <ImageLightbox
                isOpen={previewOpen}
                images={previewImages}
                initialIndex={previewIndex}
                onClose={() => setPreviewOpen(false)}
            />
        </div>
    );
};

export default LandManagementPage;
