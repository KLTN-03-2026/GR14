import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Typography, Tag, Descriptions, Image, Button, Carousel, message } from 'antd';
import {
    ArrowLeftOutlined,
    HeartOutlined,
    HeartFilled,
    CalendarOutlined,
} from '@ant-design/icons';
import { landApi, favoriteApi, recommendationApi } from '@/api';
import { Loading } from '@/components/common';
import { formatCurrency, formatArea, getFullAddress, formatDateTime } from '@/utils';
import { useAuthStore } from '@/stores/authStore';
import type { Land } from '@/types';

const { Title, Paragraph } = Typography;

const LandDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [land, setLand] = useState<Land | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);

    useEffect(() => {
        if (id) loadLand(Number(id));
    }, [id]);

    // Track view behavior for AI recommendations
    useEffect(() => {
        if (!land || !isAuthenticated) return;
        recommendationApi.trackBehavior({ action: 'view', landId: land.id }).catch(() => { });
    }, [land, isAuthenticated]);

    const loadLand = async (landId: number) => {
        try {
            const res = await landApi.getById(landId);
            setLand(res.data.data || res.data);
        } catch {
            message.error('Không tìm thấy bất động sản');
            navigate('/lands');
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
                await favoriteApi.removeLand(land!.id);
            } else {
                await favoriteApi.addLand(land!.id);
            }
            setIsFavorited(!isFavorited);
            message.success(isFavorited ? 'Đã bỏ yêu thích' : 'Đã thêm vào yêu thích');
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    if (loading) return <Loading />;
    if (!land) return null;

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
                <Col xs={24} md={14}>
                    {land.images && land.images.length > 0 ? (
                        <Carousel autoplay>
                            {land.images.map((img) => (
                                <div key={img.id}>
                                    <Image
                                        src={img.url}
                                        alt={land.title}
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

                <Col xs={24} md={10}>
                    <Title level={2}>{land.title}</Title>
                    <Title level={3} style={{ color: '#f5222d', marginTop: 0 }}>
                        {formatCurrency(land.price)}
                    </Title>

                    <div style={{ marginBottom: 16 }}>
                        <Tag color="blue">{formatArea(land.area)}</Tag>
                        {land.direction && <Tag color="green">{land.direction}</Tag>}
                        {land.category && <Tag color="purple">{land.category.name}</Tag>}
                        <Tag>{land.code}</Tag>
                    </div>

                    <Paragraph style={{ color: '#666', marginBottom: 24 }}>
                        📍 {getFullAddress(land)}
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
                                onClick={() => navigate(`/appointment?landId=${land.id}`)}
                            >
                                Đặt lịch hẹn
                            </Button>
                        </Col>
                    </Row>
                </Col>
            </Row>

            <div style={{ marginTop: 32 }}>
                <Title level={4}>Thông tin chi tiết</Title>
                <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
                    <Descriptions.Item label="Mã">{land.code}</Descriptions.Item>
                    <Descriptions.Item label="Diện tích">{formatArea(land.area)}</Descriptions.Item>
                    <Descriptions.Item label="Giá">{formatCurrency(land.price)}</Descriptions.Item>
                    <Descriptions.Item label="Hướng">{land.direction || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Mặt tiền">{land.frontWidth ? `${land.frontWidth}m` : 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Chiều dài">{land.landLength ? `${land.landLength}m` : 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Loại đất">{land.landType || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Pháp lý">{land.legalStatus || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Danh mục">{land.category?.name || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Ngày đăng">{formatDateTime(land.createdAt)}</Descriptions.Item>
                </Descriptions>
            </div>

            {land.description && (
                <div style={{ marginTop: 32 }}>
                    <Title level={4}>Mô tả</Title>
                    <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{land.description}</Paragraph>
                </div>
            )}

        </div>
    );
};

export default LandDetailPage;
