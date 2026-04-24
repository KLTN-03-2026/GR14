import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { appointmentApi, houseApi, landApi } from '@/api';

type PropertySummary = {
    title?: string;
    city?: string;
    district?: string;
    imageUrl?: string;
    price?: string | number;
    area?: string | number;
    priceUnit?: string;
};

const DURATION_OPTIONS = [30, 60, 90];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTE_OPTIONS = ['00', '15', '30', '45'];

/** Lấy URL ảnh đầu tiên từ mảng images (giống HouseDetailPage / LandDetailPage) */
const getFirstImage = (images: any[]): string | undefined => {
    if (!images || images.length === 0) return undefined;
    const first = images[0];
    return typeof first === 'string' ? first : first?.url ?? undefined;
};

const toIsoFromLocal = (date: string, time: string) => {
    const combined = `${date}T${time}`;
    return new Date(combined).toISOString();
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
    const [submitting, setSubmitting] = useState(false);

    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentHour, setAppointmentHour] = useState('09');
    const [appointmentMinute, setAppointmentMinute] = useState('00');
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [notes, setNotes] = useState('');

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
            try {
                if (effectiveHouseId) {
                    const res = await houseApi.getById(effectiveHouseId);
                    const data = res.data?.data || res.data;
                    setProperty({
                        title: data?.title,
                        city: data?.city,
                        district: data?.district,
                        imageUrl: getFirstImage(data?.images),
                        price: data?.price || data?.rentPrice,
                        area: data?.area || data?.acreage,
                        priceUnit: data?.priceUnit || '/tháng',
                    });
                    return;
                }
                if (landId) {
                    const res = await landApi.getById(landId);
                    const data = res.data?.data || res.data;
                    setProperty({
                        title: data?.title,
                        city: data?.city,
                        district: data?.district,
                        imageUrl: getFirstImage(data?.images),
                        price: data?.price,
                        area: data?.area || data?.acreage,
                        priceUnit: data?.priceUnit || '',
                    });
                }
            } catch {
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
            toast.error('Vui lòng chọn ngày xem');
            return;
        }
        if (durationMinutes <= 0) {
            toast.error('Thời lượng hẹn không hợp lệ');
            return;
        }

        setSubmitting(true);
        try {
            const appointmentTime = `${appointmentHour}:${appointmentMinute}`;
            const payload: Record<string, any> = {
                appointmentDate: toIsoFromLocal(appointmentDate, appointmentTime),
                durationMinutes,
            };
            if (houseId) payload.houseId = houseId;
            if (landId) payload.landId = landId;

            await appointmentApi.create(payload);

            toast.success('Đặt lịch thành công. Hệ thống đang tự động phân công nhân viên.');
            if (houseId) { navigate(`/houses/${houseId}`); return; }
            if (landId) { navigate(`/lands/${landId}`); return; }
            navigate('/');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Đặt lịch thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    const locationLabel = [property?.district, property?.city].filter(Boolean).join(', ') || 'Chưa có địa chỉ';

    return (
        <div className="min-h-[calc(100vh-160px)] bg-gray-100 py-10">
            <div className="mx-auto w-full max-w-5xl px-4">

                {/* ── Main card ─────────────────────────────────────────── */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">

                        {/* ── Left – Property card ──────────────────────────── */}
                        <div className="relative flex flex-col bg-[#0f1e38]">
                            {/* Property image */}
                            <div className="relative h-64 md:h-full min-h-[260px] overflow-hidden">
                                {loadingProperty ? (
                                    <div className="absolute inset-0 animate-pulse bg-gray-700" />
                                ) : property?.imageUrl ? (
                                    <img
                                        src={property.imageUrl}
                                        alt={property.title ?? 'Bất động sản'}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a3660] to-[#0d2040]">
                                        <svg className="h-16 w-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                    </div>
                                )}
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1e38] via-[#0f1e38]/40 to-transparent" />

                                {/* Verified badge */}
                                <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm border border-white/20">
                                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs font-medium text-white">Đã kiểm duyệt</span>
                                </div>
                            </div>

                            {/* Property info overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-5">
                                {loadingProperty ? (
                                    <div className="space-y-2">
                                        <div className="h-6 w-3/4 animate-pulse rounded bg-white/20" />
                                        <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-xl font-bold leading-tight text-white drop-shadow">
                                            {property?.title || `#${houseId || landId}`}
                                        </h2>
                                        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
                                            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span>{locationLabel}</span>
                                        </div>

                                        {(property?.price || property?.area) && (
                                            <div className="mt-3 flex items-start justify-between border-t border-white/10 pt-3">
                                                {property?.price && (
                                                    <div className="text-left">
                                                        <p className="text-[10px] uppercase tracking-widest text-white/40">Giá Bán</p>
                                                        <p className="text-base font-bold text-white">
                                                            {new Intl.NumberFormat('vi-VN').format(Number(property.price)) + ' đ'}
                                                        </p>
                                                    </div>
                                                )}

                                                {property?.area && (
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase tracking-widest text-white/40">Diện tích</p>
                                                        <p className="text-base font-bold text-white">
                                                            {property.area} <span className="text-xs text-white/60">m²</span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* ── Right – Booking form ──────────────────────────── */}
                        <div className="p-8">
                            <h1 className="text-2xl font-bold text-[#1f3f72]">Đặt Lịch Xem {propertyTypeLabel}</h1>
                            <p className="mt-1.5 text-sm text-gray-500">
                                Chọn thời gian phù hợp để chúng tôi sắp xếp chuyên viên tư vấn đón tiếp bạn.
                            </p>

                            <form onSubmit={handleSubmit} className="mt-7 space-y-6">
                                {/* Date + Time */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Ngày xem {propertyTypeLabel}
                                        </label>
                                        <input
                                            type="date"
                                            value={appointmentDate}
                                            onChange={(e) => setAppointmentDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#254b86] focus:bg-white focus:ring-2 focus:ring-[#254b86]/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                                            Giờ bắt đầu (24h)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={appointmentHour}
                                                onChange={(e) => setAppointmentHour(e.target.value)}
                                                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#254b86] focus:bg-white focus:ring-2 focus:ring-[#254b86]/10"
                                            >
                                                {HOUR_OPTIONS.map((h) => (
                                                    <option key={h} value={h}>{h} giờ</option>
                                                ))}
                                            </select>
                                            <span className="text-gray-400 font-bold">:</span>
                                            <select
                                                value={appointmentMinute}
                                                onChange={(e) => setAppointmentMinute(e.target.value)}
                                                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#254b86] focus:bg-white focus:ring-2 focus:ring-[#254b86]/10"
                                            >
                                                {MINUTE_OPTIONS.map((m) => (
                                                    <option key={m} value={m}>{m} phút</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Working hours notice */}
                                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    <div className="text-sm">
                                        <p className="font-semibold text-amber-700">Khung giờ làm việc</p>
                                        <p className="mt-0.5 text-amber-600">
                                            <span className="font-medium">Sáng:</span> 07:30 – 11:30 &nbsp;|&nbsp; <span className="font-medium">Chiều:</span> 13:30 – 17:30
                                        </p>
                                        <p className="mt-0.5 text-amber-500 text-xs">Thứ Hai – Thứ Bảy (trừ ngày lễ)</p>
                                    </div>
                                </div>

                                {/* Duration – pill buttons */}
                                <div>
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Thời lượng dự kiến
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {DURATION_OPTIONS.map((mins) => (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => setDurationMinutes(mins)}
                                                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${durationMinutes === mins
                                                    ? 'bg-[#1f3f72] text-white shadow-md shadow-[#1f3f72]/20'
                                                    : 'border border-gray-200 bg-white text-gray-600 hover:border-[#1f3f72]/40 hover:text-[#1f3f72]'
                                                    }`}
                                            >
                                                {mins} Phút
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Ghi chú thêm <span className="normal-case font-normal text-gray-400">(Tuỳ chọn)</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Ví dụ: Tôi muốn xem kỹ khu vực phòng bếp và ban công..."
                                        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#254b86] focus:bg-white focus:ring-2 focus:ring-[#254b86]/10"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => navigate(-1)}
                                        className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                                    >
                                        Quay lại
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1f3f72] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1f3f72]/20 transition hover:bg-[#162d55] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {submitting ? (
                                            <>
                                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                </svg>
                                                Đang gửi...
                                            </>
                                        ) : (
                                            <>
                                                Xác Nhận Lịch Hẹn
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* ── Info box ──────────────────────────────────────────── */}
                <div className="mt-5 flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1f3f72]/10">
                        <svg className="h-4 w-4 text-[#1f3f72]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-[#1f3f72]">Thông tin quan trọng</p>
                        <p className="mt-0.5 text-sm text-gray-600">
                            Lịch hẹn của bạn sẽ được xác nhận bởi chuyên viên trong vòng 30 phút. Vui lòng mang theo CMND/CCCD khi đến xem nhà để làm thủ tục an ninh tại toà nhà. Bạn có thể huỷ hoặc dời lịch miễn phí trước 2 tiếng.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AppointmentBookingPage;