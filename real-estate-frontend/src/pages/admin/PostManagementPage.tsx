import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { postApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils';
import type { Post } from '@/types';
import { PostType } from '@/types/post';
import { DEFAULT_PAGE_SIZE, POST_STATUS_LABELS } from '@/constants';
import { Button, Badge, Modal, DataTable, ImageLightbox, LoadingOverlay } from '@/components/ui';
import type { Column } from '@/components/ui';
import PostForm from '@/components/common/PostForm';
import DetailDrawer from '@/components/ui/DetailDrawer';
import PostDetailPanel from '@/components/common/PostDetailPanel';

type ApiError = {
    response?: {
        data?: {
            message?: string | string[];
        };
    };
};

type ActiveTab = 'all' | 'pending' | 'approved' | 'rejected' | 'vip';

/** Map tab → status param gửi lên API (undefined = không lọc theo status) */
const TAB_STATUS: Record<ActiveTab, number | undefined> = {
    all: undefined,
    pending: 1,
    approved: 2,
    rejected: 3,
    vip: undefined, // không có filter VIP ở backend → lọc client-side
};

const isVipPost = (post: Post) => {
    // Không có VIP flag nào → chắc chắn không phải VIP
    if (!post.isVip && !post.vipPackageName && !post.vipExpiry) return false;
    // Nếu có vipExpiry → phải còn hạn
    if (post.vipExpiry) return new Date(post.vipExpiry) > new Date();
    // isVip=true nhưng không có vipExpiry → dữ liệu chưa nhất quán, coi là không VIP
    return false;
};

const PostManagementPage: React.FC = () => {
    // Server-side pagination state
    const [posts, setPosts] = useState<Post[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    // Modal & UI state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [deletePost, setDeletePost] = useState<Post | null>(null);
    const [rejectPost, setRejectPost] = useState<Post | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formRenderKey, setFormRenderKey] = useState('admin-post-form-create');
    const formScrollRef = useRef<HTMLDivElement>(null);
    const [detailItem, setDetailItem] = useState<Post | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadPosts = useCallback(async (
        currentPage: number,
        currentTab: ActiveTab,
        currentSearch: string,
    ) => {
        setLoading(true);
        try {
            const isVipTab = currentTab === 'vip';
            const statusParam = TAB_STATUS[currentTab];

            const res = await postApi.getAll({
                page: isVipTab ? 1 : currentPage,
                // Tab VIP không có server-side filter → tải nhiều để lọc client-side
                limit: isVipTab ? 200 : DEFAULT_PAGE_SIZE,
                ...(statusParam !== undefined ? { status: statusParam } : {}),
                ...(currentSearch.trim() ? { search: currentSearch.trim() } : {}),
            } as any);

            const payload = (res as any)?.data;
            const rawPosts: Post[] = Array.isArray(payload?.data) ? payload.data : [];
            const total: number = payload?.totalItems ?? 0;

            if (isVipTab) {
                const vipOnly = rawPosts.filter(isVipPost);
                setPosts(vipOnly);
                setTotalItems(vipOnly.length);
            } else {
                setPosts(rawPosts);
                setTotalItems(total);
            }
        } catch (err: any) {
            const status = err?.response?.status;
            toast.error(status ? `Lỗi tải dữ liệu (HTTP ${status})` : 'Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPosts(page, activeTab, search);
    }, [page]); // search & tab thay đổi qua handler riêng

    useEffect(() => {
        // Load lần đầu
        loadPosts(1, 'all', '');
    }, [loadPosts]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setPage(1);
            loadPosts(1, activeTab, value);
        }, 400);
    };

    const handleTabChange = (tab: ActiveTab) => {
        setActiveTab(tab);
        setPage(1);
        setSearch('');
        loadPosts(1, tab, '');
    };

    const handlePageChange = (p: number) => {
        setPage(p);
        loadPosts(p, activeTab, search);
    };

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

    const openModal = (record?: Post) => {
        setEditingPost(record || null);
        setFormRenderKey(record
            ? `admin-post-form-edit-${record.id}-${Date.now()}`
            : `admin-post-form-create-${Date.now()}`);
        setModalOpen(true);
    };

    useEffect(() => {
        if (modalOpen && formScrollRef.current) {
            formScrollRef.current.scrollTop = 0;
        }
    }, [modalOpen, formRenderKey]);

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
            loadPosts(page, activeTab, search);
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
            // Nếu xóa hết trang cuối thì lùi trang
            const newPage = posts.length === 1 && page > 1 ? page - 1 : page;
            setPage(newPage);
            loadPosts(newPage, activeTab, search);
        } catch {
            toast.error('Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            if (status === 2) await postApi.approve(id);
            if (status === 3) {
                await postApi.reject(id);
                setRejectPost(null);
            }
            toast.success('Cập nhật trạng thái thành công');
            loadPosts(page, activeTab, search);
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
                        onClick={(e) => {
                            e.stopPropagation();
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
            render: (_, record) => {
                const isVip = isVipPost(record);
                const label = getVipTierLabel(record);
                return (
                    <div className="flex flex-col gap-1 items-start py-1">
                        <span className={`font-semibold ${isVip ? 'text-amber-700' : 'text-gray-900'} leading-snug`}>{record.title}</span>
                        {isVip && (
                            <div className="flex items-center gap-1 border border-amber-300 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-600 w-max mt-0.5 shadow-sm">
                                <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                {label}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Mô tả',
            key: 'description',
            width: 550,
            render: (_, r) => {
                if (!r.description) return '—';
                const plainText = String(r.description)
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                return (
                    <span
                        className="block max-w-[520px] truncate text-sm text-gray-700"
                        title={plainText}
                    >
                        {plainText}
                    </span>
                );
            },
        },
        { title: 'Địa chỉ', dataIndex: 'address', width: 280 },
        { title: 'Giá', key: 'price', width: 160, render: (_, r) => formatCurrency(r.price) },
        { title: 'Ngày đăng', key: 'postedAt', width: 150, render: (_, r) => formatDateTime(r.postedAt) },
        {
            title: 'Gói VIP',
            key: 'vipTier',
            width: 130,
            render: (_, record) => {
                const label = getVipTierLabel(record);
                if (label === '—') return <span className="text-gray-400 font-medium">—</span>;
                const styleClass =
                    label === 'VIP 3' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-200 border border-amber-600'
                        : label === 'VIP 2' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md shadow-purple-200 border border-purple-600'
                            : label === 'VIP 1' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-200 border border-blue-600'
                                : 'bg-gradient-to-r from-gray-500 to-gray-400 text-white shadow-md shadow-gray-200 border border-gray-600';
                return (
                    <div className="flex justify-start">
                        <span className={`inline-flex items-center justify-center rounded px-2.5 py-1 text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${styleClass}`}>
                            <svg className="w-3.5 h-3.5 mr-1 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                            {label}
                        </span>
                    </div>
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
                <div
                    className="grid grid-cols-2 gap-2 w-[80px]"
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* ✅ Duyệt */}
                    {record.status === 1 && (
                        <Button
                            size="sm"
                            variant="outline"
                            iconOnly
                            ariaLabel="Duyệt"
                            onClick={() => handleStatusChange(record.id, 2)}
                            className="border-green-500 text-green-600 hover:bg-green-50"
                            startIcon={(
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        />
                    )}

                    {/* ❌ Từ chối */}
                    {record.status === 1 && (
                        <Button
                            size="sm"
                            variant="outline"
                            iconOnly
                            ariaLabel="Từ chối"
                            onClick={() => setRejectPost(record)}
                            className="border-red-500 text-red-600 hover:bg-red-50"
                            startIcon={(
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        />
                    )}

                    {/* ✏️ Sửa */}
                    <Button
                        size="sm"
                        variant="outline"
                        iconOnly
                        ariaLabel="Sửa"
                        disabled={record.status === 2}
                        onClick={() => openModal(record)}
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        )}
                    />

                    {/* 🗑️ Xóa */}
                    <Button
                        size="sm"
                        variant="outline"
                        iconOnly
                        ariaLabel="Xóa"
                        onClick={() => setDeletePost(record)}
                        className="border-red-500 text-red-600 hover:bg-red-50"
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        )}
                    />

                </div>
            )
        },
    ];

    const tabButtonClass = (active: boolean) =>
        `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${active
            ? 'border-brand-500 bg-brand-50 text-brand-600'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`;

    const TABS: Array<{ key: ActiveTab; label: string }> = [
        { key: 'all', label: 'Tất cả' },
        { key: 'pending', label: 'Chờ duyệt' },
        { key: 'approved', label: 'Đã duyệt' },
        { key: 'rejected', label: 'Đã từ chối' },
        { key: 'vip', label: 'VIP' },
    ];

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Quản lý bài đăng</h3>
                <Button variant="primary" onClick={() => openModal()}>
                    + Thêm bài đăng
                </Button>
            </div>

            {/* Tab filter — server-side, hiển thị totalItems ở tab active */}
            <div className="mb-4 flex flex-wrap gap-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        className={tabButtonClass(activeTab === tab.key)}
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                        {activeTab === tab.key && (
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">
                                {totalItems}
                            </span>
                        )}
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
                    onChange={(e) => handleSearchChange(e.target.value)}
                />
            </div>

            <DataTable
                rowKey="id"
                columns={columns}
                dataSource={posts}
                loading={loading}
                onRow={(record) => ({ onClick: () => setDetailItem(record) })}
                pagination={{
                    current: page,
                    total: totalItems,
                    pageSize: DEFAULT_PAGE_SIZE,
                    onChange: handlePageChange,
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

            {/* Modal từ chối */}
            <Modal
                title="Xác nhận từ chối"
                isOpen={!!rejectPost}
                onClose={() => setRejectPost(null)}
                width="max-w-md"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setRejectPost(null)}>
                            Hủy
                        </Button>
                        <Button variant="danger" onClick={() => rejectPost && handleStatusChange(rejectPost.id, 3)}>
                            Xác nhận từ chối
                        </Button>
                    </>
                )}
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn từ chối bài đăng{' '}
                    <span className="font-semibold text-gray-900">{rejectPost?.title}</span>?
                </p>
            </Modal>

            {/* Modal thêm/sửa */}
            <Modal
                title={editingPost ? 'Sửa bài đăng' : 'Thêm bài đăng'}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                width="max-w-4xl"
            >
                <div ref={formScrollRef} className="max-h-[70vh] overflow-y-auto pr-2">
                    <PostForm
                        key={formRenderKey}
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
                        postTypeSelectorMode="cards"
                    />
                </div>
            </Modal>

            <LoadingOverlay
                visible={submitting || deleting}
                title="Đang xử lý bài đăng"
                description="Hệ thống đang tải ảnh và lưu dữ liệu, vui lòng đợi..."
            />

            <DetailDrawer
                isOpen={!!detailItem}
                onClose={() => setDetailItem(null)}
                title={detailItem ? `Chi tiết bài: ${detailItem.title}` : 'Chi tiết bài đăng'}
            >
                {detailItem && <PostDetailPanel post={detailItem} />}
            </DetailDrawer>
        </div>
    );
};

export default PostManagementPage;