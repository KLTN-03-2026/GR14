import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, message, Spin, Empty, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { postApi } from '@/api';
import { Link, useNavigate } from 'react-router-dom';
import { POST_TYPE_LABELS } from '@/types/post';

const MyPostsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState([]);

    const fetchMyPosts = async () => {
        try {
            const res = await postApi.getMyPosts();
            setPosts(res.data);
        } catch (error) {
            message.error('Không thể tải danh sách bài đăng');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyPosts();
    }, []);

    const handleDelete = async (id: number) => {
        try {
            await postApi.delete(id);
            message.success('Xóa bài đăng thành công');
            setPosts(prev => prev.filter((item: any) => item.id !== id));
        } catch (error) {
            message.error('Xóa bài đăng thất bại');
        }
    };

    const columns = [
        {
            title: 'Hình ảnh',
            dataIndex: 'images',
            key: 'images',
            render: (images: any[]) => (
                <img src={images?.[0]?.url || 'https://via.placeholder.com/100'} className="w-16 h-12 object-cover rounded shadow-sm" />
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'postType',
            key: 'postType',
            render: (postType: string) => (
                <Tag color="blue">{POST_TYPE_LABELS[postType as keyof typeof POST_TYPE_LABELS] || postType}</Tag>
            ),
        },
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            className: 'font-semibold text-[#254b86]',
            render: (text: string, record: any) => <Link to={`/posts/${record.id}`} className="hover:underline">{text}</Link>
        },
        {
            title: 'Giá',
            dataIndex: 'price',
            key: 'price',
            render: (price: number) => price ? <span className="text-red-600 font-medium">{price?.toLocaleString()} đ</span> : '—'
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
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
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <div className="flex gap-2">
                    <Link to={`/posts/${record.id}`}><Button icon={<EyeOutlined />} size="small" /></Link>
                    <Button
                        icon={<EditOutlined />}
                        size="small"
                        className="text-blue-600"
                        onClick={() => navigate(`/posts/${record.id}/edit`)}
                    />
                    <Popconfirm title="Xóa bài đăng này?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </div>
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-800">Bài viết của tôi</h1>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            className="bg-[#254b86] h-10 px-6 font-semibold"
                            onClick={() => navigate('/posts/new')}
                        >
                            Đăng bài mới
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Spin size="large" /></div>
                    ) : (
                        <Table
                            dataSource={posts}
                            columns={columns}
                            rowKey="id"
                            pagination={{ pageSize: 8 }}
                            className="border border-gray-50 rounded-lg overflow-hidden"
                            locale={{ emptyText: <Empty description="Bạn chưa có bài đăng nào" /> }}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default MyPostsPage;