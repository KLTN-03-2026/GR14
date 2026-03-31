import { useEffect, useMemo, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic/build/ckeditor';
import { toast } from 'react-hot-toast';
import { postApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils';
import type { Post } from '@/types';
import { DEFAULT_PAGE_SIZE, POST_STATUS_LABELS } from '@/constants';
import { Button, Badge, Modal, DataTable, ImageLightbox } from '@/components/ui';
import type { Column } from '@/components/ui';

type UploadImage = {
    uid: string;
    name: string;
    status: 'done';
    url: string;
    originFileObj?: File;
};

type PostFormData = {
    title: string;
    city: string;
    district: string;
    ward: string;
    address: string;
    price: string | number;
    area: string | number;
    direction: string;
    description: string;
};

type ApiError = {
    response?: {
        data?: {
            message?: string | string[];
        };
    };
};

type VipTooltipState = {
    visible: boolean;
    x: number;
    y: number;
    packageName: string;
    statusText: string;
};

const PostManagementPage: React.FC = () => {
    const [allPosts, setAllPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'vip'>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [fileList, setFileList] = useState<UploadImage[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [vipTooltip, setVipTooltip] = useState<VipTooltipState>({
        visible: false,
        x: 0,
        y: 0,
        packageName: '',
        statusText: '',
    });
    const [formData, setFormData] = useState<PostFormData>({
        title: '',
        city: '',
        district: '',
        ward: '',
        address: '',
        price: '',
        area: '',
        direction: '',
        description: '',
    });

    const loadPosts = async () => {
        setLoading(true);
        try {
            const res = await postApi.getAll();
            setAllPosts(res.data || []);
        } catch (err) {
            console.error('Load posts error:', err);
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, []);

    const isVipPost = (post: Post) => Boolean(post.isVip || post.vipPackageName || post.vipExpiry);

    const getVipStatusText = (post: Post) => {
        if (!post.vipExpiry) return 'Chưa có thông tin hết hạn';
        const expiry = new Date(post.vipExpiry);
        if (Number.isNaN(expiry.getTime())) return 'Ngày hết hạn không hợp lệ';
        const isActive = expiry.getTime() >= Date.now();
        return `${isActive ? 'Còn hạn đến' : 'Đã hết hạn ngày'} ${formatDateTime(post.vipExpiry)}`;
    };

    const openVipTooltip = (event: React.MouseEvent, post: Post) => {
        setVipTooltip({
            visible: true,
            x: event.clientX + 12,
            y: event.clientY + 12,
            packageName: post.vipPackageName || 'Gói VIP',
            statusText: getVipStatusText(post),
        });
    };

    const moveVipTooltip = (event: React.MouseEvent) => {
        setVipTooltip((prev) => ({
            ...prev,
            x: event.clientX + 12,
            y: event.clientY + 12,
        }));
    };

    const closeVipTooltip = () => {
        setVipTooltip((prev) => ({ ...prev, visible: false }));
    };

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
        setFileList([]);

        if (record) {
            setFormData({
                title: record.title || '',
                city: record.city || '',
                district: record.district || '',
                ward: record.ward || '',
                address: record.address || '',
                price: record.price || '',
                area: record.area || '',
                direction: record.direction || '',
                description: record.description || '',
            });
            if (record.images?.length) {
                setFileList(
                    record.images.map((img) => ({
                        uid: img.id.toString(),
                        name: `image-${img.id}`,
                        status: 'done',
                        url: img.url,
                    })),
                );
            }
        } else {
            setFormData({
                title: '',
                city: '',
                district: '',
                ward: '',
                address: '',
                price: '',
                area: '',
                direction: '',
                description: '',
            });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            if (!formData.title || !formData.description) {
                toast.error('Vui lòng nhập tiêu đề và mô tả');
                return;
            }

            const submitData = new FormData();

            Object.entries(formData).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    submitData.append(key, String(value));
                }
            });

            fileList
                .filter((file) => file.originFileObj)
                .forEach((file) => {
                    if (file.originFileObj) {
                        submitData.append('images', file.originFileObj);
                    }
                });

            if (editingPost) {
                await postApi.update(editingPost.id, submitData);
                toast.success('Cập nhật bài đăng thành công');
            } else {
                await postApi.create(submitData);
                toast.success('Thêm bài đăng thành công');
            }

            loadPosts();
            setModalOpen(false);
            setFileList([]);
        } catch (err: unknown) {
            const error = err as ApiError;
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra';
            toast.error(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await postApi.delete(id);
            toast.success('Xóa thành công');
            loadPosts();
        } catch {
            toast.error('Xóa thất bại');
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
            key: 'image',
            width: 90,
            render: (_, r) =>
                r.images?.length ? (
                    <img
                        src={r.images[0].url}
                        alt=""
                        className="h-[50px] w-[60px] rounded object-cover cursor-zoom-in"
                        onClick={() => {
                            setPreviewImages((r.images || []).map((img) => img.url));
                            setPreviewIndex(0);
                            setPreviewOpen(true);
                        }}
                    />
                ) : (
                    '—'
                ),
        },
        {
            title: 'Tiêu đề',
            key: 'title',
            width: 240,
            render: (_, r) => (
                <div className="flex items-center gap-2">
                    <span>{r.title}</span>
                    {isVipPost(r) && (
                        <span
                            className="inline-flex cursor-help"
                            onMouseEnter={(e) => openVipTooltip(e, r)}
                            onMouseMove={moveVipTooltip}
                            onMouseLeave={closeVipTooltip}
                        >
                            <Badge color="warning">VIP</Badge>
                        </span>
                    )}
                </div>
            ),
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            width: 550,
            render: (text: string) =>
                !text ? (
                    '—'
                ) : (
                    <div
                        dangerouslySetInnerHTML={{ __html: text }}
                        style={{ lineHeight: '1.6', fontSize: '13.5px', whiteSpace: 'normal', wordBreak: 'break-word' }}
                    />
                ),
        },
        { title: 'Địa chỉ', dataIndex: 'address', width: 280 },
        { title: 'Giá', key: 'price', width: 160, render: (_, r) => formatCurrency(r.price) },
        { title: 'Ngày đăng', key: 'postedAt', width: 150, render: (_, r) => formatDateTime(r.postedAt) },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 120,
            render: (_, r) => (
                <Badge color={r.status === 1 ? 'warning' : r.status === 2 ? 'success' : 'error'}>
                    {POST_STATUS_LABELS[r.status]}
                </Badge>
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 260,
            render: (_, r) => (
                <div className="flex flex-wrap items-center gap-2">
                    {r.status === 1 && (
                        <>
                            <Button size="sm" variant="primary" iconOnly ariaLabel="Duyệt" onClick={() => handleStatusChange(r.id, 2)} startIcon={(
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}>
                                Duyệt
                            </Button>
                            <Button size="sm" variant="danger" iconOnly ariaLabel="Từ chối" onClick={() => handleStatusChange(r.id, 3)} startIcon={(
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}>
                                Từ chối
                            </Button>
                        </>
                    )}
                    <Button size="sm" variant="outline" iconOnly ariaLabel="Sửa" onClick={() => openModal(r)} startIcon={(
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    )}>
                        Sửa
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        iconOnly
                        ariaLabel="Xóa"
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        )}
                        onClick={() => {
                            if (window.confirm('Bạn có chắc muốn xóa bài đăng này?')) {
                                handleDelete(r.id);
                            }
                        }}
                    >
                        Xóa
                    </Button>
                </div>
            ),
        },
    ];

    const tabButtonClass = (active: boolean) =>
        `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${active
            ? 'border-brand-500 bg-brand-50 text-brand-600'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`;

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Quản lý bài đăng</h3>
                <Button variant="primary" iconOnly ariaLabel="Thêm bài đăng" onClick={() => openModal()} startIcon={(
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                )}>
                    Thêm bài đăng
                </Button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <button
                    className={tabButtonClass(activeTab === 'all')}
                    onClick={() => {
                        setActiveTab('all');
                        setPage(1);
                    }}
                >
                    Tất cả ({allPosts.length})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'vip')}
                    onClick={() => {
                        setActiveTab('vip');
                        setPage(1);
                    }}
                >
                    Tin VIP ({allPosts.filter((p) => isVipPost(p)).length})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'pending')}
                    onClick={() => {
                        setActiveTab('pending');
                        setPage(1);
                    }}
                >
                    Chờ duyệt ({allPosts.filter((p) => p.status === 1).length})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'approved')}
                    onClick={() => {
                        setActiveTab('approved');
                        setPage(1);
                    }}
                >
                    Đã duyệt ({allPosts.filter((p) => p.status === 2).length})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'rejected')}
                    onClick={() => {
                        setActiveTab('rejected');
                        setPage(1);
                    }}
                >
                    Đã từ chối ({allPosts.filter((p) => p.status === 3).length})
                </button>
            </div>

            <div className="mb-4 w-full min-w-0 sm:max-w-[400px]">
                <input
                    type="text"
                    placeholder="Tìm kiếm theo tiêu đề hoặc địa chỉ..."
                    className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
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
                    onChange: setPage,
                }}
            />

            <ImageLightbox
                isOpen={previewOpen}
                images={previewImages}
                initialIndex={previewIndex}
                onClose={() => setPreviewOpen(false)}
            />

            {vipTooltip.visible && (
                <div
                    className="pointer-events-none fixed z-[9999] w-64 rounded-lg border border-amber-200 bg-white p-3 text-xs text-gray-700 shadow-lg"
                    style={{ left: vipTooltip.x, top: vipTooltip.y }}
                >
                    <div className="mb-1 font-semibold text-gray-900">{vipTooltip.packageName}</div>
                    <div>{vipTooltip.statusText}</div>
                </div>
            )}

            <Modal
                title={editingPost ? 'Sửa bài đăng' : 'Thêm bài đăng'}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                width="max-w-4xl"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Hủy
                        </Button>
                        <Button variant="primary" onClick={handleSubmit}>
                            Lưu
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Tiêu đề</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            placeholder="Nhập tiêu đề bài đăng"
                            value={formData.title || ''}
                            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Tỉnh" value={formData.city || ''} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
                        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Quận" value={formData.district || ''} onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))} />
                        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Phường" value={formData.ward || ''} onChange={(e) => setFormData((p) => ({ ...p, ward: e.target.value }))} />
                        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Địa chỉ" value={formData.address || ''} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} />
                        <input type="number" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Giá" value={formData.price || ''} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))} />
                        <input type="number" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Diện tích" value={formData.area || ''} onChange={(e) => setFormData((p) => ({ ...p, area: e.target.value }))} />
                        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Hướng" value={formData.direction || ''} onChange={(e) => setFormData((p) => ({ ...p, direction: e.target.value }))} />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
                        <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
                            <style>{`.ck-editor__editable_inline:not(.ck-comment__input *) { min-height: 200px !important; }`}</style>
                            <CKEditor
                                editor={ClassicEditor as unknown as never}
                                data={String(formData.description || '')}
                                onChange={(_, editor) =>
                                    setFormData((prev) => ({ ...prev, description: editor.getData() || '' }))
                                }
                                onReady={(editor) => {
                                    setTimeout(() => {
                                        if (editor?.ui?.view?.editable?.element) {
                                            editor.ui.view.editable.element.style.minHeight = '420px';
                                        }
                                    }, 300);
                                }}
                                config={{
                                    licenseKey: 'GPL',
                                    placeholder: 'Nhập mô tả chi tiết về bất động sản...',
                                    toolbar: [
                                        'sourceEditing',
                                        '|',
                                        'heading',
                                        '|',
                                        'bold',
                                        'italic',
                                        '|',
                                        'link',
                                        '|',
                                        'bulletedList',
                                        'numberedList',
                                        '|',
                                        'blockQuote',
                                        '|',
                                        'undo',
                                        'redo',
                                    ],
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Ảnh</label>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                                if (!e.target.files) return;
                                const incoming = Array.from(e.target.files).map((f, index) => ({
                                    uid: `new-${Date.now()}-${index}`,
                                    name: f.name,
                                    status: 'done' as const,
                                    originFileObj: f,
                                    url: URL.createObjectURL(f),
                                }));
                                setFileList((prev) => [...prev, ...incoming]);
                                e.target.value = '';
                            }}
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                            {fileList.map((file) => (
                                <div key={file.uid} className="relative h-[84px] w-[84px] overflow-hidden rounded border border-gray-200">
                                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                                    <button
                                        type="button"
                                        className="absolute right-0 top-0 bg-black/50 px-1 text-xs text-white"
                                        onClick={() => setFileList((prev) => prev.filter((f) => f.uid !== file.uid))}
                                    >
                                        x
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PostManagementPage;
