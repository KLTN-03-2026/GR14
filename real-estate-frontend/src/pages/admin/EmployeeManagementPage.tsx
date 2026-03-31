import { useEffect, useState } from "react";
import { toast } from 'react-hot-toast';
import dayjs from "dayjs";
import { employeeApi } from "@/api";
import { getApiErrorMessage } from "@/utils";
import type { Employee } from '@/types';
import { Button, Modal, Badge, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

type EmployeeRecord = Employee;

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const EmployeeManagementPage = () => {

  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    startDate: '',
  });

  // ================= LOAD DATA =================
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await employeeApi.getAll({ page: 1, limit: 10 });
      setData(res.data.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Tải danh sách nhân viên thất bại"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ================= MODAL =================
  const openModal = (record?: EmployeeRecord) => {
    setEditing(record || null);

    if (record) {
      setFormData({
        code: record.code || '',
        username: record.user?.username || '',
        password: '',
        fullName: record.user?.fullName || '',
        email: record.user?.email || '',
        phone: record.user?.phone || '',
        startDate: record.startDate ? dayjs(record.startDate).format('YYYY-MM-DD') : '',
      });
    } else {
      setFormData({ code: '', username: '', password: '', fullName: '', email: '', phone: '', startDate: '' });
    }

    setOpen(true);
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    try {
      if (!formData.code || !formData.fullName || !formData.email || !formData.phone) {
        toast.error('Vui lòng nhập đầy đủ trường bắt buộc');
        return;
      }
      if (!editing && (!formData.username || !formData.password)) {
        toast.error('Vui lòng nhập username và password');
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
        toast.error('Email không đúng định dạng');
        return;
      }

      const values: Record<string, unknown> = {
        code: formData.code,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
      };

      if (!editing) {
        values.username = formData.username;
        values.password = formData.password;
      }

      if (formData.startDate) {
        values.startDate = formData.startDate;
      }

      if (editing) {
        await employeeApi.update(editing.id, values);
        toast.success("Update success");
      } else {
        await employeeApi.create(values);
        toast.success("Create success");
      }

      setOpen(false);
      loadData();

    } catch (err: unknown) {
      const error = err as ApiError;
      toast.error(getApiErrorMessage(error, editing ? "Cập nhật nhân viên thất bại" : "Tạo nhân viên thất bại"));
    }
  };

  // ================= DELETE (SOFT) =================
  const remove = async (id: number) => {
    try {
      await employeeApi.delete(id);
      toast.success("Đã khóa tài khoản");

      // update UI ngay
      setData(prev =>
        prev.map(item =>
          item.id === id
            ? {
              ...item,
              user: item.user
                ? { ...item.user, status: 0 }
                : item.user
            }
            : item
        )
      );


    } catch (err) {
      toast.error(getApiErrorMessage(err, "Khóa tài khoản thất bại"));
    }
  };

  // ================= RENDER HELPERS =================
  const renderUserField = (field: 'fullName' | 'email' | 'phone') => (_: unknown, r: EmployeeRecord) =>
    r.user?.[field] || "—";

  const renderStatus = (_: unknown, r: EmployeeRecord) => {
    const isActive = r.user?.status === 1;
    return (
      <Badge color={isActive ? 'success' : 'error'}>
        {isActive ? "Hoạt động" : "Đã khóa"}
      </Badge>
    );
  };

  const renderDate = (field: 'startDate' | 'createdAt', format = "DD/MM/YYYY") => (_: unknown, r: EmployeeRecord) =>
    r[field] ? dayjs(r[field]).format(format) : "";

  // ================= COLUMNS =================
  const columns: Column<EmployeeRecord>[] = [
    { title: "Mã NV", dataIndex: "code" },
    { title: "Họ tên", render: renderUserField("fullName") },
    { title: "Email", render: renderUserField("email") },
    { title: "SĐT", render: renderUserField("phone") },
    { title: "Trạng thái", render: renderStatus },
    { title: "Ngày vào", render: renderDate("startDate") },
    { title: "Ngày tạo", render: renderDate("createdAt") },
    {
      title: "Hành động",
      render: (_: unknown, r: EmployeeRecord) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" iconOnly ariaLabel="Sửa" startIcon={(
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )} onClick={() => openModal(r)}>Sửa</Button>
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
            disabled={r.user?.status === 0}
            onClick={() => {
              if (window.confirm('Bạn có chắc muốn khóa?')) {
                remove(r.id);
              }
            }}
          >
            Khóa
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>

      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Quản lý nhân viên</h2>

        <Button
          variant="primary"
          iconOnly
          ariaLabel="Thêm mới"
          onClick={() => openModal()}
          startIcon={(
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          )}
        >
          Thêm mới
        </Button>
      </div>

      {/* TABLE */}
      <DataTable
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
      />

      {/* MODAL */}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? "Sửa nhân viên" : "Thêm nhân viên"}
        footer={(
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleSubmit}>{editing ? 'Cập nhật' : 'Tạo mới'}</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã NV</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>

          {!editing && (
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày vào</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={formData.startDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default EmployeeManagementPage;