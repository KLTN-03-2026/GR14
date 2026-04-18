import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HeartOutlined, HeartFilled, CalendarOutlined } from '@ant-design/icons';
import { landApi, recommendationApi } from '@/api';
import { PROPERTY_STATUS, PROPERTY_STATUS_LABELS } from '@/constants';
import { useFavorites } from '@/context/FavoritesContext';
import { Loading } from '@/components/common';
import { formatCurrency, formatArea, getFullAddress, formatDateTime } from '@/utils';
import { useAuthStore } from '@/stores/authStore';
import type { Land } from '@/types';


const getImages = (land: Land): string[] => {
    if (!land.images || land.images.length === 0) return [];
    return land.images.map((img: any) =>
        typeof img === 'string' ? img : img.url ?? ''
    ).filter(Boolean);
};

const getPropertyStatusTagClass = (status: number): string => {
    if (status === PROPERTY_STATUS.SOLD) {
        return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

/* ── Lightbox Modal ──────────────────────────────────────────────────── */
interface LightboxProps {
    images: string[];
    startIndex: number;
    title: string;
    onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ images, startIndex, title, onClose }) => {
    const [current, setCurrent] = useState(startIndex);

    const prev = useCallback(() => setCurrent(c => (c - 1 + images.length) % images.length), [images.length]);
    const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [onClose, prev, next]);

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.93)' }}
            onClick={onClose}
        >
            {/* Header */}
            <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
                style={{ background: 'rgba(0,0,0,0.4)' }}
                onClick={e => e.stopPropagation()}
            >
                <span className="text-white text-[14px] font-medium line-clamp-1 max-w-[70%] opacity-80">{title}</span>
                <div className="flex items-center gap-4">
                    <span className="text-white text-[14px] font-semibold opacity-70">
                        {current + 1} / {images.length}
                    </span>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-white transition-colors"
                        style={{ background: 'rgba(255,255,255,0.15)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main image */}
            <div
                className="flex items-center justify-center w-full px-16"
                style={{ height: 'calc(100vh - 140px)' }}
                onClick={e => e.stopPropagation()}
            >
                <img
                    src={images[current]}
                    alt={`${title} ${current + 1}`}
                    className="max-w-full max-h-full object-contain rounded-lg select-none"
                    style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
                />
            </div>

            {/* Prev / Next buttons */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={e => { e.stopPropagation(); prev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-white transition-all hover:scale-110"
                        style={{ background: 'rgba(255,255,255,0.18)' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); next(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full text-white transition-all hover:scale-110"
                        style={{ background: 'rgba(255,255,255,0.18)' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </>
            )}

            {/* Thumbnail strip */}
            {images.length > 1 && (
                <div
                    className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-6 py-3 overflow-x-auto"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={e => e.stopPropagation()}
                >
                    {images.map((src, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            className="flex-shrink-0 rounded overflow-hidden transition-all duration-200"
                            style={{
                                width: 56,
                                height: 40,
                                outline: i === current ? '2.5px solid #254b86' : '2px solid transparent',
                                opacity: i === current ? 1 : 0.55,
                            }}
                        >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ── Gallery Grid ────────────────────────────────────────────────────── */
interface GalleryProps {
    images: string[];
    title: string;
}

const Gallery: React.FC<GalleryProps> = ({ images, title }) => {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const openLightbox = (index: number) => setLightboxIndex(index);
    const closeLightbox = () => setLightboxIndex(null);

    if (images.length === 0) {
        return (
            <div className="w-full h-[420px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 mb-10">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-slate-400 text-sm">Chưa có hình ảnh</span>
            </div>
        );
    }

    if (images.length === 1) {
        return (
            <>
                <div
                    className="w-full mb-10 rounded-2xl overflow-hidden cursor-pointer"
                    style={{ height: 480 }}
                    onClick={() => openLightbox(0)}
                >
                    <img
                        src={images[0]}
                        alt={title}
                        className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500"
                    />
                </div>
                {lightboxIndex !== null && (
                    <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />
                )}
            </>
        );
    }

    /* ── 3 ảnh: 1 lớn trái + 2 nhỏ phải ── */
    if (images.length === 3) {
        return (
            <>
                <div className="mb-10">
                    <div
                        className="flex gap-2 rounded-2xl overflow-hidden"
                        style={{ height: 400 }}
                    >
                        {/* Big image left (60%) */}
                        <div
                            className="flex-shrink-0 overflow-hidden cursor-pointer group relative"
                            style={{ width: '60%' }}
                            onClick={() => openLightbox(0)}
                        >
                            <img
                                src={images[0]}
                                alt={title}
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                        </div>
                        {/* 2 thumbnails stacked right (40%) */}
                        <div className="flex-1 flex flex-col gap-2">
                            {[1, 2].map((imgIdx) => (
                                <div
                                    key={imgIdx}
                                    className="flex-1 overflow-hidden cursor-pointer group relative"
                                    onClick={() => openLightbox(imgIdx)}
                                >
                                    <img
                                        src={images[imgIdx]}
                                        alt={`${title} ${imgIdx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={() => openLightbox(0)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            Xem tất cả 3 ảnh
                        </button>
                    </div>
                </div>
                {lightboxIndex !== null && (
                    <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />
                )}
            </>
        );
    }

    /* ── 4+ ảnh: 1 lớn trái + lưới thumbnail phải (Airbnb style) ── */
    const thumbCount = Math.min(images.length - 1, 4);
    const thumbIndices = Array.from({ length: thumbCount }, (_, i) => i + 1);
    const extraCount = images.length - 5;

    return (
        <>
            <div className="mb-10">
                <div
                    className="flex gap-2 rounded-2xl overflow-hidden"
                    style={{ height: 400 }}
                >
                    {/* Big main image (left 55%) */}
                    <div
                        className="flex-shrink-0 overflow-hidden cursor-pointer group relative"
                        style={{ width: '55%' }}
                        onClick={() => openLightbox(0)}
                    >
                        <img
                            src={images[0]}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                    </div>

                    {/* Thumbnails right (45%) */}
                    <div
                        className={`flex-1 grid gap-2 ${thumbCount === 1 ? '' : thumbCount === 2 ? 'grid-rows-2' : 'grid-rows-2 grid-cols-2'}`}
                    >
                        {thumbIndices.map((imgIdx, gridPos) => {
                            const isLastThumb = gridPos === thumbIndices.length - 1 && extraCount > 0;
                            return (
                                <div
                                    key={imgIdx}
                                    className="relative overflow-hidden cursor-pointer group"
                                    onClick={() => openLightbox(imgIdx)}
                                >
                                    <img
                                        src={images[imgIdx]}
                                        alt={`${title} ${imgIdx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none" />

                                    {isLastThumb && (
                                        <div
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-1"
                                            style={{ background: 'rgba(0,0,0,0.52)' }}
                                        >
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" fill="white" />
                                                <polyline points="21 15 16 10 5 21" />
                                            </svg>
                                            <span className="text-white text-[17px] font-bold leading-none">+{extraCount + 1}</span>
                                            <span className="text-white/80 text-[11px] font-medium">xem thêm</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* "Xem tất cả ảnh" pill button */}
                <div className="flex justify-end mt-2">
                    <button
                        onClick={() => openLightbox(0)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        Xem tất cả {images.length} ảnh
                    </button>
                </div>
            </div>

            {lightboxIndex !== null && (
                <Lightbox images={images} startIndex={lightboxIndex} title={title} onClose={closeLightbox} />
            )}
        </>
    );
};


/* ── Main Page ───────────────────────────────────────────────────────── */
const LandDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuthStore();
    const { isFavoritedLand, addLandFavorite, removeFavoritedLand } = useFavorites();
    const [land, setLand] = useState<Land | null>(null);
    const [loading, setLoading] = useState(true);

    // Quay lại đúng trang + filter:
    // List page truyền: navigate(`/lands/${id}?from=${encodeURIComponent(location.pathname + location.search)}`)
    // Ví dụ: ?from=%2Flands%3Fpage%3D5%26category%3D1%26minPrice%3D500
    const searchParams = new URLSearchParams(location.search);
    const fromUrl = searchParams.get('from');
    const handleBack = () => {
        if (fromUrl) {
            navigate(decodeURIComponent(fromUrl));   // khôi phục toàn bộ URL gốc kể cả filter
        } else {
            navigate(-1);                            // fallback: browser history
        }
    };

    useEffect(() => {
        if (id) loadLand(Number(id));
    }, [id]);

    const loadLand = async (landId: number) => {
        try {
            const res = await landApi.getById(landId);
            setLand(res.data.data || res.data);
        } catch {
            toast.error('Không tìm thấy bất động sản');
            navigate('/lands');
        } finally {
            setLoading(false);
        }
    };

    const handleFavorite = async () => {
        if (!isAuthenticated) {
            toast('Vui lòng đăng nhập để yêu thích');
            navigate('/login');
            return;
        }
        try {
            const isFav = isFavoritedLand(land!.id);
            if (isFav) {
                await removeFavoritedLand(land!.id);
                toast.success('Đã bỏ yêu thích');
            } else {
                await addLandFavorite(land!.id);
                toast.success('Đã thêm vào yêu thích');
                recommendationApi.trackBehavior({ action: 'save', landId: land!.id }).catch(() => { });
            }
        } catch {
            toast.error('Có lỗi xảy ra');
        }
    };

    if (loading) return <Loading />;
    if (!land) return null;

    const images = getImages(land);
    const fullAddress = getFullAddress(land);
    const landStatusLabel = PROPERTY_STATUS_LABELS[land.status] || 'Không xác định';
    const landStatusTagClass = getPropertyStatusTagClass(land.status);

    return (
        <div className="w-full bg-white pb-20">

            {/* Breadcrumb */}
            <div className="w-full bg-[#f4f5f7] py-3 mb-8">
                <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0 flex items-center gap-3 text-[13px]">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-[#254b86] hover:text-white hover:border-[#254b86] transition-all duration-200 shadow-sm"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Quay lại
                    </button>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => navigate('/')}
                            className="text-gray-700 font-medium hover:text-[#254b86] transition-colors"
                        >
                            Trang Chủ
                        </button>
                        <span className="text-gray-400">›</span>
                        <button
                            onClick={() => navigate('/lands')}
                            className="text-gray-700 font-medium hover:text-[#254b86] transition-colors"
                        >
                            Danh Sách Nhà Đất
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0">

                {/* Tiêu đề + giá */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-6">
                    <h1 className="text-[28px] font-bold text-[#1a1a1a] leading-tight">
                        {land.title}
                    </h1>
                    <span className="text-[26px] font-bold text-[#254b86] whitespace-nowrap">
                        {formatCurrency(land.price)}
                    </span>
                </div>

                {/* Địa chỉ */}
                <div className="flex items-center gap-1.5 text-[15px] text-gray-500 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#254b86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{fullAddress}</span>
                </div>

                {/* ── Gallery ───────────────────────────────────────────── */}
                <Gallery images={images} title={land.title} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 items-start">
                    <div className="lg:col-span-2">
                        <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-4">Thông Tin Chi Tiết</h2>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <tbody>
                                    {/* ── Các field riêng của Land ── */}
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] w-1/4 font-medium">Giá</td>
                                        <td className="px-4 py-3 text-[#1a1a1a] font-semibold w-1/4">{formatCurrency(land.price)}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] w-1/4 font-medium">Diện Tích</td>
                                        <td className="px-4 py-3 text-[#1a1a1a] w-1/4">{formatArea(land.area)}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Mặt tiền</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{land.frontWidth ? `${land.frontWidth}m` : 'Chưa cập nhật'}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Chiều dài</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{land.landLength ? `${land.landLength}m` : 'Chưa cập nhật'}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Mã</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{land.code}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Hướng</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{land.direction || 'Chưa cập nhật'}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Trạng thái</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${landStatusTagClass}`}>
                                                {landStatusLabel}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Danh mục</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{land.category?.name || 'Chưa cập nhật'}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Pháp lý</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{land.legalStatus || 'Chưa cập nhật'}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Ngày đăng</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{formatDateTime(land.createdAt)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Cập nhật</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]" colSpan={3}>{formatDateTime(land.updatedAt)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Mô tả */}
                        {land.description && (
                            <div className="mt-8">
                                <h2 className="text-[18px] font-bold text-[#1a1a1a] mb-4 text-center">Mô Tả</h2>
                                <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                                    {land.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="text-[18px] font-bold mb-4 invisible select-none">Thông Tin Chi Tiết</div>
                        <div className="border border-gray-200 rounded-xl p-5 shadow-sm sticky top-6">

                            {/* Tên + địa chỉ */}
                            <div className="flex items-start gap-2 mb-4 pb-4 border-b border-gray-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#f5a623" stroke="#f5a623" strokeWidth="1" className="shrink-0 mt-0.5">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <div>
                                    <p className="text-[14px] font-bold text-[#1a1a1a] leading-snug">{land.title}</p>
                                    <div className="flex items-start gap-1 mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#254b86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span className="text-[12px] text-gray-500">{fullAddress}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Giá */}
                            <p className="text-[22px] font-bold text-[#254b86] mb-5 text-center">
                                {formatCurrency(land.price)}
                            </p>

                            <div className="mb-5 flex justify-center">
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold ${landStatusTagClass}`}>
                                    Trạng thái: {landStatusLabel}
                                </span>
                            </div>

                            {/* Nút Yêu thích */}
                            <button
                                onClick={handleFavorite}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[14px] font-semibold mb-3 transition-all duration-200 ${isFavoritedLand(land.id)
                                    ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-[#254b86] hover:text-[#254b86]'
                                    }`}
                            >
                                {isFavoritedLand(land.id) ? <HeartFilled className="text-[15px]" /> : <HeartOutlined className="text-[15px]" />}
                                {isFavoritedLand(land.id) ? 'Đã yêu thích' : 'Yêu thích'}
                            </button>

                            {/* Nút Đặt lịch hẹn — dùng landId (logic riêng của Land) */}
                            <button
                                onClick={() => navigate(`/appointment?landId=${land.id}`)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#254b86] text-white text-[14px] font-semibold hover:bg-[#1a3660] transition-colors duration-200"
                            >
                                <CalendarOutlined className="text-[15px]" />
                                Đặt Lịch Hẹn
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Bản đồ — giữ nguyên URL riêng của Land (hl=vi&z=15) ── */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[18px] font-bold text-[#1a1a1a]">Vị Trí</h2>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-1.5 bg-[#254b86] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1a3660] transition-colors"
                        >
                            Mở Google Map
                        </a>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 320 }}>
                        <iframe
                            title="map"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            allowFullScreen
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&hl=vi&z=15&output=embed`}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LandDetailPage;