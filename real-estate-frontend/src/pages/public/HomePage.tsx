import { useEffect, useState } from 'react';
import { Row, Col, Typography, Button, Card, Tag } from 'antd';
import { BankOutlined, EnvironmentOutlined, ReadOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { featuredApi, recommendationApi } from '@/api';
import { PropertyCard } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatArea, formatDate, getFullAddress } from '@/utils';
import type { House, Land, AIRecommendation, Post } from '@/types';
import banner1 from '@/assets/ABbn1.jpg';
import banner2 from '@/assets/ABbn2.jpg';
import banner3 from '@/assets/ABbn3.jpg';
import danang from '@/assets/danang.png';
import hanoi from '@/assets/hanoi.jpg';
import cantho from '@/assets/cantho.jpeg';
import binhduong from '@/assets/binhduong.jpg';
const { Title, Paragraph } = Typography;

const toPlainText = (value?: string) => {
    if (!value) return '';

    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
};

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
        {
            img: banner1,
            title: "Tìm kiếm bất động sản lý tưởng",
            desc: "Hơn 10.000+ tin đăng mới mỗi ngày"
        },
        {
            img: banner2,
            title: "Khám phá không gian sống mơ ước",
            desc: "Nhà đẹp – Giá tốt – Pháp lý rõ ràng"
        },
        {
            img: banner3,
            title: "Đầu tư thông minh – Sinh lời bền vững",
            desc: "Cập nhật xu hướng thị trường nhanh nhất"
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>

            {/* ================= SLIDER ================= */}
            <div className="relative w-full h-[580px] overflow-hidden mb-16">

                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-all duration-1000 ease-in-out
                ${index === currentSlide ? "opacity-100 scale-100 z-10" : "opacity-0 scale-105 z-0"}`}
                    >

                        {/* IMAGE */}
                        <img
                            src={slide.img}
                            className="w-full h-full object-cover brightness-110"
                        />

                        {/* GRADIENT */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent"></div>

                        {/* TEXT */}
                        {index === currentSlide && (
                            <div className="absolute bottom-12 left-10 text-white max-w-[500px] animate-fadeIn">

                                <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
                                    {slide.title}
                                </h1>

                                <p className="text-sm md:text-lg text-gray-200">
                                    {slide.desc}
                                </p>

                            </div>
                        )}

                    </div>
                ))}

            </div>

            {/* ================= AI HYBRID RECOMMENDATIONS ================= */}
            {isAuthenticated && aiRecs.length > 0 && (
                <div style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                        <RobotOutlined style={{ fontSize: 24, color: '#1677ff', marginRight: 10 }} />
                        <Title level={2} style={{ margin: 0 }}>AI gợi ý cho bạn</Title>
                        <Tag color="blue" style={{ marginLeft: 12 }}>Hybrid AI</Tag>
                    </div>

                    <Row gutter={[16, 16]}>
                        {aiRecs.map(rec => (
                            <Col xs={24} sm={12} md={8} lg={6} key={`${rec.propertyType}-${rec.id}`}>
                                <Card
                                    hoverable
                                    cover={
                                        <div style={{ height: 180, overflow: 'hidden', position: 'relative' }}>
                                            <img
                                                alt={rec.title}
                                                src={rec.images?.[0]?.url || 'https://via.placeholder.com/300x200?text=No+Image'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <Tag color="gold" style={{ position: 'absolute', top: 8, right: 8 }}>
                                                {Math.round(rec.recommendationScore * 100)}% phù hợp
                                            </Tag>
                                            <Tag
                                                color={rec.propertyType === 'house' ? 'blue' : 'green'}
                                                style={{ position: 'absolute', top: 8, left: 8 }}
                                            >
                                                {rec.propertyType === 'house' ? 'Nhà' : 'Đất'}
                                            </Tag>
                                        </div>
                                    }
                                    onClick={() => navigate(`/${rec.propertyType === 'house' ? 'houses' : 'lands'}/${rec.id}`)}
                                    style={{ height: '100%' }}
                                >
                                    <Card.Meta
                                        title={<span style={{ fontSize: 14 }}>{rec.title}</span>}
                                        description={
                                            <div>
                                                <div style={{ color: '#f5222d', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                                                    {formatCurrency(rec.price)}
                                                </div>
                                                <div style={{ marginBottom: 6 }}>
                                                    <Tag color="blue">{formatArea(rec.area)}</Tag>
                                                    {rec.direction && <Tag color="green">{rec.direction}</Tag>}
                                                </div>
                                                <div style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>
                                                    <EnvironmentOutlined /> {getFullAddress(rec)}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                                    {rec.recommendationReason}
                                                </div>
                                            </div>
                                        }
                                    />
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            )}


            {/* ================= CATEGORIES ================= */}
            <div style={{ maxWidth: 1200, margin: '100px auto 48px', padding: '0 24px' }}>
                <Row gutter={24} justify="center">
                    <Col xs={12} sm={8} md={6}>
                        <Card
                            hoverable
                            onClick={() => navigate('/houses')}
                            style={{ textAlign: 'center' }}
                        >
                            <BankOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
                            <Title level={4}>MUA BÁN NHÀ</Title>
                        </Card>
                    </Col>

                    <Col xs={12} sm={8} md={6}>
                        <Card
                            hoverable
                            onClick={() => navigate('/lands')}
                            style={{ textAlign: 'center' }}
                        >
                            <EnvironmentOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                            <Title level={4}>MUA BÁN ĐẤT</Title>
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6}>
                        <Card
                            hoverable
                            onClick={() => navigate('/posts')}
                            style={{ textAlign: 'center' }}
                        >
                            <ReadOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                            <Title level={4}>BÀI VIẾT</Title>
                        </Card>
                    </Col>
                </Row>
            </div>

            {/* ================= PROPERTIES BY LOCATION ================= */}
            <div style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <Title level={2}>Bất động sản theo khu vực</Title>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-4 gap-4">

                    {/* BIG CARD */}
                    <div className="col-span-2 row-span-2 relative rounded-xl overflow-hidden group cursor-pointer">
                        <img
                            src="/src/assets/tphcm.jpg"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40"></div>
                        <div className="absolute bottom-4 left-4 text-white">
                            <h3 className="text-xl font-semibold">TP Hồ Chí Minh</h3>
                            <p className="text-sm">3.592 tin đăng</p>
                        </div>
                    </div>

                    {/* SMALL CARDS */}
                    {[
                        { name: "Hà Nội", img: hanoi, total: 1103 },
                        { name: "Đà Nẵng", img: danang, total: 564 },
                        { name: "Cần Thơ", img: cantho, total: 73 },
                        { name: "Bình Dương", img: binhduong, total: 1069 },
                    ].map((item, index) => (
                        <div
                            key={index}
                            className="relative rounded-xl overflow-hidden group cursor-pointer"
                        >
                            <img
                                src={item.img}
                                className="absolute inset-0 w-full h-full object-cover brightness-110 group-hover:scale-105 transition duration-500"
                            />

                            <div className="absolute inset-0 bg-black/40"></div>

                            <div className="absolute bottom-2 left-3 text-white">
                                <h4 className="text-sm font-semibold">{item.name}</h4>
                                <p className="text-xs">{item.total} tin đăng</p>
                            </div>
                        </div>
                    ))}

                </div>
            </div>

            {/* ================= FEATURED HOUSES ================= */}
            <div style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Title level={2}>Nhà nổi bật</Title>
                    <Button type="link" onClick={() => navigate('/houses')}>
                        Xem tất cả →
                    </Button>
                </div>

                <Row gutter={[16, 16]}>
                    {houses.map((house) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={house.id}>
                            <PropertyCard property={house} type="house" />
                        </Col>
                    ))}
                </Row>
            </div>

            {/* ================= FEATURED LANDS ================= */}
            <div style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Title level={2}>Đất nổi bật</Title>
                    <Button type="link" onClick={() => navigate('/lands')}>
                        Xem tất cả →
                    </Button>
                </div>

                <Row gutter={[16, 16]}>
                    {lands.map((land) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={land.id}>
                            <PropertyCard property={land as any} type="land" />
                        </Col>
                    ))}
                </Row>
            </div>
            {/* ===================FEATURED POSTS===================== */}
            <div style={{ maxWidth: 1200, margin: '0 auto 48px', padding: '0 24px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24
                }}>
                    <Title level={2}>Bài viết nổi bật</Title>

                    <Button type="link" onClick={() => navigate('/posts')}>
                        Xem tất cả →
                    </Button>
                </div>

                <Row gutter={[16, 16]}>
                    {featuredPosts.map((post) => (
                        <Col xs={24} sm={12} lg={6} key={post.id}>
                            <Card
                                hoverable
                                onClick={() => navigate(`/posts/${post.id}`)}
                                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                                bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                                cover={
                                    <img
                                        src={post.images?.[0]?.url || 'https://via.placeholder.com/600x400?text=No+Image'}
                                        alt={post.title}
                                        style={{ height: 220, objectFit: 'cover' }}
                                    />
                                }
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Tag color="gold">VIP</Tag>
                                    <Tag color="blue">{formatDate(post.postedAt || post.createdAt)}</Tag>
                                </div>

                                <Title level={4} ellipsis={{ rows: 2 }} style={{ marginBottom: 8, minHeight: 64 }}>
                                    {post.title}
                                </Title>

                                <Paragraph ellipsis={{ rows: 4 }} style={{ marginBottom: 0, minHeight: 88 }}>
                                    {toPlainText(post.description)}
                                </Paragraph>
                            </Card>
                        </Col>
                    ))}

                    {featuredPosts.length === 0 && (
                        <Col span={24}>
                            <Card>
                                <Paragraph style={{ margin: 0, textAlign: 'center', color: '#888' }}>
                                    Chưa có bài viết VIP nổi bật.
                                </Paragraph>
                            </Card>
                        </Col>
                    )}

                </Row>

            </div>

            {/* ================= INFO SECTION ================= */}
            <div className="bg-gray-50 py-20 px-4">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

                    {/* ITEM */}
                    {[
                        {
                            img: "/src/assets/bdsBan.png",
                            title: "Bất động sản bán",
                            desc: "Bạn có thể tìm thấy ngôi nhà mơ ước hoặc cơ hội đầu tư hấp dẫn thông qua lượng tin rao lớn, uy tín.",
                        },
                        {
                            img: "/src/assets/bdsThue.png",
                            title: "Bất động sản cho thuê",
                            desc: "Cập nhật thường xuyên các loại hình bất động sản cho thuê như nhà riêng, chung cư, văn phòng.",
                        },
                        {
                            img: "/src/assets/duan.png",
                            title: "Đánh giá dự án",
                            desc: "Các video và bài viết đánh giá giúp bạn có góc nhìn khách quan trước khi đầu tư.",
                        },
                        {
                            img: "/src/assets/wikibds.png",
                            title: "Wiki BĐS",
                            desc: "Cung cấp kiến thức, kinh nghiệm mua bán, đầu tư bất động sản và thông tin hữu ích.",
                        },
                    ].map((item, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 text-center group"
                        >
                            {/* IMAGE BOX (VUÔNG + TO HƠN) */}
                            <div className="w-[150px] h-[150px] mx-auto mb-5 flex items-center justify-center bg-blue-50 rounded-xl group-hover:bg-blue-100 transition">
                                <img
                                    src={item.img}
                                    className="w-[65%] h-[65%] object-contain group-hover:scale-110 transition"
                                />
                            </div>

                            {/* TITLE */}
                            <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600 transition">
                                {item.title}
                            </h3>

                            {/* DESC */}
                            <p className="text-gray-500 text-sm leading-6">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomePage;