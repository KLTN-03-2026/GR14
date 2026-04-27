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
        <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

            {/* ================= HERO SECTION (V0 design) ================= */}
            <section
                className="relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 50%, #0d4d4a 100%)', minHeight: 540 }}
            >
                {/* Background slide image */}
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                    >
                        <img src={slide.img} className="w-full h-full object-cover" style={{ opacity: 0.25 }} alt="" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0f1f3d 0%, rgba(15,31,61,0.7) 50%, rgba(15,31,61,0.4) 100%)' }} />
                    </div>
                ))}

                {/* Glow blobs */}
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(13,148,136,0.15)' }} />
                <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(37,75,134,0.2)' }} />

                <div className="relative z-20 max-w-[1200px] mx-auto px-6 py-20 md:py-28">
                    {/* Badge */}
                    <div
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium mb-5"
                        style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#a7f3d0', backdropFilter: 'blur(8px)' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" /></svg>
                        Nền tảng bất động sản thông minh hàng đầu
                    </div>

                    {/* Headline — animated on slide change */}
                    {slides.map((slide, index) => index === currentSlide && (
                        <div key={index} className="max-w-[600px]">
                            <h1 className="font-bold leading-tight text-white mb-4" style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                                {slide.title}
                            </h1>
                            <p className="text-base text-gray-300 mb-8" style={{ maxWidth: 480 }}>{slide.desc}</p>
                        </div>
                    ))}

                    {/* CTA buttons */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => navigate('/houses')}
                            className="inline-flex items-center gap-2 rounded-full font-semibold text-sm px-6 py-3 text-white transition-opacity hover:opacity-90"
                            style={{ background: 'var(--pl-accent, #0d9488)' }}
                        >
                            Xem nhà bán
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        <button
                            onClick={() => navigate('/valuation')}
                            className="inline-flex items-center gap-2 rounded-full font-semibold text-sm px-6 py-3 transition-all"
                            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" /></svg>
                            Định giá AI
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="mt-10 flex flex-wrap gap-8">
                        {[
                            { v: '60K+', l: 'Tin đăng' },
                            { v: '150K+', l: 'Khách hàng' },
                            { v: 'Toàn quốc', l: 'Khu vực phủ sóng' },
                            { v: '99%', l: 'Pháp lý minh bạch' },
                        ].map((s, i) => (
                            <div key={i}>
                                <div className="font-bold text-2xl text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.v}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
                            </div>
                        ))}
                    </div>

                    {/* Slide dots */}
                    <div className="flex gap-2 mt-8">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentSlide(i)}
                                className="rounded-full transition-all duration-300"
                                style={{
                                    width: i === currentSlide ? 24 : 8,
                                    height: 8,
                                    background: i === currentSlide ? 'var(--pl-accent, #0d9488)' : 'rgba(255,255,255,0.35)',
                                }}
                                aria-label={`Slide ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </section>

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
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ================= "Bạn muốn tìm gì?" SECTION ================= */}
            <div style={{ maxWidth: 1200, margin: '72px auto 56px', padding: '0 24px' }}>
                <div style={{ marginBottom: 28 }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: 0 }}>Bạn muốn tìm gì?</h2>
                    <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Truy cập nhanh vào các danh mục chính</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[
                        {
                            label: 'Mua bán nhà',
                            sub: 'Hơn 42,000 tin nhà riêng, biệt thự, nhà phố trên toàn quốc',
                            count: '42,180 TIN',
                            route: '/houses',
                            bg: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&q=80',
                            accent: '#0d9488',
                        },
                        {
                            label: 'Mua bán đất',
                            sub: 'Đất nền, đất thổ cư, đất dự án với pháp lý minh bạch',
                            count: '18,640 TIN',
                            route: '/lands',
                            bg: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80',
                            accent: '#0d9488',
                        },
                        {
                            label: 'Bài viết & Tin tức',
                            sub: 'Phân tích thị trường, hướng dẫn pháp lý, tư vấn phong thủy',
                            count: '2,810 BÀI VIẾT',
                            route: '/posts',
                            bg: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900&q=80',
                            accent: '#0d9488',
                        },
                    ].map((item, i) => (
                        <div
                            key={i}
                            onClick={() => navigate(item.route)}
                            className="sr-reveal group"
                            style={{
                                position: 'relative',
                                height: 320,
                                borderRadius: 20,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                '--sr-delay': `${i * 120}ms`,
                            } as React.CSSProperties}
                        >
                            {/* Background image */}
                            <img
                                src={item.bg}
                                alt={item.label}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            {/* Gradient overlay */}
                            <div
                                className="absolute inset-0"
                                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.10) 100%)' }}
                            />
                            {/* Count badge */}
                            <div
                                style={{
                                    position: 'absolute', top: 16, left: 16,
                                    background: item.accent,
                                    color: '#fff',
                                    fontSize: 10, fontWeight: 800,
                                    letterSpacing: '0.8px',
                                    padding: '3px 10px',
                                    borderRadius: 100,
                                }}
                            >
                                {item.count}
                            </div>
                            {/* Text content */}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 20px 24px' }}>
                                <h3 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.25 }}>
                                    {item.label}
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                                    {item.sub}
                                </p>
                                <span
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        color: item.accent, fontWeight: 700, fontSize: 13,
                                        background: 'rgba(255,255,255,0.92)',
                                        borderRadius: 100, padding: '5px 14px',
                                    }}
                                >
                                    Khám phá ngay
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                                </span>
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

            {/* ================= FEATURED POSTS (V0 style) ================= */}
            <div className="sr-reveal" style={{ maxWidth: 1200, margin: '0 auto 56px', padding: '0 24px' }}>

                {/* Section header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        {/* "BÀI VIẾT VIP" label pill */}
                        <div className="inline-flex items-center gap-1.5 mb-3"
                            style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 100, padding: '3px 10px' }}>
                            {/* Crown icon */}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706">
                                <path d="M2 19h20v2H2v-2zm2-7l5 5 5-8 5 5 3-5v9H2v-9l2 3z" />
                            </svg>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                Bài viết VIP
                            </span>
                        </div>
                        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.2 }}>
                            Tin tức nổi bật
                        </h2>
                    </div>
                    <button
                        onClick={() => navigate('/posts')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', marginTop: 4 }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                        Tất cả bài viết
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                </div>

                {featuredPosts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Chưa có bài viết nổi bật.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {featuredPosts.map((post, idx) => {
                            const imgSrc = post.images?.[0]?.url || 'https://placehold.co/600x400/e5e7eb/9ca3af?text=No+Image';
                            const isVip = post.isVip === true;

                            // Loại bài → label teal
                            const POST_TYPE_LABEL_MAP: Record<string, string> = {
                                SELL_HOUSE: 'Bán nhà',
                                SELL_LAND: 'Bán đất',
                                RENT_HOUSE: 'Cho thuê nhà',
                                RENT_LAND: 'Cho thuê đất',
                                NEED_BUY: 'Cần mua',
                                NEED_RENT: 'Cần thuê',
                                NEWS: 'Tin tức',
                                PROMOTION: 'Khuyến mãi',
                            };
                            const postTypeLabel = POST_TYPE_LABEL_MAP[(post as any).postType] || 'Tin tức';

                            // Ngày đăng — format "d Tháng M, yyyy"
                            const dateStr = post.createdAt || post.postedAt || '';
                            let formattedDate = '';
                            if (dateStr) {
                                const d = new Date(dateStr);
                                if (!isNaN(d.getTime())) {
                                    formattedDate = `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
                                }
                            }

                            // Phút đọc — ước tính từ description (~200 từ/phút)
                            const words = (post.description || '').trim().split(/\s+/).filter(Boolean).length;
                            const readMin = Math.max(1, Math.round(words / 200));

                            return (
                                <div
                                    key={post.id}
                                    className="sr-reveal bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer group"
                                    style={{ '--sr-delay': `${idx * 80}ms` } as React.CSSProperties}
                                    onClick={() => navigate(`/posts/${post.id}`)}
                                >
                                    {/* Image */}
                                    <div className="relative overflow-hidden" style={{ height: 200, flexShrink: 0 }}>
                                        <img
                                            src={imgSrc}
                                            alt={post.title}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        {/* VIP badge — only for VIP posts */}
                                        {isVip && (
                                            <div
                                                className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full"
                                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 2px 8px rgba(217,119,6,0.4)' }}
                                            >
                                                {/* Crown */}
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                                                    <path d="M2 19h20v2H2v-2zm2-7l5 5 5-8 5 5 3-5v9H2v-9l2 3z" />
                                                </svg>
                                                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>VIP</span>
                                            </div>
                                        )}
                                        {/* VIP top-accent border */}
                                        {isVip && (
                                            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 flex flex-col flex-1 gap-2">
                                        {/* Category label */}
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                            {postTypeLabel}
                                        </span>

                                        {/* Title — large & bold */}
                                        <h3
                                            className="m-0 line-clamp-2 group-hover:text-[#0d9488] transition-colors"
                                            style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.4, minHeight: 42 }}
                                        >
                                            {post.title}
                                        </h3>

                                        {/* Spacer */}
                                        <div className="flex-1" />

                                        {/* Footer — date left, read time right */}
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100" style={{ marginTop: 8 }}>
                                            <span style={{ fontSize: 12, color: '#6b7280' }}>{formattedDate}</span>
                                            {words > 0 && (
                                                <span style={{ fontSize: 12, color: '#9ca3af' }}>{readMin} phút đọc</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ================= INFO SECTION ================= */}
            <div className="bg-gray-50 py-20 px-4 overflow-hidden">
                <div className="max-w-[1200px] mx-auto">
                    <div className="text-center mb-12 sr-reveal">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Thông tin hữu ích</h2>
                        <p className="text-gray-500 mt-2">Công cụ và kiến thức dành cho nhà đầu tư thông minh</p>
                        {/* Animated shimmer accent line */}
                        <div className="mt-4 flex justify-center">
                            <div
                                className="h-[3px] w-16 rounded-full"
                                style={{
                                    background: 'linear-gradient(90deg, #0d9488, #38bdf8, #0d9488)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmerLine 2.5s linear infinite',
                                }}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { img: bdsBan, title: 'Bất động sản bán', desc: 'Bạn có thể tìm thấy ngôi nhà mơ ước hoặc cơ hội đầu tư hấp dẫn thông qua lượng tin rao lớn, uy tín.', href: '/houses' },
                            { img: bdsThue, title: 'Bất động sản cho thuê', desc: 'Cập nhật thường xuyên các loại hình bất động sản cho thuê như nhà riêng, chung cư, văn phòng.', href: '/houses' },
                            { img: duan, title: 'Đánh giá dự án', desc: 'Các video và bài viết đánh giá giúp bạn có góc nhìn khách quan trước khi đầu tư.', href: '/posts' },
                            { img: wikibds, title: 'Wiki BĐS', desc: 'Cung cấp kiến thức, kinh nghiệm mua bán, đầu tư bất động sản và thông tin hữu ích.', href: '/posts' },
                        ].map((item, index) => (
                            <div
                                key={index}
                                onClick={() => navigate(item.href)}
                                className="sr-reveal bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:-translate-y-2 hover:shadow-xl transition-all duration-300 text-center group cursor-pointer relative overflow-hidden"
                                style={{ '--sr-delay': `${index * 120}ms` } as React.CSSProperties}
                            >
                                {/* Top accent bar — slides in on hover */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                                    style={{
                                        background: 'linear-gradient(90deg, #0d9488, #38bdf8)',
                                        transform: 'scaleX(0)',
                                        transformOrigin: 'left',
                                        transition: 'transform 0.35s ease',
                                    }}
                                    ref={(el) => {
                                        if (!el) return;
                                        const card = el.parentElement;
                                        if (!card) return;
                                        card.addEventListener('mouseenter', () => el.style.transform = 'scaleX(1)');
                                        card.addEventListener('mouseleave', () => el.style.transform = 'scaleX(0)');
                                    }}
                                />

                                {/* Icon container with bounce animation */}
                                <div className="w-[130px] h-[130px] mx-auto mb-5 flex items-center justify-center bg-blue-50 rounded-xl group-hover:bg-teal-50 group-hover:scale-105 transition-all duration-300">
                                    <img
                                        src={item.img}
                                        className="w-[65%] h-[65%] object-contain group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300"
                                        alt={item.title}
                                        style={{ animation: 'none' }}
                                    />
                                </div>

                                <h3 className="font-bold text-[17px] mb-2 text-gray-900 group-hover:text-[#0d9488] transition-colors duration-300">
                                    {item.title}
                                </h3>
                                <p className="text-gray-500 text-sm leading-6 mb-4">{item.desc}</p>

                                <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--pl-accent, #0d9488)' }}>
                                    Tìm hiểu
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1.5 transition-transform duration-300"><polyline points="9 18 15 12 9 6" /></svg>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Keyframes for shimmer line */}
            <style>{`
                @keyframes shimmerLine {
                    0%   { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                }
            `}</style>


            {/* ================= AI VALUATION CTA BAND ================= */}
            <div
                className="mx-4 mb-10 overflow-hidden rounded-3xl p-8 md:p-12 text-white"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0d4d4a 100%)' }}
            >
                <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="max-w-2xl">
                        <div
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider mb-3"
                            style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#a7f3d0' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.5 8.5L20 7L15.5 12L20 17L13.5 15.5L12 22L10.5 15.5L4 17L8.5 12L4 7L10.5 8.5L12 2Z" /></svg>
                            Công nghệ AI
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
                            Định giá bất động sản chính xác trong 30 giây
                        </h2>
                        <p className="text-white/70 text-base">
                            AI được huấn luyện trên hàng triệu giao dịch thực tế, cho bạn mức giá hợp lý, biên độ dao động và phân tích thị trường chi tiết.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/valuation')}
                        className="inline-flex items-center gap-2 rounded-full font-bold px-8 py-3.5 text-[#1e3a5f] whitespace-nowrap hover:opacity-90 transition-opacity flex-shrink-0"
                        style={{ background: '#a7f3d0' }}
                    >
                        Định giá ngay
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                </div>
            </div>

        </div>
    );

};

export default HomePage;