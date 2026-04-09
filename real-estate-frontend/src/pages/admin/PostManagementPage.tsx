import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { postApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils';
import type { Post } from '@/types';
import { PostType } from '@/types/post';
import { DEFAULT_PAGE_SIZE, POST_STATUS_LABELS } from '@/constants';
import { Button, Badge, Modal, DataTable, ImageLightbox, LoadingOverlay } from '@/components/ui';
import type { Column } from '@/components/ui';
import PostForm from '@/components/common/PostForm';

type ApiError = {
    response?: {
        data?: {
            message?: string | string[];
        };
    };
};

const PostManagementPage: React.FC = () => {
    const [allPosts, setAllPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'vip'>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [deletePost, setDeletePost] = useState<Post | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const loadPosts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await postApi.getAll();
            const payload = (res as any)?.data;
            const maybePosts = payload?.data ?? payload;
            const posts = Array.isArray(maybePosts)
                ? maybePosts
                : Array.isArray(maybePosts?.data)
                    ? maybePosts.data
                    : [];

            if (!Array.isArray(posts)) {
                console.warn('Unexpected posts payload:', payload);
            }

            setAllPosts(posts);
        } catch (err: any) {
            const status = err?.response?.status;
            const apiMessage = err?.response?.data?.message;
            const url = err?.config?.baseURL && err?.config?.url ? `${err.config.baseURL}${err.config.url}` : undefined;

            console.error('Load posts error:', err);
            toast.error(
                status
                    ? `Lỗi tải dữ liệu (HTTP ${status})${url ? `: ${url}` : ''}`
                    : 'Lỗi tải dữ liệu'
            );
            if (apiMessage) {
                toast.error(Array.isArray(apiMessage) ? apiMessage[0] : apiMessage);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const isVipPost = (post: Post) => Boolean(post.isVip || post.vipPackageName || post.vipExpiry);

    const getVipTierLabel = (post: Post): string => {
        if (!isVipPost(post)) return '—';

        const level = post.vipPriorityLevel;
        if (level === 0) return 'VIP 0';
        if (level === 1) return 'VIP 1';
        if (level === 2) return 'VIP 2';
        if (level === 3) return 'VIP 3';

        const name = String(post.vipPackageName || '').toLowerCase();
        if (!name) return 'VIP';
        if (name.includes('30')) return 'VIP 3';
        if (name.includes('15')) return 'VIP 2';
        if (name.includes('7')) return 'VIP 1';
        if (name.includes('10k') || name.includes('1 lần') || name.includes('1 lan')) return 'VIP 0';
        return 'VIP';
    };

    // Tooltip VIP đã được bỏ ở cột "Tiêu đề" (đã có cột "Gói VIP" riêng).

    const filteredByTabAndSearch = useMemo(() => {
        let result = [...allPosts];

        if (activeTab === 'pending') result = result.filter((p) => p.status === 1);
        else if (activeTab === 'approved') result = result.filter((p) => p.status === 2);
        else if (activeTab === 'rejected') result = result.filter((p) => p.status === 3);
        else if (activeTab === 'vip') result = result.filter((p) => isVipPost(p));

        if (search.trim()) {
            const keyword = search.toLowerCase().trim();
            result = result.filter(
                (p) => p.title?.toLowerCase().includes(keyword) || p.address?.toLowerCase().includes(keyword),
            );
        }

        return result;
    }, [allPosts, activeTab, search]);

    const pagedPosts = useMemo(() => {
        const start = (page - 1) * DEFAULT_PAGE_SIZE;
        return filteredByTabAndSearch.slice(start, start + DEFAULT_PAGE_SIZE);
    }, [filteredByTabAndSearch, page]);

    const openModal = (record?: Post) => {
        setEditingPost(record || null);
        setModalOpen(true);
    };

    const handleSubmit = async (submitData: FormData) => {
        setSubmitting(true);
        try {
            if (editingPost) {
                await postApi.update(editingPost.id, submitData);
                toast.success('Cập nhật bài đăng thành công');
            } else {
                await postApi.create(submitData);
                toast.success('Thêm bài đăng thành công');
            }
            loadPosts();
            setModalOpen(false);
        } catch (err: unknown) {
            const error = err as ApiError;
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra';
            toast.error(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deletePost) return;
        setDeleting(true);
        try {
            await postApi.delete(deletePost.id);
            toast.success('Xóa thành công');
            setDeletePost(null);
            loadPosts();
        } catch {
            toast.error('Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            if (status === 2) await postApi.approve(id);
            if (status === 3) await postApi.reject(id);
            toast.success('Cập nhật trạng thái thành công');
            loadPosts();
        } catch {
            toast.error('Thất bại');
        }
    };

    const columns: Column<Post>[] = [
        {
            title: 'Ảnh',
            width: 80,
            render: (_, record) =>
                record.images?.length ? (
                    <img
                        src={record.images[0].url}
                        alt="thumb"
                        className="h-[50px] w-[60px] cursor-pointer rounded object-cover"
                        onClick={() => {
                           setPreviewImages(record.images?.map((img) => img.url) || []);
                            setPreviewIndex(0);
                            setPreviewOpen(true);
                        }}
                    />
                ) : '—',
        },
        {
            title: 'Tiêu đề',
            width: 220,
            render: (_, record) => (
                <span className="font-medium">{record.title}</span>
            ),
        },
        {
            title: 'Mô tả',
            key: 'description',
            width: 550,
            render: (_, r) =>
                !r.description ? '—' : (() => {
                    const raw = String(r.description || '');
                    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
                    const escapeHtml = (s: string) =>
                        s
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');

                    const html = looksLikeHtml
                        ? raw
                        : `<div>${escapeHtml(raw).replace(/\r?\n/g, '<br />')}</div>`;

                    return (
                        <div
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
                            style={{ lineHeight: '1.6', fontSize: '13.5px', whiteSpace: 'normal', wordBreak: 'break-word' }}
                        />
                    );
                })(),
        },
        { title: 'Địa chỉ', dataIndex: 'address', width: 280 },
        { title: 'Giá', key: 'price', width: 160, render: (_, r) => formatCurrency(r.price) },
        { title: 'Ngày đăng', key: 'postedAt', width: 150, render: (_, r) => formatDateTime(r.postedAt) },
        {
            title: 'Gói VIP',
            key: 'vipTier',
            width: 110,
            render: (_, record) => {
                const label = getVipTierLabel(record);
                if (label === '—') return '—';
                const color =
                    label === 'VIP 3' ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : label === 'VIP 2' ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : label === 'VIP 1' ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200';
                return (
                    <span className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs font-bold whitespace-nowrap ${color}`}>
                        {label}
                    </span>
                );
            },
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 130,
            render: (_, record) => {
                const colorMap: Record<number, 'warning' | 'success' | 'error'> = {
                    1: 'warning',
                    2: 'success',
                    3: 'error',
                };
                return (
                    <Badge color={colorMap[record.status]}>
                        {POST_STATUS_LABELS[record.status]}
                    </Badge>
                );
            },
        },
        {
            title: 'Hành động',
            width: 180,
            render: (_, record) => (
                <div className="grid grid-cols-2 gap-2">
                    {record.status === 1 && (
                        <>
                            <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleStatusChange(record.id, 2)}
                                ariaLabel="Duyệt"
                                className="h-9 w-full"
                            >
                                Duyệt
                            </Button>
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleStatusChange(record.id, 3)}
                                ariaLabel="Từ chối"
                                className="h-9 w-full"
                            >
                                Từ chối
                            </Button>
                        </>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openModal(record)}
                        ariaLabel="Sửa"
                        className="h-9 w-full"
                    >
                        Sửa
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeletePost(record)}
                        ariaLabel="Xóa"
                        className="h-9 w-full"
                    >
                        Xóa
                    </Button>
                </div>
            ),
        },
    ];

    const tabButtonClass = (active: boolean) =>
        `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
            active
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`;

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Quản lý bài đăng</h3>
                <Button variant="primary" onClick={() => openModal()}>
                    + Thêm bài đăng
                </Button>
            </div>

            {/* Tab filter */}
            <div className="mb-4 flex flex-wrap gap-2">
                {(
                    [
                        { key: 'all', label: 'Tất cả', count: allPosts.length },
                        { key: 'pending', label: 'Chờ duyệt', count: allPosts.filter((p) => p.status === 1).length },
                        { key: 'approved', label: 'Đã duyệt', count: allPosts.filter((p) => p.status === 2).length },
                        { key: 'rejected', label: 'Đã từ chối', count: allPosts.filter((p) => p.status === 3).length },
                        { key: 'vip', label: 'VIP', count: allPosts.filter((p) => isVipPost(p)).length },
                    ] as const
                ).map((tab) => (
                    <button
                        key={tab.key}
                        className={tabButtonClass(activeTab === tab.key)}
                        onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    >
                        {tab.label}
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">{tab.count}</span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-4 w-full sm:max-w-[400px]">
                <input
                    type="text"
                    placeholder="Tìm kiếm theo tiêu đề hoặc địa chỉ..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            <DataTable
                rowKey="id"
                columns={columns}
                dataSource={pagedPosts}
                loading={loading}
                pagination={{
                    current: page,
                    total: filteredByTabAndSearch.length,
                    pageSize: DEFAULT_PAGE_SIZE,
                    onChange: (p: number) => setPage(p),
                    showTotal: (t: number) => `Tổng ${t} bản ghi`,
                }}
            />

            <ImageLightbox
                isOpen={previewOpen}
                images={previewImages}
                initialIndex={previewIndex}
                onClose={() => setPreviewOpen(false)}
            />

            {/* Modal xóa */}
            <Modal
                title="Xác nhận xóa bài đăng"
                isOpen={!!deletePost}
                onClose={() => { if (!deleting) setDeletePost(null); }}
                width="max-w-md"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setDeletePost(null)} disabled={deleting}>
                            Hủy
                        </Button>
                        <Button variant="danger" onClick={handleDelete} loading={deleting}>
                            Xóa
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn xóa bài đăng{' '}
                    <span className="font-semibold text-gray-900">{deletePost?.title}</span>?
                </p>
            </Modal>

            {/* Modal thêm/sửa */}
            <Modal
                title={editingPost ? 'Sửa bài đăng' : 'Thêm bài đăng'}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                width="max-w-4xl"
            >
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    <PostForm
                        initialData={editingPost ? {
                            postType: editingPost.postType as PostType,
                            title: editingPost.title,
                            city: editingPost.city,
                            district: editingPost.district,
                            ward: editingPost.ward,
                            address: editingPost.address,
                            contactPhone: editingPost.contactPhone,
                            contactLink: editingPost.contactLink,
                            price: editingPost.price,
                            area: editingPost.area,
                            direction: editingPost.direction,
                            description: editingPost.description,
                            bedrooms: editingPost.bedrooms,
                            bathrooms: editingPost.bathrooms,
                            floors: editingPost.floors,
                            frontWidth: editingPost.frontWidth,
                            landLength: editingPost.landLength,
                            landType: editingPost.landType,
                            legalStatus: editingPost.legalStatus,
                            minPrice: editingPost.minPrice,
                            maxPrice: editingPost.maxPrice,
                            minArea: editingPost.minArea,
                            maxArea: editingPost.maxArea,
                            startDate: editingPost.startDate,
                            endDate: editingPost.endDate,
                            discountCode: editingPost.discountCode,
                            images: editingPost.images,
                        } : undefined}
                        onSubmit={handleSubmit}
                        onCancel={() => setModalOpen(false)}
                        submitLabel={editingPost ? 'Cập nhật' : 'Thêm mới'}
                        isLoading={submitting}
                    />
                </div>
            </Modal>

            <LoadingOverlay
                visible={submitting || deleting}
                title="Đang xử lý bài đăng"
                description="Hệ thống đang tải ảnh và lưu dữ liệu, vui lòng đợi..."
            />
        </div>
    );
};

export default PostManagementPage;