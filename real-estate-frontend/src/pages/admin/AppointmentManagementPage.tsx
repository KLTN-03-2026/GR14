import { useEffect, useState, useCallback } from 'react';
import {
    Table, Tag, Input, message, Typography, Space, Button,
    Modal, Form, Select, Popconfirm, Tooltip, Badge,
} from 'antd';
import {
    SearchOutlined, PlusOutlined, EditOutlined,
    DeleteOutlined, CheckOutlined, CloseOutlined, UserSwitchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { appointmentApi, employeeApi } from '@/api';
import { formatDateTime } from '@/utils';
import type { Appointment, Employee } from '@/types';
import { DEFAULT_PAGE_SIZE, APPOINTMENT_STATUS_LABELS } from '@/constants';

const { Title } = Typography;
const { TextArea } = Input;

const STATUS_COLOR: Record<number, string> = { 0: 'orange', 1: 'green', 2: 'red' };

const AppointmentManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    // Approve modal
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [approveId, setApproveId] = useState<number | null>(null);
    const [approveForm] = Form.useForm();

    // Cancel modal
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelId, setCancelId] = useState<number | null>(null);
    const [cancelForm] = Form.useForm();

    // Assign employee modal
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignId, setAssignId] = useState<number | null>(null);
    const [assignForm] = Form.useForm();

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;
            const res = await appointmentApi.getAll(params);
            const data = res.data;
            setAppointments(data.data || []);
            setTotal(data.totalItems || 0);
        } catch {
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => { loadAppointments(); }, [loadAppointments]);

    useEffect(() => {
        employeeApi.getAll({ limit: 100 }).then(res => {
            const data = res.data;
            setEmployees(data.data || data);
        }).catch(() => { });
    }, []);

    // -- Delete ---------------------------------------------
    const handleDelete = async (id: number) => {
        try {
            await appointmentApi.delete(id);
            message.success('Xóa thành công');
            loadAppointments();
        } catch {
            message.error('Xóa thất bại');
        }
    };

    // -- Approve --------------------------------------------
    const openApproveModal = (id: number) => { setApproveId(id); approveForm.resetFields(); setApproveModalOpen(true); };
    const handleApprove = async () => {
        const values = await approveForm.validateFields();
        try {
            await appointmentApi.approve(approveId!, { employeeId: values.employeeId });
            message.success('Duyệt lịch hẹn thành công, đã gửi mail cho khách');
            setApproveModalOpen(false);
            loadAppointments();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'Duyệt thất bại');
        }
    };

    // -- Cancel ---------------------------------------------
    const openCancelModal = (id: number) => { setCancelId(id); cancelForm.resetFields(); setCancelModalOpen(true); };
    const handleCancel = async () => {
        const values = await cancelForm.validateFields();
        try {
            await appointmentApi.cancel(cancelId!, { cancelReason: values.cancelReason });
            message.success('Đã từ chối lịch hẹn và gửi mail cho khách');
            setCancelModalOpen(false);
            loadAppointments();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'Từ chối thất bại');
        }
    };

    // -- Assign employee ------------------------------------
    const openAssignModal = (record: Appointment) => {
        setAssignId(record.id);
        assignForm.setFieldsValue({ employeeId: record.employeeId });
        setAssignModalOpen(true);
    };
    const handleAssign = async () => {
        const values = await assignForm.validateFields();
        try {
            await appointmentApi.assignEmployee(assignId!, values.employeeId);
            message.success('Phân công nhân viên thành công');
            setAssignModalOpen(false);
            loadAppointments();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'Phân công thất bại');
        }
    };

    const employeeOptions = employees.map(e => ({
        value: e.id,
        label: e.user?.fullName || e.code,
    }));

    const columns: ColumnsType<Appointment> = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
        {
            title: 'Bất động sản',
            key: 'property',
            ellipsis: true,
            render: (_, r) => r.house?.title || r.land?.title || <span style={{ color: '#ccc' }}>N/A</span>,
        },
        {
            title: 'Khách hàng',
            key: 'customer',
            render: (_, r) => (
                <div>
                    <div>{r.customer?.user?.fullName || r.customer?.code || 'N/A'}</div>
                    {r.customer?.user?.phone && <div style={{ fontSize: 12, color: '#888' }}>{r.customer.user.phone}</div>}
                    {r.customer?.user?.email && <div style={{ fontSize: 12, color: '#aaa' }}>{r.customer.user.email}</div>}
                </div>
            ),
        },
        {
            title: 'Nhân viên',
            key: 'employee',
            render: (_, r) => r.employee?.user?.fullName
                ? <span style={{ color: '#1677ff' }}>{r.employee.user.fullName}</span>
                : <span style={{ color: '#ccc' }}>Chưa phân công</span>,
        },
        {
            title: 'Ngày hẹn',
            dataIndex: 'appointmentDate',
            key: 'appointmentDate',
            render: (d: string) => formatDateTime(d),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (s: number) => (
                <Badge
                    status={s === 0 ? 'processing' : s === 1 ? 'success' : 'error'}
                    text={<Tag color={STATUS_COLOR[s]}>{APPOINTMENT_STATUS_LABELS[s]}</Tag>}
                />
            ),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 220,
            render: (_, record) => (
                <Space wrap>
                    {record.status === 0 && (
                        <>
                            <Tooltip title="Duyệt">
                                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openApproveModal(record.id)} />
                            </Tooltip>
                            <Tooltip title="Từ chối">
                                <Button size="small" danger icon={<CloseOutlined />} onClick={() => openCancelModal(record.id)} />
                            </Tooltip>
                        </>
                    )}
                    {record.status === 1 && (
                        <Tooltip title="Phân công lại nhân viên">
                            <Button size="small" icon={<UserSwitchOutlined />} onClick={() => openAssignModal(record)} />
                        </Tooltip>
                    )}
                    <Tooltip title="Sửa">
                        <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/appointments/${record.id}/edit`)} />
                    </Tooltip>
                    <Popconfirm title="Bạn có chắc muốn xóa?" onConfirm={() => handleDelete(record.id)}>
                        <Tooltip title="Xóa">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0 }}>Quản lý lịch hẹn</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/appointments/create')}>
                    Thêm mới
                </Button>
            </div>

            <Input
                placeholder="Tìm kiếm khách hàng, BĐS..."
                prefix={<SearchOutlined />}
                style={{ marginBottom: 16, maxWidth: 400 }}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                allowClear
            />

            <Table
                columns={columns}
                dataSource={appointments}
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

            {/* Approve Modal */}
            <Modal
                title=" Duyệt lịch hẹn"
                open={approveModalOpen}
                onOk={handleApprove}
                onCancel={() => setApproveModalOpen(false)}
                okText="Duyệt"
                cancelText="Hủy"
            >
                <Form form={approveForm} layout="vertical">
                    <Form.Item
                        name="employeeId"
                        label="Phân công nhân viên"
                        rules={[{ required: true, message: 'Vui lòng chọn nhân viên' }]}
                    >
                        <Select placeholder="Chọn nhân viên" options={employeeOptions} showSearch optionFilterProp="label" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Cancel Modal */}
            <Modal
                title=" Từ chối lịch hẹn"
                open={cancelModalOpen}
                onOk={handleCancel}
                onCancel={() => setCancelModalOpen(false)}
                okText="Xác nhận từ chối"
                okButtonProps={{ danger: true }}
                cancelText="Hủy"
            >
                <Form form={cancelForm} layout="vertical">
                    <Form.Item
                        name="cancelReason"
                        label="Lý do từ chối"
                        rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}
                    >
                        <TextArea rows={3} placeholder="Nhập lý do từ chối..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Assign employee Modal */}
            <Modal
                title=" Phân công nhân viên"
                open={assignModalOpen}
                onOk={handleAssign}
                onCancel={() => setAssignModalOpen(false)}
                okText="Phân công"
                cancelText="Hủy"
            >
                <Form form={assignForm} layout="vertical">
                    <Form.Item
                        name="employeeId"
                        label="Nhân viên"
                        rules={[{ required: true, message: 'Vui lòng chọn nhân viên' }]}
                    >
                        <Select placeholder="Chọn nhân viên" options={employeeOptions} showSearch optionFilterProp="label" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AppointmentManagementPage;