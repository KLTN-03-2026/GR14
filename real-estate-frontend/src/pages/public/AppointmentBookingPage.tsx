import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { appointmentApi, houseApi, landApi } from '@/api';

type PropertySummary = {
    title?: string;
    city?: string;
    district?: string;
};

const toIsoFromLocal = (localDateTime: string) => {
    const date = new Date(localDateTime);
    return date.toISOString();
};

const toLocalDateTimeInputValue = (date: Date) => {
    const offsetMinutes = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offsetMinutes * 60_000);
    return localDate.toISOString().slice(0, 16);
};

const AppointmentBookingPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const houseId = Number(searchParams.get('houseId') || 0) || undefined;
    const landId = Number(searchParams.get('landId') || 0) || undefined;

    const hasExactlyOneProperty = Boolean(houseId) !== Boolean(landId);
    const effectiveHouseId = houseId && !landId ? houseId : undefined;
    const effectiveLandId = landId && !houseId ? landId : undefined;

    const [property, setProperty] = useState<PropertySummary | null>(null);
    const [loadingProperty, setLoadingProperty] = useState(false);
    const [propertyLoadFailed, setPropertyLoadFailed] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [appointmentDate, setAppointmentDate] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);

    const propertyTypeLabel = useMemo(() => {
        if (effectiveHouseId) return 'Nhà';
        if (effectiveLandId) return 'Đất';
        return 'Bất động sản';
    }, [effectiveHouseId, effectiveLandId]);

    useEffect(() => {
        if (!hasExactlyOneProperty) {
            toast.error('Liên kết đặt lịch không hợp lệ, vui lòng chọn đúng một bất động sản');
            navigate('/', { replace: true });
            return;
        }

        const loadProperty = async () => {
            setLoadingProperty(true);
            setPropertyLoadFailed(false);
            try {
                if (effectiveHouseId) {
                    const res = await houseApi.getById(effectiveHouseId);
                    const data = res.data?.data || res.data;
                    setProperty({
                        title: data?.title,
                        city: data?.city,
                        district: data?.district,
                    });
                    return;
                }

                if (effectiveLandId) {
                    const res = await landApi.getById(effectiveLandId);
                    const data = res.data?.data || res.data;
                    setProperty({
                        title: data?.title,
                        city: data?.city,
                        district: data?.district,
                    });
                }
            } catch {
                setPropertyLoadFailed(true);
                toast.error('Không tải được thông tin bất động sản');
            } finally {
                setLoadingProperty(false);
            }
        };

        void loadProperty();
    }, [effectiveHouseId, effectiveLandId, hasExactlyOneProperty, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!appointmentDate) {
            toast.error('Vui lòng chọn thời gian hẹn');
            return;
        }

        if (!property || loadingProperty || propertyLoadFailed) {
            toast.error('Thông tin bất động sản chưa sẵn sàng, vui lòng thử lại');
            return;
        }

        if (durationMinutes <= 0) {
            toast.error('Thời lượng hẹn không hợp lệ');
            return;
        }

        setSubmitting(true);
        try {
            await appointmentApi.create({
                houseId: effectiveHouseId,
                landId: effectiveLandId,
                appointmentDate: toIsoFromLocal(appointmentDate),
                durationMinutes,
            });

            toast.success('Đặt lịch thành công. Hệ thống đang tự động phân công nhân viên.');
            if (effectiveHouseId) {
                navigate(`/houses/${effectiveHouseId}`);
                return;
            }
            if (effectiveLandId) {
                navigate(`/lands/${effectiveLandId}`);
                return;
            }
            navigate('/');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Đặt lịch thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-160px)] bg-gray-50 py-8">
            <div className="mx-auto w-full max-w-3xl px-4">
                <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-bold text-[#1f3f72]">Đặt lịch xem {propertyTypeLabel}</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Sau khi đặt lịch, hệ thống sẽ tự động chọn nhân viên phù hợp theo khu vực, lịch trống và tải công việc.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 rounded-xl bg-blue-50 p-4">
                        <div className="text-sm font-semibold text-blue-900">Thông tin bất động sản</div>
                        {loadingProperty ? (
                            <div className="mt-1 text-sm text-blue-700">Đang tải...</div>
                        ) : (
                            <>
                                <div className="mt-1 text-sm text-blue-800">{property?.title || `#${houseId || landId}`}</div>
                                <div className="text-xs text-blue-700">{[property?.district, property?.city].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Thời gian hẹn</label>
                            <input
                                type="datetime-local"
                                value={appointmentDate}
                                min={toLocalDateTimeInputValue(new Date())}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Thời lượng (phút)</label>
                            <select
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                                <option value={30}>30 phút</option>
                                <option value={45}>45 phút</option>
                                <option value={60}>60 phút</option>
                                <option value={90}>90 phút</option>
                                <option value={120}>120 phút</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Quay lại
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || loadingProperty || propertyLoadFailed || !property}
                            className="rounded-lg bg-[#254b86] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a3660] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Đang gửi...' : 'Xác nhận đặt lịch'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AppointmentBookingPage;
