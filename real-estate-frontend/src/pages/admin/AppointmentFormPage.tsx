import { useEffect, useState, useRef } from 'react';
import {
    Form, Select, Button, Card, message, Typography,
    Row, Col, Space, Radio, DatePicker, Input, Alert,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UserOutlined, UserAddOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { appointmentApi, customerApi, employeeApi, houseApi, landApi, userApi } from '@/api';
import { APPOINTMENT_STATUS_LABELS } from '@/constants';
import type { Customer, Employee, House, Land } from '@/types';

const { Title } = Typography;

const AppointmentFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [houses, setHouses] = useState<House[]>([]);
    const [lands, setLands] = useState<Land[]>([]);
    const [propertyType, setPropertyType] = useState<'house' | 'land'>('house');
    const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
    const [phoneCheckStatus, setPhoneCheckStatus] = useState<'idle' | 'exists' | 'new'>('idle');
    const phoneCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isEdit = !!id;

    useEffect(() => {
        loadSelects();
        if (isEdit) loadAppointment(Number(id));
    }, [id]);

    const loadSelects = async () => {
        try {
            const [cusRes, empRes, houseRes, landRes] = await Promise.all([
                customerApi.getAll({ limit: 200 }),
                employeeApi.getAll({ limit: 200 }),
                houseApi.getAll({ limit: 200 }),
                landApi.getAll({ limit: 200 }),
            ]);
            setCustomers(cusRes.data.data || cusRes.data);
            setEmployees(empRes.data.data || empRes.data);
            setHouses(houseRes.data.data || houseRes.data);
            setLands(landRes.data.data || landRes.data);
        } catch {
            message.error('Lỗi tải dữ liệu');
        }
    };

    const loadAppointment = async (appointmentId: number) => {
        setFetching(true);
        try {
            const res = await appointmentApi.getById(appointmentId);
            const data = res.data;
            const type = data.landId ? 'land' : 'house';
            setPropertyType(type);
            form.setFieldsValue({
                customerId: data.customerId,
                employeeId: data.employeeId,
                propertyType: type,
                houseId: data.houseId,
                landId: data.landId,
                appointmentDate: data.appointmentDate ? dayjs(data.appointmentDate) : null,
                status: data.status,
            });
        } catch {
            message.error('Lỗi tải lịch hẹn');
        } finally {
            setFetching(false);
        }
    };

    const handlePhoneChange = (phone: string) => {
        setPhoneCheckStatus('idle');
        if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);
        if (!phone || phone.length < 9) return;
        phoneCheckTimer.current = setTimeout(async () => {
            try {
                const res = await userApi.checkPhone(phone);
                setPhoneCheckStatus(res.data.exists ? 'exists' : 'new');
            } catch {
                setPhoneCheckStatus('idle');
            }
        }, 500);
    };

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                employeeId: values.employeeId || null,
                appointmentDate: values.appointmentDate.toISOString(),
                houseId: propertyType === 'house' ? values.houseId : null,
                landId: propertyType === 'land' ? values.landId : null,
            };

            if (isEdit) {
                payload.customerId = values.customerId;
                payload.status = values.status;
                await appointmentApi.update(Number(id), payload);
                message.success('Cập nhật lịch hẹn thành công');
            } else {
                if (customerMode === 'existing') {
                    payload.customerId = values.customerId;
                } else {
                    payload.newCustomerName = values.newCustomerName;
                    payload.newCustomerPhone = values.newCustomerPhone;
                    payload.newCustomerEmail = values.newCustomerEmail || undefined;
                }
                await appointmentApi.adminCreate(payload);
                message.success(
                    phoneCheckStatus === 'exists'
                        ? 'Tạo lịch hẹn thành công (dùng tài khoản đã có)'
                        : 'Tạo lịch hẹn thành công'
                );
            }
            navigate('/admin/appointments');
        } catch (e: any) {
            message.error(e?.response?.data?.message || (isEdit ? 'Cập nhật thất bại' : 'Tạo thất bại'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/appointments')} />
                <Title level={3} style={{ margin: 0 }}>
                    {isEdit ? 'Chỉnh sửa lịch hẹn' : 'Tạo lịch hẹn mới'}
                </Title>
            </div>

            <Card loading={fetching}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ propertyType: 'house', status: 0 }}
                >
                    <Row gutter={24}>

                        {/* 1. Thông tin khách hàng */}
                        {!isEdit && (
                            <Col xs={24}>
                                <Form.Item label="Khách hàng">
                                    <Radio.Group
                                        value={customerMode}
                                        onChange={(e) => {
                                            setCustomerMode(e.target.value);
                                            setPhoneCheckStatus('idle');
                                            form.setFieldsValue({
                                                customerId: undefined,
                                                newCustomerName: undefined,
                                                newCustomerPhone: undefined,
                                                newCustomerEmail: undefined,
                                            });
                                        }}
                                        style={{ marginBottom: 16 }}
                                    >
                                        <Radio.Button value="existing">
                                            <UserOutlined /> Khách có sẵn
                                        </Radio.Button>
                                        <Radio.Button value="new">
                                            <UserAddOutlined /> Khách mới
                                        </Radio.Button>
                                    </Radio.Group>

                                    {/* Chọn khách có sẵn */}
                                    {customerMode === 'existing' && (
                                        <Form.Item
                                            name="customerId"
                                            rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="Tìm theo tên hoặc số điện thoại..."
                                                options={customers.map(c => ({
                                                    value: c.id,
                                                    label: `${c.user?.fullName || c.code}${c.user?.phone ? '    ' + c.user.phone : ''}`,
                                                }))}
                                                optionFilterProp="label"
                                                style={{ maxWidth: 420 }}
                                            />
                                        </Form.Item>
                                    )}

                                    {/* Nhập khách mới */}
                                    {customerMode === 'new' && (
                                        <Row gutter={16}>
                                            <Col xs={24} md={8}>
                                                <Form.Item
                                                    name="newCustomerName"
                                                    label="Họ tên"
                                                    rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
                                                >
                                                    <Input placeholder="Nguyễn Văn A" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item
                                                    name="newCustomerPhone"
                                                    label="Số điện thoại"
                                                    rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                                                >
                                                    <Input
                                                        placeholder="09xxxxxxxx"
                                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                                    />
                                                </Form.Item>
                                                {phoneCheckStatus === 'exists' && (
                                                    <Alert
                                                        type="info"
                                                        showIcon
                                                        message="Số điện thoại đã có tài khoản, sẽ dùng tài khoản đó"
                                                        style={{ marginTop: -16, marginBottom: 8 }}
                                                    />
                                                )}
                                                {phoneCheckStatus === 'new' && (
                                                    <Alert
                                                        type="success"
                                                        showIcon
                                                        message="Sẽ tạo tài khoản khách hàng mới"
                                                        style={{ marginTop: -16, marginBottom: 8 }}
                                                    />
                                                )}
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item
                                                    name="newCustomerEmail"
                                                    label="Email (tùy chọn)"
                                                    rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
                                                >
                                                    <Input placeholder="example@gmail.com" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    )}
                                </Form.Item>
                            </Col>
                        )}

                        {/* Edit mode: customer readonly */}
                        {isEdit && (
                            <Col xs={24} md={12}>
                                <Form.Item name="customerId" noStyle />
                                <Form.Item label="Khách hàng">
                                    <Input
                                        disabled
                                        value={
                                            customers.find(c => c.id === form.getFieldValue('customerId'))
                                                ?.user?.fullName || ''
                                        }
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        {/* 2. Nhân viên */}
                        <Col xs={24} md={12}>
                            <Form.Item name="employeeId" label="Phân công nhân viên (tùy chọn)">
                                <Select
                                    showSearch
                                    placeholder="Chọn nhân viên"
                                    options={employees.map(e => ({
                                        value: e.id,
                                        label: e.user?.fullName || e.code,
                                    }))}
                                    optionFilterProp="label"
                                    allowClear
                                />
                            </Form.Item>
                        </Col>

                        {/* 3. Ngày giờ & trạng thái */}
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="appointmentDate"
                                label="Ngày & giờ hẹn"
                                rules={[{ required: true, message: 'Vui lòng chọn ngày giờ' }]}
                            >
                                <DatePicker
                                    showTime
                                    format="DD/MM/YYYY HH:mm"
                                    style={{ width: '100%' }}
                                    placeholder="Chọn ngày giờ hẹn"
                                    disabledDate={(d) => d && d < dayjs().startOf('day')}
                                />
                            </Form.Item>
                        </Col>

                        {isEdit && (
                            <Col xs={24} md={12}>
                                <Form.Item name="status" label="Trạng thái">
                                    <Select
                                        options={Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, v]) => ({
                                            value: Number(k), label: v,
                                        }))}
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        {/* 4. Bất động sản (chỉ khi tạo mới) */}
                        {!isEdit && (
                            <>
                                <Col xs={24}>
                                    <Form.Item name="propertyType" label="Loại bất động sản">
                                        <Radio.Group
                                            value={propertyType}
                                            onChange={(e) => {
                                                setPropertyType(e.target.value);
                                                form.setFieldsValue({ houseId: undefined, landId: undefined });
                                            }}
                                        >
                                            <Radio.Button value="house">Nhà</Radio.Button>
                                            <Radio.Button value="land">Đất</Radio.Button>
                                        </Radio.Group>
                                    </Form.Item>
                                </Col>

                                {propertyType === 'house' && (
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            name="houseId"
                                            label="Chọn nhà"
                                            rules={[{ required: true, message: 'Vui lòng chọn nhà' }]}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="Chọn nhà"
                                                options={houses.map(h => ({
                                                    value: h.id,
                                                    label: `${h.code}  ${h.title}`,
                                                }))}
                                                optionFilterProp="label"
                                            />
                                        </Form.Item>
                                    </Col>
                                )}

                                {propertyType === 'land' && (
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            name="landId"
                                            label="Chọn đất"
                                            rules={[{ required: true, message: 'Vui lòng chọn đất' }]}
                                        >
                                            <Select
                                                showSearch
                                                placeholder="Chọn đất"
                                                options={lands.map(l => ({
                                                    value: l.id,
                                                    label: `${l.code}  ${l.title}`,
                                                }))}
                                                optionFilterProp="label"
                                            />
                                        </Form.Item>
                                    </Col>
                                )}
                            </>
                        )}
                    </Row>

                    <Space>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<SaveOutlined />}
                        >
                            {isEdit ? 'Lưu thay đổi' : 'Tạo lịch hẹn'}
                        </Button>
                        <Button onClick={() => navigate('/admin/appointments')}>Hủy</Button>
                    </Space>
                </Form>
            </Card>
        </div>
    );
};

export default AppointmentFormPage;