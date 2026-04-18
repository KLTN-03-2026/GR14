import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { vipPackageApi } from '@/api';
import { Button } from '@/components/ui';

interface FormData {
    name: string;
    description: string;
    durationDays: number | '';
    price: number | '';
    priorityLevel: number | '';
    status: number;
    packageType: string;
}

interface PriorityItem {
    id: number;
    priorityLevel: number;
}

interface FeatureConfig {
    highlight: boolean;
    topPost: boolean;
    featured: boolean;
    urgent: boolean;
    badge: string;
}

type TierKey = 'basic' | 'standard' | 'pro' | 'premium';

interface VipTierTemplate {
    key: TierKey;
    label: string;
    description: string;
    durationDays: number;
    priorityLevel: number;
    badge: string;
    features: Omit<FeatureConfig, 'badge'>;
}

const defaultFeatureConfig: FeatureConfig = {
    highlight: false,
    topPost: false,
    featured: false,
    urgent: false,
    badge: '',
};

const VIP_TIER_TEMPLATES: VipTierTemplate[] = [
    {
        key: 'basic',
        label: 'Gói Cơ bản',
        description: 'Phù hợp test nhanh, ngân sách thấp',
        durationDays: 3,
        priorityLevel: 1,
        badge: 'VIP Basic',
        features: { highlight: true, topPost: false, featured: false, urgent: false },
    },
    {
        key: 'standard',
        label: 'Gói Tiêu chuẩn',
        description: 'Tăng nhận diện ổn định, phù hợp đa số bài đăng',
        durationDays: 7,
        priorityLevel: 2,
        badge: 'VIP Standard',
        features: { highlight: true, topPost: false, featured: true, urgent: false },
    },
    {
        key: 'pro',
        label: 'Gói Nâng cao',
        description: 'Đẩy hiển thị mạnh hơn cho bài cần chốt nhanh',
        durationDays: 15,
        priorityLevel: 3,
        badge: 'VIP Pro',
        features: { highlight: true, topPost: true, featured: true, urgent: false },
    },
    {
        key: 'premium',
        label: 'Gói Premium',
        description: 'Hiệu quả tối đa cho bài trọng điểm',
        durationDays: 30,
        priorityLevel: 4,
        badge: 'VIP Premium',
        features: { highlight: true, topPost: true, featured: true, urgent: true },
    },
];

const getTierByPriority = (priorityLevel: number): VipTierTemplate | undefined =>
    VIP_TIER_TEMPLATES.find((tier) => tier.priorityLevel === priorityLevel);

const applyTierTemplate = (tier: VipTierTemplate) => ({
    durationDays: tier.durationDays,
    priorityLevel: tier.priorityLevel,
    featureConfig: {
        ...tier.features,
        badge: tier.badge,
    } satisfies FeatureConfig,
});

const parseFeatureConfig = (raw?: string): FeatureConfig => {
    if (!raw?.trim()) return { ...defaultFeatureConfig };

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
        return { ...defaultFeatureConfig };
    }
};

const serializeFeatureConfig = (config: FeatureConfig): string | undefined => {
    const normalized: Record<string, unknown> = {
        highlight: config.highlight,
        topPost: config.topPost,
        featured: config.featured,
        urgent: config.urgent,
    };

    if (config.badge.trim()) {
        normalized.badge = config.badge.trim();
    }

    const hasAnyEnabled =
        config.highlight || config.topPost || config.featured || config.urgent || !!config.badge.trim();

    return hasAnyEnabled ? JSON.stringify(normalized) : undefined;
};

const BADGE_REGEX = /^(?=.{1,30}$)[\p{L}\p{N}\s-]+$/u;

const VipPackageFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        description: '',
        durationDays: '',
        price: '',
        priorityLevel: '',
        status: 1,
        packageType: 'POST_VIP',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
    const [featureConfig, setFeatureConfig] = useState<FeatureConfig>({ ...defaultFeatureConfig });
    const [selectedTier, setSelectedTier] = useState<TierKey>('basic');

    const isEdit = !!id;
    const existingPriorityLevels = new Set(
        priorityItems
            .filter((item) => !isEdit || item.id !== Number(id))
            .map((item) => item.priorityLevel),
    );
    const cannotCreateActiveTier = !isEdit
        && formData.status === 1
        && VIP_TIER_TEMPLATES.every((tier) => existingPriorityLevels.has(tier.priorityLevel));

    useEffect(() => {
        loadPriorityItems();
        if (isEdit) {
            loadPackage();
        }
    }, [id]);

    const loadPriorityItems = async () => {
        try {
            const res = await vipPackageApi.getAll(1, 1000);
            const data = (res.data.data || res.data) as PriorityItem[];
            setPriorityItems(Array.isArray(data) ? data : []);
        } catch {
            setPriorityItems([]);
        }
    };

    const loadPackage = async () => {
        try {
            const res = await vipPackageApi.getById(Number(id));
            const pkg = res.data.data || res.data;
            const detectedTier = getTierByPriority(pkg.priorityLevel);
            setFormData({
                name: pkg.name || '',
                description: pkg.description || '',
                durationDays: pkg.durationDays || detectedTier?.durationDays || '',
                price: pkg.price || '',
                priorityLevel: pkg.priorityLevel || detectedTier?.priorityLevel || '',
                status: pkg.status ?? 1,
                packageType: pkg.packageType || 'POST_VIP',
            });
            const parsedFeature = parseFeatureConfig(pkg.features);
            if (detectedTier) {
                setSelectedTier(detectedTier.key);
                setFeatureConfig({
                    ...detectedTier.features,
                    badge: detectedTier.badge,
                });
            } else {
                setFeatureConfig(parsedFeature);
            }
        } catch {
            toast.error('Không tìm thấy gói VIP');
            navigate('/admin/vip-packages');
        }
    };

    const handleSelectTier = (tierKey: TierKey) => {
        setSelectedTier(tierKey);
        const tier = VIP_TIER_TEMPLATES.find((item) => item.key === tierKey);
        if (!tier) return;
        const mapped = applyTierTemplate(tier);
        setFormData((prev) => ({
            ...prev,
            durationDays: mapped.durationDays,
            priorityLevel: mapped.priorityLevel,
        }));
        setFeatureConfig(mapped.featureConfig);
    };

    useEffect(() => {
        if (isEdit) return;

        if (formData.status !== 1) {
            if (formData.durationDays === '' || formData.priorityLevel === '') {
                handleSelectTier(selectedTier);
            }
            return;
        }

        const selected = VIP_TIER_TEMPLATES.find((item) => item.key === selectedTier);
        const selectedTaken = selected ? existingPriorityLevels.has(selected.priorityLevel) : false;

        if (!selectedTaken) {
            if (formData.durationDays === '' || formData.priorityLevel === '') {
                handleSelectTier(selectedTier);
            }
            return;
        }

        const firstAvailable = VIP_TIER_TEMPLATES.find((tier) => !existingPriorityLevels.has(tier.priorityLevel));
        if (firstAvailable && firstAvailable.key !== selectedTier) {
            handleSelectTier(firstAvailable.key);
        }
    }, [isEdit, selectedTier, formData.status, priorityItems]);

    const handleChange = (field: keyof FormData, value: unknown) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.name?.trim()) newErrors.name = 'Vui lòng nhập tên gói';
        if (!formData.durationDays || formData.durationDays <= 0) newErrors.durationDays = 'Vui lòng nhập số ngày hợp lệ';
        if (!formData.price || formData.price < 0) newErrors.price = 'Vui lòng nhập giá hợp lệ';
        if (!formData.priorityLevel || formData.priorityLevel <= 0) newErrors.priorityLevel = 'Vui lòng nhập mức độ ưu tiên';

        if (formData.status === 1 && formData.priorityLevel && formData.priorityLevel > 0) {
            const duplicate = priorityItems.some(
                (item) => item.priorityLevel === formData.priorityLevel && (!isEdit || item.id !== Number(id)),
            );
            if (duplicate) {
                newErrors.priorityLevel = 'Mức độ ưu tiên đã có gói active. Hãy chọn tier khác hoặc đổi trạng thái về Không hoạt động.';
            }
        }

        const badge = featureConfig.badge.trim();
        if (badge && !BADGE_REGEX.test(badge)) {
            newErrors.badge = 'Badge chỉ cho phép chữ, số, khoảng trắng, dấu gạch ngang (tối đa 30 ký tự)';
        }

        const tier = VIP_TIER_TEMPLATES.find((item) => item.key === selectedTier);
        if (tier) {
            if (formData.durationDays !== tier.durationDays) {
                newErrors.durationDays = `Gói ${tier.label} phải có thời hạn ${tier.durationDays} ngày`;
            }
            if (formData.priorityLevel !== tier.priorityLevel) {
                newErrors.priorityLevel = `Gói ${tier.label} phải có mức ưu tiên ${tier.priorityLevel}`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const onFinish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const payload: Record<string, unknown> = { ...formData };
            // Always send features key so admin can clear all features when editing.
            payload.features = serializeFeatureConfig(featureConfig) ?? '';

            if (isEdit) {
                await vipPackageApi.update(Number(id), payload);
                toast.success('Cập nhật thành công');
            } else {
                await vipPackageApi.create(payload);
                toast.success('Tạo mới thành công');
            }
            navigate('/admin/vip-packages');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
    const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';
    const errorClass = 'mt-1 text-xs text-error-500';
    const featureOptionClass = 'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors';

    const featureItems = [
        { key: 'highlight' as const, label: 'Làm nổi bật bài đăng' },
        { key: 'topPost' as const, label: 'Ưu tiên lên đầu danh sách' },
        { key: 'featured' as const, label: 'Gắn nhãn nổi bật' },
        { key: 'urgent' as const, label: 'Gắn nhãn khẩn' },
    ];

    const selectedTierInfo = VIP_TIER_TEMPLATES.find((item) => item.key === selectedTier);

    return (
        <div className="space-y-5">
            <Button
                variant="link"
                onClick={() => navigate('/admin/vip-packages')}
                className="px-0"
            >
                ← Quay lại
            </Button>

            <div>
                <h3 className="text-2xl font-bold text-gray-900">
                    {isEdit ? 'Chỉnh sửa gói VIP' : 'Tạo gói VIP mới'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                    {isEdit ? 'Cập nhật thông tin gói' : 'Tạo gói nâng cao độ hiển thị bài đăng'}
                </p>
            </div>

            <div className="bg-white rounded-2xl p-6 md:p-7 shadow-sm border border-gray-100">
                <form onSubmit={onFinish}>
                    <p className="font-semibold text-gray-900 mb-4">Thông tin cơ bản</p>

                    <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                        <label className={labelClass}>Mẫu phân tầng gói VIP</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {VIP_TIER_TEMPLATES.map((tier) => {
                                const active = selectedTier === tier.key;
                                const occupied = existingPriorityLevels.has(tier.priorityLevel);
                                const disabled = !isEdit && formData.status === 1 && occupied;
                                return (
                                    <button
                                        key={tier.key}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => handleSelectTier(tier.key)}
                                        className={`rounded-xl border px-4 py-3 text-left transition ${active
                                            ? 'border-brand-500 bg-white shadow-sm'
                                            : disabled
                                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'border-brand-100 bg-white/70 hover:border-brand-300'
                                            }`}
                                    >
                                        <p className="text-sm font-semibold text-gray-900">{tier.label}</p>
                                        <p className="mt-1 text-xs text-gray-500">{tier.description}</p>
                                        <p className="mt-1 text-xs text-brand-700">{tier.durationDays} ngày • Ưu tiên {tier.priorityLevel} • {tier.badge}</p>
                                        {disabled && <p className="mt-1 text-[11px] text-error-500">Đã có gói active ở tier này</p>}
                                    </button>
                                );
                            })}
                        </div>
                        {selectedTierInfo && (
                            <p className="mt-3 text-xs text-brand-700">
                                Đã chọn {selectedTierInfo.label}. Hệ thống tự áp dụng thời hạn, ưu tiên và tính năng để đảm bảo phân tầng rõ ràng.
                            </p>
                        )}
                        {cannotCreateActiveTier && (
                            <p className="mt-2 text-xs text-error-500">
                                Đã đủ 4 gói active. Muốn thêm mới, hãy chuyển trạng thái gói này thành Không hoạt động hoặc chỉnh sửa gói hiện có.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>
                                Tên gói <span className="text-error-500">*</span>
                            </label>
                            <input
                                className={`${inputClass} ${errors.name ? 'border-error-500' : ''}`}
                                placeholder="VD: Gói Bạc, Gói Vàng"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                            />
                            {errors.name && <p className={errorClass}>{errors.name}</p>}
                        </div>

                        <div>
                            <label className={labelClass}>
                                Mô tả <span className="text-gray-400 font-normal">(Tùy chọn)</span>
                            </label>
                            <input
                                className={inputClass}
                                placeholder="Mô tả ngắn gọn về gói"
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>
                                Thời hạn (ngày) <span className="text-error-500">*</span>
                            </label>
                            <input
                                type="number"
                                className={`${inputClass} ${errors.durationDays ? 'border-error-500' : ''}`}
                                placeholder="VD: 3, 7, 30"
                                min={1}
                                readOnly
                                value={formData.durationDays}
                                onChange={(e) => handleChange('durationDays', e.target.value ? Number(e.target.value) : '')}
                            />
                            {errors.durationDays && <p className={errorClass}>{errors.durationDays}</p>}
                        </div>

                        <div>
                            <label className={labelClass}>
                                Giá (VNĐ) <span className="text-error-500">*</span>
                            </label>
                            <input
                                type="number"
                                className={`${inputClass} ${errors.price ? 'border-error-500' : ''}`}
                                placeholder="VD: 50000"
                                min={0}
                                value={formData.price}
                                onChange={(e) => handleChange('price', e.target.value ? Number(e.target.value) : '')}
                            />
                            {errors.price && <p className={errorClass}>{errors.price}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>
                                Mức độ ưu tiên <span className="text-error-500">*</span>
                            </label>
                            <input
                                type="number"
                                className={`${inputClass} ${errors.priorityLevel ? 'border-error-500' : ''}`}
                                placeholder="VD: 1 (thấp), 2, 3, 4, 5 (cao)"
                                min={1}
                                readOnly
                                value={formData.priorityLevel}
                                onChange={(e) => handleChange('priorityLevel', e.target.value ? Number(e.target.value) : '')}
                            />
                            {errors.priorityLevel && <p className={errorClass}>{errors.priorityLevel}</p>}
                        </div>

                        <div>
                            <label className={labelClass}>Phân loại gói</label>
                            <select
                                className={inputClass}
                                value={formData.packageType}
                                onChange={(e) => handleChange('packageType', e.target.value)}
                            >
                                <option value="POST_VIP">Nổi bật bài đăng (POST_VIP)</option>
                                <option value="ACCOUNT_VIP">Nâng tài khoản (ACCOUNT_VIP)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="md:col-span-1">
                            <label className={labelClass}>Trạng thái</label>
                            <select
                                className={inputClass}
                                value={formData.status}
                                onChange={(e) => handleChange('status', Number(e.target.value))}
                            >
                                <option value={1}>Hoạt động</option>
                                <option value={0}>Không hoạt động</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className={labelClass}>
                            Tính năng <span className="text-gray-400 font-normal">(Tùy chọn)</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {featureItems.map((item) => {
                                const active = featureConfig[item.key];
                                return (
                                    <button
                                        type="button"
                                        key={item.key}
                                        className={`${featureOptionClass} ${active
                                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                        onClick={() => undefined}
                                    >
                                        <span>{item.label}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {active ? 'Bật' : 'Tắt'}
                                        </span>
                                        <span className="ml-2 text-[11px] text-gray-500">Theo mẫu</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-3">
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nhãn badge (ví dụ: VIP 30)</label>
                            <input
                                className={`${inputClass} ${errors.badge ? 'border-error-500' : ''}`}
                                placeholder="Nhập nhãn hiển thị trên bài đăng"
                                value={featureConfig.badge}
                                readOnly
                                onChange={(e) => setFeatureConfig((prev) => ({ ...prev, badge: e.target.value }))}
                            />
                            {errors.badge && <p className={errorClass}>{errors.badge}</p>}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5">
                        <Button type="submit" variant="primary" loading={loading} disabled={cannotCreateActiveTier}>
                            {isEdit ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/admin/vip-packages')}>
                            Hủy
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VipPackageFormPage;
