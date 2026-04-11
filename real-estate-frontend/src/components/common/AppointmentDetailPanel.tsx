import { useMemo, useState } from 'react';
import {
    APPOINTMENT_ACTUAL_STATUS,
    APPOINTMENT_ACTUAL_STATUS_LABELS,
    APPOINTMENT_STATUS_LABELS,
} from '@/constants';
import type { Appointment } from '@/types';
import { formatDateTime } from '@/utils';
import Badge from '@/components/ui/Badge';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface Props {
    appointment: Appointment;
}

type BadgeColor = 'warning' | 'success' | 'error' | 'light';

const SLA_LABELS: Record<number, string> = {
    0: 'Đúng hạn',
    1: 'Sắp trễ hạn',
    2: 'Quá hạn',
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <dt className="w-36 flex-shrink-0 text-sm font-medium text-gray-500">{label}</dt>
        <dd className="flex-1 text-sm text-gray-900 break-words">{value ?? <span className="text-gray-300">—</span>}</dd>
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-500">{title}</h3>
        <dl>{children}</dl>
    </div>
);

const getStatusColor = (status?: number): BadgeColor => {
    if (status === 1) return 'success';
    if (status === 2) return 'error';
    return 'warning';
};

const getActualStatusColor = (status?: number): BadgeColor => {
    if (status === APPOINTMENT_ACTUAL_STATUS.MET) return 'success';
    if (status === APPOINTMENT_ACTUAL_STATUS.NOT_MET) return 'warning';
    if (status === APPOINTMENT_ACTUAL_STATUS.CUSTOMER_NO_SHOW || status === APPOINTMENT_ACTUAL_STATUS.UNABLE_TO_PROCEED) {
        return 'error';
    }
    return 'light';
};

const getSlaColor = (status?: number): BadgeColor => {
    if (status === 2) return 'error';
    if (status === 1) return 'warning';
    return 'success';
};

const safeFormatDateTime = (value?: string) => (value ? formatDateTime(value) : undefined);

const AppointmentDetailPanel: React.FC<Props> = ({ appointment }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const property = appointment.house || appointment.land;
    const propertyType = appointment.house ? 'Nhà' : appointment.land ? 'Đất' : undefined;
    const propertyAddress = useMemo(() => {
        if (!property) return undefined;
        return [property.district, property.city].filter(Boolean).join(', ') || undefined;
    }, [property]);

    const images = useMemo(() => {
        if (appointment.house?.images) return appointment.house.images.map((img) => img.url);
        if (appointment.land?.images) return appointment.land.images.map((img) => img.url);
        return [];
    }, [appointment.house?.images, appointment.land?.images]);

    return (
        <div>
            {images.length > 0 && (
                <div className="mb-6">
                    <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((url, idx) => (
                            <div key={idx} className="relative">
                                <img
                                    src={url}
                                    alt=""
                                    className="h-24 w-full cursor-zoom-in rounded-xl object-cover ring-1 ring-gray-200 transition hover:ring-brand-400"
                                    onClick={() => {
                                        setLightboxIndex(idx);
                                        setLightboxOpen(true);
                                    }}
                                />
                                {idx === 3 && images.length > 4 && (
                                    <div
                                        className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/50 text-sm font-bold text-white"
                                        onClick={() => {
                                            setLightboxIndex(3);
                                            setLightboxOpen(true);
                                        }}
                                    >
                                        +{images.length - 4}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Section title="Thông tin lịch hẹn">
                <Row label="ID" value={appointment.id} />
                <Row label="Ngày hẹn" value={safeFormatDateTime(appointment.appointmentDate)} />
                <Row label="Thời lượng" value={appointment.durationMinutes ? `${appointment.durationMinutes} phút` : undefined} />
                <Row
                    label="Trạng thái"
                    value={<Badge color={getStatusColor(appointment.status)}>{APPOINTMENT_STATUS_LABELS[appointment.status] || 'Không rõ'}</Badge>}
                />
                <Row
                    label="Thực tế"
                    value={
                        appointment.actualStatus === undefined || appointment.actualStatus === null
                            ? <Badge color="light">Chưa cập nhật</Badge>
                            : <Badge color={getActualStatusColor(appointment.actualStatus)}>{APPOINTMENT_ACTUAL_STATUS_LABELS[appointment.actualStatus] || `Không rõ (${appointment.actualStatus})`}</Badge>
                    }
                />
                <Row
                    label="SLA"
                    value={<Badge color={getSlaColor(appointment.slaStatus)}>{SLA_LABELS[appointment.slaStatus ?? 0] || 'Đúng hạn'}</Badge>}
                />
                <Row label="Lý do hủy" value={appointment.cancelReason} />
                <Row label="Lý do gán" value={appointment.autoAssignReason} />
            </Section>

            <Section title="Bất động sản">
                <Row label="Loại" value={propertyType} />
                <Row label="Tiêu đề" value={property?.title ? <span className="font-semibold">{property.title}</span> : undefined} />
                <Row label="Địa chỉ" value={propertyAddress} />
            </Section>

            <Section title="Khách hàng">
                <Row label="Mã KH" value={appointment.customer?.code} />
                <Row label="Họ tên" value={appointment.customer?.user?.fullName} />
                <Row label="Số điện thoại" value={appointment.customer?.user?.phone} />
                <Row label="Email" value={appointment.customer?.user?.email} />
            </Section>

            <Section title="Nhân viên phụ trách">
                <Row label="Mã NV" value={appointment.employee?.code} />
                <Row label="Họ tên" value={appointment.employee?.user?.fullName} />
                <Row label="Số điện thoại" value={appointment.employee?.user?.phone} />
                <Row label="Email" value={appointment.employee?.user?.email} />
            </Section>

            <Section title="Mốc thời gian">
                <Row label="Gán NV lúc" value={safeFormatDateTime(appointment.assignedAt)} />
                <Row label="Liên hệ đầu tiên" value={safeFormatDateTime(appointment.firstContactAt)} />
                <Row label="Deadline gán NV" value={safeFormatDateTime(appointment.slaAssignDeadlineAt)} />
                <Row label="Deadline liên hệ" value={safeFormatDateTime(appointment.slaFirstContactDeadlineAt)} />
                <Row label="Tạo lúc" value={safeFormatDateTime(appointment.createdAt)} />
                <Row label="Cập nhật" value={safeFormatDateTime(appointment.updatedAt)} />
            </Section>

            <ImageLightbox
                isOpen={lightboxOpen}
                images={images}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
            />
        </div>
    );
};

export default AppointmentDetailPanel;
