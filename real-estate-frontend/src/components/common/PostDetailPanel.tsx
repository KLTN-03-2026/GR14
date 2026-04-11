import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { Post } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils';
import Badge from '@/components/ui/Badge';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { POST_STATUS_LABELS } from '@/constants';

interface Props { post: Post; }

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

const STATUS_COLOR: Record<number, 'warning' | 'success' | 'error'> = { 1: 'warning', 2: 'success', 3: 'error' };

const VIP_LABEL: Record<number, string> = { 0: 'VIP 0', 1: 'VIP 1', 2: 'VIP 2', 3: 'VIP 3' };
const VIP_COLOR: Record<number, string> = {
    3: 'bg-amber-100 text-amber-800 border-amber-200',
    2: 'bg-purple-100 text-purple-800 border-purple-200',
    1: 'bg-blue-100 text-blue-800 border-blue-200',
    0: 'bg-gray-100 text-gray-700 border-gray-200',
};

const POST_TYPE_LABELS: Record<string, string> = {
    SELL_HOUSE: 'Bán nhà', RENT_HOUSE: 'Cho thuê nhà',
    SELL_LAND: 'Bán đất', RENT_LAND: 'Cho thuê đất',
    NEED_BUY: 'Cần mua', NEED_RENT: 'Cần thuê',
    NEWS: 'Tin tức', PROMOTION: 'Khuyến mãi',
};

const PostDetailPanel: React.FC<Props> = ({ post }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const images = post.images?.map((i) => i.url) ?? [];

    const isVip = Boolean(post.isVip || post.vipPackageName || post.vipExpiry);
    const vipLevel = post.vipPriorityLevel;

    // Render description (may be HTML)
    const descHtml = (() => {
        const raw = String(post.description || '');
        const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
        const escaped = raw
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return looksLikeHtml ? raw : `<div>${escaped.replace(/\r?\n/g, '<br />')}</div>`;
    })();

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
                <Row label="Loại bài đăng" value={POST_TYPE_LABELS[post.postType] ?? post.postType} />
                <Row label="Tiêu đề" value={<span className="font-semibold">{post.title}</span>} />
                <Row label="Trạng thái" value={
                    <Badge color={STATUS_COLOR[post.status]}>{POST_STATUS_LABELS[post.status]}</Badge>
                } />
                {isVip && vipLevel !== undefined && vipLevel !== null && (
                    <Row label="Gói VIP" value={
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${VIP_COLOR[vipLevel] ?? VIP_COLOR[0]}`}>
                            {VIP_LABEL[vipLevel] ?? 'VIP'}
                        </span>
                    } />
                )}
                <Row label="Người đăng" value={post.user?.fullName ?? post.user?.username} />
                <Row label="Liên hệ" value={post.contactPhone} />
                <Row label="Link liên hệ" value={post.contactLink} />
            </Section>

            <Section title="Địa điểm & Giá">
                <Row label="Địa chỉ đầy đủ" value={post.address} />
                <Row label="Phường / Xã" value={post.ward} />
                <Row label="Quận / Huyện" value={post.district} />
                <Row label="Tỉnh / Thành phố" value={post.city} />
                <Row label="Giá" value={post.price ? formatCurrency(post.price) : undefined} />
                <Row label="Diện tích" value={post.area ? `${post.area} m²` : undefined} />
            </Section>

            {/* Sell/Rent house extras */}
            {(post.bedrooms || post.bathrooms || post.floors) && (
                <Section title="Thông số nhà">
                    <Row label="Phòng ngủ" value={post.bedrooms} />
                    <Row label="Phòng tắm" value={post.bathrooms} />
                    <Row label="Số tầng" value={post.floors} />
                    <Row label="Hướng" value={post.direction} />
                </Section>
            )}

            {/* Sell/Rent land extras */}
            {(post.landType || post.legalStatus || post.frontWidth) && (
                <Section title="Thông số đất">
                    <Row label="Loại đất" value={post.landType} />
                    <Row label="Pháp lý" value={post.legalStatus} />
                    <Row label="Mặt tiền" value={post.frontWidth ? `${post.frontWidth} m` : undefined} />
                    <Row label="Chiều dài" value={post.landLength ? `${post.landLength} m` : undefined} />
                </Section>
            )}

            {/* Need buy/rent extras */}
            {(post.minPrice || post.maxPrice || post.minArea) && (
                <Section title="Yêu cầu tìm kiếm">
                    <Row label="Giá từ" value={post.minPrice ? formatCurrency(post.minPrice) : undefined} />
                    <Row label="Giá đến" value={post.maxPrice ? formatCurrency(post.maxPrice) : undefined} />
                    <Row label="DT từ" value={post.minArea ? `${post.minArea} m²` : undefined} />
                    <Row label="DT đến" value={post.maxArea ? `${post.maxArea} m²` : undefined} />
                </Section>
            )}

            {/* News / promo extras */}
            {(post.startDate || post.discountCode) && (
                <Section title="Thông tin sự kiện">
                    <Row label="Bắt đầu" value={post.startDate ? formatDateTime(post.startDate) : undefined} />
                    <Row label="Kết thúc" value={post.endDate ? formatDateTime(post.endDate) : undefined} />
                    <Row label="Mã ưu đãi" value={post.discountCode} />
                </Section>
            )}

            {post.description && (
                <Section title="Mô tả">
                    <div
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(descHtml) }}
                        className="text-sm leading-relaxed text-gray-700 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    />
                </Section>
            )}

            <Section title="Thời gian">
                <Row label="Ngày đăng" value={post.postedAt ? formatDateTime(post.postedAt) : undefined} />
                <Row label="Duyệt lúc" value={post.approvedAt ? formatDateTime(post.approvedAt) : undefined} />
                <Row label="VIP đến" value={post.vipExpiry ? formatDateTime(post.vipExpiry) : undefined} />
            </Section>

            <ImageLightbox isOpen={lightboxOpen} images={images} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
        </div>
    );
};

export default PostDetailPanel;
