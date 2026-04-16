import { useEffect, useState } from 'react';
import { Row, Col, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { featuredApi, recommendationApi } from '@/api';
import { PropertyCard } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatArea, getFullAddress } from '@/utils';
import type { House, Land, AIRecommendation, Post } from '@/types';
import banner1 from '@/assets/ABbn1.jpg';
import banner2 from '@/assets/ABbn2.jpg';
import banner3 from '@/assets/ABbn3.jpg';
import danang from '@/assets/danang.png';
import hanoi from '@/assets/hanoi.jpg';
import cantho from '@/assets/cantho.jpeg';
import binhduong from '@/assets/binhduong.jpg';
import tphcm from '@/assets/tphcm.jpg';
import bdsBan from '@/assets/bdsBan.png';
import bdsThue from '@/assets/bdsThue.png';
import duan from '@/assets/duan.png';
import wikibds from '@/assets/wikiBds.png';

const { Title } = Typography;

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [houses, setHouses] = useState<House[]>([]);
    const [lands, setLands] = useState<Land[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [aiRecs, setAiRecs] = useState<AIRecommendation[]>([]);
    const [featuredPosts, setFeaturedPosts] = useState<Post[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        recommendationApi.getAIRecommendations(8)
            .then(res => setAiRecs(res.data?.data || res.data || []))
            .catch(() => { });
    }, [isAuthenticated]);

    const loadData = async () => {
        try {
            const [featuredRes, featuredPostsRes] = await Promise.all([
                featuredApi.getAll(),
                featuredApi.getPosts(4),
            ]);

            const payload = featuredRes.data?.data || featuredRes.data || {};
            const postsPayload = featuredPostsRes.data?.data || featuredPostsRes.data || [];

            setHouses(payload.houses || []);
            setLands(payload.lands || []);
            setFeaturedPosts(postsPayload || []);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const slides = [
        { img: banner1, title: 'Tìm kiếm bất động sản lý tưởng', desc: 'Hơn 10.000+ tin đăng mới mỗi ngày' },
        { img: banner2, title: 'Khám phá không gian sống mơ ước', desc: 'Nhà đẹp – Giá tốt – Pháp lý rõ ràng' },
        { img: banner3, title: 'Đầu tư thông minh – Sinh lời bền vững', desc: 'Cập nhật xu hướng thị trường nhanh nhất' },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            const els = document.querySelectorAll('.sr-reveal');
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('sr-visible');
                        }
                    });
                },
                { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
            );
            els.forEach(el => observer.observe(el));
            return () => observer.disconnect();
        }, 100);
        return () => clearTimeout(timer);
    }, [houses, lands]);

    const trackRecommendationClick = (rec: AIRecommendation) => {
        if (!isAuthenticated) return;

        recommendationApi.trackBehavior(
            rec.propertyType === 'house'
                ? { action: 'click', houseId: rec.id }
                : { action: 'click', landId: rec.id },
        ).catch(() => { });
    };

    const handleRecommendationNavigate = (rec: AIRecommendation) => {
        trackRecommendationClick(rec);
        navigate(`/${rec.propertyType === 'house' ? 'houses' : 'lands'}/${rec.id}`);
    };

    return (
        <div>

            {/* ================= SLIDER ================= */}
            <div className="relative w-full h-[580px] overflow-hidden mb-16">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'
                            }`}
                    >
                        <img src={slide.img} className="w-full h-full object-cover brightness-110" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
                        {index === currentSlide && (
                            <div className="absolute bottom-12 left-10 text-white max-w-[500px] animate-fadeIn">
                                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">{slide.title}</h1>
                                <p className="text-sm md:text-lg text-gray-200">{slide.desc}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ================= AI HYBRID RECOMMENDATIONS ================= */}
            {isAuthenticated && aiRecs.length > 0 && (
                <div className="bg-white py-9 mb-0">
                    <div className="max-w-[1200px] mx-auto px-6">

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-[10px] bg-[#254b86] flex items-center justify-center shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z"
                                            fill="white"
                                        />
                                    </svg>
                                </div>
                                <h2 className="text-[20px] font-bold text-[#1a1a1a] m-0 leading-none">
                                    AI gợi ý cho bạn
                                </h2>
                                <span className="text-[10px] font-bold tracking-[1.5px] uppercase text-[#185FA5] bg-[#E6F1FB] border border-[#B5D4F4] rounded-full px-2.5 py-[3px]">
                                    Hybrid AI
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-[7px] h-[7px] rounded-full bg-green-500 shrink-0 animate-pulse" />
                                <span className="text-[12px] text-gray-400">
                                    Được cá nhân hoá theo sở thích của bạn
                                </span>
                            </div>
                        </div>

                        {/* Accent divider */}
                        <div
                            className="h-[3px] rounded-sm mb-6"
                            style={{ background: 'linear-gradient(90deg, #254b86 0%, #dbeafe 55%, transparent 100%)' }}
                        />

                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {aiRecs.map(rec => {
                                const isHouse = rec.propertyType === 'house';
                                const score = Math.round(rec.recommendationScore * 100);
                                const circ = 2 * Math.PI * 17;
                                const offset = circ * (1 - rec.recommendationScore);

                                return (
                                    <div
                                        key={`${rec.propertyType}-${rec.id}`}
                                        onClick={() => handleRecommendationNavigate(rec)}
                                        className="bg-white border border-gray-100 rounded-tl-3xl rounded-br-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-[0_8px_28px_rgba(37,75,134,0.14)] hover:-translate-y-1 transition-all duration-250 flex flex-col h-full group"
                                    >
                                        {/* Image */}
                                        <div className="relative h-[185px] overflow-hidden">
                                            <img
                                                alt={rec.title}
                                                src={rec.images?.[0]?.url || 'https://via.placeholder.com/300x200?text=No+Image'}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />

                                            {/* Type pill */}
                                            <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold text-white px-2.5 py-[3px] rounded-full ${isHouse ? 'bg-[#254b86]' : 'bg-[#1a7a4a]'}`}>
                                                {isHouse ? 'Nhà' : 'Đất'}
                                            </span>

                                            {/* Score ring */}
                                            <svg viewBox="0 0 44 44" className="absolute top-2.5 right-2.5 w-11 h-11">
                                                <circle cx="22" cy="22" r="20" fill="rgba(255,255,255,0.93)" />
                                                <circle cx="22" cy="22" r="17" fill="none" stroke="#e5e7eb" strokeWidth="3" transform="rotate(-90 22 22)" />
                                                <circle
                                                    cx="22" cy="22" r="17" fill="none"
                                                    stroke={isHouse ? '#254b86' : '#1a7a4a'}
                                                    strokeWidth="3" strokeLinecap="round"
                                                    transform="rotate(-90 22 22)"
                                                    strokeDasharray={`${circ}`}
                                                    strokeDashoffset={`${offset}`}
                                                />
                                                <text x="22" y="20" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fontWeight: 700, fill: '#1a1a1a' }}>
                                                    {score}
                                                </text>
                                                <text x="22" y="30" textAnchor="middle" style={{ fontSize: 6.5, fill: '#888' }}>
                                                    % phù hợp
                                                </text>
                                            </svg>

                                            {/* Price */}
                                            <span className="absolute bottom-2.5 left-3 text-white font-extrabold text-[13px] drop-shadow-md">
                                                {formatCurrency(rec.price)}
                                            </span>
                                        </div>

                                        {/* Body */}
                                        <div className="p-3.5 flex flex-col gap-2.5 flex-1">

                                            {/* Title */}
                                            <h3 className="text-[13.5px] font-bold text-[#1a1a1a] leading-snug line-clamp-2 min-h-[39px] m-0">
                                                {rec.title}
                                            </h3>

                                            {/* Address */}
                                            <div className="flex items-start gap-1 text-[12px] text-gray-400 leading-snug">
                                                <svg className="w-3 h-3 shrink-0 mt-[2px] text-[#254b86]" viewBox="0 0 16 16" fill="none">
                                                    <circle cx="8" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
                                                    <path d="M8 14S3 10 3 6.5a5 5 0 0110 0C13 10 8 14 8 14z" stroke="currentColor" strokeWidth="1.5" />
                                                </svg>
                                                <span className="line-clamp-1">{getFullAddress(rec)}</span>
                                            </div>

                                            {/* Tags */}
                                            <div className="flex gap-1.5 flex-wrap">
                                                <span className="text-[11px] font-semibold text-[#254b86] bg-[#f0f4ff] border border-[#dce7ff] rounded-md px-2 py-[2px]">
                                                    {formatArea(rec.area)}
                                                </span>
                                                {rec.direction && (
                                                    <span className="text-[11px] font-semibold text-[#1a7a4a] bg-[#f0faf4] border border-[#c6ebd8] rounded-md px-2 py-[2px]">
                                                        {rec.direction}
                                                    </span>
                                                )}
                                            </div>


                                            <div
                                                onClick={e => e.stopPropagation()}
                                                className="bg-[#f8f9ff] border-l-[3px] border-[#254b86] rounded-r-md px-2.5 py-2 text-[11px] text-gray-500 leading-relaxed"
                                            >
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-[#254b86] uppercase tracking-[0.5px] mb-1">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                                        <path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" fill="#254b86" />
                                                    </svg>
                                                    AI nhận xét
                                                </span>
                                                {rec.recommendationReason}
                                            </div>

                                            {/* Footer */}
                                            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 mt-auto">
                                                <span className="text-[13px] font-extrabold text-[#254b86]">
                                                    {formatCurrency(rec.price)}
                                                </span>
                                                <a
                                                    href={`/${isHouse ? 'houses' : 'lands'}/${rec.id}`}
                                                    onClick={e => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleRecommendationNavigate(rec);
                                                    }}
                                                    className="px-3.5 py-[5px] bg-[#254b86] text-white border-[1.5px] border-[#254b86] text-[12px] font-semibold rounded-lg hover:bg-white hover:text-[#254b86] transition-all duration-200 whitespace-nowrap no-underline"
                                                >
                                                    Xem chi tiết
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ================= CATEGORIES ================= */}
            <style>{`
                .qc-card {
                    position: relative;
                    overflow: hidden;
                    border-radius: 20px;
                    border: 1.5px solid var(--qc-border);
                    padding: 44px 28px 36px;
                    text-align: center;
                    cursor: pointer;
                    background: var(--qc-light);
                    transition: transform 0.35s cubic-bezier(.22,.68,0,1.2), box-shadow 0.35s ease, border-color 0.3s ease, background 0.35s ease;
                }
                .qc-card:hover {
                    transform: translateY(-8px) scale(1.02);
                    box-shadow: 0 20px 50px var(--qc-glow);
                    background: var(--qc-hover);
                    border-color: var(--qc-color);
                }
                .qc-deco {
                    position: absolute;
                    top: -40px; right: -40px;
                    width: 140px; height: 140px;
                    border-radius: 50%;
                    background: var(--qc-deco-bg);
                    transition: transform 0.5s ease;
                    z-index: 0;
                }
                .qc-deco2 {
                    position: absolute;
                    bottom: -50px; left: -30px;
                    width: 100px; height: 100px;
                    border-radius: 50%;
                    background: var(--qc-deco-bg);
                    transition: transform 0.5s ease;
                    z-index: 0;
                    opacity: 0.5;
                }
                .qc-card:hover .qc-deco  { transform: scale(2); }
                .qc-card:hover .qc-deco2 { transform: scale(2.2); }
                .qc-icon-wrap {
                    position: relative;
                    z-index: 1;
                    width: 84px; height: 84px;
                    border-radius: 22px;
                    margin: 0 auto 22px;
                    display: flex; align-items: center; justify-content: center;
                    background: var(--qc-gradient);
                    box-shadow: 0 10px 28px var(--qc-glow);
                    transition: transform 0.35s cubic-bezier(.22,.68,0,1.2), box-shadow 0.3s ease;
                }
                .qc-card:hover .qc-icon-wrap {
                    transform: scale(1.1) translateY(-4px);
                    box-shadow: 0 16px 36px var(--qc-glow);
                }
                .qc-label {
                    position: relative; z-index: 1;
                    font-weight: 800;
                    font-size: 15px;
                    letter-spacing: 2px;
                    color: #1a1a1a;
                    margin-bottom: 8px;
                    transition: color 0.3s ease;
                }
                .qc-sub {
                    position: relative; z-index: 1;
                    font-size: 13px;
                    color: #888;
                    margin-bottom: 18px;
                    transition: color 0.3s ease;
                }
                .qc-arrow {
                    position: relative; z-index: 1;
                    display: inline-flex; align-items: center; justify-content: center;
                    width: 34px; height: 34px;
                    border-radius: 50%;
                    border: 1.5px solid var(--qc-color);
                    color: var(--qc-color);
                    transition: all 0.3s ease;
                    line-height: 1;
                }
                .qc-card:hover .qc-label { color: var(--qc-color); }
                .qc-card:hover .qc-sub   { color: #555; }
                .qc-card:hover .qc-arrow {
                    background: var(--qc-color);
                    color: white;
                    border-color: var(--qc-color);
                    transform: translateX(4px);
                }
                .qc-card:hover .qc-arrow svg { stroke: white; }
                .qc-topline {
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 4px;
                    background: var(--qc-gradient);
                    border-radius: 20px 20px 0 0;
                    z-index: 1;
                    transform: scaleX(0);
                    transform-origin: left;
                    transition: transform 0.4s ease;
                }
                .qc-card:hover .qc-topline { transform: scaleX(1); }

                /* ===== SCROLL REVEAL ===== */
                .sr-reveal {
                    opacity: 0;
                    transform: translateY(36px);
                    transition: opacity 0.65s ease, transform 0.65s cubic-bezier(0.22, 0.68, 0, 1.05);
                    transition-delay: var(--sr-delay, 0ms);
                }
                .sr-reveal.sr-visible {
                    opacity: 1;
                    transform: translateY(0);
                }
            `}</style>

            <div style={{ maxWidth: 1200, margin: '80px auto 56px', padding: '0 24px' }}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                        {
                            icon: (
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
                                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                                </svg>
                            ),
                            label: 'MUA BÁN NHÀ',
                            sub: 'Hàng nghìn căn nhà đang chờ bạn',
                            route: '/houses',
                            light: '#f0f5ff',
                            hover: '#dbeafe',
                            gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)',
                            glow: 'rgba(59,130,246,0.22)',
                            color: '#2563eb',
                            border: 'rgba(37,99,235,0.15)',
                            deco: 'rgba(59,130,246,0.10)',
                        },
                        {
                            icon: (
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
                                    <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
                                </svg>
                            ),
                            label: 'MUA BÁN ĐẤT',
                            sub: 'Đất nền tiềm năng, giá cạnh tranh',
                            route: '/lands',
                            light: '#f0fdf4',
                            hover: '#dcfce7',
                            gradient: 'linear-gradient(135deg, #16a34a, #4ade80)',
                            glow: 'rgba(34,197,94,0.22)',
                            color: '#16a34a',
                            border: 'rgba(22,163,74,0.15)',
                            deco: 'rgba(34,197,94,0.10)',
                        },
                        {
                            icon: (
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="white">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                </svg>
                            ),
                            label: 'BÀI VIẾT',
                            sub: 'Kiến thức & xu hướng thị trường',
                            route: '/posts',
                            light: '#ecfeff',
                            hover: '#cffafe',
                            gradient: 'linear-gradient(135deg, #0891b2, #22d3ee)',
                            glow: 'rgba(6,182,212,0.22)',
                            color: '#0891b2',
                            border: 'rgba(8,145,178,0.15)',
                            deco: 'rgba(6,182,212,0.10)',
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            className="qc-card sr-reveal"
                            onClick={() => navigate(item.route)}
                            style={{
                                '--qc-light': item.light,
                                '--qc-hover': item.hover,
                                '--qc-gradient': item.gradient,
                                '--qc-glow': item.glow,
                                '--qc-color': item.color,
                                '--qc-border': item.border,
                                '--qc-deco-bg': item.deco,
                                '--sr-delay': `${i * 130}ms`,
                            } as React.CSSProperties}
                        >
                            <div className="qc-topline" />
                            <div className="qc-deco" />
                            <div className="qc-deco2" />
                            <div className="qc-icon-wrap">{item.icon}</div>
                            <div className="qc-label">{item.label}</div>
                            <div className="qc-sub">{item.sub}</div>
                            <div className="qc-arrow">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ================= PROPERTIES BY LOCATION ================= */}
            <div className="sr-reveal" style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                <div className="flex justify-between items-center mb-6">
                    <Title level={2}>Bất động sản theo khu vực</Title>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    {/* Big card */}
                    <div className="col-span-2 row-span-2 relative rounded-xl overflow-hidden group cursor-pointer sr-reveal" style={{ '--sr-delay': '100ms' } as React.CSSProperties}>
                        <img src={tphcm} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/40" />
                        <div className="absolute bottom-4 left-4 text-white">
                            <h3 className="text-xl font-semibold">TP Hồ Chí Minh</h3>
                            <p className="text-sm">3.592 tin đăng</p>
                        </div>
                    </div>

                    {/* Small cards */}
                    {[
                        { name: 'Hà Nội', img: hanoi, total: 1103 },
                        { name: 'Đà Nẵng', img: danang, total: 564 },
                        { name: 'Cần Thơ', img: cantho, total: 73 },
                        { name: 'Bình Dương', img: binhduong, total: 1069 },
                    ].map((item, index) => (
                        <div key={index} className="relative rounded-xl overflow-hidden group cursor-pointer sr-reveal" style={{ '--sr-delay': `${(index + 2) * 100}ms` } as React.CSSProperties}>
                            <img src={item.img} className="absolute inset-0 w-full h-full object-cover brightness-110 group-hover:scale-105 transition duration-500" />
                            <div className="absolute inset-0 bg-black/40" />
                            <div className="absolute bottom-2 left-3 text-white">
                                <h4 className="text-sm font-semibold">{item.name}</h4>
                                <p className="text-xs">{item.total} tin đăng</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ================= FEATURED HOUSES ================= */}
            <div className="sr-reveal" style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Title level={2}>Nhà nổi bật</Title>
                    <Button type="link" onClick={() => navigate('/houses')}>Xem tất cả →</Button>
                </div>
                <Row gutter={[16, 16]}>
                    {houses.map((house, idx) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={house.id}
                            className="sr-reveal"
                            style={{ '--sr-delay': `${idx * 80}ms` } as React.CSSProperties}>
                            <PropertyCard property={house} type="house" />
                        </Col>
                    ))}
                </Row>
            </div>

            {/* ================= FEATURED LANDS ================= */}
            <div className="sr-reveal" style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Title level={2}>Đất nổi bật</Title>
                    <Button type="link" onClick={() => navigate('/lands')}>Xem tất cả →</Button>
                </div>
                <Row gutter={[16, 16]}>
                    {lands.map((land, idx) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={land.id}
                            className="sr-reveal"
                            style={{ '--sr-delay': `${idx * 80}ms` } as React.CSSProperties}>
                            <PropertyCard property={land as any} type="land" />
                        </Col>
                    ))}
                </Row>
            </div>

            {/* ================= FEATURED POSTS ================= */}
            <div className="sr-reveal" style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" />
                            </svg>
                        </div>
                        <h2 className="text-[22px] font-bold text-[#1a1a1a] m-0 leading-none">Bài viết nổi bật</h2>
                        <span className="text-[10px] font-bold tracking-wide uppercase text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-[3px]">
                            {featuredPosts.length} bài
                        </span>
                    </div>
                    <button
                        onClick={() => navigate('/posts')}
                        className="text-[13px] font-semibold text-[#254b86] hover:underline bg-transparent border-none cursor-pointer"
                    >
                        Xem tất cả →
                    </button>
                </div>
                <div className="h-[3px] rounded-sm mb-6" style={{ background: 'linear-gradient(90deg, #f97316 0%, #eab308 40%, transparent 100%)' }} />

                {featuredPosts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Chưa có bài viết VIP nổi bật.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {featuredPosts.map((post, idx) => {
                            const imgSrc = post.images?.[0]?.url || 'https://placehold.co/600x400?text=No+Image';
                            const location = [post.district, post.city].filter(Boolean).join(', ');
                            const formatPostPrice = (v?: number) => {
                                if (!v) return 'Liên hệ';
                                if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + ' tỷ';
                                if (v >= 1e6) return (v / 1e6).toFixed(0) + ' triệu';
                                return v.toLocaleString('vi-VN') + ' đ';
                            };
                            return (
                                <div
                                    key={post.id}
                                    className="sr-reveal"
                                    style={{ padding: '2px', borderRadius: '24px 0 24px 0', background: 'linear-gradient(135deg, #f97316, #eab308)', '--sr-delay': `${idx * 80}ms` } as React.CSSProperties}
                                >
                                    <div
                                        className="bg-white flex flex-col cursor-pointer group hover:shadow-lg transition-shadow duration-300 overflow-hidden"
                                        style={{ borderRadius: '22px 0 22px 0' }}
                                        onClick={() => navigate(`/posts/${post.id}`)}
                                    >
                                        {/* Image */}
                                        <div className="relative overflow-hidden" style={{ height: 200, borderRadius: '22px 0 0 0' }}>
                                            <img
                                                src={imgSrc}
                                                alt={post.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                style={{ borderRadius: '22px 0 0 0' }}
                                            />
                                            {/* VIP badge */}
                                            <div className="absolute top-3 right-3">
                                                <span className="text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow-md tracking-wide" style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>
                                                    ⭐ VIP
                                                </span>
                                            </div>
                                            {/* Price overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
                                                <span className="text-white font-bold text-sm">{formatPostPrice(post.price)}</span>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-4 flex flex-col gap-2.5 flex-1">
                                            <h3 className="text-[14px] font-bold text-[#1a1a1a] leading-snug line-clamp-2 min-h-[40px] m-0 group-hover:text-orange-600 transition-colors">
                                                {post.title}
                                            </h3>

                                            {location && (
                                                <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                                                    <svg className="shrink-0" width="12" height="12" viewBox="0 0 20 20" fill="#254b86">
                                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="line-clamp-1">{location}</span>
                                                </div>
                                            )}

                                            {(post as any).area && (
                                                <div className="text-[12px] text-gray-600">
                                                    Diện tích: <span className="font-semibold text-[#1a1a1a]">{(post as any).area} m²</span>
                                                </div>
                                            )}

                                            {/* Footer */}
                                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                                <span className="text-[13px] font-bold text-[#254b86]">{formatPostPrice(post.price)}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/posts/${post.id}`); }}
                                                    className="px-3.5 py-1.5 bg-[#254b86] text-white border border-[#254b86] text-[12px] font-semibold rounded-lg hover:bg-white hover:text-[#254b86] transition-all duration-200 whitespace-nowrap"
                                                >
                                                    Xem chi tiết
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ================= INFO SECTION ================= */}
            <div className="bg-gray-50 py-20 px-4">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { img: bdsBan, title: 'Bất động sản bán', desc: 'Bạn có thể tìm thấy ngôi nhà mơ ước hoặc cơ hội đầu tư hấp dẫn thông qua lượng tin rao lớn, uy tín.' },
                        { img: bdsThue, title: 'Bất động sản cho thuê', desc: 'Cập nhật thường xuyên các loại hình bất động sản cho thuê như nhà riêng, chung cư, văn phòng.' },
                        { img: duan, title: 'Đánh giá dự án', desc: 'Các video và bài viết đánh giá giúp bạn có góc nhìn khách quan trước khi đầu tư.' },
                        { img: wikibds, title: 'Wiki BĐS', desc: 'Cung cấp kiến thức, kinh nghiệm mua bán, đầu tư bất động sản và thông tin hữu ích.' },
                    ].map((item, index) => (
                        <div key={index} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 text-center group">
                            <div className="w-[150px] h-[150px] mx-auto mb-5 flex items-center justify-center bg-blue-50 rounded-xl group-hover:bg-blue-100 transition">
                                <img src={item.img} className="w-[65%] h-[65%] object-contain group-hover:scale-110 transition" />
                            </div>
                            <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{item.title}</h3>
                            <p className="text-gray-500 text-sm leading-6">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default HomePage;