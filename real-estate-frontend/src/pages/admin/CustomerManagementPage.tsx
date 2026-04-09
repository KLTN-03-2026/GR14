import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { customerApi } from '@/api';
import { formatDateTime, getApiErrorMessage } from '@/utils';
import type { Customer } from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/constants';
import { Button, Badge, Modal, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

const CustomerManagementPage: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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
            if (search.trim()) params.search = search.trim();

            const res = await customerApi.getAll(params);
            const data = res.data;
            const customerList = data.data || data;
            const totalCount = data.totalItems || data.total || 0;

            setCustomers(Array.isArray(customerList) ? customerList : []);
            setTotal(totalCount);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Lỗi tải danh sách khách hàng'));
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    const handleLockAccount = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await customerApi.delete(deleteTarget.id);

            toast.success('Đã khóa tài khoản thành công');

            setCustomers((prev) =>
                prev.map((item) =>
                    item.id === deleteTarget.id
                        ? {
                              ...item,
                              user: item.user ? { ...item.user, status: 0 } : item.user,
                          }
                        : item,
                ),
            );
            setDeleteTarget(null);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Khóa tài khoản thất bại'));
        } finally {
            setDeleting(false);
        }
    };

    const handleToggleVip = async (customerId: number, currentVipStatus: boolean) => {
        try {
            const newVipStatus = !currentVipStatus;
            const res = await customerApi.update(customerId, { isVip: newVipStatus });

            const updatedCustomer = res.data?.data;

            setCustomers((prev) =>
                prev.map((item) =>
                    item.id === customerId
                        ? updatedCustomer || {
                              ...item,
                              user: item.user ? { ...item.user, isVip: newVipStatus } : item.user,
                          }
                        : item,
                ),
            );

            toast.success(newVipStatus ? 'Nâng cấp VIP thành công' : 'Hạ cấp VIP thành công');
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Cập nhật VIP thất bại'));
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

    const resetForm = () => {
        setFormData({ username: '', password: '', fullName: '', phone: '', email: '', address: '' });
        setEditingCustomer(null);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const handleSubmit = async () => {
        if (!formData.fullName || !formData.phone || !formData.email) {
            toast.error('Vui lòng nhập đầy đủ Họ tên, SĐT và Email');
            return;
        }
        if (!editingCustomer && (!formData.username || !formData.password)) {
            toast.error('Vui lòng nhập Username và Password khi tạo mới');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            toast.error('Email không đúng định dạng');
            return;
        }

        setSubmitting(true);
        try {
            const values = {
                fullName: formData.fullName,
                phone: formData.phone,
                email: formData.email,
                address: formData.address || undefined,
            };

            if (!editingCustomer) {
                const createPayload = { ...values, username: formData.username, password: formData.password };
                const res = await customerApi.create(createPayload);
                const newCustomer = res.data.data || res.data;

                setCustomers((prev) => [newCustomer, ...prev]);
                toast.success('Tạo khách hàng mới thành công');
            } else {
                await customerApi.update(editingCustomer.id, values);

                setCustomers((prev) =>
                    prev.map((item) =>
                        item.id === editingCustomer.id
                            ? ({
                                  ...item,
                                  user: item.user ? { ...item.user, ...values } : item.user,
                              } as Customer)
                            : item,
                    ),
                );
                toast.success('Cập nhật thông tin thành công');
            }

            handleCloseModal();
        } catch (err) {
            toast.error(getApiErrorMessage(err, editingCustomer ? 'Cập nhật thất bại' : 'Tạo mới thất bại'));
        } finally {
            setSubmitting(false);
        }
    };

    const columns: Column<Customer>[] = [
        { title: 'Mã KH', dataIndex: 'code', key: 'code', width: 100 },
        {
            title: 'Họ tên',
            key: 'fullName',
            render: (_, record) => record.user?.fullName || '—',
        },
        {
            title: 'SĐT',
            key: 'phone',
            render: (_, record) => record.user?.phone || '—',
        },
        {
            title: 'Email',
            key: 'email',
            ellipsis: true,
            render: (_, record) => record.user?.email || '—',
        },
        {
            title: 'VIP',
            key: 'vip',
            width: 80,
            render: (_, record) => (
                <Badge color={record.user?.isVip ? 'warning' : 'light'}>
                    {record.user?.isVip ? 'VIP' : '—'}
                </Badge>
            ),
        },
        {
            title: 'Ngày tạo',
            key: 'createdAt',
            render: (_, record) => formatDateTime(record.createdAt),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 220,
            render: (_, record) => (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenModal(record)}>
                        Sửa
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleVip(record.id, !!record.user?.isVip)}>
                        {record.user?.isVip ? 'Hạ VIP' : 'Nâng VIP'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(record)}>
                        Khóa
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Quản lý khách hàng</h3>
                <Button variant="primary" onClick={() => handleOpenModal()}>
                    Thêm khách hàng
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
                isOpen={!!deleteTarget}
                onClose={() => {
                    if (!deleting) setDeleteTarget(null);
                }}
                title="Xác nhận khóa tài khoản"
                width="max-w-md"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                            Hủy
                        </Button>
                        <Button variant="danger" onClick={handleLockAccount} loading={deleting}>
                            Khóa tài khoản
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn khóa tài khoản khách hàng{' '}
                    <span className="font-semibold text-gray-900">
                        {deleteTarget?.user?.fullName || deleteTarget?.code}
                    </span>
                    ?
                </p>
            </Modal>

            <Modal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
                footer={
                    <>
                        <Button variant="outline" onClick={handleCloseModal} disabled={submitting}>
                            Hủy
                        </Button>
                        <Button variant="primary" onClick={handleSubmit} loading={submitting}>
                            {editingCustomer ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    {!editingCustomer && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    value={formData.username}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mật khẩu <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    value={formData.password}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Họ tên <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.fullName}
                            onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Số điện thoại <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
