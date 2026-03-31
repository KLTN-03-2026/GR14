import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { roleApi } from '@/api';
import type { Role } from '@/types';
import { Button, Modal, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

const RoleManagementPage: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [formData, setFormData] = useState({ code: '', name: '', description: '' });
    const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const res = await roleApi.getAll();
            setRoles(res.data.data || res.data);
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await roleApi.delete(deleteTarget.id);
            toast.success('Xóa thành công');
            setDeleteTarget(null);
            loadRoles();
        } catch {
            toast.error('Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenModal = (role?: Role) => {
        setEditingRole(role || null);
        if (role) {
            setFormData({ code: role.code || '', name: role.name || '', description: role.description || '' });
        } else {
            setFormData({ code: '', name: '', description: '' });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.code || !formData.name) return;
        try {
            const values = { ...formData };
            if (editingRole) {
                await roleApi.update(editingRole.id, values);
                toast.success('Cập nhật thành công');
            } else {
                await roleApi.create(values);
                toast.success('Tạo mới thành công');
            }
            setModalOpen(false);
            loadRoles();
        } catch {
            // validation
        }
    };

    const columns: Column<Role>[] = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
        { title: 'Mã', dataIndex: 'code', key: 'code' },
        { title: 'Tên', dataIndex: 'name', key: 'name' },
        { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true },
        {
            title: 'Hành động',
            key: 'action',
            width: 150,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" iconOnly ariaLabel="Sửa" startIcon={(
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    )} onClick={() => handleOpenModal(record)}>
                        Sửa
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        iconOnly
                        ariaLabel="Xóa"
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        )}
                        onClick={() => {
                            setDeleteTarget(record);
                        }}
                    >
                        Xóa
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Quản lý vai trò</h3>
                <Button variant="primary" iconOnly ariaLabel="Thêm mới" onClick={() => handleOpenModal()} startIcon={(
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                )}>
                    Thêm mới
                </Button>
            </div>

            <DataTable columns={columns} dataSource={roles} rowKey="id" loading={loading} pagination={false} />

            <Modal
                isOpen={!!deleteTarget}
                onClose={() => {
                    if (!deleting) setDeleteTarget(null);
                }}
                title="Xác nhận xóa vai trò"
                width="max-w-md"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                            Hủy
                        </Button>
                        <Button variant="danger" onClick={handleDelete} loading={deleting}>
                            Xóa
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-gray-700">
                    Bạn có chắc muốn xóa vai trò
                    {' '}
                    <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>
                    ?
                </p>
            </Modal>

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingRole ? 'Chỉnh sửa vai trò' : 'Thêm vai trò mới'}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Hủy
                        </Button>
                        <Button variant="primary" onClick={handleSubmit}>
                            {editingRole ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã vai trò <span className="text-error-500">*</span></label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            disabled={!!editingRole}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên vai trò <span className="text-error-500">*</span></label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                        <textarea
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default RoleManagementPage;
