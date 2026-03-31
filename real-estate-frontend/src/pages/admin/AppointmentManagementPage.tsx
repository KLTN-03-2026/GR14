import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { appointmentApi, employeeApi } from '@/api';
import { formatDateTime } from '@/utils';
import type { Appointment, Employee } from '@/types';
import {
    DEFAULT_PAGE_SIZE,
    APPOINTMENT_STATUS,
    APPOINTMENT_STATUS_LABELS,
    APPOINTMENT_ACTUAL_STATUS,
    APPOINTMENT_ACTUAL_STATUS_LABELS,
} from '@/constants';
import { Button, Modal, Badge, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';

type ApiError = {
    response?: {
        data?: {
            message?: string;
        };
    };
};

const STATUS_COLOR: Record<number, 'warning' | 'success' | 'error'> = { 0: 'warning', 1: 'success', 2: 'error' };
const ACTUAL_STATUS_COLOR: Record<number, string> = {
    [APPOINTMENT_ACTUAL_STATUS.NOT_MET]: 'gold',
    [APPOINTMENT_ACTUAL_STATUS.MET]: 'green',
    [APPOINTMENT_ACTUAL_STATUS.CUSTOMER_NO_SHOW]: 'volcano',
    [APPOINTMENT_ACTUAL_STATUS.UNABLE_TO_PROCEED]: 'red',
};

type AppointmentFilterTab = 'all' | 'pending' | 'approved' | 'rejected';
type AppointmentStatusCounts = {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
};

const AppointmentManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<AppointmentFilterTab>('all');
    const [statusCounts, setStatusCounts] = useState<AppointmentStatusCounts>({
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
    });

    // Approve modal
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [approveId, setApproveId] = useState<number | null>(null);
    const [approveData, setApproveData] = useState<{ employeeId?: number }>({});

    // Cancel modal
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelId, setCancelId] = useState<number | null>(null);
    const [cancelData, setCancelData] = useState<{ cancelReason?: string }>({});

    // Assign employee modal
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignId, setAssignId] = useState<number | null>(null);
    const [assignData, setAssignData] = useState<{ employeeId?: number }>({});

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = { page, limit: DEFAULT_PAGE_SIZE };
            if (search) params.search = search;
            if (activeTab === 'pending') params.status = APPOINTMENT_STATUS.PENDING;
            if (activeTab === 'approved') params.status = APPOINTMENT_STATUS.APPROVED;
            if (activeTab === 'rejected') params.status = APPOINTMENT_STATUS.REJECTED;

            const res = await appointmentApi.getAll(params);
            const data = res.data;
            setAppointments(data.data || []);
            setTotal(data.totalItems || 0);

            const counts = data.statusCounts;
            if (counts) {
                setStatusCounts({
                    all: Number(counts.all || 0),
                    pending: Number(counts.pending || 0),
                    approved: Number(counts.approved || 0),
                    rejected: Number(counts.rejected || 0),
                });
            }
        } catch {
            toast.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [page, search, activeTab]);

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
            toast.success('Xóa thành công');
            loadAppointments();
        } catch {
            toast.error('Xóa thất bại');
        }
    };

    // -- Approve --------------------------------------------
    const openApproveModal = (id: number) => {
        setApproveId(id);
        setApproveData({});
        setApproveModalOpen(true);
    };
    const handleApprove = async () => {
        if (!approveData.employeeId) {
            toast.error('Vui lòng chọn nhân viên');
            return;
        }
        try {
            await appointmentApi.approve(approveId!, { employeeId: approveData.employeeId });
            toast.success('Duyệt lịch hẹn thành công, đã gửi mail cho khách');
            setApproveModalOpen(false);
            loadAppointments();
        } catch (e: unknown) {
            const err = e as ApiError;
            toast.error(err.response?.data?.message || 'Duyệt thất bại');
        }
    };

    // -- Cancel ---------------------------------------------
    const openCancelModal = (id: number) => {
        setCancelId(id);
        setCancelData({});
        setCancelModalOpen(true);
    };
    const handleCancel = async () => {
        if (!cancelData.cancelReason?.trim()) {
            toast.error('Vui lòng nhập lý do');
            return;
        }
        try {
            await appointmentApi.cancel(cancelId!, { cancelReason: cancelData.cancelReason });
            toast.success('Đã từ chối lịch hẹn và gửi mail cho khách');
            setCancelModalOpen(false);
            loadAppointments();
        } catch (e: unknown) {
            const err = e as ApiError;
            toast.error(err.response?.data?.message || 'Từ chối thất bại');
        }
    };

    // -- Assign employee ------------------------------------
    const openAssignModal = (record: Appointment) => {
        setAssignId(record.id);
        setAssignData({ employeeId: record.employeeId ?? undefined });
        setAssignModalOpen(true);
    };
    const handleAssign = async () => {
        if (!assignData.employeeId) {
            toast.error('Vui lòng chọn nhân viên');
            return;
        }
        try {
            await appointmentApi.assignEmployee(assignId!, assignData.employeeId);
            toast.success('Phân công nhân viên thành công');
            setAssignModalOpen(false);
            loadAppointments();
        } catch (e: unknown) {
            const err = e as ApiError;
            toast.error(err.response?.data?.message || 'Phân công thất bại');
        }
    };

    const employeeOptions = employees.map(e => ({
        value: e.id,
        label: e.user?.fullName || e.code,
    }));

    const tabButtonClass = (active: boolean) =>
        `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${active
            ? 'border-brand-500 bg-brand-50 text-brand-600'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`;

    const columns: Column<Appointment>[] = [
        { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
        {
            title: 'Bất động sản',
            key: 'property',
            ellipsis: true,
            render: (_, r) => {
                const propertyTitle = r.house?.title || r.land?.title;
                const imageUrl = r.house?.images?.[0]?.url || r.land?.images?.[0]?.url;

                if (!propertyTitle) {
                    return <span style={{ color: '#ccc' }}>N/A</span>;
                }

                return (
                    <div className="flex items-center gap-3 min-w-0">
                        {imageUrl ? (
                            <img src={imageUrl} alt={propertyTitle} className="h-12 w-16 rounded object-cover border border-gray-200 flex-shrink-0" />
                        ) : (
                            <div className="h-12 w-16 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-[11px] text-gray-400 flex-shrink-0">No Img</div>
                        )}
                        <span className="truncate" title={propertyTitle}>{propertyTitle}</span>
                    </div>
                );
            },
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
                <Badge color={STATUS_COLOR[s] || 'light'}>{APPOINTMENT_STATUS_LABELS[s]}</Badge>
            ),
        },
        {
            title: 'Thực tế',
            key: 'actualStatus',
            width: 220,
            render: (_, r) => {
                if (r.status !== APPOINTMENT_STATUS.APPROVED) {
                    return <span style={{ color: '#bbb' }}>Chưa áp dụng</span>;
                }

                if (r.actualStatus === undefined || r.actualStatus === null) {
                    return <Badge color="light">Chưa cập nhật</Badge>;
                }

                const label = APPOINTMENT_ACTUAL_STATUS_LABELS[r.actualStatus] || `Không rõ (${r.actualStatus})`;
                return (
                    <div>
                        <Badge color={
                            ACTUAL_STATUS_COLOR[r.actualStatus] === 'green'
                                ? 'success'
                                : ACTUAL_STATUS_COLOR[r.actualStatus] === 'gold'
                                    ? 'warning'
                                    : 'error'
                        }>{label}</Badge>
                        {r.cancelReason && (
                            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.cancelReason}</div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 220,
            render: (_, record) => {
                const actualUpdated = record.actualStatus !== undefined && record.actualStatus !== null;

                return (
                    <div className="flex flex-wrap items-center gap-2">
                        {record.status === 0 && (
                            <>
                                <Button size="sm" variant="primary" iconOnly ariaLabel="Duyệt" onClick={() => openApproveModal(record.id)} startIcon={(
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}>Duyệt</Button>
                                <Button size="sm" variant="danger" iconOnly ariaLabel="Từ chối" onClick={() => openCancelModal(record.id)} startIcon={(
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}>Từ chối</Button>
                            </>
                        )}
                        {record.status === 1 && !actualUpdated && (
                            <Button size="sm" variant="outline" iconOnly ariaLabel="Phân công" onClick={() => openAssignModal(record)} startIcon={(
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5V4H2v16h5m10 0v-5a3 3 0 00-6 0v5m6 0H11" />
                                </svg>
                            )}>Phân công</Button>
                        )}
                        {!actualUpdated && record.status !== APPOINTMENT_STATUS.REJECTED && (
                            <Button size="sm" variant="outline" iconOnly ariaLabel="Sửa" onClick={() => navigate(`/admin/appointments/${record.id}/edit`)} startIcon={(
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            )}>Sửa</Button>
                        )}
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
                                if (window.confirm('Bạn có chắc muốn xóa?')) {
                                    handleDelete(record.id);
                                }
                            }}
                        >
                            Xóa
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Quản lý lịch hẹn</h3>
                <Button variant="primary" iconOnly ariaLabel="Thêm mới" onClick={() => navigate('/admin/appointments/create')} startIcon={(
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                )}>
                    Thêm mới
                </Button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <button
                    className={tabButtonClass(activeTab === 'all')}
                    onClick={() => {
                        setActiveTab('all');
                        setPage(1);
                    }}
                >
                    Tất cả ({statusCounts.all})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'pending')}
                    onClick={() => {
                        setActiveTab('pending');
                        setPage(1);
                    }}
                >
                    Chờ duyệt ({statusCounts.pending})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'approved')}
                    onClick={() => {
                        setActiveTab('approved');
                        setPage(1);
                    }}
                >
                    Đã duyệt ({statusCounts.approved})
                </button>
                <button
                    className={tabButtonClass(activeTab === 'rejected')}
                    onClick={() => {
                        setActiveTab('rejected');
                        setPage(1);
                    }}
                >
                    Đã từ chối ({statusCounts.rejected})
                </button>
            </div>

            <div className="mb-4 w-full min-w-0 sm:max-w-[400px]">
                <input
                    type="text"
                    placeholder="Tìm kiếm theo tiêu đề hoặc địa chỉ..."
                    className="admin-control admin-filter-input w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            <DataTable
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
                isOpen={approveModalOpen}
                onClose={() => setApproveModalOpen(false)}
                title=" Duyệt lịch hẹn"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setApproveModalOpen(false)}>Hủy</Button>
                        <Button variant="primary" onClick={handleApprove}>Duyệt</Button>
                    </>
                )}
            >
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phân công nhân viên</label>
                    <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={approveData.employeeId || ''}
                        onChange={(e) => setApproveData({ employeeId: Number(e.target.value) || undefined })}
                    >
                        <option value="">Chọn nhân viên</option>
                        {employeeOptions.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                    </select>
                </div>
            </Modal>

            {/* Cancel Modal */}
            <Modal
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                title=" Từ chối lịch hẹn"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Hủy</Button>
                        <Button variant="danger" onClick={handleCancel}>Xác nhận từ chối</Button>
                    </>
                )}
            >
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lý do từ chối</label>
                    <textarea
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="Nhập lý do từ chối..."
                        value={cancelData.cancelReason || ''}
                        onChange={(e) => setCancelData({ cancelReason: e.target.value })}
                    />
                </div>
            </Modal>

            {/* Assign employee Modal */}
            <Modal
                isOpen={assignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                title=" Phân công nhân viên"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Hủy</Button>
                        <Button variant="primary" onClick={handleAssign}>Phân công</Button>
                    </>
                )}
            >
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhân viên</label>
                    <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={assignData.employeeId || ''}
                        onChange={(e) => setAssignData({ employeeId: Number(e.target.value) || undefined })}
                    >
                        <option value="">Chọn nhân viên</option>
                        {employeeOptions.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                    </select>
                </div>
            </Modal>
        </div>
    );
};

export default AppointmentManagementPage;