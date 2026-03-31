import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Typography, Tag, Descriptions, Image, Button, Carousel, message } from 'antd';
import {
    ArrowLeftOutlined,
    HeartOutlined,
    HeartFilled,
    CalendarOutlined,
} from '@ant-design/icons';
import { houseApi, favoriteApi, recommendationApi } from '@/api';
import { Loading } from '@/components/common';
import { formatCurrency, formatArea, getFullAddress, formatDateTime } from '@/utils';
import { useAuthStore } from '@/stores/authStore';
import type { House } from '@/types';

const { Title, Paragraph } = Typography;

const HouseDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [house, setHouse] = useState<House | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);

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

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
            <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(-1)}
                style={{ marginBottom: 16, padding: 0 }}
            >
                Quay lại
            </Button>

            <Row gutter={32}>
                {/* Images */}
                <Col xs={24} md={14}>
                    {house.images && house.images.length > 0 ? (
                        <Carousel autoplay>
                            {house.images.map((img) => (
                                <div key={img.id}>
                                    <Image
                                        src={img.url}
                                        alt={house.title}
                                        style={{ width: '100%', height: 400, objectFit: 'cover', borderRadius: 8 }}
                                        preview
                                    />
                                </div>
                            ))}
                        </Carousel>
                    ) : (
                        <div
                            style={{
                                height: 400,
                                background: '#f0f0f0',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#999',
                                fontSize: 18,
                            }}
                        >
                            Chưa có hình ảnh
                        </div>
                    )}
                </Col>

                {/* Details */}
                <Col xs={24} md={10}>
                    <Title level={2}>{house.title}</Title>
                    <Title level={3} style={{ color: '#f5222d', marginTop: 0 }}>
                        {formatCurrency(house.price)}
                    </Title>

                    <div style={{ marginBottom: 16 }}>
                        <Tag color="blue">{formatArea(house.area)}</Tag>
                        {house.direction && <Tag color="green">{house.direction}</Tag>}
                        {house.category && <Tag color="purple">{house.category.name}</Tag>}
                        <Tag>{house.code}</Tag>
                    </div>

                    <Paragraph style={{ color: '#666', marginBottom: 24 }}>
                        📍 {getFullAddress(house)}
                    </Paragraph>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Button
                                block
                                size="large"
                                icon={isFavorited ? <HeartFilled /> : <HeartOutlined />}
                                onClick={handleFavorite}
                                danger={isFavorited}
                            >
                                {isFavorited ? 'Đã yêu thích' : 'Yêu thích'}
                            </Button>
                        </Col>
                        <Col span={12}>
                            <Button
                                block
                                size="large"
                                type="primary"
                                icon={<CalendarOutlined />}
                                onClick={() => navigate(`/appointment?houseId=${house.id}`)}
                            >
                                Đặt lịch hẹn
                            </Button>
                        </Col>
                    </Row>
                </Col>
            </Row>

            {/* Full Details */}
            <div style={{ marginTop: 32 }}>
                <Title level={4}>Thông tin chi tiết</Title>
                <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
                    <Descriptions.Item label="Mã">{house.code}</Descriptions.Item>
                    <Descriptions.Item label="Diện tích">{formatArea(house.area)}</Descriptions.Item>
                    <Descriptions.Item label="Giá">{formatCurrency(house.price)}</Descriptions.Item>
                    <Descriptions.Item label="Hướng">{house.direction || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Số tầng">{house.floors || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Phòng ngủ">{house.bedrooms || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Phòng tắm">{house.bathrooms || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Danh mục">{house.category?.name || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày đăng">{formatDateTime(house.createdAt)}</Descriptions.Item>
                </Descriptions>
            </div>

            {house.description && (
                <div style={{ marginTop: 32 }}>
                    <Title level={4}>Mô tả</Title>
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{house.description}</Paragraph>
                </div>
            )}

        </div>
    );
};

export default HouseDetailPage;
