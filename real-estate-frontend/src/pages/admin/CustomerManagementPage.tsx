import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { customerApi, userApi } from '@/api';
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
  const [togglingVip, setTogglingVip] = useState<number | null>(null);

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

const handleToggleVip = async (userId: number, currentVipStatus: boolean) => {
  setTogglingVip(userId);
  try {
    const newVipStatus = !currentVipStatus;

    await customerApi.toggleVip(userId, newVipStatus);

    setCustomers((prev) =>
      prev.map((item) =>
        item.user?.id === userId
          ? {
              ...item,
              user: item.user
                ? { ...item.user, isVip: newVipStatus }
                : item.user,
            }
          : item
      )
    );

    toast.success(
      newVipStatus ? 'Nâng VIP thành công' : 'Hạ VIP thành công'
    );

    // 🔥 đảm bảo sync DB
    await loadCustomers();

  } catch (err) {
    toast.error(getApiErrorMessage(err, 'Cập nhật VIP thất bại'));
  } finally {
    setTogglingVip(null);
  }
};
  const handleLockAccount = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await customerApi.delete(deleteTarget.id);
      toast.success('Đã khóa tài khoản thành công');

      setCustomers((prev) =>
        prev.map((item) =>
          item.id === deleteTarget.id
            ? { ...item, user: item.user ? { ...item.user, status: 0 } : item.user }
            : item
        )
      );
      setDeleteTarget(null);
      loadCustomers();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Khóa tài khoản thất bại'));
    } finally {
      setDeleting(false);
    }
  };

  const handleUnlockAccount = async (customer: Customer) => {
    if (!customer.user?.id) return;
    try {
      await userApi.update(customer.user.id, { status: 1 });
      toast.success('Đã mở khóa tài khoản thành công');

      setCustomers((prev) =>
        prev.map((item) =>
          item.id === customer.id
            ? { ...item, user: item.user ? { ...item.user, status: 1 } : item.user }
            : item
        )
      );
      loadCustomers();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Mở khóa tài khoản thất bại'));
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
              ? ({ ...item, user: item.user ? { ...item.user, ...values } : item.user } as Customer)
              : item
          )
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
    width: 100,
    render: (_, record) => {
      const isVip = record.user?.isVip;
      return (
        <Badge
          className={isVip ? "bg-yellow-500 text-white" : "bg-gray-100"}
        >
          {isVip ? 'VIP' : 'Thường'}
        </Badge>
      );
    },
  },

  {
    title: 'Ngày tạo',
    key: 'createdAt',
    render: (_, record) => formatDateTime(record.createdAt),
  },

{
  title: 'Hành động',
  key: 'action',
  width: 200,
  render: (_, record) => {
    const isVip = !!record.user?.isVip;

    return (
      <div className="flex items-center gap-2">

        {/* ✏️ Sửa */}
        <Button
          size="sm"
          variant="outline"
          iconOnly
          ariaLabel="Sửa"
          startIcon={(
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
          onClick={() => handleOpenModal(record)}
        />

        {/* 👑 VIP */}
        <Button
          size="sm"
          variant={isVip ? "danger" : "primary"}
          loading={togglingVip === record.user?.id}
          onClick={() => {
            if (!record.user?.id) return;
            handleToggleVip(record.user.id, isVip);
          }}
          startIcon={(
        <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7l4 6 5-8 5 8 4-6-2 13H5L3 7z"
            />
            </svg>
          )}
        />

        {/* 🗑️ Khóa / Mở khóa */}
        {record.user?.status === 1 ? (
            <Button
              size="sm"
              variant="danger"
              iconOnly
              ariaLabel="Khóa"
              startIcon={(
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M5 20a7 7 0 0114 0" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M18 6l4 4m0-4l-4 4" />
                </svg>
              )}
              onClick={() => setDeleteTarget(record)}
            />
        ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50"
              iconOnly
              ariaLabel="Mở khóa"
              startIcon={(
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
              onClick={() => handleUnlockAccount(record)}
            />
        )}

      </div>
    );
  },
}
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

      {/* Modal Khóa tài khoản */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Xác nhận khóa tài khoản"
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Hủy
            </Button>
            <Button 
              variant="danger" 
              onClick={handleLockAccount} 
              disabled={deleting}
            >
              {deleting ? 'Đang khóa...' : 'Khóa tài khoản'}
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

      {/* Modal Thêm / Sửa */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
        footer={
          <>
            <Button variant="outline" onClick={handleCloseModal} disabled={submitting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Đang xử lý...' : (editingCustomer ? 'Cập nhật' : 'Tạo mới')}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {!editingCustomer && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                <input type="text" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" value={formData.username} onChange={(e) => setFormData(prev => ({...prev, username: e.target.value}))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
                <input type="password" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" value={formData.password} onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))} />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên <span className="text-red-500">*</span></label>
            <input type="text" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" value={formData.fullName} onChange={(e) => setFormData(prev => ({...prev, fullName: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
            <input type="text" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" value={formData.phone} onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input type="text" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm" value={formData.address} onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerManagementPage;