import { useState } from 'react';
import type { House } from '@/types';
import { formatCurrency, formatArea } from '@/utils';
import Badge from '@/components/ui/Badge';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface Props {
    house: House;
}

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

const HouseDetailPanel: React.FC<Props> = ({ house }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const images = house.images?.map((i) => i.url) ?? [];

    const fullAddress = [
        house.houseNumber,
        house.street,
        house.ward,
        house.district,
        house.city,
    ].filter(Boolean).join(', ');

    return (
        <div>
            {/* Image gallery */}
            {images.length > 0 && (
                <div className="mb-6">
                    <div className="grid grid-cols-4 gap-2">
                        {images.slice(0, 4).map((url, idx) => (
                            <div key={idx} className="relative">
                                <img
                                    src={url}
                                    alt=""
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

            {/* Basic info */}
            <Section title="Thông tin chung">
                <Row label="Mã" value={house.code} />
                <Row label="Tiêu đề" value={<span className="font-semibold">{house.title}</span>} />
                <Row label="Trạng thái" value={
                    <Badge color={house.status === 1 ? 'success' : 'error'}>
                        {house.status === 1 ? 'Hoạt động' : 'Đã bán'}
                    </Badge>
                } />
                <Row label="Danh mục" value={house.category?.name} />
            </Section>

            {/* Location */}
            <Section title="Địa chỉ">
                <Row label="Địa chỉ đầy đủ" value={fullAddress || undefined} />
                <Row label="Số nhà" value={house.houseNumber} />
                <Row label="Đường" value={house.street} />
                <Row label="Phường / Xã" value={house.ward} />
                <Row label="Quận / Huyện" value={house.district} />
                <Row label="Tỉnh / Thành phố" value={house.city} />
            </Section>

            {/* Property details */}
            <Section title="Thông số BĐS">
                <Row label="Giá" value={house.price ? formatCurrency(house.price) : undefined} />
                <Row label="Diện tích" value={house.area ? formatArea(house.area) : undefined} />
                <Row label="Hướng" value={house.direction} />
                <Row label="Số tầng" value={house.floors} />
                <Row label="Phòng ngủ" value={house.bedrooms} />
                <Row label="Phòng tắm" value={house.bathrooms} />
            </Section>

            {/* Description */}
            {house.description && (
                <Section title="Mô tả">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{house.description}</p>
                </Section>
            )}

            {/* Employee */}
            {house.employee?.user && (
                <Section title="Nhân viên phụ trách">
                    <Row label="Tên" value={house.employee.user.fullName} />
                    <Row label="SĐT" value={house.employee.user.phone} />
                </Section>
            )}

            {/* Timestamps */}
            <Section title="Thời gian">
                <Row label="Tạo lúc" value={new Date(house.createdAt).toLocaleString('vi-VN')} />
                <Row label="Cập nhật" value={new Date(house.updatedAt).toLocaleString('vi-VN')} />
            </Section>

            <ImageLightbox isOpen={lightboxOpen} images={images} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
        </div>
    );
};

export default HouseDetailPanel;
