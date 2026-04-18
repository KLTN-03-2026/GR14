import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { postApi } from '@/api';
import { POST_TYPE_LABELS } from '@/types/post';
import { useAuthStore } from '@/stores/authStore';
import PostDetailPanel from '@/components/common/PostDetailPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPrice = (price: number | null | undefined) =>
    price ? price.toLocaleString('vi-VN') + ' đ' : null;

const STATUS_CFG: Record<number, { label: string; dot: string; text: string; bg: string }> = {
    1: { label: 'Chờ duyệt', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50  border-amber-200' },
    2: { label: 'Đã duyệt', dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    3: { label: 'Từ chối', dot: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50    border-red-200' },
};

// ─── Preview Drawer ───────────────────────────────────────────────────────────

const STATUS_BANNER: Record<number, { label: string; cls: string }> = {
    1: { label: '⚠️ Bài viết đang chờ duyệt — chỉ bạn mới xem được nội dung này', cls: 'bg-amber-50 border-amber-300 text-amber-800' },
    3: { label: '❌ Bài viết đã bị từ chối', cls: 'bg-red-50 border-red-300 text-red-700' },
};

const PreviewDrawer: React.FC<{ post: any | null; onClose: () => void }> = ({ post, onClose }) => {
    // Prevent body scroll when open
    React.useEffect(() => {
        if (post) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [post]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${post ? 'opacity-100' : 'pointer-events-none opacity-0'
                    }`}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-300 ${post ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">Xem trước bài viết</p>
                        <h2 className="mt-0.5 truncate text-sm font-bold text-gray-900">{post?.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Pending / rejected banner */}
                {post && STATUS_BANNER[post.status] && (
                    <div className={`shrink-0 border-b px-5 py-2.5 text-xs font-medium ${STATUS_BANNER[post.status].cls}`}>
                        {STATUS_BANNER[post.status].label}
                    </div>
                )}

                {/* Scrollable content */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    {post && <PostDetailPanel post={post} />}
                </div>

                {/* Footer actions */}
                <div className="shrink-0 border-t border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
                    <a
                        href={`/posts/${post?.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Mở trang đầy đủ
                    </a>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}
const DeleteConfirm: React.FC<ConfirmProps> = ({ isOpen, onConfirm, onCancel, loading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>
                <h3 className="mb-1 text-base font-bold text-gray-900">Xoá bài đăng?</h3>
                <p className="mb-5 text-sm text-gray-500">Hành động này không thể hoàn tác. Bài đăng sẽ bị xoá vĩnh viễn.</p>
                <div className="flex justify-end gap-2.5">
                    <button onClick={onCancel} disabled={loading} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Huỷ</button>
                    <button onClick={onConfirm} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                        {loading && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
                        Xoá
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── VIP Upgrade Modal ────────────────────────────────────────────────────────

interface VipModalProps {
    post: any | null;
    onClose: () => void;
    onUpgradePost: (post: any) => void;
    onUpgradeAccount: (post: any) => void;
}
const VipModal: React.FC<VipModalProps> = ({ post, onClose, onUpgradePost, onUpgradeAccount }) => {
    if (!post) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                        <svg className="h-5 w-5 text-amber-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Nâng cấp bài viết lên VIP</h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{post.title}</p>
                    </div>
                </div>

                {/* Benefits */}
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-2 text-sm font-semibold text-amber-800">Lợi ích khi nâng VIP bài:</p>
                    <ul className="space-y-1.5 text-sm text-amber-700">
                        {['Ưu tiên hiển thị trên trang tìm kiếm', 'Xếp hạng cao hơn bài thường', 'Tiếp cận nhiều khách hàng tiềm năng hơn'].map((b) => (
                            <li key={b} className="flex items-center gap-2">
                                <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                {b}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Tip */}
                <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-700">
                    💡 Nếu có nhiều bài, hãy cân nhắc <button className="font-semibold underline" onClick={() => onUpgradeAccount(post)}>nâng cấp tài khoản VIP</button> để tiết kiệm hơn.
                </div>

                {/* Actions */}
                <div className="flex flex-row items-center justify-between pt-2">
                    <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                        Để sau
                    </button>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onUpgradeAccount(post)} className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 whitespace-nowrap">Nâng cấp tài khoản</button>
                        <button onClick={() => onUpgradePost(post)} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 whitespace-nowrap">⭐ Nâng VIP bài này</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
    post: any;
    onEdit: () => void;
    onDelete: () => void;
    onVipUpgrade: () => void;
    onPreview: () => void;
}
const PostCard: React.FC<PostCardProps> = ({ post, onEdit, onDelete, onVipUpgrade, onPreview }) => {
    const status = STATUS_CFG[post.status] ?? { label: 'Không xác định', dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' };
    const typeLabel = POST_TYPE_LABELS[post.postType as keyof typeof POST_TYPE_LABELS] || post.postType;
    const price = fmtPrice(post.price);
    const thumb = post.images?.[0]?.url;

    return (
        <div className={`group relative flex gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${post.isVip ? 'border-amber-200 bg-gradient-to-r from-amber-50/40 to-white' : 'border-gray-100'}`}>
            {/* VIP badge */}
            {post.isVip && (
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" /></svg>
                    VIP
                </span>
            )}

            {/* Thumbnail */}
            <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {thumb ? (
                    <img src={thumb} alt="thumb" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                {/* Type + Status */}
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{typeLabel}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                    </span>
                </div>

                {/* Title */}
                <Link to={`/posts/${post.id}`} className="block truncate text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors">
                    {post.title}
                </Link>

                {/* Price */}
                {price && (
                    <p className="mt-1 text-sm font-bold text-red-500">{price}</p>
                )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5 self-center">
                {/* View (preview drawer) */}
                <button
                    onClick={onPreview}
                    title="Xem trước"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                {/* Edit */}
                <button onClick={onEdit} title="Chỉnh sửa" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                {/* VIP upgrade */}
                {!post.isVip && (
                    <button onClick={onVipUpgrade} title="Nâng lên VIP" className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-500 transition hover:bg-amber-50 hover:text-amber-600">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" /></svg>
                    </button>
                )}
                {/* Delete */}
                <button onClick={onDelete} title="Xoá" className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
    );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = () => (
    <div className="animate-pulse flex gap-4 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="h-20 w-28 rounded-xl bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2.5 py-1">
            <div className="flex gap-2"><div className="h-5 w-20 rounded-full bg-gray-200" /><div className="h-5 w-20 rounded-full bg-gray-200" /></div>
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
        </div>
    </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ onNew }: { onNew: () => void }) => (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
        </div>
        <div>
            <p className="font-semibold text-gray-700">Bạn chưa có bài đăng nào</p>
            <p className="mt-1 text-sm text-gray-400">Hãy tạo bài đăng đầu tiên để tiếp cận khách hàng!</p>
        </div>
        <button onClick={onNew} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Đăng bài mới
        </button>
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

const MyPostsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [previewPost, setPreviewPost] = useState<any | null>(null);
    const [vipModalPost, setVipModalPost] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Filter state ────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [statusFilter, setStatus] = useState<number | 'all'>('all');
    const [typeFilter, setType] = useState<string>('all');
    const [vipOnly, setVipOnly] = useState(false);

    // Unique post types from data
    const postTypes = useMemo(
        () => Array.from(new Set(posts.map((p) => p.postType))).filter(Boolean),
        [posts]
    );

    const hasActiveFilter = search.trim() !== '' || statusFilter !== 'all' || typeFilter !== 'all' || vipOnly;

    const clearFilters = () => { setSearch(''); setStatus('all'); setType('all'); setVipOnly(false); };

    const fetchMyPosts = async () => {
        setLoading(true);
        try {
            const res = await postApi.getMyPosts();
            setPosts(res.data ?? []);
        } catch {
            toast.error('Không thể tải danh sách bài đăng');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchMyPosts(); }, []);

    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') fetchMyPosts(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await postApi.delete(deleteTarget.id);
            toast.success('Đã xoá bài đăng');
            setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch {
            toast.error('Xoá bài đăng thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const vipCount = posts.filter((p) => p.isVip).length;

    // ── Filtered + paged ────────────────────────────────────────────────────
    const filteredPosts = useMemo(() => {
        let result = [...posts];
        if (statusFilter !== 'all') result = result.filter((p) => p.status === statusFilter);
        if (typeFilter !== 'all') result = result.filter((p) => p.postType === typeFilter);
        if (vipOnly) result = result.filter((p) => p.isVip);
        if (search.trim()) result = result.filter((p) =>
            p.title?.toLowerCase().includes(search.toLowerCase())
        );
        return result;
    }, [posts, statusFilter, typeFilter, vipOnly, search]);

    const totalPage = Math.ceil(filteredPosts.length / PAGE_SIZE);
    const paged = filteredPosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, vipOnly]);

    return (
        <div className="min-h-screen bg-gray-50/70">
            <main className="mx-auto max-w-4xl px-4 py-10">

                {/* ── Header ─────────────────────────────────── */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Bài viết của tôi</h1>
                        <p className="mt-0.5 text-sm text-gray-400">{posts.length} bài đăng</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        {/* VIP account button */}
                        <button
                            onClick={() => navigate('/vip-upgrade?type=account')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" /></svg>
                            {user?.isVip ? 'Gia hạn VIP' : 'Nâng cấp VIP'}
                        </button>
                        {/* New post button */}
                        <button
                            onClick={() => navigate('/posts/new')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            Đăng bài mới
                        </button>
                    </div>
                </div>

                {/* ── VIP Banner ──────────────────────────────── */}
                {user?.isVip ? (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
                        <svg className="h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" /></svg>
                        <span className="text-sm font-medium text-amber-800">Tài khoản VIP — {posts.length} bài đăng của bạn được ưu tiên hiển thị.</span>
                    </div>
                ) : vipCount > 0 ? (
                    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-amber-800">
                            <svg className="h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" /></svg>
                            Bạn có <strong>{vipCount}</strong> bài VIP. Nâng cấp tài khoản để toàn bộ bài được hưởng VIP.
                        </div>
                        <button onClick={() => navigate('/vip-upgrade?type=account')} className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">Nâng cấp ngay</button>
                    </div>
                ) : (
                    <div className="mb-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Nâng cấp từng bài hoặc toàn bộ tài khoản lên VIP để ưu tiên hiển thị và tiếp cận nhiều khách hơn.
                    </div>
                )}

                {/* ── Filter Bar ──────────────────────────────── */}
                <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">

                    {/* Row 1: Search + VIP toggle */}
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="relative min-w-0 flex-1">
                            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Tìm theo tiêu đề bài viết..."
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>

                        {/* Post type dropdown */}
                        <select
                            value={typeFilter}
                            onChange={(e) => setType(e.target.value)}
                            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                        >
                            <option value="all">Tất cả loại</option>
                            {postTypes.map((t) => (
                                <option key={t} value={t}>
                                    {POST_TYPE_LABELS[t as keyof typeof POST_TYPE_LABELS] || t}
                                </option>
                            ))}
                        </select>

                        {/* VIP toggle */}
                        <button
                            onClick={() => setVipOnly((v) => !v)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${vipOnly
                                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" /></svg>
                            VIP
                        </button>
                    </div>

                    {/* Row 2: Status pills */}
                    <div className="flex flex-wrap gap-2">
                        {(
                            [
                                { key: 'all', label: 'Tất cả', count: posts.length },
                                { key: 1, label: 'Chờ duyệt', count: posts.filter((p) => p.status === 1).length },
                                { key: 2, label: 'Đã duyệt', count: posts.filter((p) => p.status === 2).length },
                                { key: 3, label: 'Từ chối', count: posts.filter((p) => p.status === 3).length },
                            ] as const
                        ).map((tab) => {
                            const active = statusFilter === tab.key;
                            const dotCls = tab.key === 1 ? 'bg-amber-400' : tab.key === 2 ? 'bg-emerald-400' : tab.key === 3 ? 'bg-red-400' : 'bg-gray-300';
                            return (
                                <button
                                    key={String(tab.key)}
                                    onClick={() => setStatus(tab.key as any)}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${active
                                            ? 'border-blue-500 bg-blue-600 text-white shadow-sm shadow-blue-200'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {tab.key !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : dotCls}`} />}
                                    {tab.label}
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                        }`}>{tab.count}</span>
                                </button>
                            );
                        })}

                        {/* Result count + clear */}
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                                {hasActiveFilter ? `${filteredPosts.length} / ${posts.length} kết quả` : `${posts.length} bài`}
                            </span>
                            {hasActiveFilter && (
                                <button
                                    onClick={clearFilters}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
                                >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    Xoá lọc
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Post List ───────────────────────────────── */}
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)}
                    </div>
                ) : filteredPosts.length === 0 ? (
                    hasActiveFilter ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                                <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Không tìm thấy bài phù hợp</p>
                                <p className="mt-1 text-sm text-gray-400">Thử xoá bộ lọc để xem tất cả bài đăng.</p>
                            </div>
                            <button onClick={clearFilters} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">Xoá bộ lọc</button>
                        </div>
                    ) : (
                        <EmptyState onNew={() => navigate('/posts/new')} />
                    )
                ) : (
                    <>
                        <div className="space-y-3">
                            {paged.map((post) => (
                                <PostCard
                                    key={post.id}
                                    post={post}
                                    onEdit={() => navigate(`/posts/${post.id}/edit`)}
                                    onDelete={() => setDeleteTarget(post)}
                                    onVipUpgrade={() => setVipModalPost(post)}
                                    onPreview={() => setPreviewPost(post)}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPage > 1 && (
                            <div className="mt-6 flex items-center justify-center gap-1.5">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                {Array.from({ length: totalPage }, (_, i) => i + 1).map((p) => (
                                    <button key={p} onClick={() => setPage(p)}
                                        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition ${p === page ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        {p}
                                    </button>
                                ))}
                                <button onClick={() => setPage((p) => Math.min(totalPage, p + 1))} disabled={page === totalPage}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* ── Preview Drawer ──────────────────── */}
            <PreviewDrawer
                post={previewPost}
                onClose={() => setPreviewPost(null)}
            />

            {/* ── Modals ──────────────────────────────── */}
            <DeleteConfirm
                isOpen={!!deleteTarget}
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() => !deleting && setDeleteTarget(null)}
            />
            <VipModal
                post={vipModalPost}
                onClose={() => setVipModalPost(null)}
                onUpgradePost={(p) => { setVipModalPost(null); navigate(`/vip-upgrade?postId=${p.id}&postTitle=${encodeURIComponent(p.title)}`); }}
                onUpgradeAccount={() => { setVipModalPost(null); navigate('/vip-upgrade?type=account'); }}
            />
        </div>
    );
};

export default MyPostsPage;