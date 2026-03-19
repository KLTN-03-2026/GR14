import { useEffect, useState } from 'react';
import {
    Table, Button, Space, Input, Popconfirm,
    message, Typography, Modal, Form
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { customerApi } from '@/api';
import { formatDateTime } from '@/utils';
import type { Customer } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import { Tag } from 'antd';
const { Title } = Typography;

const CustomerManagementPage: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        loadCustomers(); // ✅ chỉ gọi cái này
    }, [page, search]);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;

            const res = await customerApi.getAll(params);
            const data = res.data;

            setCustomers(data.data || data);
            setTotal(data.totalItems || 0);
        } catch {
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
    try {
        await customerApi.delete(id);

        message.success('Đã khóa tài khoản');

        setCustomers(prev =>
            prev.map(item =>
                item.id === id
                    ? {
                        ...item,
                        user: item.user
                            ? {
                                ...item.user,
                                status: 0
                            }
                            : item.user
                    }
                    : item
            )
        );

    } catch {
        message.error('Xóa thất bại');
    }
};

    const handleOpenModal = (item?: Customer) => {
        setEditingCustomer(item || null);
        form.resetFields();

        if (item) {
            form.setFieldsValue({
                fullName: item.user?.fullName,
                phone: item.user?.phone,
                email: item.user?.email,
                address: item.user?.address,
            });
        }

        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (editingCustomer) {
                await customerApi.update(editingCustomer.id, values);

                setCustomers(prev =>
                    prev.map(item =>
                        item.id === editingCustomer.id
                            ? {
                                ...item,
                                user: {
                                    ...item.user,
                                    ...values,
                                },
                            }
                            : item
                    )
                );

                message.success('Cập nhật thành công');

            } else {
                const res = await customerApi.create(values);
                const newCustomer = res.data.data;

                setCustomers(prev => [newCustomer, ...prev]);

                message.success('Tạo mới thành công');
            }


            setModalOpen(false);
            form.resetFields();

        } catch (err: any) {
            message.error(err?.response?.data?.message || 'Thất bại');
        }
    };

    const columns: ColumnsType<Customer> = [
        { title: 'Mã KH', dataIndex: 'code', key: 'code' },
        { title: 'Họ tên', render: (_, r) => r.user?.fullName || '—' },
        { title: 'Email', render: (_, r) => r.user?.email || '—' },
        { title: 'SĐT', render: (_, r) => r.user?.phone || '—' },
        {
            title: 'Ngày tạo',
            dataIndex: 'createdAt',
            render: (d: string) => formatDateTime(d),
        },
        {
            title: 'Trạng thái',
            render: (_, record) => {
                const isActive = record.user?.status === 1;

                return (
                    <Tag color={isActive ? 'green' : 'red'}>
                        {isActive ? 'Hoạt động' : 'Đã khóa'}
                    </Tag>
                );
            }
        },
        {
            title: 'Hành động',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        size="small"
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenModal(record)}
                    />
                    <Popconfirm
                        title="Bạn có chắc muốn xóa?"
                        onConfirm={() => handleDelete(record.id)}
                    >
                       <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={record.user?.status === 0}
                    />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0 }}>
                    Quản lý khách hàng
                </Title>

                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                    Thêm mới
                </Button>
            </div>

            <Input
                placeholder="Tìm kiếm..."
                prefix={<SearchOutlined />}
                style={{ marginBottom: 16, maxWidth: 400 }}
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                }}
                allowClear
            />

            <Table
                columns={columns}
                dataSource={customers}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    total,
                    pageSize: DEFAULT_PAGE_SIZE,
                    onChange: setPage,
                    showTotal: (t) => `Tổng ${t} bản ghi`,
                }}
            />

            <Modal
                title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
                open={modalOpen}
                onOk={handleSubmit}
                onCancel={() => setModalOpen(false)}
            >
                <Form form={form} layout="vertical">
                    {!editingCustomer && (
                        <>
                            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                                <Input.Password />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item name="fullName" label="Họ tên">
                        <Input />
                    </Form.Item>

                    <Form.Item name="phone" label="SĐT">
                        <Input />
                    </Form.Item>

                    <Form.Item name="email" label="Email">
                        <Input />
                    </Form.Item>

                    <Form.Item name="address" label="Địa chỉ">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CustomerManagementPage;