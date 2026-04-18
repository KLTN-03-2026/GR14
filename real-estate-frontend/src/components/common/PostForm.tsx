import React, { useState, useEffect } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic/build/ckeditor';
import { StarFilled } from '@ant-design/icons';
import toast from 'react-hot-toast';
import PostTypeSelector from './PostTypeSelector';
import AiDescriptionGeneratorModal from './AiDescriptionGeneratorModal';
import { aiApi } from '@/api/ai';
import { PostType, POST_TYPE_GROUPS } from '@/types/post';
import type { CreatePostDto } from '@/types/post';
import { useVietnamAddress } from '@/hooks/UseAddressVN';

// ─── Price formatting helpers ─────────────────────────────────────────────────

/** Format a number to Vietnamese dot-separated string: 1000000000 → "1.000.000.000" */
const formatVND = (val: number | undefined): string => {
    if (val === undefined || val === null || isNaN(val) || val === 0) return '';
    return val.toLocaleString('vi-VN');
};

// ─── PriceInput ───────────────────────────────────────────────────────────────

interface PriceInputProps {
    value: number | undefined;
    onChange: (val: number) => void;
    placeholder?: string;
    className?: string;
    hasError?: boolean;
}

const PriceInput: React.FC<PriceInputProps> = ({
    value,
    onChange,
    placeholder = '0',
    className = '',
    hasError = false,
}) => {
    const [displayValue, setDisplayValue] = useState<string>(formatVND(value));

    // Sync when external value changes (e.g. initialData load)
    useEffect(() => {
        setDisplayValue(formatVND(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        const num = raw ? Number(raw) : 0;
        // Format with dots for display
        const formatted = raw ? Number(raw).toLocaleString('vi-VN') : '';
        setDisplayValue(formatted);
        onChange(num);
    };

    const handleBlur = () => {
        setDisplayValue(formatVND(value));
    };

    const baseClass = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
        hasError
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
    }`;

    return (
        <div className="relative">
            <input
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={`${baseClass} pr-14 ${className}`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-xs font-medium text-gray-400">
                VNĐ
            </span>
        </div>
    );
};

type UploadImage = {
    uid: string;
    name: string;
    status: 'done';
    url: string;
    originFileObj?: File;
};

interface PostFormProps {
    initialData?: Partial<CreatePostDto> & { images?: { id: number; url: string }[] };
    onSubmit: (formData: FormData) => Promise<void>;
    onCancel: () => void;
    submitLabel?: string;
    isLoading?: boolean;
    postTypeSelectorMode?: 'select' | 'cards';
}

const PostForm: React.FC<PostFormProps> = ({
    initialData,
    onSubmit,
    onCancel,
    submitLabel = 'Lưu',
    isLoading = false,
    postTypeSelectorMode = 'select',
}) => {
    const [postType, setPostType] = useState<PostType | ''>(initialData?.postType || '');
    const [formData, setFormData] = useState<Partial<CreatePostDto>>(initialData || {});
    const [fileList, setFileList] = useState<UploadImage[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const { provinces, wards, loadWards, resetAddress } = useVietnamAddress();

    const propertyTypeSet = new Set<PostType>(POST_TYPE_GROUPS.PROPERTY as readonly PostType[]);
    const needTypeSet = new Set<PostType>(POST_TYPE_GROUPS.NEED as readonly PostType[]);
    const contentTypeSet = new Set<PostType>(POST_TYPE_GROUPS.CONTENT as readonly PostType[]);

    // Initialize file list from initial data
    useEffect(() => {
        if (initialData?.images?.length) {
            setFileList(
                initialData.images.map((img) => ({
                    uid: img.id.toString(),
                    name: `image-${img.id}`,
                    status: 'done' as const,
                    url: img.url,
                }))
            );
        }
    }, [initialData]);

    useEffect(() => {
        if (formData.city) {
            loadWards(formData.city);
        } else {
            resetAddress();
        }
    }, [formData.city, loadWards, resetAddress]);

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        handleFieldChange('city', e.target.value);
        handleFieldChange('district', '');
        handleFieldChange('ward', '');
    };

    // Reset form when post type changes
    useEffect(() => {
        if (postType && !initialData?.postType) {
            setFormData({ postType });
            setErrors({});
        }
    }, [postType, initialData?.postType]);

    const handleFieldChange = (field: keyof CreatePostDto, value: string | number | undefined) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user types
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newImages: UploadImage[] = Array.from(files).map((file) => ({
            uid: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            status: 'done',
            url: URL.createObjectURL(file),
            originFileObj: file,
        }));

        setFileList((prev) => [...prev, ...newImages]);
    };

    const removeImage = (uid: string) => {
        setFileList((prev) => prev.filter((img) => img.uid !== uid));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Common required fields
        if (!formData.title?.trim()) {
            newErrors.title = 'Vui lòng nhập tiêu đề';
        }
        if (!formData.description?.trim()) {
            newErrors.description = 'Vui lòng nhập mô tả';
        }

        // Validate based on post type
        if (postType && propertyTypeSet.has(postType)) {
            // BĐS requires: city, district, ward, address, price, area
            if (!formData.city?.trim()) newErrors.city = 'Vui lòng nhập thành phố';
            if (!formData.ward?.trim()) newErrors.ward = 'Vui lòng nhập phường/xã';
            if (!formData.address?.trim()) newErrors.address = 'Vui lòng nhập địa chỉ';
            if (!formData.price || formData.price <= 0) newErrors.price = 'Vui lòng nhập giá hợp lệ';
            if (!formData.area || formData.area <= 0) newErrors.area = 'Vui lòng nhập diện tích hợp lệ';
        } else if (postType && needTypeSet.has(postType)) {
            // NEED_BUY/NEED_RENT requires: city, district, minPrice, maxPrice, minArea, maxArea
            if (!formData.city?.trim()) newErrors.city = 'Vui lòng nhập thành phố';
            if (!formData.minPrice || formData.minPrice <= 0) newErrors.minPrice = 'Vui lòng nhập giá tối thiểu';
            if (!formData.maxPrice || formData.maxPrice <= 0) newErrors.maxPrice = 'Vui lòng nhập giá tối đa';
            if (!formData.minArea || formData.minArea <= 0) newErrors.minArea = 'Vui lòng nhập diện tích tối thiểu';
            if (!formData.maxArea || formData.maxArea <= 0) newErrors.maxArea = 'Vui lòng nhập diện tích tối đa';

            // Validate min <= max
            if (formData.minPrice && formData.maxPrice && formData.minPrice > formData.maxPrice) {
                newErrors.minPrice = 'Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa';
            }
            if (formData.minArea && formData.maxArea && formData.minArea > formData.maxArea) {
                newErrors.minArea = 'Diện tích tối thiểu phải nhỏ hơn hoặc bằng diện tích tối đa';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!postType) {
            setErrors({ postType: 'Vui lòng chọn loại bài đăng' });
            return;
        }

        if (!validateForm()) {
            return;
        }

        const submitData = new FormData();

        // Add all form fields (exclude 'images' — only send new file objects below)
        Object.entries(formData).forEach(([key, value]) => {
            if (key !== 'postType' && key !== 'images' && value !== undefined && value !== null && value !== '') {
                submitData.append(key, String(value));
            }
        });

        // Add postType
        submitData.append('postType', postType);

        // Add new images
        fileList
            .filter((file) => file.originFileObj)
            .forEach((file) => {
                if (file.originFileObj) {
                    submitData.append('images', file.originFileObj);
                }
            });

        await onSubmit(submitData);
    };

    const handleGenerateAiDescription = async (tone: 'polite' | 'friendly') => {
        if (!postType) {
            toast('Vui lòng chọn loại bài đăng trước khi tạo mô tả');
            setIsAiModalOpen(false);
            return;
        }
        if (!formData.title) {
            toast('Vui lòng nhập tiêu đề để AI hiểu bạn muốn bán/cho thuê gì');
            setIsAiModalOpen(false);
            return;
        }

        try {
            setIsGeneratingAi(true);

            const payload = {
                tone,
                postType,
                title: formData.title,
                city: formData.city,
                district: formData.district,
                ward: formData.ward,
                address: formData.address,
                price: formData.price,
                area: formData.area,
                bedrooms: formData.bedrooms,
                bathrooms: formData.bathrooms,
                floors: formData.floors,
                frontWidth: formData.frontWidth,
                landLength: formData.landLength,
                landType: formData.landType,
                direction: formData.direction,
                legalStatus: formData.legalStatus,
                minPrice: formData.minPrice,
                maxPrice: formData.maxPrice,
                minArea: formData.minArea,
                maxArea: formData.maxArea,
                startDate: formData.startDate,
                endDate: formData.endDate,
                discountCode: formData.discountCode,
                contactPhone: formData.contactPhone,
                contactLink: formData.contactLink,
            };

            const data = await aiApi.generateDescription(payload);
            const fullText = data.description || '';

            // Convert text newlines to HTML breaks for CKEditor, and handle Markdown bold loosely
            let formattedText = fullText.replace(/(?:\r\n|\r|\n)/g, '<br/>');
            // Basic markdown bold to HTML bold since CKEditor prefers HTML
            formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            handleFieldChange('description', formattedText);

            toast.success('Tạo mô tả thành công!');
            setIsAiModalOpen(false); // Close modal when finished
        } catch (error: any) {
            const backendMsg = error.response?.data?.message || 'Có lỗi xảy ra khi tạo mô tả, vui lòng thử lại sau.';
            toast.error(backendMsg);
            console.error('AI Desc Generator error:', error);
            setIsAiModalOpen(false);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const isPropertyType = postType !== '' && propertyTypeSet.has(postType);
    const isNeedType = postType !== '' && needTypeSet.has(postType);
    const isContentType = postType !== '' && contentTypeSet.has(postType);
    const isHouseType = postType === PostType.SELL_HOUSE || postType === PostType.RENT_HOUSE;
    const isLandType = postType === PostType.SELL_LAND || postType === PostType.RENT_LAND;

    const inputClass = (fieldName: string) =>
        `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors[fieldName]
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
        }`;

    const renderFieldError = (fieldName: string) =>
        errors[fieldName] ? (
            <p className="mt-1 text-xs text-red-500">{errors[fieldName]}</p>
        ) : null;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Post Type Selector */}
            <PostTypeSelector
                value={postType}
                onChange={(value) => setPostType(value)}
                disabled={!!initialData?.postType}
                mode={postTypeSelectorMode}
            />
            {errors.postType && <p className="text-xs text-red-500">{errors.postType}</p>}

            {/* Title */}
            <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    className={inputClass('title')}
                    placeholder="Nhập tiêu đề bài đăng"
                />
                {renderFieldError('title')}
            </div>

            {/* Location Fields - For Property and Need types */}
            {(isPropertyType || isNeedType) && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Thành phố <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.city || ''}
                                onChange={handleCityChange}
                                className={inputClass('city')}
                            >
                                <option value="" disabled>-- Chọn Tỉnh/Thành phố --</option>
                                {provinces.map((p) => (
                                    <option key={p.province_code} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            {renderFieldError('city')}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Quận/Huyện
                            </label>
                            <input
                                type="text"
                                value={formData.district || ''}
                                onChange={(e) => handleFieldChange('district', e.target.value)}
                                className={inputClass('district')}
                                placeholder="Nhập quận/huyện (không bắt buộc)"
                            />
                            {renderFieldError('district')}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Phường/Xã {isPropertyType && <span className="text-red-500">*</span>}
                            </label>
                            <select
                                value={formData.ward || ''}
                                onChange={(e) => handleFieldChange('ward', e.target.value)}
                                disabled={!formData.city}
                                className={inputClass('ward') + ' disabled:bg-gray-100'}
                            >
                                <option value="" disabled>-- Chọn Phường/Xã --</option>
                                {wards.map((w) => (
                                    <option key={w.ward_code} value={w.ward_name}>{w.ward_name}</option>
                                ))}
                            </select>
                            {renderFieldError('ward')}
                        </div>
                    </div>

                    {isPropertyType && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Địa chỉ <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.address || ''}
                                onChange={(e) => handleFieldChange('address', e.target.value)}
                                className={inputClass('address')}
                                placeholder="123 Nguyễn Huệ"
                            />
                            {renderFieldError('address')}
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Hướng
                        </label>
                        <select
                            value={formData.direction || ''}
                            onChange={(e) => handleFieldChange('direction', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                            <option value="">-- Chọn hướng --</option>
                            <option value="Đông">Đông</option>
                            <option value="Tây">Tây</option>
                            <option value="Nam">Nam</option>
                            <option value="Bắc">Bắc</option>
                            <option value="Đông Bắc">Đông Bắc</option>
                            <option value="Đông Nam">Đông Nam</option>
                            <option value="Tây Bắc">Tây Bắc</option>
                            <option value="Tây Nam">Tây Nam</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Số điện thoại liên hệ
                            </label>
                            <input
                                type="text"
                                value={formData.contactPhone || ''}
                                onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="VD: 0901234567"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Link liên hệ (Facebook/Zalo)
                            </label>
                            <input
                                type="text"
                                value={formData.contactLink || ''}
                                onChange={(e) => handleFieldChange('contactLink', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="https://facebook.com/..."
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Price & Area - For Property types */}
            {isPropertyType && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Giá <span className="text-red-500">*</span>
                        </label>
                        <PriceInput
                            value={formData.price}
                            onChange={(val) => handleFieldChange('price', val)}
                            placeholder="1.000.000.000"
                            hasError={!!errors.price}
                        />
                        {renderFieldError('price')}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Diện tích (m²) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.area || ''}
                            onChange={(e) => handleFieldChange('area', parseFloat(e.target.value) || 0)}
                            className={inputClass('area')}
                            placeholder="100"
                            min="0"
                        />
                        {renderFieldError('area')}
                    </div>
                </div>
            )}

            {/* House-specific fields */}
            {isHouseType && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Số tầng
                        </label>
                        <input
                            type="number"
                            value={formData.floors || ''}
                            onChange={(e) => {
                                const raw = e.target.value;
                                handleFieldChange('floors', raw === '' ? undefined : Number.parseInt(raw, 10));
                            }}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            placeholder="1"
                            min="1"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Số phòng ngủ
                        </label>
                        <input
                            type="number"
                            value={formData.bedrooms || ''}
                            onChange={(e) => handleFieldChange('bedrooms', parseInt(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            placeholder="3"
                            min="0"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Số phòng tắm
                        </label>
                        <input
                            type="number"
                            value={formData.bathrooms || ''}
                            onChange={(e) => handleFieldChange('bathrooms', parseInt(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            placeholder="2"
                            min="0"
                        />
                    </div>
                </div>
            )}

            {/* Land-specific fields */}
            {isLandType && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Chiều ngang (m)
                            </label>
                            <input
                                type="number"
                                value={formData.frontWidth || ''}
                                onChange={(e) => handleFieldChange('frontWidth', parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="5"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Chiều dài (m)
                            </label>
                            <input
                                type="number"
                                value={formData.landLength || ''}
                                onChange={(e) => handleFieldChange('landLength', parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="20"
                                min="0"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Loại đất
                            </label>
                            <select
                                value={formData.landType || ''}
                                onChange={(e) => handleFieldChange('landType', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                                <option value="">-- Chọn loại đất --</option>
                                <option value="Đất thổ cư">Đất thổ cư</option>
                                <option value="Đất nông nghiệp">Đất nông nghiệp</option>
                                <option value="Đất công nghiệp">Đất công nghiệp</option>
                                <option value="Đất thương mại">Đất thương mại</option>
                                <option value="Đất dự án">Đất dự án</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Pháp lý
                            </label>
                            <select
                                value={formData.legalStatus || ''}
                                onChange={(e) => handleFieldChange('legalStatus', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                                <option value="">-- Chọn pháp lý --</option>
                                <option value="Sổ đỏ">Sổ đỏ</option>
                                <option value="Sổ hồng">Sổ hồng</option>
                                <option value="Giấy tờ hợp lệ">Giấy tờ hợp lệ</option>
                                <option value="Đang chờ sổ">Đang chờ sổ</option>
                            </select>
                        </div>
                    </div>
                </>
            )}

            {/* Need Buy/Rent fields */}
            {isNeedType && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Giá tối thiểu <span className="text-red-500">*</span>
                        </label>
                        <PriceInput
                            value={formData.minPrice}
                            onChange={(val) => handleFieldChange('minPrice', val)}
                            placeholder="500.000.000"
                            hasError={!!errors.minPrice}
                        />
                        {renderFieldError('minPrice')}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Giá tối đa <span className="text-red-500">*</span>
                        </label>
                        <PriceInput
                            value={formData.maxPrice}
                            onChange={(val) => handleFieldChange('maxPrice', val)}
                            placeholder="2.000.000.000"
                            hasError={!!errors.maxPrice}
                        />
                        {renderFieldError('maxPrice')}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Diện tích tối thiểu (m²) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.minArea || ''}
                            onChange={(e) => handleFieldChange('minArea', parseFloat(e.target.value) || 0)}
                            className={inputClass('minArea')}
                            placeholder="50"
                            min="0"
                        />
                        {renderFieldError('minArea')}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Diện tích tối đa (m²) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.maxArea || ''}
                            onChange={(e) => handleFieldChange('maxArea', parseFloat(e.target.value) || 0)}
                            className={inputClass('maxArea')}
                            placeholder="200"
                            min="0"
                        />
                        {renderFieldError('maxArea')}
                    </div>
                </div>
            )}

            {/* News/Promotion fields */}
            {isContentType && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Ngày bắt đầu
                            </label>
                            <input
                                type="date"
                                value={formData.startDate || ''}
                                onChange={(e) => handleFieldChange('startDate', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Ngày kết thúc
                            </label>
                            <input
                                type="date"
                                value={formData.endDate || ''}
                                onChange={(e) => handleFieldChange('endDate', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                    </div>
                    {postType === PostType.PROMOTION && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Mã giảm giá
                            </label>
                            <input
                                type="text"
                                value={formData.discountCode || ''}
                                onChange={(e) => handleFieldChange('discountCode', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="SUMMER2024"
                            />
                        </div>
                    )}
                </>
            )}

            {/* Description - CKEditor */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        Mô tả <span className="text-red-500">*</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setIsAiModalOpen(true)}
                        className="group flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-brand-500/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/40"
                    >
                        <StarFilled className="text-yellow-300 group-hover:animate-pulse" />
                        Tạo tự động bằng AI
                    </button>
                </div>
                <div className={`post-description-editor ${errors.description ? 'rounded-lg border border-red-500' : ''}`}>
                    <CKEditor
                        editor={ClassicEditor as any}
                        data={formData.description || ''}
                        onChange={(_, editor) => {
                            const data = editor.getData();
                            handleFieldChange('description', data);
                        }}
                        config={{
                            licenseKey: 'GPL',
                            placeholder: 'Nhập mô tả chi tiết...',
                        }}
                    />
                </div>
                <style>{`
                    .post-description-editor .ck-editor__editable[role="textbox"] {
                        min-height: 280px !important;
                    }
                `}</style>
                {renderFieldError('description')}
            </div>

            {/* Image Upload */}
            <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                    Hình ảnh
                </label>
                <div className="flex flex-wrap gap-3">
                    {fileList.map((file) => (
                        <div key={file.uid} className="relative h-24 w-24">
                            <img
                                src={file.url}
                                alt=""
                                className="h-full w-full rounded-lg object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(file.uid)}
                                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-brand-500">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <span className="text-2xl text-gray-400">+</span>
                    </label>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={isLoading}
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    disabled={isLoading || !postType}
                >
                    {isLoading ? 'Đang xử lý...' : submitLabel}
                </button>
            </div>

            <AiDescriptionGeneratorModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                onGenerate={handleGenerateAiDescription}
                isGenerating={isGeneratingAi}
            />
        </form>
    );
};

export default PostForm;
