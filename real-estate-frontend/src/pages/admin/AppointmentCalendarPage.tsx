import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import viLocale from '@fullcalendar/core/locales/vi';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { appointmentApi, employeeApi } from '@/api';
import { Button, Modal } from '@/components/ui';
import { getApiErrorMessage } from '@/utils';
import type { AppointmentCalendarEvent, Employee } from '@/types';

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps?: {
    employeeId?: number;
    employeeName?: string;
    customerName?: string;
    durationMinutes?: number;
    location?: string;
  };
};

type SlotSuggestion = {
  at: string;
  availableEmployees: number;
};

const AppointmentCalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<SlotSuggestion[]>([]);

  const loadEmployees = useCallback(async () => {
    try {
      const response = await employeeApi.getAll({ page: 1, limit: 200 });
      setEmployees(response.data?.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Tải danh sách nhân viên thất bại'));
    }
  }, []);

  const mapEvents = (payload: AppointmentCalendarEvent[]): CalendarEvent[] => {
    return payload.map((item) => ({
      id: String(item.id),
      title: item.title,
      start: item.start,
      end: item.end,
      extendedProps: item.extendedProps,
    }));
  };

  const loadEvents = useCallback(async (start: Date, end: Date) => {
    try {
      const response = await appointmentApi.getCalendarEvents({
        start: start.toISOString(),
        end: end.toISOString(),
        ...(selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}),
      });

      setEvents(mapEvents(response.data || []));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Tải dữ liệu lịch thất bại'));
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!visibleRange) return;
    void loadEvents(visibleRange.start, visibleRange.end);
  }, [visibleRange, loadEvents]);

  const refreshCalendar = async () => {
    if (!visibleRange) return;
    await loadEvents(visibleRange.start, visibleRange.end);
  };

  const openEventModal = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEditingEmployeeId(event.extendedProps?.employeeId || '');
    setSuggestions([]);
    setEventModalOpen(true);
  };

  const moveEvent = async (eventId: string, date: Date, employeeId?: number) => {
    await appointmentApi.moveCalendarAppointment(Number(eventId), {
      appointmentDate: date.toISOString(),
      ...(employeeId ? { employeeId } : {}),
    });
  };

  const extractSuggestions = (error: unknown) => {
    const maybeData = (error as { response?: { data?: { message?: string | string[] | { suggestions?: SlotSuggestion[] } } } })?.response?.data;
    const message = maybeData?.message;

    if (message && typeof message === 'object' && 'suggestions' in message) {
      return (message.suggestions || []) as SlotSuggestion[];
    }

    return [] as SlotSuggestion[];
  };

  const handleDropOrResize = async (eventId: string, start: Date, revert: () => void) => {
    try {
      await moveEvent(eventId, start);
      toast.success('Điều phối lịch thành công');
      await refreshCalendar();
    } catch (error) {
      const nextSuggestions = extractSuggestions(error);
      setSuggestions(nextSuggestions);
      toast.error(getApiErrorMessage(error, 'Điều phối lịch thất bại'));
      revert();
    }
  };

  const handleEventDrop = async (arg: any) => {
    if (!arg.event.start) {
      arg.revert();
      return;
    }

    await handleDropOrResize(arg.event.id, arg.event.start, arg.revert);
  };

  const handleEventResize = async (arg: any) => {
    if (!arg.event.start) {
      arg.revert();
      return;
    }

    await handleDropOrResize(arg.event.id, arg.event.start, arg.revert);
  };

  const handleManualReassign = async () => {
    if (!selectedEvent || !selectedEvent.start) return;

    setSaving(true);
    try {
      await moveEvent(selectedEvent.id, new Date(selectedEvent.start), editingEmployeeId ? Number(editingEmployeeId) : undefined);
      toast.success('Điều phối lại nhân viên thành công');
      setEventModalOpen(false);
      setSelectedEvent(null);
      await refreshCalendar();
    } catch (error) {
      const nextSuggestions = extractSuggestions(error);
      setSuggestions(nextSuggestions);
      toast.error(getApiErrorMessage(error, 'Điều phối lại thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const renderSuggestions = useMemo(() => {
    if (suggestions.length === 0) return null;

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-900">Gợi ý khung giờ thay thế</p>
        <div className="mt-2 space-y-1">
          {suggestions.map((item) => (
            <button
              key={item.at}
              className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-100"
              onClick={() => {
                if (!selectedEvent) return;
                setSelectedEvent({
                  ...selectedEvent,
                  start: item.at,
                  end: dayjs(item.at)
                    .add(selectedEvent.extendedProps?.durationMinutes || 60, 'minute')
                    .toISOString(),
                });
              }}
            >
              {dayjs(item.at).format('DD/MM/YYYY HH:mm')} - {item.availableEmployees} nhân viên khả dụng
            </button>
          ))}
        </div>
      </div>
    );
  }, [suggestions, selectedEvent]);

  const breakDisplay = 'Nghỉ trưa: 12:00 - 13:30 | Slot: 30 phút | Khung làm việc: 08:00 - 17:30';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Điều phối lịch hẹn</h2>
          <p className="text-sm text-gray-500">Chỉ hiển thị lịch hẹn đã duyệt. Kéo-thả để đổi giờ và điều phối lại nhân viên.</p>
          <p className="mt-1 text-xs text-gray-500">{breakDisplay}</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Tất cả nhân viên</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.user?.fullName || employee.code}
              </option>
            ))}
          </select>

        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locales={[viLocale]}
          locale="vi"
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
          editable
          eventDurationEditable={false}
          selectable
          slotEventOverlap={false}
          eventMaxStack={3}
          dayMaxEventRows={3}
          eventMinHeight={26}
          slotDuration="00:30:00"
          slotLabelInterval="00:30:00"
          slotMinTime="08:00:00"
          slotMaxTime="17:30:00"
          businessHours={[
            { daysOfWeek: [1, 2, 3, 4, 5, 6, 0], startTime: '08:00', endTime: '12:00' },
            { daysOfWeek: [1, 2, 3, 4, 5, 6, 0], startTime: '13:30', endTime: '17:30' },
          ]}
          nowIndicator
          events={events}
          eventDrop={(arg) => { void handleEventDrop(arg); }}
          eventResize={(arg) => { void handleEventResize(arg); }}
          eventClick={(arg) => openEventModal(arg.event.toPlainObject() as CalendarEvent)}
          datesSet={(arg: any) => {
            setVisibleRange((prev) => {
              const nextStart = arg.start as Date;
              const nextEnd = arg.end as Date;

              if (
                prev &&
                prev.start.getTime() === nextStart.getTime() &&
                prev.end.getTime() === nextEnd.getTime()
              ) {
                return prev;
              }

              return {
                start: nextStart,
                end: nextEnd,
              };
            });
          }}
          height="auto"
        />
      </div>

      <Modal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setSelectedEvent(null);
          setSuggestions([]);
        }}
        title="Điều phối lịch hẹn"
        width="max-w-lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setEventModalOpen(false)}>
              Đóng
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void handleManualReassign()}>
              Lưu điều phối
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p><span className="font-medium">Lịch:</span> {selectedEvent?.title}</p>
            <p><span className="font-medium">Nhân viên hiện tại:</span> {selectedEvent?.extendedProps?.employeeName || 'N/A'}</p>
            <p><span className="font-medium">Khung giờ:</span> {selectedEvent?.start ? dayjs(selectedEvent.start).format('DD/MM/YYYY HH:mm') : 'N/A'}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nhân viên phụ trách</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={editingEmployeeId}
              onChange={(e) => setEditingEmployeeId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Giữ nguyên nhân viên</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.user?.fullName || employee.code}
                </option>
              ))}
            </select>
          </div>

          {renderSuggestions}
        </div>
      </Modal>
    </div>
  );
};

export default AppointmentCalendarPage;
