import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { landApi, propertyCategoryApi, employeeApi } from '@/api';
import { DIRECTIONS } from '@/constants';
import type { PropertyCategory, Employee } from '@/types';
import { Button } from '@/components/ui';

interface FileItem {
    uid: string;
    name: string;
    status: string;
    url?: string;
    originFileObj?: File;
    preview?: string;
}

const LandFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<PropertyCategory[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [fileList, setFileList] = useState<FileItem[]>([]);
    const isEdit = !!id;

    const [formData, setFormData] = useState<Record<string, unknown>>({
        code: '',
        title: '',
        categoryId: '',
        city: '',
        district: '',
        ward: '',
        street: '',
        plotNumber: '',
        price: '',
        area: '',
        direction: '',
        frontWidth: '',
        landLength: '',
        landType: '',
        legalStatus: '',
        employeeId: '',
        status: 1,
        description: '',
    });

    const setField = (name: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

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

    const loadLand = useCallback(async (landId: number) => {
        try {
            const res = await landApi.getById(landId);
            const land = res.data.data || res.data;
            setFormData({
                code: land.code || '',
                title: land.title || '',
                categoryId: land.categoryId || '',
                city: land.city || '',
                district: land.district || '',
                ward: land.ward || '',
                street: land.street || '',
                plotNumber: land.plotNumber || '',
                price: land.price || '',
                area: land.area || '',
                direction: land.direction || '',
                frontWidth: land.frontWidth || '',
                landLength: land.landLength || '',
                landType: land.landType || '',
                legalStatus: land.legalStatus || '',
                employeeId: land.employeeId || '',
                status: land.status ?? 1,
                description: land.description || '',
            });
            if (land.images) {
                setFileList(
                    land.images.map((img: { id: number; url: string }) => ({
                        uid: String(img.id),
                        name: `image-${img.id}`,
                        status: 'done' as const,
                        url: img.url,
                    })),
                );
            }
        } catch {
            toast.error('Không tìm thấy đất');
            navigate('/admin/lands');
        }
    }, [navigate]);

    useEffect(() => {
        loadFormData();
        if (isEdit) loadLand(Number(id));
    }, [id, isEdit, loadFormData, loadLand]);

    const onFinish = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.code) {
            toast.error('Vui lòng nhập mã đất');
            return;
        }
        if (!formData.title) {
            toast.error('Vui lòng nhập tiêu đề');
            return;
        }

        setLoading(true);
        try {
            const submitData = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    submitData.append(key, String(value));
                }
            });

            // Ảnh cũ cần giữ lại
            fileList.forEach((file) => {
                if (!file.originFileObj && file.uid) {
                    submitData.append('keepImageIds', file.uid);
                }
            });

            // Ảnh mới upload
            fileList.forEach((file) => {
                if (file.originFileObj) {
                    submitData.append('images', file.originFileObj);
                }
            });

            if (isEdit) {
                await landApi.update(Number(id), submitData);
                toast.success('Cập nhật thành công');
            } else {
                await landApi.create(submitData);
                toast.success('Tạo mới thành công');
            }
            navigate('/admin/lands');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles: FileItem[] = Array.from(e.target.files).map((file, i) => ({
            uid: `new-${Date.now()}-${i}`,
            name: file.name,
            status: 'done',
            originFileObj: file,
            preview: URL.createObjectURL(file),
        }));
        setFileList((prev) => [...prev, ...newFiles].slice(0, 10));
        e.target.value = '';
    };

    const removeFile = (uid: string) => {
        setFileList((prev) => prev.filter((f) => f.uid !== uid));
    };

    const inputClass =
        'admin-control w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500';
    const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

    return (
        <div className="space-y-5">
            <Button
                variant="link"
                onClick={() => navigate('/admin/lands')}
                startIcon={
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                }
                className="mb-4 px-0"
            >
                Quay lại
            </Button>

            <div>
                <h3 className="admin-page-title text-2xl font-bold text-gray-900">
                    {isEdit ? 'Chỉnh sửa đất' : 'Thêm đất mới'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">Tối ưu thông tin pháp lý và mô tả lô đất để duyệt nhanh hơn.</p>
            </div>

            <div className="admin-form-surface rounded-2xl p-6 md:p-7">
                <form onSubmit={onFinish}>
                    <p className="admin-section-title">Thông tin cơ bản</p>
                    {/* Row 1: Mã, Tiêu đề, Danh mục */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                        <div className="md:col-span-3">
                            <label className={labelClass}>
                                Mã đất <span className="text-error-500">*</span>
                            </label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="VD: L001"
                                value={String(formData.code || '')}
                                onChange={(e) => setField('code', e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-6">
                            <label className={labelClass}>
                                Tiêu đề <span className="text-error-500">*</span>
                            </label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Nhập tiêu đề"
                                value={String(formData.title || '')}
                                onChange={(e) => setField('title', e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Danh mục</label>
                            <select
                                className={inputClass}
                                value={String(formData.categoryId || '')}
                                onChange={(e) => setField('categoryId', e.target.value || '')}
                            >
                                <option value="">Chọn danh mục</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <p className="admin-section-title">Địa chỉ</p>
                    {/* Row 2: Địa chỉ */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Tỉnh/Thành phố</label>
                            <input type="text" className={inputClass} value={String(formData.city || '')} onChange={(e) => setField('city', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Quận/Huyện</label>
                            <input type="text" className={inputClass} value={String(formData.district || '')} onChange={(e) => setField('district', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Phường/Xã</label>
                            <input type="text" className={inputClass} value={String(formData.ward || '')} onChange={(e) => setField('ward', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Đường</label>
                            <input type="text" className={inputClass} value={String(formData.street || '')} onChange={(e) => setField('street', e.target.value)} />
                        </div>
                    </div>

                    <p className="admin-section-title">Thông số lô đất</p>
                    {/* Row 3: Số thửa, Giá, Diện tích, Hướng, Mặt tiền */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Số thửa</label>
                            <input type="text" className={inputClass} value={String(formData.plotNumber || '')} onChange={(e) => setField('plotNumber', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Giá (VNĐ)</label>
                            <input type="number" className={inputClass} value={String(formData.price || '')} onChange={(e) => setField('price', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Diện tích (m²)</label>
                            <input type="number" className={inputClass} min={0} value={String(formData.area || '')} onChange={(e) => setField('area', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Hướng</label>
                            <select className={inputClass} value={String(formData.direction || '')} onChange={(e) => setField('direction', e.target.value || '')}>
                                <option value="">Chọn hướng</option>
                                {DIRECTIONS.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Mặt tiền (m)</label>
                            <input type="number" className={inputClass} min={0} value={String(formData.frontWidth || '')} onChange={(e) => setField('frontWidth', e.target.value)} />
                        </div>
                    </div>

                    {/* Row 4: Chiều dài, Loại đất, Pháp lý, Nhân viên, Trạng thái */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Chiều dài (m)</label>
                            <input type="number" className={inputClass} min={0} value={String(formData.landLength || '')} onChange={(e) => setField('landLength', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Loại đất</label>
                            <input type="text" className={inputClass} value={String(formData.landType || '')} onChange={(e) => setField('landType', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Pháp lý</label>
                            <input type="text" className={inputClass} value={String(formData.legalStatus || '')} onChange={(e) => setField('legalStatus', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Nhân viên</label>
                            <select className={inputClass} value={String(formData.employeeId || '')} onChange={(e) => setField('employeeId', e.target.value || '')}>
                                <option value="">Chọn nhân viên</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.code} - {emp.user?.fullName || ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Trạng thái</label>
                            <select className={inputClass} value={String(formData.status || 1)} onChange={(e) => setField('status', Number(e.target.value))}>
                                <option value={1}>Hoạt động</option>
                                <option value={0}>Đã bán</option>
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label className={labelClass}>Mô tả</label>
                        <textarea
                            rows={4}
                            className={`${inputClass} min-h-[130px]`}
                            value={String(formData.description || '')}
                            onChange={(e) => setField('description', e.target.value)}
                        />
                    </div>

                    {/* Image upload */}
                    <div className="mb-6">
                        <label className={labelClass}>Hình ảnh</label>
                        <div className="flex flex-wrap gap-3 mt-1">
                            {fileList.map((file) => (
                                <div key={file.uid} className="relative group w-[112px] h-[112px] rounded-xl border border-gray-200 overflow-hidden">
                                    <img
                                        src={file.url || file.preview}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeFile(file.uid)}
                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            {fileList.length < 10 && (
                                <label className="w-[112px] h-[112px] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs text-gray-400 mt-1">Tải lên</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-5">
                        <Button type="submit" variant="primary" loading={loading}>
                            {isEdit ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/admin/lands')}>
                            Hủy
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LandFormPage;
