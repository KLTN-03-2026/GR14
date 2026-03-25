import { useEffect, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
    Table, Button, Space, Tag, Input, Popconfirm,
    message, Typography, Image, Form, Modal, Upload, Tabs
} from 'antd';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic/build/ckeditor';
import {
    EditOutlined, 
    DeleteOutlined, 
    SearchOutlined, 
    PlusOutlined,
    AppstoreOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { postApi } from '@/api';
import { formatCurrency, formatDateTime } from '@/utils';
import type { Post } from '@/types';
import { DEFAULT_PAGE_SIZE, POST_STATUS_LABELS } from '@/constants';

const { Title } = Typography;
const { TabPane } = Tabs;

const PostManagementPage: React.FC = () => {
    const [allPosts, setAllPosts] = useState<Post[]>([]);
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [fileList, setFileList] = useState<any[]>([]);
    const [form] = Form.useForm();

    // Load dữ liệu
    const loadPosts = async () => {
        setLoading(true);
        try {
            const res = await postApi.getAll();
            setAllPosts(res.data || []);
        } catch (err) {
            console.error("Load posts error:", err);
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, []);

    // Lọc và phân trang
    useEffect(() => {
        let result = [...allPosts];

        if (activeTab === "pending") result = result.filter(p => p.status === 1);
        else if (activeTab === "approved") result = result.filter(p => p.status === 2);
        else if (activeTab === "rejected") result = result.filter(p => p.status === 3);

        if (search.trim()) {
            const keyword = search.toLowerCase().trim();
            result = result.filter(p =>
                p.title?.toLowerCase().includes(keyword) ||
                p.address?.toLowerCase().includes(keyword)
            );
        }

        const start = (page - 1) * DEFAULT_PAGE_SIZE;
        setFilteredPosts(result.slice(start, start + DEFAULT_PAGE_SIZE));
    }, [allPosts, activeTab, search, page]);

    const openModal = (record?: Post) => {
        setEditingPost(record || null);
        form.resetFields();
        setFileList([]);

        if (record) {
            form.setFieldsValue(record);
            if (record.images?.length) {
                setFileList(record.images.map(img => ({
                    uid: img.id.toString(),
                    name: `image-${img.id}`,
                    status: 'done',
                    url: img.url,
                })));
            }
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const formData = new FormData();

            Object.keys(values).forEach(key => {
                if (key !== 'images' && values[key] !== undefined && values[key] !== null && values[key] !== '') {
                    formData.append(key, String(values[key]));
                }
            });

            fileList
                .filter(file => file.originFileObj)
                .forEach(file => formData.append("images", file.originFileObj!));

            if (editingPost) {
                await postApi.update(editingPost.id, formData);
                message.success("Cập nhật bài đăng thành công");
            } else {
                await postApi.create(formData);
                message.success("Thêm bài đăng thành công");
            }

            loadPosts();
            setModalOpen(false);
            setFileList([]);
        } catch (err: any) {
            if (err.errorFields) return;
            const errorMsg = err.response?.data?.message || "Có lỗi xảy ra";
            message.error(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await postApi.delete(id);
            message.success('Xóa thành công');
            loadPosts();
        } catch {
            message.error('Xóa thất bại');
        }
    };

    const handleStatusChange = async (id: number, status: number) => {
        try {
            if (status === 2) await postApi.approve(id);
            if (status === 3) await postApi.reject(id);
            message.success('Cập nhật trạng thái thành công');
            loadPosts();
        } catch {
            message.error('Thất bại');
        }
    };

    const columns: ColumnsType<Post> = [
        { title: 'Ảnh', width: 80, render: (_, r) => r.images?.length ? <Image src={r.images[0].url} width={60} height={50} /> : '—' },
        {
            title: 'Tiêu đề',
            width: 220,
            render: (_, r) => (
                <Space>
                    {r.title}
                    {r.isVip && <Tag color="gold">VIP</Tag>}
                </Space>
            )
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
            width: 550,                    // Tăng rộng hơn nữa
            render: (text: string) => !text ? '—' : (
                <div 
                    dangerouslySetInnerHTML={{ __html: text }}
                    style={{
                        lineHeight: '1.6',
                        fontSize: '13.5px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                    }}
                />
            )
        },
        { title: 'Địa chỉ', dataIndex: 'address', width: 280 },
        { title: 'Giá', width: 160, render: (_, r) => formatCurrency(r.price) },
        { title: 'Ngày đăng', width: 150, render: (_, r) => formatDateTime(r.postedAt) },
        {
            title: 'Trạng thái',
            width: 120,
            render: (_, r) => (
                <Tag color={r.status === 1 ? 'orange' : r.status === 2 ? 'green' : 'red'}>
                    {POST_STATUS_LABELS[r.status]}
                </Tag>
            )
        },
        {
            title: 'Hành động',
            width: 240,
            render: (_, r) => (
                <Space size="middle">
                    {r.status === 1 && (
                        <>
                            <Button type="primary" onClick={() => handleStatusChange(r.id, 2)}>Duyệt</Button>
                            <Button danger onClick={() => handleStatusChange(r.id, 3)}>Từ chối</Button>
                        </>
                    )}
                    <Button icon={<EditOutlined />} onClick={() => openModal(r)}>Sửa</Button>
                    <Popconfirm title="Bạn có chắc muốn xóa bài đăng này?" onConfirm={() => handleDelete(r.id)}>
                        <Button danger icon={<DeleteOutlined />}>Xóa</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={3}>Quản lý bài đăng</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                    Thêm bài đăng
                </Button>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={(key) => { 
                    setActiveTab(key as any); 
                    setPage(1); 
                }}
                style={{ marginBottom: 16 }}
                tabBarStyle={{ marginBottom: 0 }}
            >
                <TabPane 
                    tab={
                        <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AppstoreOutlined style={{ fontSize: '18px' }} /> 
                            Tất cả ({allPosts.length})
                        </span>
                    } 
                    key="all" 
                />
                
                <TabPane 
                    tab={
                        <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ClockCircleOutlined style={{ fontSize: '18px', color: '#faad14' }} /> 
                            Chờ duyệt ({allPosts.filter(p => p.status === 1).length})
                        </span>
                    } 
                    key="pending" 
                />
                
                <TabPane 
                    tab={
                        <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircleOutlined style={{ fontSize: '18px', color: '#52c41a' }} /> 
                            Đã duyệt ({allPosts.filter(p => p.status === 2).length})
                        </span>
                    } 
                    key="approved" 
                />
                
                <TabPane 
                    tab={
                        <span style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CloseCircleOutlined style={{ fontSize: '18px', color: '#f5222d' }} /> 
                            Đã từ chối ({allPosts.filter(p => p.status === 3).length})
                        </span>
                    } 
                    key="rejected" 
                />
            </Tabs>

            <Input
                placeholder="Tìm kiếm theo tiêu đề hoặc địa chỉ..."
                prefix={<SearchOutlined />}
                style={{ marginBottom: 16, maxWidth: 400 }}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                allowClear
            />

            <Table
                rowKey="id"
                columns={columns}
                dataSource={filteredPosts}
                loading={loading}
                scroll={{ x: 'max-content' }}
                style={{ width: '100%' }}               
                pagination={{
                    current: page,
                    total: allPosts.filter(p => {
                        if (activeTab === "pending") return p.status === 1;
                        if (activeTab === "approved") return p.status === 2;
                        if (activeTab === "rejected") return p.status === 3;
                        return true;
                    }).length,
                    pageSize: DEFAULT_PAGE_SIZE,
                    onChange: setPage,
                }}
            />

            <Modal
                title={editingPost ? "Sửa bài đăng" : "Thêm bài đăng"}
                open={modalOpen}
                onOk={handleSubmit}
                onCancel={() => setModalOpen(false)}
                width={850}
                okText="Lưu"
                cancelText="Hủy"
            >
                <Form layout="vertical" form={form}>
                    <Form.Item name="title" label="Tiêu đề" rules={[{ required: true }]}>
                        <Input placeholder="Nhập tiêu đề bài đăng" />
                    </Form.Item>

                    <Form.Item name="city" label="Tỉnh"><Input /></Form.Item>
                    <Form.Item name="district" label="Quận"><Input /></Form.Item>
                    <Form.Item name="ward" label="Phường"><Input /></Form.Item>
                    <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
                    <Form.Item name="price" label="Giá"><Input type="number" /></Form.Item>
                    <Form.Item name="area" label="Diện tích"><Input type="number" /></Form.Item>
                    <Form.Item name="direction" label="Hướng"><Input /></Form.Item>

                    <Form.Item 
                        name="description" 
                        label="Mô tả" 
                        rules={[{ required: true, message: 'Vui lòng nhập mô tả' }]}
                    >
                        <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', overflow: 'hidden' }}>
                            <style>{`
                                .ck-editor__editable_inline:not(.ck-comment__input *) {
                                    min-height: 200px !important;
                                }
                            `}</style>
                            <CKEditor
                                editor={ClassicEditor as any}
                                data={form.getFieldValue('description') || ''}
                                onChange={(_, editor) => form.setFieldsValue({ description: editor.getData() || '' })}
                                onReady={(editor) => {
                                    setTimeout(() => {
                                        if (editor?.ui?.view?.editable?.element) {
                                            editor.ui.view.editable.element.style.minHeight = '420px';
                                        }
                                    }, 300);
                                }}
                                config={{
                                    licenseKey: 'GPL',
                                    placeholder: 'Nhập mô tả chi tiết về bất động sản...',
                                    toolbar: [
                                        'sourceEditing', '|', 'heading', '|',
                                        'bold', 'italic', '|', 'link', '|',
                                        'bulletedList', 'numberedList', '|',
                                        'blockQuote', '|', 'undo', 'redo'
                                    ]
                                }}
                            />
                        </div>
                    </Form.Item>

                    <Form.Item label="Ảnh">
    <Upload
        multiple
        listType="picture-card"           // Đổi sang picture-card để đẹp hơn
        fileList={fileList}
        onChange={({ fileList: newFileList }) => setFileList(newFileList)}
        onRemove={async (file) => {
            // Nếu là ảnh cũ (có url) và đang sửa bài
            if (file.url && editingPost) {
                // Bạn có thể gọi API xóa ảnh nếu backend hỗ trợ
                // Hiện tại chỉ xóa khỏi danh sách hiển thị
                console.log("Xóa ảnh cũ:", file.url);
            }
            return true; // Cho phép xóa
        }}
        beforeUpload={() => false}        // Không tự upload lên server ngay
    >
        <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>Thêm ảnh</div>
        </div>
    </Upload>
    
    <div style={{ marginTop: 8, color: '#999', fontSize: '12px' }}>
        • Có thể chọn nhiều ảnh<br />
        • Khi sửa: ảnh cũ sẽ hiển thị, bạn có thể xóa ảnh cũ hoặc thêm ảnh mới
    </div>
</Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PostManagementPage;