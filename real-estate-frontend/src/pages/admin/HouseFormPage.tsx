import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { houseApi, propertyCategoryApi, employeeApi } from '@/api';
import { DIRECTIONS } from '@/constants';
import type { PropertyCategory, Employee } from '@/types';
import Button from '@/components/ui/Button';
import LoadingOverlay from '@/components/ui/LoadingOverlay';

interface FileItem {
    uid: string;
    name: string;
    status?: string;
    url?: string;
    originFileObj?: File;
    preview?: string;
}

type FormPrimitive = string | number | null | undefined;

const HouseFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<PropertyCategory[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [fileList, setFileList] = useState<FileItem[]>([]);
    const [formData, setFormData] = useState<Record<string, FormPrimitive>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isEdit = !!id;

    const loadFormData = useCallback(async () => {
        try {
            const [catRes, empRes] = await Promise.all([
                propertyCategoryApi.getAll(),
                employeeApi.getAll(),
            ]);
            setCategories(catRes.data.data || catRes.data);
            setEmployees(empRes.data.data || empRes.data);
        } catch {
            console.error('Error loading form data');
        }
    }, []);

    const loadHouse = useCallback(async (houseId: number) => {
        try {
            const res = await houseApi.getById(houseId);
            const house = res.data.data || res.data;
            setFormData(house as Record<string, FormPrimitive>);
            if (house.images) {
                setFileList(
                    house.images.map((img: { id: number; url: string }) => ({
                        uid: String(img.id),
                        name: `image-${img.id}`,
                        status: 'done' as const,
                        url: img.url,
                    })),
                );
            }
        } catch {
            toast.error('Không tìm thấy nhà');
            navigate('/admin/houses');
        }
    }, [navigate]);

    useEffect(() => {
        loadFormData();
        if (isEdit) loadHouse(Number(id));
    }, [id, isEdit, loadFormData, loadHouse]);

    const handleChange = (field: string, value: FormPrimitive) => {
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
        if (!formData.code?.toString().trim()) newErrors.code = 'Vui lòng nhập mã nhà';
        if (!formData.title?.toString().trim()) newErrors.title = 'Vui lòng nhập tiêu đề';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newFiles: FileItem[] = Array.from(files).map((file) => ({
            uid: `new-${Date.now()}-${Math.random()}`,
            name: file.name,
            originFileObj: file,
            preview: URL.createObjectURL(file),
        }));
        setFileList((prev) => [...prev, ...newFiles]);
        // Reset input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (uid: string) => {
        setFileList((prev) => {
            const item = prev.find((f) => f.uid === uid);
            if (item?.preview) URL.revokeObjectURL(item.preview);
            return prev.filter((f) => f.uid !== uid);
        });
    };

    const onFinish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        const values = formData;
        setLoading(true);
        try {
            const fd = new FormData();
            Object.entries(values).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    fd.append(key, String(value));
                }
            });

            // Ảnh cũ cần giữ lại (có uid = id từ DB, không có originFileObj)
            fileList.forEach((file) => {
                if (!file.originFileObj && file.uid) {
                    fd.append('keepImageIds', file.uid);
                }
            });

            // Ảnh mới upload
            fileList.forEach((file) => {
                if (file.originFileObj) {
                    fd.append('images', file.originFileObj);
                }
            });

            if (isEdit) {
                await houseApi.update(Number(id), fd);
                toast.success('Cập nhật thành công');
            } else {
                await houseApi.create(fd);
                toast.success('Tạo mới thành công');
            }
            navigate('/admin/houses');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        'admin-control w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
    const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';
    const errorClass = 'mt-1 text-xs text-error-500';

    return (
        <div className="space-y-5">
            <Button
                variant="link"
                onClick={() => navigate('/admin/houses')}
                className="px-0"
                startIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                }
            >
                Quay lại
            </Button>

            <div>
                <h3 className="admin-page-title text-2xl font-bold text-gray-900">
                    {isEdit ? 'Chỉnh sửa nhà' : 'Thêm nhà mới'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">Cập nhật thông tin bất động sản theo chuẩn hiển thị quản trị.</p>
            </div>

            <div className="admin-form-surface rounded-2xl p-6 md:p-7">
                <form onSubmit={onFinish}>
                    <p className="admin-section-title">Thông tin cơ bản</p>
                    {/* Row 1: code, title, category */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                        <div className="md:col-span-3">
                            <label className={labelClass}>
                                Mã nhà <span className="text-error-500">*</span>
                            </label>
                            <input
                                className={`${inputClass} ${errors.code ? 'border-error-500' : ''}`}
                                placeholder="VD: H001"
                                value={formData.code || ''}
                                onChange={(e) => handleChange('code', e.target.value)}
                            />
                            {errors.code && <p className={errorClass}>{errors.code}</p>}
                        </div>
                        <div className="md:col-span-6">
                            <label className={labelClass}>
                                Tiêu đề <span className="text-error-500">*</span>
                            </label>
                            <input
                                className={`${inputClass} ${errors.title ? 'border-error-500' : ''}`}
                                placeholder="Nhập tiêu đề"
                                value={formData.title || ''}
                                onChange={(e) => handleChange('title', e.target.value)}
                            />
                            {errors.title && <p className={errorClass}>{errors.title}</p>}
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Danh mục</label>
                            <select
                                className={inputClass}
                                value={formData.categoryId || ''}
                                onChange={(e) => handleChange('categoryId', e.target.value || undefined)}
                            >
                                <option value="">Chọn danh mục</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <p className="admin-section-title">Địa chỉ</p>
                    {/* Row 2: city, district, ward, street */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Tỉnh/Thành phố</label>
                            <input
                                className={inputClass}
                                placeholder="Nhập tỉnh/thành phố"
                                value={formData.city || ''}
                                onChange={(e) => handleChange('city', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Quận/Huyện</label>
                            <input
                                className={inputClass}
                                placeholder="Nhập quận/huyện"
                                value={formData.district || ''}
                                onChange={(e) => handleChange('district', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Phường/Xã</label>
                            <input
                                className={inputClass}
                                placeholder="Nhập phường/xã"
                                value={formData.ward || ''}
                                onChange={(e) => handleChange('ward', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Đường</label>
                            <input
                                className={inputClass}
                                placeholder="Nhập đường"
                                value={formData.street || ''}
                                onChange={(e) => handleChange('street', e.target.value)}
                            />
                        </div>
                    </div>

                    <p className="admin-section-title">Thông số</p>
                    {/* Row 3: houseNumber, price, area, direction */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Số nhà</label>
                            <input
                                className={inputClass}
                                placeholder="Số nhà"
                                value={formData.houseNumber || ''}
                                onChange={(e) => handleChange('houseNumber', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Giá (VNĐ)</label>
                            <input
                                type="number"
                                className={inputClass}
                                placeholder="Nhập giá"
                                value={formData.price || ''}
                                onChange={(e) => handleChange('price', e.target.value ? Number(e.target.value) : undefined)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Diện tích (m²)</label>
                            <input
                                type="number"
                                className={inputClass}
                                placeholder="Nhập diện tích"
                                min={0}
                                value={formData.area || ''}
                                onChange={(e) => handleChange('area', e.target.value ? Number(e.target.value) : undefined)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Hướng</label>
                            <select
                                className={inputClass}
                                value={formData.direction || ''}
                                onChange={(e) => handleChange('direction', e.target.value || undefined)}
                            >
                                <option value="">Chọn hướng</option>
                                {DIRECTIONS.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 4: floors, bedrooms, bathrooms, employee, status */}
                    <div className="grid grid-cols-3 md:grid-cols-12 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Số tầng</label>
                            <input
                                type="number"
                                className={inputClass}
                                min={0}
                                value={formData.floors ?? ''}
                                onChange={(e) => handleChange('floors', e.target.value ? Number(e.target.value) : undefined)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Phòng ngủ</label>
                            <input
                                type="number"
                                className={inputClass}
                                min={0}
                                value={formData.bedrooms ?? ''}
                                onChange={(e) => handleChange('bedrooms', e.target.value ? Number(e.target.value) : undefined)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelClass}>Phòng tắm</label>
                            <input
                                type="number"
                                className={inputClass}
                                min={0}
                                value={formData.bathrooms ?? ''}
                                onChange={(e) => handleChange('bathrooms', e.target.value ? Number(e.target.value) : undefined)}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Trạng thái</label>
                            <select
                                className={inputClass}
                                value={formData.status ?? 1}
                                onChange={(e) => handleChange('status', Number(e.target.value))}
                            >
                                <option value={1}>Hoạt động</option>
                                <option value={0}>Đã bán</option>
                            </select>
                        </div>
                        <div className="col-span-3 md:col-span-3">
                            <label className={labelClass}>Nhân viên phụ trách</label>
                            <select
                                className={inputClass}
                                value={formData.employeeId || ''}
                                onChange={(e) => handleChange('employeeId', e.target.value ? Number(e.target.value) : undefined)}
                            >
                                <option value="">Chọn nhân viên</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.code} - {emp.user?.fullName || ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label className={labelClass}>Mô tả</label>
                        <textarea
                            className={`${inputClass} min-h-[130px]`}
                            rows={4}
                            placeholder="Nhập mô tả chi tiết"
                            value={formData.description || ''}
                            onChange={(e) => handleChange('description', e.target.value)}
                        />
                    </div>

                    {/* Images */}
                    <div className="mb-6">
                        <label className={labelClass}>Hình ảnh</label>
                        <div className="flex flex-wrap gap-3 mt-2">
                            {fileList.map((file) => (
                                <div
                                    key={file.uid}
                                    className="relative group w-[112px] h-[112px] rounded-xl border border-gray-200 overflow-hidden"
                                >
                                    <img
                                        src={file.url || file.preview}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeFile(file.uid)}
                                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-error-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            {fileList.length < 10 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center justify-center w-[112px] h-[112px] rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-brand-500 hover:text-brand-500 transition-colors"
                                >
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="mt-1 text-xs">Tải lên</span>
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-5">
                        <Button type="submit" variant="primary" loading={loading}>
                            {isEdit ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/admin/houses')}>
                            Hủy
                        </Button>
                    </div>
                </form>
            </div>

            <LoadingOverlay
                visible={loading}
                title={isEdit ? 'Đang cập nhật nhà' : 'Đang tạo nhà mới'}
                description="Đang tải ảnh và lưu dữ liệu, vui lòng đợi..."
            />
        </div>
    );
};

export default HouseFormPage;
