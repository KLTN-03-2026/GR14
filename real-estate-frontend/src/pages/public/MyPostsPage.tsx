import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, message, Spin, Empty, Popconfirm, Modal } from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    EyeOutlined,
    CrownOutlined,
} from '@ant-design/icons';
import { postApi, paymentApi } from '@/api';
import { Link, useNavigate } from 'react-router-dom';
import { POST_TYPE_LABELS } from '@/types/post';
import { useAuthStore } from '@/stores/authStore';

const MyPostsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [vipModalPost, setVipModalPost] = useState<any | null>(null);
    const [upgradingPostId, setUpgradingPostId] = useState<number | null>(null);
    const [upgradingAccount, setUpgradingAccount] = useState(false);
const [refreshKey, setRefreshKey] = useState(0);
  const fetchMyPosts = async () => {
  try {
    const res = await postApi.getMyPosts();
    setPosts(res.data);
  } catch {
    message.error('Không thể tải danh sách bài đăng');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchMyPosts();
}, [refreshKey]);

  useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      fetchMyPosts();   // Refresh khi quay lại tab
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);

    const handleDelete = async (id: number) => {
        try {
            await postApi.delete(id);
            message.success('Xóa bài đăng thành công');
            setPosts(prev => prev.filter((item: any) => item.id !== id));
        } catch {
            message.error('Xóa bài đăng thất bại');
        }
    };

    const handleUpgradePost = (record: any) => {
        setVipModalPost(null);
        navigate(`/vip-upgrade?postId=${record.id}&postTitle=${encodeURIComponent(record.title)}`);
    };

const handleUpgradeAccount = async () => {
  try {
    setUpgradingAccount(true);
    navigate('/vip-upgrade?type=account');
  } finally {
    setUpgradingAccount(false);
  }
};
    const vipCount = posts.filter((p: any) => p.isVip).length;

    const columns = [
        {
            title: 'Hình ảnh',
            dataIndex: 'images',
            key: 'images',
            width: 80,
            render: (images: any[]) => (
                <img
                    src={images?.[0]?.url || 'https://via.placeholder.com/100'}
                    className="w-16 h-12 object-cover rounded shadow-sm"
                    alt="thumbnail"
                />
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'postType',
            key: 'postType',
            width: 120,
            render: (postType: string) => (
                <Tag color="blue">
                    {POST_TYPE_LABELS[postType as keyof typeof POST_TYPE_LABELS] || postType}
                </Tag>
            ),
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            render: (text: string, record: any) => (
                <Link to={`/posts/${record.id}`} className="hover:underline font-semibold text-[#254b86]">
                    {text}
                </Link>
            ),
        },
        {
            title: 'Giá',
            dataIndex: 'price',
            key: 'price',
            width: 130,
            render: (price: number) =>
                price ? (
                    <span className="text-red-600 font-medium">{price.toLocaleString()} đ</span>
                ) : (
                    '—'
                ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (status: number) => {
                const statusConfig: Record<number, { color: string; label: string }> = {
                    1: { color: 'orange', label: 'Chờ duyệt' },
                    2: { color: 'green', label: 'Đã duyệt' },
                    3: { color: 'red', label: 'Từ chối' },
                };
                const config = statusConfig[status] || { color: 'default', label: 'Không xác định' };
                return <Tag color={config.color}>{config.label}</Tag>;
            },
        },
        {
            title: 'Loại bài',
            dataIndex: 'isVip',
            key: 'isVip',
            width: 100,
            render: (isVip: boolean) =>
                isVip ? (
                    <Tag icon={<CrownOutlined />} color="gold">
                        VIP
                    </Tag>
                ) : (
                    <Tag color="default">Thường</Tag>
                ),
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 160,
            render: (_: any, record: any) => (
                <div className="flex gap-1.5 flex-wrap">
                    <Link to={`/posts/${record.id}`}>
                        <Button icon={<EyeOutlined />} size="small" title="Xem bài" />
                    </Link>
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        className="text-blue-600"
                        title="Chỉnh sửa"
                        onClick={() => navigate(`/posts/${record.id}/edit`)}
                    />
                    {!record.isVip && (
                        <Button
                            icon={<CrownOutlined />}
                            size="small"
                            style={{ color: '#d48806', borderColor: '#d48806' }}
                            title="Nâng cấp bài này lên VIP"
                            onClick={() => setVipModalPost(record)}
                        />
                    )}
                    <Popconfirm title="Xóa bài đăng này?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small" title="Xóa" />
                    </Popconfirm>
                </div>
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-800">Bài viết của tôi</h1>
                        <div className="flex gap-3">
                            <Button
                                icon={<CrownOutlined />}
                                loading={upgradingAccount}
                                onClick={handleUpgradeAccount}
                                style={{ borderColor: '#d48806', color: '#d48806', height: 40 }}
                                className="px-4 font-semibold"
                            >
                                {user?.isVip ? 'Gia hạn VIP' : 'Nâng cấp tài khoản VIP'}
                            </Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                className="bg-[#254b86] h-10 px-6 font-semibold"
                                onClick={() => navigate('/posts/new')}
                            >
                                Đăng bài mới
                            </Button>
                        </div>
                    </div>

                    {/* VIP account banner */}
                    {user?.isVip ? (
                        <div className="mb-5 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 flex items-center gap-3">
                            <CrownOutlined style={{ color: '#d48806', fontSize: 18 }} />
                            <span className="text-sm text-yellow-800 font-medium">
                                Tài khoản VIP — tất cả {posts.length} bài đăng của bạn được ưu tiên hiển thị.
                            </span>
                        </div>
                    ) : vipCount > 0 ? (
                        <div className="mb-5 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <CrownOutlined style={{ color: '#d48806', fontSize: 18 }} />
                                <span className="text-sm text-yellow-800">
                                    Bạn có <strong>{vipCount}</strong> bài VIP.{' '}
                                    Nâng cấp tài khoản để toàn bộ bài đăng được hưởng VIP.
                                </span>
                            </div>
                           <Button
                            size="small"
                            icon={<CrownOutlined />}
                            style={{ borderColor: '#d48806', color: '#d48806' }}
                            onClick={() => navigate('/vip-upgrade?type=account')}   // ← Sửa ở đây
                            >
                            Nâng cấp ngay
                            </Button>
                        </div>
                    ) : (
                        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Nâng cấp từng bài hoặc toàn bộ tài khoản lên VIP để được ưu tiên hiển thị và tiếp cận nhiều khách hơn.
                        </div>
                    )}

                    {/* Table */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Spin size="large" />
                        </div>
                    ) : (
                        <Table
                            dataSource={posts}
                            columns={columns}
                            rowKey="id"
                            pagination={{ pageSize: 8 }}
                            className="border border-gray-50 rounded-lg overflow-hidden"
                            locale={{ emptyText: <Empty description="Bạn chưa có bài đăng nào" /> }}
                            rowClassName={(record: any) =>
                                record.isVip ? 'bg-yellow-50' : ''
                            }
                        />
                    )}
                </div>
            </main>

            <Modal
                open={!!vipModalPost}
                title={
                    <span className="flex items-center gap-2">
                        <CrownOutlined style={{ color: '#d48806' }} />
                        Nâng cấp bài viết lên VIP
                    </span>
                }
                onCancel={() => setVipModalPost(null)}
                footer={null}
                width={480}
            >
                {vipModalPost && (
                    <div className="pt-2">
                        <p className="text-gray-600 mb-4">
                            Bài viết:{' '}
                            <strong className="text-gray-800">
                                {vipModalPost.title}
                            </strong>
                        </p>

                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-6">
                            <p className="font-medium text-yellow-800 mb-2">
                                Lợi ích khi nâng VIP bài:
                            </p>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                <li>— Ưu tiên hiển thị trên trang tìm kiếm</li>
                                <li>— Xếp hạng cao hơn bài thường</li>
                                <li>— Tiếp cận nhiều khách hàng tiềm năng hơn</li>
                            </ul>
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-6">
                            <p className="text-sm text-blue-700">
                                Nếu bạn có nhiều bài viết, hãy cân nhắc{' '}
                                <button
                                    className="underline font-medium"
                                    onClick={() => {
                                        setVipModalPost(null);
                                        navigate(
                                            `/vip-upgrade?postId=${vipModalPost.id}&postTitle=${encodeURIComponent(
                                                vipModalPost.title
                                            )}`
                                        );
                                    }}
                                >
                                    nâng cấp tài khoản VIP
                                </button>{' '}
                                để tất cả bài đều được hưởng lợi với chi phí tiết kiệm hơn.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button onClick={() => setVipModalPost(null)}>
                                Để sau
                            </Button>

                            <Button
                                type="primary"
                                icon={<CrownOutlined />}
                                onClick={() => handleUpgradePost(vipModalPost)}
                                style={{ backgroundColor: '#d48806', borderColor: '#d48806' }}
                            >
                                Nâng cấp bài này
                            </Button>

                            <Button
                                icon={<CrownOutlined />}
                                onClick={() => {
                                    setVipModalPost(null);
                                    navigate(
                                        `/vip-upgrade?postId=${vipModalPost.id}&postTitle=${encodeURIComponent(
                                            vipModalPost.title
                                        )}`
                                    );
                                }}
                                style={{
                                    borderColor: '#254b86',
                                    color: '#254b86',
                                }}
                            >
                                Nâng cấp tài khoản
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MyPostsPage;