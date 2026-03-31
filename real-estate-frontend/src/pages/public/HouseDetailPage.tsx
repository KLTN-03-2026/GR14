import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { HeartOutlined, HeartFilled, CalendarOutlined } from '@ant-design/icons';
import { houseApi, favoriteApi, recommendationApi } from '@/api';
import { Loading } from '@/components/common';
import { formatCurrency, formatArea, getFullAddress, formatDateTime } from '@/utils';
import { useAuthStore } from '@/stores/authStore';
import type { House } from '@/types';


const getImages = (house: House): string[] => {
    if (!house.images || house.images.length === 0) return [];
    return house.images.map((img: any) =>
        typeof img === 'string' ? img : img.url ?? ''
    ).filter(Boolean);
};


const HouseDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [house, setHouse] = useState<House | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [activeImg, setActiveImg] = useState(0);

   
    useEffect(() => {
        if (id) loadHouse(Number(id));
    }, [id]);

    // Track view behavior for AI recommendations
    useEffect(() => {
        if (!house || !isAuthenticated) return;
        recommendationApi.trackBehavior({ action: 'view', houseId: house.id }).catch(() => { });
    }, [house, isAuthenticated]);

    const loadHouse = async (houseId: number) => {
        try {
            const res = await houseApi.getById(houseId);
            setHouse(res.data.data || res.data);
        } catch {
            message.error('Không tìm thấy bất động sản');
            navigate('/houses');
        } finally {
            setLoading(false);
        }
    };

    const handleFavorite = async () => {
        if (!isAuthenticated) {
            message.warning('Vui lòng đăng nhập để yêu thích');
            navigate('/login');
            return;
        }
        try {
            if (isFavorited) {
                await favoriteApi.removeHouse(house!.id);
            } else {
                await favoriteApi.addHouse(house!.id);
            }
            setIsFavorited(!isFavorited);
            message.success(isFavorited ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích');
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    if (loading) return <Loading />;
    if (!house) return null;

    const images = getImages(house);
    const fullAddress = getFullAddress(house);

    
    return (
        <div className="w-full bg-white pb-20">

            {/* Breadcrumb */}
            <div className="w-full bg-[#f4f5f7] py-3 mb-8">
                <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0 flex items-center gap-1.5 text-[13px]">
                    <button
                        onClick={() => navigate('/')}
                        className="text-gray-700 font-medium hover:text-[#254b86] transition-colors"
                    >
                        Trang Chủ
                    </button>
                    <span className="text-gray-400">›</span>
                    <button
                        onClick={() => navigate('/houses')}
                        className="text-gray-700 font-medium hover:text-[#254b86] transition-colors"
                    >
                        Danh Sách Nhà Ở
                    </button>
                    <span className="text-gray-400">›</span>
                    <span className="text-gray-500 line-clamp-1">{house.title}</span>
                </div>
            </div>

            <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-0">

                {/* Tiêu đề + giá */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-6">
                    <h1 className="text-[28px] font-bold text-[#1a1a1a] leading-tight">
                        {house.title}
                    </h1>
                    <span className="text-[26px] font-bold text-[#254b86] whitespace-nowrap">
                        {formatCurrency(house.price)}
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

                {/* ── Hiển thị ảnh linh hoạt theo số lượng ───────────────── */}
                {images.length === 0 ? (
                    <div className="w-full h-[420px] bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 mb-10">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span className="text-slate-400 text-sm">Chưa có hình ảnh</span>
                    </div>

                ) : images.length === 1 ? (
                    <div className="flex justify-center mb-10">
                        <div className="rounded-2xl overflow-hidden" style={{ height: 420, maxWidth: 640, width: '100%' }}>
                            <img
                                src={images[0]}
                                alt={house.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>

                ) : images.length === 2 ? (
                    <div className="grid grid-cols-2 gap-2 mb-10" style={{ height: 420 }}>
                        {images.map((src, i) => (
                            <div
                                key={i}
                                className={`overflow-hidden cursor-pointer ${i === 0 ? 'rounded-l-2xl' : 'rounded-r-2xl'}`}
                                onClick={() => setActiveImg(i)}
                            >
                                <img src={src} alt={`${house.title} ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                            </div>
                        ))}
                    </div>

                ) : images.length === 3 ? (
                    <div className="grid grid-cols-2 gap-2 mb-10" style={{ height: 420 }}>
                        <div className="rounded-l-2xl overflow-hidden cursor-pointer" onClick={() => setActiveImg(0)}>
                            <img src={images[0]} alt={house.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="grid grid-rows-2 gap-2">
                            {[1, 2].map((i) => (
                                <div key={i} className={`overflow-hidden cursor-pointer ${i === 1 ? 'rounded-tr-2xl' : 'rounded-br-2xl'}`} onClick={() => setActiveImg(i)}>
                                    <img src={images[i]} alt={`${house.title} ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                </div>
                            ))}
                        </div>
                    </div>

                ) : images.length === 4 ? (
                    <div className="grid grid-cols-2 gap-2 mb-10" style={{ height: 420 }}>
                        <div className="rounded-l-2xl overflow-hidden cursor-pointer" onClick={() => setActiveImg(0)}>
                            <img src={images[0]} alt={house.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="grid grid-rows-3 gap-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={`overflow-hidden cursor-pointer ${i === 1 ? 'rounded-tr-2xl' : i === 3 ? 'rounded-br-2xl' : ''}`} onClick={() => setActiveImg(i)}>
                                    <img src={images[i]} alt={`${house.title} ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                                </div>
                            ))}
                        </div>
                    </div>

                ) : (
        
                    <div className="grid grid-cols-4 grid-rows-2 gap-2 mb-10" style={{ height: 420 }}>
                        <div
                            className="col-span-2 row-span-2 rounded-tl-2xl rounded-bl-2xl overflow-hidden cursor-pointer"
                            onClick={() => setActiveImg(0)}
                        >
                            <img
                                src={images[activeImg] || images[0]}
                                alt={house.title}
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                            />
                        </div>
                        {[1, 2, 3, 4].map((i) => {
                            const isLast = i === 4 && images.length > 5;
                            return (
                                <div
                                    key={i}
                                    className={`relative overflow-hidden cursor-pointer ${i === 2 ? 'rounded-tr-2xl' : i === 4 ? 'rounded-br-2xl' : ''}`}
                                    onClick={() => setActiveImg(i)}
                                >
                                    <img
                                        src={images[i]}
                                        alt={`${house.title} ${i + 1}`}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                    />
                                    {isLast && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-br-2xl">
                                            <span className="text-white text-xl font-bold">+{images.length - 5}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 items-start">

                    <div className="lg:col-span-2">
                        <h2 className="text-[18px] font-bold text-[#254b86] mb-4">Thông Tin Chi Tiết</h2>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <tbody>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] w-1/4 font-medium">Giá</td>
                                        <td className="px-4 py-3 text-[#1a1a1a] font-semibold w-1/4">{formatCurrency(house.price)}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] w-1/4 font-medium">Diện Tích</td>
                                        <td className="px-4 py-3 text-[#1a1a1a] w-1/4">{formatArea(house.area)}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Số Phòng ngủ</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{house.bedrooms || 'N/A'}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Số Tầng</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{house.floors || 'N/A'}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Mã</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{house.code}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Phòng tắm</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{house.bathrooms || 'N/A'}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Hướng</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{house.direction || 'N/A'}</td>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Danh mục</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]">{house.category?.name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-gray-500 bg-[#fafafa] font-medium">Ngày đăng</td>
                                        <td className="px-4 py-3 text-[#1a1a1a]" colSpan={3}>{formatDateTime(house.createdAt)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Mô tả */}
                        {house.description && (
                            <div className="mt-8">
                                <h2 className="text-[18px] font-bold text-[#254b86] mb-4 text-center">Mô Tả</h2>
                                <p className="text-[16px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                                    {house.description}
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
                                    <p className="text-[14px] font-bold text-[#1a1a1a] leading-snug">{house.title}</p>
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
                                {formatCurrency(house.price)}
                            </p>

                            {/* Nút Yêu thích — giữ nguyên logic + icon */}
                            <button
                                onClick={handleFavorite}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[14px] font-semibold mb-3 transition-all duration-200 ${
                                    isFavorited
                                        ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                                        : 'bg-white border-gray-300 text-gray-700 hover:border-[#254b86] hover:text-[#254b86]'
                                }`}
                            >
                                {isFavorited ? <HeartFilled className="text-[15px]" /> : <HeartOutlined className="text-[15px]" />}
                                {isFavorited ? 'Đã yêu thích' : 'Yêu thích'}
                            </button>

                            {/* Nút Đặt lịch hẹn — giữ nguyên logic + icon */}
                            <button
                                onClick={() => navigate(`/appointment?houseId=${house.id}`)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#254b86] text-white text-[14px] font-semibold hover:bg-[#1a3660] transition-colors duration-200"
                            >
                                <CalendarOutlined className="text-[15px]" />
                                Đặt Lịch Hẹn
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Bản đồ — full width bên dưới, span toàn bộ ─────────── */}
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
                            src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HouseDetailPage;