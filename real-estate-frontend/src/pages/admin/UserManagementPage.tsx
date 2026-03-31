import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { userApi } from '@/api';
import { formatDateTime, getApiErrorMessage } from '@/utils';
import type { User } from '@/types';
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

const UserManagementPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        fullName: '',
        email: '',
        phone: '',
    });

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;
            const res = await userApi.getAll(params);
            const data = res.data;
            setUsers(data.data || data);
            setTotal(data.totalItems || 0);
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Lỗi tải dữ liệu'));
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await userApi.delete(deleteTarget.id);
            toast.success('Đã khóa tài khoản');
            setDeleteTarget(null);
            loadUsers();
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Khóa tài khoản thất bại'));
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenModal = (user?: User) => {
        setEditingUser(user || null);
        if (user) {
            setFormData({
                username: user.username || '',
                password: '',
                fullName: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
            });
        } else {
            setFormData({ username: '', password: '', fullName: '', email: '', phone: '' });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            if (!formData.username || !formData.fullName || !formData.email || !formData.phone) {
                toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc');
                return;
            }
            if (!editingUser && !formData.password) {
                toast.error('Vui lòng nhập mật khẩu');
                return;
            }
            if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                toast.error('Email không đúng định dạng');
                return;
            }

            const values: Record<string, unknown> = {
                username: formData.username,
                fullName: formData.fullName,
                email: formData.email,
                phone: formData.phone,
            };
            if (!editingUser) values.password = formData.password;

            if (editingUser) {
                await userApi.update(editingUser.id, values);
                toast.success('Cập nhật thành công');
            } else {
                await userApi.create(values);
                toast.success('Tạo mới thành công');
            }
            setModalOpen(false);
            loadUsers();
        } catch (err: unknown) {
            const error = err as ApiError;
            toast.error(getApiErrorMessage(error, editingUser ? 'Cập nhật thất bại' : 'Tạo mới thất bại'));
        }
    };

    const columns: Column<User>[] = [
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
                    <Badge key={ur.id} color="info" className="mr-1">{ur.role?.name || ur.roleId}</Badge>
                )) || '—',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => (
                <Badge color={status === 1 ? 'success' : 'error'}>{status === 1 ? 'Hoạt động' : 'Khóa'}</Badge>
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
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" iconOnly ariaLabel="Sửa" onClick={() => handleOpenModal(record)} startIcon={(
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    )}>Sửa</Button>
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
                        disabled={record.status === 0}
                        onClick={() => {
                            setDeleteTarget(record);
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
                <h3 className="text-xl font-semibold text-gray-900">Quản lý người dùng</h3>
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
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            <DataTable
                columns={columns}
                dataSource={users}
                rowKey="id"
                loading={loading}
                pagination={{ current: page, total, pageSize: DEFAULT_PAGE_SIZE, onChange: setPage, showTotal: (t) => `Tổng ${t} bản ghi` }}
            />

            <Modal
                isOpen={!!deleteTarget}
                onClose={() => {
                    if (!deleting) setDeleteTarget(null);
                }}
                title="Xác nhận khóa tài khoản"
                width="max-w-md"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</Button>
                        <Button variant="danger" onClick={handleDelete} loading={deleting}>Khóa tài khoản</Button>
                    </>
                )}
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn khóa tài khoản
                    {' '}
                    <span className="font-semibold text-gray-900">{deleteTarget?.fullName || deleteTarget?.username}</span>
                    ?
                </p>
            </Modal>

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Hủy</Button>
                        <Button variant="primary" onClick={handleSubmit}>{editingUser ? 'Cập nhật' : 'Tạo mới'}</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            disabled={!!editingUser}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100"
                            value={formData.username}
                            onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                        />
                    </div>
                    {!editingUser && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                            <input
                                type="password"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                value={formData.password}
                                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                            />
                        </div>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserManagementPage;
