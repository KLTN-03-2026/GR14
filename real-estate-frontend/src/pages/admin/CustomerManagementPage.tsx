import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { customerApi } from '@/api';
import { formatDateTime, getApiErrorMessage } from '@/utils';
import type { Customer } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import { Button, Badge, Modal, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

type ApiError = {
    response?: {
        data?: {
            message?: string;
        };
    };
};

const CustomerManagementPage: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        fullName: '',
        phone: '',
        email: '',
        address: '',
    });

    const loadCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;

            const res = await customerApi.getAll(params);
            const data = res.data;

            setCustomers(data.data || data);
            setTotal(data.totalItems || 0);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Lỗi tải dữ liệu'));
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    const handleDelete = async (id: number) => {
        try {
            await customerApi.delete(id);

            toast.success('Đã khóa tài khoản');

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

        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Xóa thất bại'));
        }
    };

    const handleOpenModal = (item?: Customer) => {
        setEditingCustomer(item || null);

        if (item) {
            setFormData({
                username: item.user?.username || '',
                password: '',
                fullName: item.user?.fullName || '',
                phone: item.user?.phone || '',
                email: item.user?.email || '',
                address: item.user?.address || '',
            });
        } else {
            setFormData({ username: '', password: '', fullName: '', phone: '', email: '', address: '' });
        }

        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            if (!formData.fullName || !formData.phone || !formData.email) {
                toast.error('Vui lòng nhập đầy đủ các trường bắt buộc');
                return;
            }
            if (!editingCustomer && (!formData.username || !formData.password)) {
                toast.error('Vui lòng nhập username và password');
                return;
            }
            if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                toast.error('Email không đúng định dạng');
                return;
            }

            const values = {
                fullName: formData.fullName,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
            };

            if (!editingCustomer) {
                const createPayload = {
                    ...values,
                    username: formData.username,
                    password: formData.password,
                };
                const res = await customerApi.create(createPayload);
                const newCustomer = res.data.data;

                setCustomers(prev => [newCustomer, ...prev]);

                toast.success('Tạo mới thành công');
                setModalOpen(false);
                setFormData({ username: '', password: '', fullName: '', phone: '', email: '', address: '' });
                return;
            }

            if (editingCustomer) {
                await customerApi.update(editingCustomer.id, values);

                setCustomers(prev =>
                    prev.map(item =>
                        item.id === editingCustomer.id
                            ? ({
                                ...item,
                                user: {
                                    ...item.user,
                                    fullName: values.fullName,
                                    phone: values.phone,
                                    email: values.email,
                                    address: values.address,
                                },
                            } as Customer)
                            : item
                    )
                );

                toast.success('Cập nhật thành công');
            }


            setModalOpen(false);
            setFormData({ username: '', password: '', fullName: '', phone: '', email: '', address: '' });

        } catch (err: unknown) {
            const error = err as ApiError;
            toast.error(getApiErrorMessage(error, editingCustomer ? 'Cập nhật thất bại' : 'Tạo mới thất bại'));
        }
    };

    const columns: Column<Customer>[] = [
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
                    <Badge color={isActive ? 'success' : 'error'}>
                        {isActive ? 'Hoạt động' : 'Đã khóa'}
                    </Badge>
                );
            }
        },
        {
            title: 'Hành động',
            width: 150,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        iconOnly
                        ariaLabel="Sửa"
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        )}
                        onClick={() => handleOpenModal(record)}
                    >
                        Sửa
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        iconOnly
                        ariaLabel="Khóa"
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 20a7 7 0 0114 0" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6l4 4m0-4l-4 4" />
                            </svg>
                        )}
                        disabled={record.user?.status === 0}
                        onClick={() => {
                            if (window.confirm('Bạn có chắc muốn xóa?')) {
                                handleDelete(record.id);
                            }
                        }}
                    >
                        Khóa
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                    Quản lý khách hàng
                </h3>

                <Button variant="primary" iconOnly ariaLabel="Thêm mới" onClick={() => handleOpenModal()} startIcon={(
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                )}>
                    Thêm mới
                </Button>
            </div>

            <div className="relative mb-4 w-full min-w-0 sm:max-w-[400px]">
                <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                />
            </div>

            <DataTable
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
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
                        <Button variant="primary" onClick={handleSubmit}>{editingCustomer ? 'Cập nhật' : 'Tạo mới'}</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {!editingCustomer && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    value={formData.username}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    value={formData.password}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.fullName}
                            onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.address}
                            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomerManagementPage;