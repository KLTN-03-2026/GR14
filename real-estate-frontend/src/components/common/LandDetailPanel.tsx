import { useState } from 'react';
import type { Land } from '@/types';
import { formatCurrency, formatArea } from '@/utils';
import Badge from '@/components/ui/Badge';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface Props { land: Land; }

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

const LandDetailPanel: React.FC<Props> = ({ land }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const images = land.images?.map((i) => i.url) ?? [];

    const fullAddress = [land.plotNumber, land.street, land.ward, land.district, land.city]
        .filter(Boolean).join(', ');

    return (
        <div>
            {/* Image gallery */}
            {images.length > 0 && (
                <div className="mb-6">
                    <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((url, idx) => (
                            <div key={idx} className="relative">
                                <img
                                    src={url} alt=""
                                    className="h-24 w-full cursor-zoom-in rounded-xl object-cover ring-1 ring-gray-200 transition hover:ring-brand-400"
                                    onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                                />
                                {idx === 3 && images.length > 4 && (
                                    <div
                                        className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/50 text-sm font-bold text-white"
                                        onClick={() => { setLightboxIndex(3); setLightboxOpen(true); }}
                                    >
                                        +{images.length - 4}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Section title="Thông tin chung">
                <Row label="Mã" value={land.code} />
                <Row label="Tiêu đề" value={<span className="font-semibold">{land.title}</span>} />
                <Row label="Trạng thái" value={
                    <Badge color={land.status === 1 ? 'success' : 'error'}>
                        {land.status === 1 ? 'Hoạt động' : 'Đã bán'}
                    </Badge>
                } />
                <Row label="Loại đất" value={land.landType} />
                <Row label="Pháp lý" value={land.legalStatus} />
            </Section>

            <Section title="Địa chỉ">
                <Row label="Địa chỉ đầy đủ" value={fullAddress || undefined} />
                <Row label="Số thửa" value={land.plotNumber} />
                <Row label="Đường" value={land.street} />
                <Row label="Phường / Xã" value={land.ward} />
                <Row label="Quận / Huyện" value={land.district} />
                <Row label="Tỉnh / Thành phố" value={land.city} />
            </Section>

            <Section title="Thông số BĐS">
                <Row label="Giá" value={land.price ? formatCurrency(land.price) : undefined} />
                <Row label="Diện tích" value={land.area ? formatArea(land.area) : undefined} />
                <Row label="Hướng" value={land.direction} />
                <Row label="Mặt tiền" value={land.frontWidth ? `${land.frontWidth} m` : undefined} />
                <Row label="Chiều dài" value={land.landLength ? `${land.landLength} m` : undefined} />
            </Section>

            {land.description && (
                <Section title="Mô tả">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{land.description}</p>
                </Section>
            )}

            {land.employee?.user && (
                <Section title="Nhân viên phụ trách">
                    <Row label="Tên" value={land.employee.user.fullName} />
                    <Row label="SĐT" value={land.employee.user.phone} />
                </Section>
            )}

            <Section title="Thời gian">
                <Row label="Tạo lúc" value={new Date(land.createdAt).toLocaleString('vi-VN')} />
                <Row label="Cập nhật" value={new Date(land.updatedAt).toLocaleString('vi-VN')} />
            </Section>

            <ImageLightbox isOpen={lightboxOpen} images={images} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
        </div>
    );
};

export default LandDetailPanel;
