import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { postApi } from '@/api';
import PostForm from '@/components/common/PostForm';
import type { CreatePostDto, Post } from '@/types/post';
import { useAuthStore } from '@/stores/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type PostFormInitialData = Partial<CreatePostDto> & {
    images?: { id: number; url: string }[];
};

type DraftPayload = {
    formData?: Partial<CreatePostDto>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const POST_DRAFT_KEY = 'pendingPostDraftV2';
const LEGACY_POST_DRAFT_KEY = 'pendingPostDraft';


// ─── Helpers ──────────────────────────────────────────────────────────────────

const toEditInitialData = (post: Post): PostFormInitialData => ({
    postType: post.postType,
    title: post.title,
    city: post.city,
    district: post.district,
    ward: post.ward,
    address: post.address,
    contactPhone: post.contactPhone,
    contactLink: post.contactLink,
    price: post.price,
    area: post.area,
    direction: post.direction,
    description: post.description,
    bedrooms: post.bedrooms,
    bathrooms: post.bathrooms,
    floors: post.floors,
    frontWidth: post.frontWidth,
    landLength: post.landLength,
    landType: post.landType,
    legalStatus: post.legalStatus,
    minPrice: post.minPrice,
    maxPrice: post.maxPrice,
    minArea: post.minArea,
    maxArea: post.maxArea,
    startDate: post.startDate,
    endDate: post.endDate,
    discountCode: post.discountCode,
    images: post.images,
});


// ─── Custom Confirm Modal (Tailwind-only) ─────────────────────────────────────

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

const ConfirmModal = ({
    isOpen,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
    loading = false,
}: ConfirmModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!loading ? onCancel : undefined}
            />

            {/* Dialog */}
            <div className="relative z-10 mx-4 w-full max-w-md animate-[fadeInScale_0.2s_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
                {/* Icon */}
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                    <svg
                        className="h-6 w-6 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                {/* Content */}
                <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
                <p className="mb-6 text-sm leading-relaxed text-gray-500">{description}</p>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                        {loading && (
                            <svg
                                className="h-4 w-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8H4z"
                                />
                            </svg>
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PostFormPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    const { user } = useAuthStore();
    const editingId = params.id ? Number(params.id) : undefined;

    const [isEditMode, setIsEditMode] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formInitialData, setFormInitialData] = useState<PostFormInitialData | undefined>(undefined);
    const [formRenderKey, setFormRenderKey] = useState('post-form-create');

    // Confirm modal state
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

    // ── Restore draft ────────────────────────────────────────────────────────
    useEffect(() => {
        const restoreDraft = () => {
            if (editingId) return;

            const draftRaw =
                sessionStorage.getItem(POST_DRAFT_KEY) ||
                sessionStorage.getItem(LEGACY_POST_DRAFT_KEY);
            if (!draftRaw) return;

            try {
                const draft = JSON.parse(draftRaw) as DraftPayload;
                if (!draft.formData) return;

                setFormInitialData(draft.formData);
                setFormRenderKey(`post-form-draft-${Date.now()}`);

                if (new URLSearchParams(location.search).get('resumeDraft') === '1') {
                    toast.success('Đã khôi phục nội dung bài đăng. Vui lòng chọn lại hình ảnh rồi gửi duyệt.');
                }
            } catch {
                // Ignore malformed draft data.
            } finally {
                sessionStorage.removeItem(POST_DRAFT_KEY);
                sessionStorage.removeItem(LEGACY_POST_DRAFT_KEY);
            }
        };

        restoreDraft();
    }, [editingId, location.search]);

    // ── Load post for edit ───────────────────────────────────────────────────
    useEffect(() => {
        const loadPostForEdit = async () => {
            if (!editingId) {
                setIsEditMode(false);
                return;
            }

            try {
                setIsPageLoading(true);
                const res = await postApi.getById(editingId);
                const post = ((res as any)?.data?.data ?? (res as any)?.data) as Post | undefined;

                if (!post) throw new Error('Post not found');

                setIsEditMode(true);
                setFormInitialData(toEditInitialData(post));
                setFormRenderKey(`post-form-edit-${editingId}`);
            } catch {
                toast.error('Không thể tải dữ liệu bài đăng để chỉnh sửa');
                navigate('/my-posts');
            } finally {
                setIsPageLoading(false);
            }
        };

        loadPostForEdit();
    }, [editingId, navigate]);

    // ── Submit flow ──────────────────────────────────────────────────────────
    // Step 1: PostForm calls this → store formData and open confirm dialog
    const handleSubmit = async (submitData: FormData) => {
        setPendingFormData(submitData);
        setConfirmOpen(true);
    };

    // Step 2: User clicks confirm → call API
    const handleConfirm = async () => {
        if (!pendingFormData) return;

        try {
            setSubmitting(true);
            if (editingId) {
                await postApi.update(editingId, pendingFormData);
                toast.success('Cập nhật bài viết thành công!');
            } else {
                await postApi.create(pendingFormData);
                toast.success('Đăng bài thành công! Bài viết đang chờ Admin duyệt.');
            }
            setConfirmOpen(false);
            navigate(user?.roles?.includes('ADMIN') ? '/admin/posts' : '/my-posts');
        } catch (error: any) {
            const msg = error?.response?.data?.message || 'Không thể kết nối đến server.';
            toast.error(Array.isArray(msg) ? msg[0] : String(msg));
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelConfirm = () => {
        if (!submitting) {
            setConfirmOpen(false);
            setPendingFormData(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            <div className="mx-auto mb-20 mt-10 max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
                {/* Header */}
                <div className="mb-6 border-b border-gray-100 pb-5 text-center">
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                        {isEditMode ? 'Chỉnh sửa tin đăng' : 'Đăng tin bất động sản'}
                    </h1>
                    {!isEditMode && (
                        <p className="mt-1 text-sm text-gray-400">
                            Điền đầy đủ thông tin để gửi bài duyệt. Bài sẽ hiển thị sau khi Admin phê duyệt.
                        </p>
                    )}
                </div>

                {/* VIP notice */}
                {!isEditMode && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                        {/* Crown icon (SVG) */}
                        <div className="mt-0.5 shrink-0">
                            <svg
                                className="h-5 w-5 text-amber-500"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M2.5 19L5 10l4.5 4 2.5-6 2.5 6L19 10l2.5 9H2.5z" />
                            </svg>
                        </div>
                        <p className="text-sm leading-relaxed text-amber-800">
                            <span className="font-semibold">Lưu ý:</span> Bài đăng bất động sản cần tài
                            khoản VIP để gửi duyệt. Nếu chưa có VIP, hệ thống sẽ lưu nháp thông tin
                            để bạn tiếp tục sau khi nâng cấp.
                        </p>
                    </div>
                )}

                {/* Form area */}
                {isPageLoading ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 py-16">
                        <svg
                            className="h-8 w-8 animate-spin text-blue-500"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8H4z"
                            />
                        </svg>
                        <span className="text-sm text-gray-500">Đang tải dữ liệu bài đăng...</span>
                    </div>
                ) : (
                    <PostForm
                        key={formRenderKey}
                        initialData={formInitialData}
                        onSubmit={handleSubmit}
                        onCancel={() => navigate(-1)}
                        submitLabel={isEditMode ? 'Cập nhật bài viết' : 'Đăng tin ngay'}
                        isLoading={submitting}
                        postTypeSelectorMode="cards"
                    />
                )}
            </div>

            {/* Custom Confirm Modal */}
            <ConfirmModal
                isOpen={confirmOpen}
                title={isEditMode ? 'Xác nhận cập nhật bài viết' : 'Xác nhận đăng bài'}
                description={
                    isEditMode
                        ? 'Bạn có chắc muốn cập nhật bài viết này không?'
                        : 'Bài viết sẽ được gửi để Admin duyệt trước khi hiển thị công khai. Bạn có muốn tiếp tục?'
                }
                confirmLabel={isEditMode ? 'Cập nhật' : 'Đăng bài'}
                onConfirm={handleConfirm}
                onCancel={handleCancelConfirm}
                loading={submitting}
            />
        </>
    );
};

export default PostFormPage;
