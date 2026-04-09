import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import { message } from 'antd';
import { HeartOutlined, HeartFilled, EnvironmentOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useFavorites } from '@/context/FavoritesContext';
import { formatCurrency } from '@/utils';
import type { House, Land } from '@/types';
import bedIcon from '@/assets/double-bed.png';
import bathIcon from '@/assets/bathroom.png';
import stairsIcon from '@/assets/stairs.png';

interface PropertyCardProps {
    property: House | Land;
    type?: 'house' | 'land';
}


const getImageSrc = (property: House | Land): string => {
    if (!property.images || property.images.length === 0) return '';
    const first = property.images[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) return (first as any).url;
    return '';
};

const formatPrice = (price?: number): string => {
    if (!price) return 'Liên hệ';
    if (typeof formatCurrency === 'function') {
        try { return formatCurrency(price); } catch { /* fallback */ }
    }
    const ty = Math.floor(price / 1_000_000_000);
    const trieu = Math.floor((price % 1_000_000_000) / 1_000_000);
    let result = '';
    if (ty > 0) result += `${ty} Tỷ`;
    if (trieu > 0) result += ` ${trieu} Triệu`;
    return (result.trim() || 'Liên hệ') + ' VND';
};

const getLocation = (property: House | Land): string => {
    return [
        (property as any).ward,
        (property as any).district,
        (property as any).city || (property as any).province,
    ].filter(Boolean).join(', ');
};


const PropertyCard: React.FC<PropertyCardProps> = ({ property, type = 'house' }) => {
    const navigate = useNavigate();
    const [imgError, setImgError] = useState(false);
    const { isAuthenticated } = useAuthStore();
    const { isFavoritedHouse, isFavoritedLand, addHouseFavorite, removeFavoritedHouse, addLandFavorite, removeFavoritedLand } = useFavorites();

    const imgSrc = getImageSrc(property);
    const showPlaceholder = !imgSrc || imgError;
    const location = getLocation(property);
    const isHouse = type === 'house';
    const isFavorited = isHouse ? isFavoritedHouse(property.id) : isFavoritedLand(property.id);

    const handleClick = () => {
        navigate(`/${isHouse ? 'houses' : 'lands'}/${property.id}`);
    };

    const handleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthenticated) {
            message.warning('Vui lòng đăng nhập để yêu thích');
            navigate('/login');
            return;
        }
        try {
            if (isFavorited) {
                if (isHouse) {
                    await removeFavoritedHouse(property.id);
                } else {
                    await removeFavoritedLand(property.id);
                }
                message.success('Đã bỏ yêu thích');
            } else {
                if (isHouse) {
                    await addHouseFavorite(property.id);
                } else {
                    await addLandFavorite(property.id);
                }
                message.success('Đã thêm vào yêu thích');
            }
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    return (
        <div
            className="bg-white rounded-tl-3xl rounded-br-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col group cursor-pointer"
            onClick={handleClick}
        >
            {/* Ảnh + nút tim */}
            <div className="relative overflow-hidden rounded-tl-3xl" style={{ height: '200px' }}>
                {showPlaceholder ? (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-2">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span className="text-slate-400 text-xs">Chưa có ảnh</span>
                    </div>
                ) : (
                    <img
                        src={imgSrc}
                        alt={property.title || (isHouse ? 'Nhà' : 'Đất')}
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover rounded-tl-3xl transition-transform duration-500 group-hover:scale-105"
                    />
                )}

                {/* Nút yêu thích */}
                <button
                    onClick={handleFavorite}
                    aria-label={isFavorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                    className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-200 z-10 ${isFavorited ? 'bg-red-500 hover:bg-red-600' : 'bg-white/90 hover:bg-white'
                        }`}
                >
                    {isFavorited
                        ? <HeartFilled className="text-white text-[14px]" />
                        : <HeartOutlined className="text-gray-400 text-[14px]" />
                    }
                </button>
            </div>

            {/* Nội dung */}
            <div className="p-4 flex flex-col gap-2.5 flex-1">
                {/* Tiêu đề */}
                <h3 className="text-[15px] font-bold text-[#1a1a1a] leading-snug line-clamp-2 min-h-[40px]">
                    {property.title || (isHouse ? 'Nhà Phố' : 'Lô Đất')}
                </h3>

                {/* Địa chỉ */}
                <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                    <EnvironmentOutlined className="text-[#254b86] text-[12px] shrink-0" />
                    <span className="line-clamp-1">{location || 'Chưa cập nhật địa chỉ'}</span>
                </div>

                <div className="flex flex-col gap-1.5 text-[13px] text-gray-600">
                    {isHouse ? (
                        <>
                            <div className="flex items-center gap-2">
                                <img src={bedIcon} alt="bed" className="w-[15px] h-[15px] object-contain opacity-60" />
                                <span>{(property as House).bedrooms ?? 0} phòng ngủ</span>
                                <span className="mx-1 text-gray-300">|</span>
                                <img src={bathIcon} alt="bath" className="w-[15px] h-[15px] object-contain opacity-60" />
                                <span>{(property as House).bathrooms ?? 0} nhà vệ sinh</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <img src={stairsIcon} alt="stairs" className="w-[15px] h-[15px] object-contain opacity-60" />
                                <span>{(property as House).floors ?? 1} tầng</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            {(property as any).area && (
                                <span className="text-gray-500">
                                    Diện tích: <span className="text-[#1a1a1a] font-medium">{(property as any).area} m²</span>
                                </span>
                            )}
                            {(property as any).direction && (
                                <>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-gray-500">
                                        Hướng: <span className="text-[#1a1a1a] font-medium">{(property as any).direction}</span>
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Giá + nút xem chi tiết */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                    <span className="text-[14px] font-bold text-[#254b86]">
                        {formatPrice((property as any).price)}
                    </span>
                    <Link
                        to={`/${isHouse ? 'houses' : 'lands'}/${property.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-1.5 bg-[#254b86] text-white border border-[#254b86] text-[13px] font-semibold rounded-lg hover:bg-white hover:text-[#254b86] transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow"
                    >
                        Xem chi tiết
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PropertyCard;