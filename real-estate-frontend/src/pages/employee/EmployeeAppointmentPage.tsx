import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { appointmentApi } from '@/api';
import type { Appointment } from '@/types';
import {
    APPOINTMENT_ACTUAL_STATUS,
    APPOINTMENT_ACTUAL_STATUS_LABELS,
    APPOINTMENT_STATUS,
    APPOINTMENT_STATUS_LABELS,
    DEFAULT_PAGE_SIZE,
} from '@/constants';
import { formatDateTime } from '@/utils';
import { Badge, Button, DataTable, Modal } from '@/components/ui';
import type { Column } from '@/components/ui';

const STATUS_COLOR: Record<number, 'warning' | 'success' | 'error'> = {
    [APPOINTMENT_STATUS.PENDING]: 'warning',
    [APPOINTMENT_STATUS.APPROVED]: 'success',
    [APPOINTMENT_STATUS.REJECTED]: 'error',
};

const ACTUAL_STATUS_COLOR: Record<number, 'warning' | 'success' | 'error' | 'light'> = {
    [APPOINTMENT_ACTUAL_STATUS.NOT_MET]: 'warning',
    [APPOINTMENT_ACTUAL_STATUS.MET]: 'success',
    [APPOINTMENT_ACTUAL_STATUS.CUSTOMER_NO_SHOW]: 'error',
    [APPOINTMENT_ACTUAL_STATUS.UNABLE_TO_PROCEED]: 'error',
};

const EmployeeAppointmentPage: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'updated' | 'pending'>('all');

    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
    const [actualStatus, setActualStatus] = useState<number | ''>('');
    const [cancelReason, setCancelReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await appointmentApi.getMyAssigned();
            setAppointments(res.data || []);
        } catch {
            toast.error('Không thể tải danh sách lịch hẹn');
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

    const pagedAppointments = useMemo(() => {
        const start = (page - 1) * DEFAULT_PAGE_SIZE;
        return filteredAppointments.slice(start, start + DEFAULT_PAGE_SIZE);
    }, [filteredAppointments, page]);

    const openUpdateModal = (record: Appointment) => {
        setCurrentAppointment(record);
        setActualStatus(record.actualStatus ?? '');
        setCancelReason(record.cancelReason || '');
        setUpdateModalOpen(true);
    };

    const handleUpdateActualStatus = async () => {
        if (!currentAppointment) return;

        if (actualStatus === '') {
            toast.error('Vui lòng chọn trạng thái thực tế');
            return;
        }

        const needReason = actualStatus !== APPOINTMENT_ACTUAL_STATUS.MET;
        if (needReason && !cancelReason.trim()) {
            toast.error('Vui lòng nhập ghi chú hoặc lý do');
            return;
        }

        setSubmitting(true);
        try {
            await appointmentApi.updateActualStatus(currentAppointment.id, {
                actualStatus,
                cancelReason: needReason ? cancelReason.trim() : undefined,
            });
            toast.success('Cập nhật trạng thái thực tế thành công');
            setUpdateModalOpen(false);
            setCurrentAppointment(null);
            setActualStatus('');
            setCancelReason('');
            await loadAppointments();
        } catch (error: unknown) {
            const e = error as { response?: { data?: { message?: string } } };
            toast.error(e?.response?.data?.message || 'Cập nhật thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    const closeUpdateModal = () => {
        setUpdateModalOpen(false);
        setCurrentAppointment(null);
        setActualStatus('');
        setCancelReason('');
    };

    const isActualStatusUpdated = (record: Appointment) =>
        record.actualStatus !== undefined && record.actualStatus !== null;

    const columns: Column<Appointment>[] = [
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
                        <div className="text-xs text-gray-500 mt-0.5">{record.customer.user.phone}</div>
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
                <Badge color={STATUS_COLOR[status] || 'light'}>
                    {APPOINTMENT_STATUS_LABELS[status]}
                </Badge>
            ),
        },
        {
            title: 'Trạng thái thực tế',
            key: 'actualStatus',
            width: 230,
            render: (_, record) => {
                if (!isActualStatusUpdated(record)) {
                    return <Badge color="light">Chưa cập nhật</Badge>;
                }
                const actualStatusValue = record.actualStatus as number;
                return (
                    <div>
                        <Badge color={ACTUAL_STATUS_COLOR[actualStatusValue] || 'light'}>
                            {APPOINTMENT_ACTUAL_STATUS_LABELS[actualStatusValue] || `Không rõ (${actualStatusValue})`}
                        </Badge>
                        {record.cancelReason && (
                            <div className="text-xs text-gray-500 mt-1">{record.cancelReason}</div>
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
                    size="sm"
                    variant="primary"
                    startIcon={(
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                    onClick={() => openUpdateModal(record)}
                >
                    Cập nhật
                </Button>
            ),
        },
    ];

    const statusFilterOptions: Array<{ value: 'all' | 'pending' | 'updated'; label: string }> = [
        { value: 'all', label: 'Tất cả' },
        { value: 'pending', label: 'Chưa cập nhật' },
        { value: 'updated', label: 'Đã cập nhật' },
    ];

    const needReason = actualStatus !== '' && actualStatus !== APPOINTMENT_ACTUAL_STATUS.MET;

    return (
        <div className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Lịch hẹn của tôi</h3>
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        className="admin-control rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        onChange={(e) => {
                            setStatusFilter(e.target.value as 'all' | 'pending' | 'updated');
                            setPage(1);
                        }}
                    >
                        {statusFilterOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <Button
                        variant="outline"
                        startIcon={(
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.65 18.35A9 9 0 1018.35 5.65l-.58.58" />
                            </svg>
                        )}
                        onClick={loadAppointments}
                    >
                        Tải lại
                    </Button>
                </div>
            </div>

            <div className="admin-form-surface p-6">
                <div className="mb-4 space-y-1">
                    <p className="text-sm text-gray-500">Chỉ hiển thị các lịch hẹn đã được duyệt và đang được phân công cho bạn.</p>
                    <p className="text-sm text-gray-500">Cập nhật trạng thái thực tế ngay sau khi đã gặp khách để admin theo dõi.</p>
                </div>

                <DataTable
                    rowKey="id"
                    columns={columns}
                    dataSource={pagedAppointments}
                    loading={loading}
                    pagination={{
                        current: page,
                        total: filteredAppointments.length,
                        pageSize: DEFAULT_PAGE_SIZE,
                        onChange: setPage,
                        showTotal: (t) => `Tổng ${t} bản ghi`,
                    }}
                />
            </div>

            <Modal
                title={currentAppointment ? `Cập nhật thực tế lịch #${currentAppointment.id}` : 'Cập nhật thực tế'}
                isOpen={updateModalOpen}
                onClose={closeUpdateModal}
                footer={(
                    <>
                        <Button variant="outline" onClick={closeUpdateModal}>Hủy</Button>
                        <Button variant="primary" onClick={handleUpdateActualStatus} loading={submitting}>Lưu</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái thực tế</label>
                        <select
                            value={actualStatus}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            onChange={(e) => {
                                const value = e.target.value;
                                setActualStatus(value === '' ? '' : Number(value));
                            }}
                        >
                            <option value="">Chọn trạng thái thực tế</option>
                            {Object.entries(APPOINTMENT_ACTUAL_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {needReason && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Ghi chú / lý do</label>
                            <textarea
                                rows={3}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                placeholder="Nhập thông tin thực tế sau buổi hẹn..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default EmployeeAppointmentPage;
