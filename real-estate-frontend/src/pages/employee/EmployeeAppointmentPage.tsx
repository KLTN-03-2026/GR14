import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Form,
    Input,
    message,
    Modal,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { appointmentApi } from '@/api';
import type { Appointment } from '@/types';
import {
    APPOINTMENT_ACTUAL_STATUS,
    APPOINTMENT_ACTUAL_STATUS_LABELS,
    APPOINTMENT_STATUS_LABELS,
} from '@/constants';
import { formatDateTime } from '@/utils';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR: Record<number, string> = { 0: 'orange', 1: 'green', 2: 'red' };
const ACTUAL_STATUS_COLOR: Record<number, string> = {
    [APPOINTMENT_ACTUAL_STATUS.NOT_MET]: 'gold',
    [APPOINTMENT_ACTUAL_STATUS.MET]: 'green',
    [APPOINTMENT_ACTUAL_STATUS.CUSTOMER_NO_SHOW]: 'volcano',
    [APPOINTMENT_ACTUAL_STATUS.UNABLE_TO_PROCEED]: 'red',
};

const EmployeeAppointmentPage: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'updated' | 'pending'>('all');

    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await appointmentApi.getMyAssigned();
            setAppointments(res.data || []);
        } catch {
            message.error('Không thể tải danh sách lịch hẹn');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    const filteredAppointments = useMemo(() => {
        if (statusFilter === 'updated') {
            return appointments.filter((item) => item.actualStatus !== undefined && item.actualStatus !== null);
        }
        if (statusFilter === 'pending') {
            return appointments.filter((item) => item.actualStatus === undefined || item.actualStatus === null);
        }
        return appointments;
    }, [appointments, statusFilter]);

    const openUpdateModal = (record: Appointment) => {
        setCurrentAppointment(record);
        form.setFieldsValue({
            actualStatus: record.actualStatus,
            cancelReason: record.cancelReason || '',
        });
        setUpdateModalOpen(true);
    };

    const handleUpdateActualStatus = async () => {
        if (!currentAppointment) return;
        const values = await form.validateFields();
        setSubmitting(true);
        try {
            await appointmentApi.updateActualStatus(currentAppointment.id, {
                actualStatus: values.actualStatus,
                cancelReason: values.cancelReason || undefined,
            });
            message.success('Cập nhật trạng thái thực tế thành công');
            setUpdateModalOpen(false);
            setCurrentAppointment(null);
            form.resetFields();
            await loadAppointments();
        } catch (error: any) {
            message.error(error?.response?.data?.message || 'Cập nhật thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    const columns: ColumnsType<Appointment> = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 70,
        },
        {
            title: 'Bất động sản',
            key: 'property',
            render: (_, record) => record.house?.title || record.land?.title || 'Chưa gắn BĐS',
        },
        {
            title: 'Khách hàng',
            key: 'customer',
            render: (_, record) => (
                <div>
                    <div>{record.customer?.user?.fullName || record.customer?.code || 'N/A'}</div>
                    {record.customer?.user?.phone && (
                        <div style={{ fontSize: 12, color: '#888' }}>{record.customer.user.phone}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Ngày hẹn',
            dataIndex: 'appointmentDate',
            key: 'appointmentDate',
            width: 180,
            render: (date: string) => formatDateTime(date),
        },
        {
            title: 'Trạng thái duyệt',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (status: number) => (
                <Badge
                    status={status === 0 ? 'processing' : status === 1 ? 'success' : 'error'}
                    text={<Tag color={STATUS_COLOR[status]}>{APPOINTMENT_STATUS_LABELS[status]}</Tag>}
                />
            ),
        },
        {
            title: 'Trạng thái thực tế',
            key: 'actualStatus',
            width: 230,
            render: (_, record) => {
                if (record.actualStatus === undefined || record.actualStatus === null) {
                    return <Tag color="default">Chưa cập nhật</Tag>;
                }
                return (
                    <div>
                        <Tag color={ACTUAL_STATUS_COLOR[record.actualStatus] || 'default'}>
                            {APPOINTMENT_ACTUAL_STATUS_LABELS[record.actualStatus] || `Không rõ (${record.actualStatus})`}
                        </Tag>
                        {record.cancelReason && (
                            <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{record.cancelReason}</div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 160,
            render: (_, record) => (
                <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => openUpdateModal(record)}
                >
                    Cập nhật
                </Button>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0 }}>Lịch hẹn của tôi</Title>
                <Space>
                    <Select
                        value={statusFilter}
                        style={{ width: 180 }}
                        onChange={setStatusFilter}
                        options={[
                            { value: 'all', label: 'Tất cả' },
                            { value: 'pending', label: 'Chưa cập nhật' },
                            { value: 'updated', label: 'Đã cập nhật' },
                        ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={loadAppointments}>Tải lại</Button>
                </Space>
            </div>

            <Card>
                <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
                    <Text type="secondary">Chỉ hiển thị các lịch hẹn đã được duyệt và đang được phân công cho bạn.</Text>
                    <Text type="secondary">Cập nhật trạng thái thực tế ngay sau khi đã gặp khách để admin theo dõi.</Text>
                </Space>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredAppointments}
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                />
            </Card>

            <Modal
                title={currentAppointment ? `Cập nhật thực tế lịch #${currentAppointment.id}` : 'Cập nhật thực tế'}
                open={updateModalOpen}
                onCancel={() => {
                    setUpdateModalOpen(false);
                    setCurrentAppointment(null);
                }}
                onOk={handleUpdateActualStatus}
                okText="Lưu"
                confirmLoading={submitting}
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        label="Trạng thái thực tế"
                        name="actualStatus"
                        rules={[{ required: true, message: 'Vui lòng chọn trạng thái thực tế' }]}
                    >
                        <Select
                            options={Object.entries(APPOINTMENT_ACTUAL_STATUS_LABELS).map(([value, label]) => ({
                                value: Number(value),
                                label,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item
                        shouldUpdate={(prev, next) => prev.actualStatus !== next.actualStatus}
                        noStyle
                    >
                        {({ getFieldValue }) => {
                            const actualStatus = getFieldValue('actualStatus');
                            const needReason = actualStatus !== undefined && actualStatus !== APPOINTMENT_ACTUAL_STATUS.MET;
                            return (
                                <Form.Item
                                    label="Ghi chú / lý do"
                                    name="cancelReason"
                                    rules={needReason ? [{ required: true, message: 'Vui lòng nhập ghi chú hoặc lý do' }] : []}
                                >
                                    <TextArea rows={3} placeholder="Nhập thông tin thực tế sau buổi hẹn..." />
                                </Form.Item>
                            );
                        }}
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default EmployeeAppointmentPage;
