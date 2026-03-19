import { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Input, Popconfirm, message, Typography, Modal, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userApi } from '@/api';
import { formatDateTime, getApiErrorMessage } from '@/utils';
import type { User } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';

const { Title } = Typography;

const UserManagementPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadUsers();
    }, [page, search]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;
            const res = await userApi.getAll(params);
            const data = res.data;
            setUsers(data.data || data);
            setTotal(data.totalItems || 0);
        } catch (err) {
            message.error(getApiErrorMessage(err, 'Lỗi tải dữ liệu'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await userApi.delete(id);
            message.success('Đã khóa tài khoản');
            loadUsers();
        } catch (err) {
            message.error(getApiErrorMessage(err, 'Khóa tài khoản thất bại'));
        }
    };

    const handleOpenModal = (user?: User) => {
        setEditingUser(user || null);
        if (user) {
            form.setFieldsValue(user);
        } else {
            form.resetFields();
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingUser) {
                await userApi.update(editingUser.id, values);
                message.success('Cập nhật thành công');
            } else {
                await userApi.create(values);
                message.success('Tạo mới thành công');
            }
            setModalOpen(false);
            loadUsers();
        } catch (err: any) {
            if (err?.errorFields) return;
            message.error(getApiErrorMessage(err, editingUser ? 'Cập nhật thất bại' : 'Tạo mới thất bại'));
        }
    };

    const columns: ColumnsType<User> = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
        { title: 'Username', dataIndex: 'username', key: 'username' },
        { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
        { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
        { title: 'SĐT', dataIndex: 'phone', key: 'phone' },
        {
            title: 'Vai trò',
            key: 'roles',
            render: (_, record) =>
                record.userRoles?.map((ur) => (
                    <Tag key={ur.id} color="blue">{ur.role?.name || ur.roleId}</Tag>
                )) || '—',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => (
                <Tag color={status === 1 ? 'green' : 'red'}>{status === 1 ? 'Hoạt động' : 'Khóa'}</Tag>
            ),
        },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => formatDateTime(date),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
                    <Popconfirm title="Bạn có chắc muốn khóa tài khoản này?" onConfirm={() => handleDelete(record.id)} disabled={record.status === 0}>
                        <Button size="small" danger icon={<DeleteOutlined />} disabled={record.status === 0} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0 }}>Quản lý người dùng</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                    Thêm mới
                </Button>
            </div>

            <Input
                placeholder="Tìm kiếm..."
                prefix={<SearchOutlined />}
                style={{ marginBottom: 16, maxWidth: 400 }}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                allowClear
            />

            <Table
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{ current: page, total, pageSize: DEFAULT_PAGE_SIZE, onChange: setPage, showTotal: (t) => `Tổng ${t} bản ghi` }}
            />

            <Modal
                title={editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
                open={modalOpen}
                onOk={handleSubmit}
                onCancel={() => setModalOpen(false)}
                okText={editingUser ? 'Cập nhật' : 'Tạo mới'}
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}>
                        <Input disabled={!!editingUser} />
                    </Form.Item>
                    {!editingUser && (
                        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}>
                            <Input.Password />
                        </Form.Item>
                    )}
                    <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Vui lòng nhập email' },
                            { type: 'email', message: 'Email không đúng định dạng' },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagementPage;
