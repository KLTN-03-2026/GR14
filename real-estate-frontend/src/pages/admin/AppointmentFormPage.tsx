import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { appointmentApi, customerApi, employeeApi, houseApi, landApi, userApi } from '@/api';
import { APPOINTMENT_STATUS_LABELS } from '@/constants';
import type { Customer, Employee, House, Land } from '@/types';
import { Button } from '@/components/ui';

type AppointmentFormData = {
    customerId?: number;
    employeeId?: number;
    propertyType: 'house' | 'land';
    houseId?: number;
    landId?: number;
    appointmentDate?: string;
    status: number;
    newCustomerName?: string;
    newCustomerPhone?: string;
    newCustomerEmail?: string;
};

type ApiError = {
    response?: {
        data?: {
            message?: string;
        };
    };
};

const AppointmentFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    const [formData, setFormData] = useState<AppointmentFormData>({
        propertyType: 'house',
        status: 0,
    });

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [houses, setHouses] = useState<House[]>([]);
    const [lands, setLands] = useState<Land[]>([]);
    const [propertyType, setPropertyType] = useState<'house' | 'land'>('house');
    const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
    const [phoneCheckStatus, setPhoneCheckStatus] = useState<'idle' | 'exists' | 'new'>('idle');
    const phoneCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isEdit = !!id;

    useEffect(() => {
        loadSelects();
        if (isEdit) loadAppointment(Number(id));
    }, [id, isEdit]);

    const loadSelects = async () => {
        try {
            const [cusRes, empRes, houseRes, landRes] = await Promise.all([
                customerApi.getAll({ limit: 200 }),
                employeeApi.getAll({ limit: 200 }),
                houseApi.getAll({ limit: 1000 }),
                landApi.getAll({ limit: 1000 }),
            ]);
            setCustomers(cusRes.data.data || cusRes.data);
            setEmployees(empRes.data.data || empRes.data);
            setHouses(houseRes.data.data || houseRes.data);
            setLands(landRes.data.data || landRes.data);
        } catch {
            toast.error('Lỗi tải dữ liệu');
        }
    };

    const loadAppointment = async (appointmentId: number) => {
        setFetching(true);
        try {
            const res = await appointmentApi.getById(appointmentId);
            const data = res.data;
            const type = data.landId ? 'land' : 'house';
            setPropertyType(type);
            setFormData({
                customerId: data.customerId,
                employeeId: data.employeeId,
                propertyType: type,
                houseId: data.houseId,
                landId: data.landId,
                appointmentDate: data.appointmentDate ? dayjs(data.appointmentDate).format('YYYY-MM-DDTHH:mm') : '',
                status: data.status,
            });
        } catch {
            toast.error('Lỗi tải lịch hẹn');
        } finally {
            setFetching(false);
        }
    };

    const handlePhoneChange = (phone: string) => {
        setPhoneCheckStatus('idle');
        if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);
        if (!phone || phone.length < 9) return;
        phoneCheckTimer.current = setTimeout(async () => {
            try {
                const res = await userApi.checkPhone(phone);
                setPhoneCheckStatus(res.data.exists ? 'exists' : 'new');
            } catch {
                setPhoneCheckStatus('idle');
            }
        }, 500);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const values = formData;

        // Basic validation
        if (!isEdit && customerMode === 'existing' && !values.customerId) {
            toast.error('Vui lòng chọn khách hàng');
            return;
        }
        if (!isEdit && customerMode === 'new' && !values.newCustomerName) {
            toast.error('Vui lòng nhập họ tên');
            return;
        }
        if (!isEdit && customerMode === 'new' && !values.newCustomerPhone) {
            toast.error('Vui lòng nhập số điện thoại');
            return;
        }
        if (!values.appointmentDate) {
            toast.error('Vui lòng chọn ngày giờ');
            return;
        }
        if (!isEdit && propertyType === 'house' && !values.houseId) {
            toast.error('Vui lòng chọn nhà');
            return;
        }
        if (!isEdit && propertyType === 'land' && !values.landId) {
            toast.error('Vui lòng chọn đất');
            return;
        }
        if (isEdit && values.status === 1 && !values.employeeId) {
            toast.error('Kỳ hạn Được Duyệt yêu cầu phải có Nhân viên phụ trách');
            return;
        }

        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                employeeId: values.employeeId || null,
                appointmentDate: new Date(values.appointmentDate).toISOString(),
                houseId: propertyType === 'house' ? values.houseId : null,
                landId: propertyType === 'land' ? values.landId : null,
            };

            if (isEdit) {
                payload.customerId = values.customerId;
                payload.status = values.status;
                await appointmentApi.update(Number(id), payload);
                if (dayjs(values.appointmentDate).isBefore(dayjs().startOf('minute'))) {
                    toast.success('Báo cáo cập nhật (Lịch hẹn thuộc về QUÁ KHỨ)', { icon: '⚠️' });
                } else {
                    toast.success('Cập nhật lịch hẹn thành công');
                }
            } else {
                if (customerMode === 'existing') {
                    payload.customerId = values.customerId;
                } else {
                    payload.newCustomerName = values.newCustomerName;
                    payload.newCustomerPhone = values.newCustomerPhone;
                    payload.newCustomerEmail = values.newCustomerEmail || undefined;
                }
                await appointmentApi.adminCreate(payload);
                toast.success(
                    phoneCheckStatus === 'exists'
                        ? 'Tạo lịch hẹn thành công (dùng tài khoản đã có)'
                        : 'Tạo lịch hẹn thành công'
                );
            }
            navigate('/admin/appointments');
        } catch (e: unknown) {
            const err = e as ApiError;
            toast.error(err.response?.data?.message || (isEdit ? 'Cập nhật thất bại' : 'Tạo thất bại'));
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        'admin-control w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition disabled:bg-gray-100 disabled:cursor-not-allowed';
    const selectClass =
        'admin-control w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-700 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition';
    const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-700';

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/admin/appointments')}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50 transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h2 className="admin-page-title text-2xl font-bold text-gray-900">
                        {isEdit ? 'Chỉnh sửa lịch hẹn' : 'Tạo lịch hẹn mới'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">Phân công nhân sự và theo dõi lịch hẹn khách hàng theo quy trình.</p>
                </div>
            </div>

            {/* Card */}
            <div className="admin-form-surface rounded-2xl p-6 md:p-7">
                {fetching ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="ml-2 text-gray-500">Đang tải...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <p className="admin-section-title">Thông tin cuộc hẹn</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {/* 1. Customer info - Create mode */}
                            {!isEdit && (
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Khách hàng</label>

                                    {/* Segmented buttons for customer mode */}
                                    <div className="inline-flex rounded-xl border border-gray-300 mb-4 overflow-hidden">
                                        <button
                                            type="button"
                                            className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition ${customerMode === 'existing'
                                                ? 'bg-brand-500 text-white'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            onClick={() => {
                                                setCustomerMode('existing');
                                                setPhoneCheckStatus('idle');
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    customerId: undefined,
                                                    newCustomerName: undefined,
                                                    newCustomerPhone: undefined,
                                                    newCustomerEmail: undefined,
                                                }));
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Khách có sẵn
                                        </button>
                                        <button
                                            type="button"
                                            className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 border-l border-gray-300 transition ${customerMode === 'new'
                                                ? 'bg-brand-500 text-white'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            onClick={() => {
                                                setCustomerMode('new');
                                                setPhoneCheckStatus('idle');
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    customerId: undefined,
                                                    newCustomerName: undefined,
                                                    newCustomerPhone: undefined,
                                                    newCustomerEmail: undefined,
                                                }));
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                            </svg>
                                            Khách mới
                                        </button>
                                    </div>

                                    {/* Existing customer select */}
                                    {customerMode === 'existing' && (
                                        <select
                                            className={`${selectClass} max-w-md`}
                                            value={formData.customerId || ''}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, customerId: Number(e.target.value) || undefined }))
                                            }
                                        >
                                            <option value="">Tìm theo tên hoặc số điện thoại...</option>
                                            {customers.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.user?.fullName || c.code}
                                                    {c.user?.phone ? `    ${c.user.phone}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}

                                    {/* New customer fields */}
                                    {customerMode === 'new' && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelClass}>Họ tên</label>
                                                <input
                                                    className={inputClass}
                                                    placeholder="Nguyễn Văn A"
                                                    value={formData.newCustomerName || ''}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({ ...prev, newCustomerName: e.target.value }))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Số điện thoại</label>
                                                <input
                                                    className={inputClass}
                                                    placeholder="09xxxxxxxx"
                                                    value={formData.newCustomerPhone || ''}
                                                    onChange={(e) => {
                                                        setFormData((prev) => ({ ...prev, newCustomerPhone: e.target.value }));
                                                        handlePhoneChange(e.target.value);
                                                    }}
                                                />
                                                {phoneCheckStatus === 'exists' && (
                                                    <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                        </svg>
                                                        Số điện thoại đã có tài khoản, sẽ dùng tài khoản đó
                                                    </div>
                                                )}
                                                {phoneCheckStatus === 'new' && (
                                                    <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                        Sẽ tạo tài khoản khách hàng mới
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className={labelClass}>Email (tùy chọn)</label>
                                                <input
                                                    className={inputClass}
                                                    type="email"
                                                    placeholder="example@gmail.com"
                                                    value={formData.newCustomerEmail || ''}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({ ...prev, newCustomerEmail: e.target.value }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Edit mode: customer readonly */}
                            {isEdit && (
                                <div>
                                    <label className={labelClass}>Khách hàng</label>
                                    <input
                                        className={inputClass}
                                        disabled
                                        value={
                                            customers.find((c) => c.id === formData.customerId)?.user?.fullName || ''
                                        }
                                        readOnly
                                    />
                                </div>
                            )}

                            {/* 2. Employee */}
                            <div>
                                <label className={labelClass}>Phân công nhân viên (tùy chọn)</label>
                                <select
                                    className={selectClass}
                                    value={formData.employeeId || ''}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            employeeId: Number(e.target.value) || undefined,
                                        }))
                                    }
                                >
                                    <option value="">Chọn nhân viên</option>
                                    {employees.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.user?.fullName || e.code}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Date time */}
                            <div>
                                <label className={labelClass}>Ngày & giờ hẹn</label>
                                <input
                                    type="datetime-local"
                                    className={inputClass}
                                    value={formData.appointmentDate || ''}
                                    min={dayjs().format('YYYY-MM-DDTHH:mm')}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, appointmentDate: e.target.value }))
                                    }
                                />
                            </div>

                            {/* Status (edit only) */}
                            {isEdit && (
                                <div>
                                    <label className={labelClass}>Trạng thái</label>
                                    <select
                                        className={selectClass}
                                        value={formData.status ?? 0}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, status: Number(e.target.value) }))
                                        }
                                    >
                                        {Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, v]) => (
                                            <option key={k} value={Number(k)}>
                                                {v}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* 4. Property (create only) */}
                            {!isEdit && (
                                <>
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Loại bất động sản</label>
                                        <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden">
                                            <button
                                                type="button"
                                                className={`px-4 py-2.5 text-sm font-semibold transition ${propertyType === 'house'
                                                    ? 'bg-brand-500 text-white'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => {
                                                    setPropertyType('house');
                                                    setFormData((prev) => ({ ...prev, houseId: undefined, landId: undefined }));
                                                }}
                                            >
                                                Nhà
                                            </button>
                                            <button
                                                type="button"
                                                className={`px-4 py-2.5 text-sm font-semibold border-l border-gray-300 transition ${propertyType === 'land'
                                                    ? 'bg-brand-500 text-white'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                onClick={() => {
                                                    setPropertyType('land');
                                                    setFormData((prev) => ({ ...prev, houseId: undefined, landId: undefined }));
                                                }}
                                            >
                                                Đất
                                            </button>
                                        </div>
                                    </div>

                                    {propertyType === 'house' && (
                                        <div>
                                            <label className={labelClass}>Chọn nhà</label>
                                            <select
                                                className={selectClass}
                                                value={formData.houseId || ''}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        houseId: Number(e.target.value) || undefined,
                                                    }))
                                                }
                                            >
                                                <option value="">Chọn nhà</option>
                                                {houses.map((h) => (
                                                    <option key={h.id} value={h.id}>
                                                        {h.code}  {h.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {propertyType === 'land' && (
                                        <div>
                                            <label className={labelClass}>Chọn đất</label>
                                            <select
                                                className={selectClass}
                                                value={formData.landId || ''}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        landId: Number(e.target.value) || undefined,
                                                    }))
                                                }
                                            >
                                                <option value="">Chọn đất</option>
                                                {lands.map((l) => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.code}  {l.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-5">
                            <Button
                                variant="primary"
                                type="submit"
                                loading={loading}
                                startIcon={
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                }
                            >
                                {isEdit ? 'Lưu thay đổi' : 'Tạo lịch hẹn'}
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/admin/appointments')}>
                                Hủy
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AppointmentFormPage;
