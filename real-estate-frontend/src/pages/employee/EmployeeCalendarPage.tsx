import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import viLocale from '@fullcalendar/core/locales/vi';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { appointmentApi } from '@/api';
import type { Appointment } from '@/types';
import { Badge, Button, Modal } from '@/components/ui';

type CalendarEvent = {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: false;
    extendedProps: {
        customerName: string;
        customerPhone?: string;
        propertyTitle: string;
        location: string;
        durationMinutes: number;
    };
};

const EmployeeCalendarPage: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const loadAppointments = useCallback(async () => {
        try {
            const response = await appointmentApi.getMyAssigned();
            setAppointments(response.data || []);
        } catch {
            toast.error('Không thể tải lịch làm việc của bạn');
        }
    }, []);

    useEffect(() => {
        void loadAppointments();
    }, [loadAppointments]);

    const events = useMemo<CalendarEvent[]>(() => {
        return appointments.map((item) => {
            const start = dayjs(item.appointmentDate);
            const durationMinutes = item.durationMinutes || 60;
            const end = start.add(durationMinutes, 'minute');
            const propertyTitle = item.house?.title || item.land?.title || 'Bất động sản';
            const district = item.house?.district || item.land?.district || '';
            const city = item.house?.city || item.land?.city || '';
            const location = [district, city].filter(Boolean).join(', ');
            const customerName = item.customer?.user?.fullName || item.customer?.code || 'Khách hàng';
            const customerPhone = item.customer?.user?.phone;

            return {
                id: String(item.id),
                title: propertyTitle,
                start: start.toISOString(),
                end: end.toISOString(),
                allDay: false,
                extendedProps: {
                    customerName,
                    customerPhone,
                    propertyTitle,
                    location,
                    durationMinutes,
                },
            };
        });
    }, [appointments]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Lịch calendar của tôi</h2>
                    <p className="text-sm text-gray-500">Chỉ xem lịch hẹn đã được duyệt và phân công cho bạn. Không thể kéo thả chỉnh sửa.</p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    locale="vi"
                    locales={[viLocale]}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay',
                    }}
                    buttonText={{
                        today: 'Hôm nay',
                        month: 'Tháng',
                        week: 'Tuần',
                        day: 'Ngày',
                    }}
                    editable={false}
                    selectable={false}
                    eventStartEditable={false}
                    eventDurationEditable={false}
                    slotEventOverlap={false}
                    eventMaxStack={3}
                    dayMaxEventRows={3}
                    eventMinHeight={26}
                    slotDuration="00:30:00"
                    slotLabelInterval="00:30:00"
                    slotMinTime="08:00:00"
                    slotMaxTime="18:00:00"
                    events={events}
                    eventClick={(arg) => {
                        setSelectedEvent(arg.event.toPlainObject() as CalendarEvent);
                        setDetailOpen(true);
                    }}
                    height="auto"
                />
            </div>

            <Modal
                isOpen={detailOpen}
                onClose={() => {
                    setDetailOpen(false);
                    setSelectedEvent(null);
                }}
                title={selectedEvent?.extendedProps?.propertyTitle || 'Chi tiết lịch hẹn'}
                width="max-w-lg"
                footer={<Button variant="outline" onClick={() => setDetailOpen(false)}>Đóng</Button>}
            >
                <div className="space-y-3 text-sm text-gray-700">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-2">
                            <Badge color="success">Đã duyệt</Badge>
                        </div>
                        <p><span className="font-medium">Thời gian:</span> {selectedEvent?.start ? dayjs(selectedEvent.start).format('DD/MM/YYYY HH:mm') : 'N/A'} - {selectedEvent?.end ? dayjs(selectedEvent.end).format('HH:mm') : 'N/A'}</p>
                        <p><span className="font-medium">Thời lượng:</span> {selectedEvent?.extendedProps?.durationMinutes || 0} phút</p>
                        <p><span className="font-medium">Khách hàng:</span> {selectedEvent?.extendedProps?.customerName || 'N/A'}</p>
                        {selectedEvent?.extendedProps?.customerPhone && (
                            <p><span className="font-medium">SĐT khách:</span> {selectedEvent.extendedProps.customerPhone}</p>
                        )}
                        <p><span className="font-medium">Vị trí:</span> {selectedEvent?.extendedProps?.location || 'Chưa có thông tin'}</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default EmployeeCalendarPage;
