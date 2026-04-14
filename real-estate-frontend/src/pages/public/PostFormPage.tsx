import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { message, Modal } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import { authApi, paymentApi, postApi } from '@/api';
import PostForm from '@/components/common/PostForm';
import { POST_TYPE_GROUPS } from '@/types/post';
import type { CreatePostDto, Post, PostType } from '@/types/post';
import { useAuthStore } from '@/stores/authStore';

type PostFormInitialData = Partial<CreatePostDto> & {
    images?: { id: number; url: string }[];
};

type DraftPayload = {
    formData?: Partial<CreatePostDto>;
};

const POST_DRAFT_KEY = 'pendingPostDraftV2';
const LEGACY_POST_DRAFT_KEY = 'pendingPostDraft';
const NUMERIC_FIELDS: Array<keyof CreatePostDto> = [
    'price',
    'area',
    'bedrooms',
    'bathrooms',
    'floors',
    'frontWidth',
    'landLength',
    'minPrice',
    'maxPrice',
    'minArea',
    'maxArea',
];

const isPropertyPostType = (postType: PostType): boolean => {
    return (POST_TYPE_GROUPS.PROPERTY as readonly PostType[]).includes(postType);
};

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

const serializeDraftFromFormData = (submitData: FormData): DraftPayload => {
    const formData: Partial<CreatePostDto> = {};

    submitData.forEach((value, key) => {
        if (key === 'images') return;
        if (typeof value !== 'string') return;

        const field = key as keyof CreatePostDto;
        if (NUMERIC_FIELDS.includes(field)) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                (formData as Record<string, unknown>)[field] = parsed;
            }
            return;
        }

        (formData as Record<string, unknown>)[field] = value;
    });

    return { formData };
};

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

    useEffect(() => {
        const restoreDraft = () => {
            if (editingId) return;

            const draftRaw = sessionStorage.getItem(POST_DRAFT_KEY) || sessionStorage.getItem(LEGACY_POST_DRAFT_KEY);
            if (!draftRaw) return;

            try {
                const draft = JSON.parse(draftRaw) as DraftPayload;
                if (!draft.formData) return;

                setFormInitialData(draft.formData);
                setFormRenderKey(`post-form-draft-${Date.now()}`);

                if (new URLSearchParams(location.search).get('resumeDraft') === '1') {
                    message.success('Đã khôi phục nội dung bài đăng. Vui lòng chọn lại hình ảnh rồi gửi duyệt.');
                }
            } catch {
                // Ignore malformed draft data and clear below.
            } finally {
                sessionStorage.removeItem(POST_DRAFT_KEY);
                sessionStorage.removeItem(LEGACY_POST_DRAFT_KEY);
            }
        };

        restoreDraft();
    }, [editingId, location.search]);

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

                if (!post) {
                    throw new Error('Post not found');
                }

                setIsEditMode(true);
                setFormInitialData(toEditInitialData(post));
                setFormRenderKey(`post-form-edit-${editingId}`);
            } catch {
                message.error('Không thể tải dữ liệu bài đăng để chỉnh sửa');
                navigate('/my-posts');
            } finally {
                setIsPageLoading(false);
            }
        };

        loadPostForEdit();
    }, [editingId, navigate]);

    const checkVipStatus = async (): Promise<boolean> => {
        if (!user) return false;

        try {
            const res = await authApi.getMe();
            const currentUser = res.data?.user;

            if (!currentUser) {
                return false;
            }

            const { setUser } = useAuthStore.getState();
            setUser(currentUser);

            if (!currentUser.isVip) {
                return false;
            }

            try {
                const subsRes = await paymentApi.getMySubscriptions({ limit: 100 });
                const subscriptions = subsRes.data?.data || [];

                return subscriptions.some((sub: any) => sub.status === 1 && new Date(sub.endDate) > new Date());
            } catch {
                return currentUser.isVip || false;
            }
        } catch (error) {
            console.error('Error checking VIP status:', error);
            return user?.isVip || false;
        }
    };
const handleSubmit = async (submitData: FormData) => {
    try {
        setSubmitting(true);
        const confirmMessage = isEditMode
            ? 'Bạn có chắc muốn cập nhật bài viết này?'
            : 'Bạn có chắc muốn đăng bài viết này? Thông tin sẽ chờ Admin duyệt.';

        if (!window.confirm(confirmMessage)) return;

        if (editingId) {
            await postApi.update(editingId, submitData);
            message.success('Cập nhật bài viết thành công');
        } else {
            await postApi.create(submitData);
            message.success('Đăng bài thành công! Thông tin đang chờ Admin duyệt.');
        }

        navigate(user?.roles?.includes('ADMIN') ? '/admin/posts' : '/my-posts');
    } catch (error: any) {
        const msg = error?.response?.data?.message || 'Không thể kết nối đến server.';
        message.error(Array.isArray(msg) ? msg[0] : String(msg));
    } finally {
        setSubmitting(false);
    }
};

    return (
        <div className="mx-auto mb-20 mt-10 max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
            <h2 className="mb-2 border-b-2 border-blue-100 pb-4 text-center text-3xl font-extrabold text-gray-800">
                {isEditMode ? 'Chỉnh sửa tin đăng' : 'Đăng tin bất động sản'}
            </h2>


            {!isEditMode && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Lưu ý: Bài đăng bất động sản cần tài khoản VIP để gửi duyệt. Nếu chưa có VIP, hệ thống sẽ
                    lưu nháp thông tin để bạn tiếp tục sau khi nâng cấp.
                </div>
            )}

            {isPageLoading ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-600">
                    Đang tải dữ liệu bài đăng...
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
    );
};

export default PostFormPage;
