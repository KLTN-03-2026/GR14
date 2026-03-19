import { useEffect, useState } from "react";
import {
  Table, Button, Space, Modal, Form, Input,
  DatePicker, Popconfirm, message, Tag
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { employeeApi } from "@/api";
import { getApiErrorMessage } from "@/utils";

const EmployeeManagementPage = () => {

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  // ================= LOAD DATA =================
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await employeeApi.getAll({ page: 1, limit: 10 });
      setData(res.data.data);
    } catch (err) {
      message.error(getApiErrorMessage(err, "Tải danh sách nhân viên thất bại"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ================= MODAL =================
  const openModal = (record?: any) => {
    setEditing(record || null);
    form.resetFields();

    if (record) {
      form.setFieldsValue({
        ...record,
        fullName: record.user?.fullName,
        email: record.user?.email,
        phone: record.user?.phone,
        startDate: record.startDate ? dayjs(record.startDate) : null
      });
    }

    setOpen(true);
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.startDate) {
        values.startDate = values.startDate.format("YYYY-MM-DD");
      }

      if (editing) {
        await employeeApi.update(editing.id, values);
        message.success("Update success");
      } else {
        await employeeApi.create(values);
        message.success("Create success");
      }

      setOpen(false);
      loadData();

    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(getApiErrorMessage(err, editing ? "Cập nhật nhân viên thất bại" : "Tạo nhân viên thất bại"));
    }
  };

  // ================= DELETE (SOFT) =================
  const remove = async (id: number) => {
    try {
      await employeeApi.delete(id);
      message.success("Đã khóa tài khoản");

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
      message.error(getApiErrorMessage(err, "Khóa tài khoản thất bại"));
    }
  };

  // ================= RENDER HELPERS =================
  const renderUserField = (field: string) => (_: any, r: any) =>
    r.user?.[field] || "—";

  const renderStatus = (_: any, r: any) => {
    const isActive = r.user?.status === 1;
    return (
      <Tag color={isActive ? "green" : "red"}>
        {isActive ? "Hoạt động" : "Đã khóa"}
      </Tag>
    );
  };

  const renderDate = (field: string, format = "DD/MM/YYYY") => (_: any, r: any) =>
    r[field] ? dayjs(r[field]).format(format) : "";

  // ================= COLUMNS =================
  const columns = [
    { title: "Mã NV", dataIndex: "code" },
    { title: "Họ tên", render: renderUserField("fullName") },
    { title: "Email", render: renderUserField("email") },
    { title: "SĐT", render: renderUserField("phone") },
    { title: "Trạng thái", render: renderStatus },
    { title: "Ngày vào", render: renderDate("startDate") },
    { title: "Ngày tạo", render: renderDate("createdAt") },
    {
      title: "Hành động",
      render: (_: any, r: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openModal(r)} />

          <Popconfirm
            title="Bạn có chắc muốn khóa?"
            onConfirm={() => remove(r.id)}
            disabled={r.user?.status === 0}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={r.user?.status === 0}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2>Quản lý nhân viên</h2>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
        >
          Thêm mới
        </Button>
      </div>

      {/* TABLE */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
      />

      {/* MODAL */}
      <Modal
        title={editing ? "Sửa nhân viên" : "Thêm nhân viên"}
        open={open}
        onOk={handleSubmit}
        onCancel={() => setOpen(false)}
      >
        <Form layout="vertical" form={form}>

          <Form.Item name="code" label="Mã NV" rules={[{ required: true, message: "Vui lòng nhập mã nhân viên" }]}>
            <Input />
          </Form.Item>

          {!editing && (
            <>
              <Form.Item name="username" label="Username" rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập" }]}>
                <Input />
              </Form.Item>

              <Form.Item name="password" label="Password" rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}

          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}>
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không đúng định dạng" },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="phone" label="SĐT" rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}>
            <Input />
          </Form.Item>

          <Form.Item name="startDate" label="Ngày vào">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

        </Form>
      </Modal>

    </div>
  );
};

export default EmployeeManagementPage;