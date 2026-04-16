import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { propertyCategoryApi } from '@/api';
import type { PropertyCategory } from '@/types';
import { Button, Modal, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

type CategoryTypeFilter = 'all' | 'HOUSE' | 'LAND';

const CategoryManagementPage: React.FC = () => {
    const [categories, setCategories] = useState<PropertyCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<PropertyCategory | null>(null);
    const [formData, setFormData] = useState({ code: '', name: '', categoryType: 'HOUSE' as 'HOUSE' | 'LAND' });
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<CategoryTypeFilter>('all');
    const [deleteTarget, setDeleteTarget] = useState<PropertyCategory | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const res = await propertyCategoryApi.getAll();
            setCategories(res.data.data || res.data);
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
            await propertyCategoryApi.delete(deleteTarget.id);
            toast.success('Xóa thành công');
            setDeleteTarget(null);
            loadCategories();
        } catch {
            toast.error('Xóa thất bại');
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenModal = (cat?: PropertyCategory) => {
        setEditingCategory(cat || null);
        if (cat) {
            setFormData({
                code: cat.code || '',
                name: cat.name || '',
                categoryType: cat.categoryType,
            });
        } else {
            setFormData({ code: '', name: '', categoryType: 'HOUSE' });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.code || !formData.name || !formData.categoryType) return;
        try {
            const values = { ...formData };
            if (editingCategory) {
                await propertyCategoryApi.update(editingCategory.id, values);
                toast.success('Cập nhật thành công');
            } else {
                await propertyCategoryApi.create(values);
                toast.success('Tạo mới thành công');
            }
            setModalOpen(false);
            loadCategories();
        } catch {
            // validation
        }
    };

    const columns: Column<PropertyCategory>[] = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
        { title: 'Mã', dataIndex: 'code', key: 'code' },
        { title: 'Tên danh mục', dataIndex: 'name', key: 'name' },
        {
            title: 'Loại',
            key: 'categoryType',
            width: 110,
            render: (_, record) => (record.categoryType === 'HOUSE' ? 'Nhà' : 'Đất'),
        },
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

    const filteredCategories = useMemo(() => {
        let source = categories;

        if (categoryFilter === 'HOUSE' || categoryFilter === 'LAND') {
            source = source.filter((item) => item.categoryType === categoryFilter);
        }

        const keyword = search.trim().toLowerCase();
        if (!keyword) return source;
        return source.filter((item) => {
            const code = item.code?.toLowerCase() || '';
            const name = item.name?.toLowerCase() || '';
            return code.includes(keyword) || name.includes(keyword);
        });
    }, [categories, categoryFilter, search]);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Danh mục bất động sản</h3>
                <Button variant="primary" iconOnly ariaLabel="Thêm mới" onClick={() => handleOpenModal()} startIcon={(
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                )}>
                    Thêm mới
                </Button>
            </div>

            <div className="mb-6 space-y-3">
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${categoryFilter === 'all'
                            ? 'bg-brand-500 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Tất cả ({categories.length})
                    </button>
                    <button
                        onClick={() => setCategoryFilter('HOUSE')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${categoryFilter === 'HOUSE'
                            ? 'bg-brand-500 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Nhà ({categories.filter((item) => item.categoryType === 'HOUSE').length})
                    </button>
                    <button
                        onClick={() => setCategoryFilter('LAND')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${categoryFilter === 'LAND'
                            ? 'bg-brand-500 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Đất ({categories.filter((item) => item.categoryType === 'LAND').length})
                    </button>
                </div>
                <div className="w-full min-w-0 sm:max-w-[400px]">
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <DataTable columns={columns} dataSource={filteredCategories} rowKey="id" loading={loading} pagination={false} />

            <Modal
                isOpen={!!deleteTarget}
                onClose={() => {
                    if (!deleting) setDeleteTarget(null);
                }}
                title="Xác nhận xóa danh mục"
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
                    Bạn có chắc muốn xóa danh mục
                    {' '}
                    <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>
                    ?
                </p>
            </Modal>

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Hủy
                        </Button>
                        <Button variant="primary" onClick={handleSubmit}>
                            {editingCategory ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã danh mục <span className="text-error-500">*</span></label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            disabled={!!editingCategory}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên danh mục <span className="text-error-500">*</span></label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Loại danh mục <span className="text-error-500">*</span></label>
                        <select
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                            value={formData.categoryType}
                            onChange={(e) => setFormData({ ...formData, categoryType: e.target.value as 'HOUSE' | 'LAND' })}
                        >
                            <option value="HOUSE">Nhà</option>
                            <option value="LAND">Đất</option>
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CategoryManagementPage;
