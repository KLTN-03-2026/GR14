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
    const [markingContactId, setMarkingContactId] = useState<number | null>(null);

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

    const handleMarkFirstContact = async (record: Appointment) => {
        if (record.firstContactAt) return;
        setMarkingContactId(record.id);
        try {
            await appointmentApi.markFirstContact(record.id);
            toast.success('Đã cập nhật liên hệ đầu tiên');
            await loadAppointments();
        } catch (error: unknown) {
            const e = error as { response?: { data?: { message?: string } } };
            toast.error(e?.response?.data?.message || 'Cập nhật liên hệ đầu tiên thất bại');
        } finally {
            setMarkingContactId(null);
        }
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
            title: 'Liên hệ đầu tiên',
            key: 'firstContactAt',
            width: 210,
            render: (_, record) => (
                record.firstContactAt
                    ? <span className="text-sm text-gray-700">{formatDateTime(record.firstContactAt)}</span>
                    : <span className="text-sm text-gray-400">Chưa cập nhật</span>
            ),
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 300,
            render: (_, record) => {
                return (
                    <div className="flex flex-wrap items-center gap-2">
                        {record.firstContactAt ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Đã liên hệ
                            </span>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkFirstContact(record)}
                                loading={markingContactId === record.id}
                            >
                                Đã liên hệ
                            </Button>
                        )}

                        {isActualStatusUpdated(record) ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Đã cập nhật
                            </span>
                        ) : record.status !== APPOINTMENT_STATUS.APPROVED ? (
                             <span className="text-sm text-gray-400 italic">Chưa được duyệt</span>
                        ) : (
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
                        )}
                    </div>
                );
            },
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
                        loading={loading}
                        startIcon={!loading ? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        ) : undefined}
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
