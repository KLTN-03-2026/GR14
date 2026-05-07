import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import { Home, Map, Calendar as CalendarIcon, FileText, Clock, CheckCircle2, Activity, XCircle, MapPin } from "lucide-react";
import { houseApi, landApi, appointmentApi, postApi } from "@/api";
import { analyticsApi } from "@/api/analytics";
import type { House, Land, Appointment } from "@/types";
import type { LocationStat, AppointmentRates, HeatmapPoint } from "@/types/analytics";
import {
    AnalyticsAreaChart, AnalyticsDonutChart, HorizontalBar,
    ChartSkeleton, EmptyState, HeatmapChart,
} from "@/components/analytics/charts";
import {
    SectionCard, GoalTrackerCard, SLAComplianceCard, ResponseTimeCard,
    WorkloadCalendarCard, MonthlyComparisonCard, MyPropertyByLocationCard,
} from "./dashboard-cards";

// ─── Month/Year Filter ────────────────────────────────
function TimeFilter({ month, year, onMonth, onYear }: {
    month: number; year: number; onMonth: (m: number) => void; onYear: (y: number) => void;
}) {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];
    const selectStyle: React.CSSProperties = {
        border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px",
        fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer",
    };
    return (
        <div className="flex items-center gap-2">
            <select value={month} onChange={e => onMonth(+e.target.value)} style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                ))}
            </select>
            <select value={year} onChange={e => onYear(+e.target.value)} style={selectStyle}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );
}

// ─── Appointment Trend (filtered by month/year) ───────
function MyAppointmentsTrendCard({ appointments, month, year }: {
    appointments: Appointment[]; month: number; year: number;
}) {
    const data = useMemo(() => {
        const map: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(year, month - 1 - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            map[key] = 0;
        }
        appointments.forEach(a => {
            const d = new Date(a.appointmentDate || a.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (map[key] !== undefined) map[key]++;
        });
        return Object.entries(map).map(([time, total]) => ({ time, total }));
    }, [appointments, month, year]);

    return (
        <SectionCard title="Xu hướng lịch hẹn" subtitle="6 tháng tính đến tháng đã chọn">
            {appointments.length === 0
                ? <EmptyState message="Chưa có dữ liệu lịch hẹn" />
                : <AnalyticsAreaChart data={data as any} dataKey="total" xKey="time" name="Lịch hẹn" color="#8b5cf6" height={200} />}
        </SectionCard>
    );
}

// ─── My Appointment Pipeline (filtered) ──────────────
const PIPELINE_ITEMS = [
    { key: "pending", label: "Chờ duyệt", icon: Clock, color: "#f59e0b", bg: "#f59e0b0d" },
    { key: "approved", label: "Đã duyệt", icon: CheckCircle2, color: "#10b981", bg: "#10b9810d" },
    { key: "completed", label: "Hoàn thành", icon: Activity, color: "#6366f1", bg: "#6366f10d" },
    { key: "rejected", label: "Từ chối", icon: XCircle, color: "#ef4444", bg: "#ef44440d" },
] as const;

function MyAppointmentPipelineCard({ appointments, month, year }: {
    appointments: Appointment[]; month: number; year: number;
}) {
    const filtered = useMemo(() => appointments.filter(a => {
        const d = new Date(a.appointmentDate || a.createdAt);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
    }), [appointments, month, year]);

    const rates = useMemo(() => {
        let pending = 0, approved = 0, rejected = 0, completed = 0;
        filtered.forEach(a => {
            if (a.status === 0) pending++;
            if (a.status === 1) approved++;
            if (a.status === 2) rejected++;
            if (a.actualStatus === 1) completed++;
        });
        const total = filtered.length;
        return { total, pending, approved, rejected, completed, completionRate: approved > 0 ? completed / approved : 0, rejectionRate: total > 0 ? rejected / total : 0 };
    }, [filtered]);

    return (
        <SectionCard title="Pipeline lịch hẹn" subtitle={`Tháng ${month}/${year} — lịch hẹn của tôi`}
            headerRight={<span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#6366f114", color: "#6366f1" }}>{rates.total} tổng</span>}>
            {filtered.length === 0 ? <EmptyState message="Không có lịch hẹn trong tháng này" /> : (
                <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {PIPELINE_ITEMS.map(({ key, label, icon: Icon, color, bg }) => {
                            const count = rates[key] as number;
                            const pct = rates.total > 0 ? ((count / rates.total) * 100).toFixed(0) : "0";
                            return (
                                <div key={key} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${color}20` }}>
                                    <div className="flex items-center gap-1.5 mb-1"><Icon size={13} style={{ color }} /><span className="text-xs font-medium" style={{ color }}>{label}</span></div>
                                    <div className="text-xl font-bold text-gray-800">{count}</div>
                                    <div className="text-xs text-gray-400">{pct}%</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                        <div className="flex justify-between mb-1.5">
                            <span className="text-sm text-gray-600">Tỷ lệ hoàn thành</span>
                            <span className="text-sm font-bold" style={{ color: "#6366f1" }}>{(rates.completionRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(rates.completionRate * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                        </div>
                    </div>
                </>
            )}
        </SectionCard>
    );
}

// ─── Upcoming Appointments ────────────────────────────
function UpcomingAppointmentsCard({ appointments }: { appointments: Appointment[] }) {
    const upcoming = useMemo(() => {
        const now = new Date();
        return appointments.filter(a => new Date(a.appointmentDate) >= now && a.status === 1 && a.actualStatus === 0)
            .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
            .slice(0, 4);
    }, [appointments]);

    return (
        <SectionCard title="Khách hàng sắp gặp" subtitle="Lịch hẹn đã duyệt trong tương lai gần">
            {upcoming.length === 0 ? <EmptyState message="Không có lịch hẹn sắp tới" /> : (
                <div className="space-y-3">
                    {upcoming.map(app => (
                        <div key={app.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#3b82f615", color: "#3b82f6" }}>
                                <CalendarIcon size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{app.customer?.user?.fullName || "Khách hàng"}</p>
                                <p className="text-xs text-gray-500 truncate">{app.house?.title || app.land?.title || "BĐS"}</p>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                                    <Clock size={11} />{dayjs(app.appointmentDate).format("HH:mm - DD/MM/YYYY")}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}

// ─── My Property Distribution ─────────────────────────
function MyPropertyDistributionCard({ houses, lands }: { houses: number; lands: number }) {
    const total = houses + lands;
    const data = [{ name: "Nhà", value: houses }, { name: "Đất", value: lands }];
    return (
        <SectionCard title="BĐS của tôi" subtitle="Tỷ lệ Nhà và Đất đang quản lý">
            {total === 0 ? <EmptyState message="Chưa quản lý BĐS nào" /> : (
                <>
                    <AnalyticsDonutChart data={data} nameKey="name" valueKey="value" colors={["#3b82f6", "#10b981"]} height={180} />
                    <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                        {[{ label: "Nhà", value: houses, color: "#3b82f6" }, { label: "Đất", value: lands, color: "#10b981" }].map(i => (
                            <div key={i.label} className="flex-1 rounded-xl p-3 text-center" style={{ background: `${i.color}08`, border: `1px solid ${i.color}20` }}>
                                <div className="text-xs font-medium mb-1" style={{ color: i.color }}>{i.label}</div>
                                <div className="text-xl font-bold text-gray-800">{i.value}</div>
                                <div className="text-xs text-gray-400">{total > 0 ? ((i.value / total) * 100).toFixed(1) : 0}%</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </SectionCard>
    );
}

// ─── System: Top Locations ────────────────────────────
function TopLocationsCard() {
    const [locations, setLocations] = useState<LocationStat[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { analyticsApi.getTopLocations().then(setLocations).catch(console.error).finally(() => setLoading(false)); }, []);
    const top = locations.slice(0, 5), maxTotal = top[0]?.total ?? 1;
    return (
        <SectionCard title="Top khu vực (Toàn HT)" subtitle="Tỉnh/thành có nhiều BĐS nhất"
            headerRight={<span className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "#f43f5e14", color: "#f43f5e" }}><MapPin size={11} />{locations.length} khu vực</span>}>
            {loading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 rounded-lg animate-pulse" style={{ background: "#f1f5f9", width: `${85 - i * 10}%` }} />)}</div>
                : top.length === 0 ? <EmptyState message="Không có dữ liệu" />
                : <div className="space-y-3">
                    {top.map((loc, idx) => (
                        <div key={loc.city}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={idx < 3 ? { background: "#f59e0b18", color: "#f59e0b" } : { background: "#f1f5f9", color: "#94a3b8" }}>{idx + 1}</span>
                                    <span className="text-sm font-medium text-gray-700">{loc.city}</span>
                                </div>
                                <div className="flex gap-1">
                                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "#6366f114", color: "#6366f1" }}>{loc.houses} nhà</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "#10b98114", color: "#10b981" }}>{loc.lands} đất</span>
                                </div>
                            </div>
                            <HorizontalBar label="" value={loc.total} max={maxTotal} color={idx < 3 ? "#6366f1" : "#94a3b8"} suffix=" tin" />
                        </div>
                    ))}
                </div>}
        </SectionCard>
    );
}

// ─── System: Appointment Pipeline ─────────────────────
function SystemAppointmentPipelineCard() {
    const [rates, setRates] = useState<AppointmentRates | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { analyticsApi.getAppointmentRates().then(setRates).catch(console.error).finally(() => setLoading(false)); }, []);
    return (
        <SectionCard title="Pipeline lịch hẹn (Toàn HT)" subtitle="Trạng thái tổng hợp toàn bộ lịch hẹn"
            headerRight={rates ? <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#6366f114", color: "#6366f1" }}>{rates.total.toLocaleString("vi-VN")} tổng</span> : undefined}>
            {loading ? <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "#f1f5f9" }} />)}</div>
                : !rates ? <EmptyState message="Không có dữ liệu" />
                : <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {PIPELINE_ITEMS.map(({ key, label, icon: Icon, color, bg }) => {
                            const count = rates[key] as number;
                            const pct = rates.total > 0 ? ((count / rates.total) * 100).toFixed(0) : "0";
                            return (
                                <div key={key} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${color}20` }}>
                                    <div className="flex items-center gap-1.5 mb-1"><Icon size={13} style={{ color }} /><span className="text-xs font-medium" style={{ color }}>{label}</span></div>
                                    <div className="text-xl font-bold text-gray-800">{count.toLocaleString("vi-VN")}</div>
                                    <div className="text-xs text-gray-400">{pct}%</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                        <div className="flex justify-between mb-1.5">
                            <span className="text-sm text-gray-600">Tỷ lệ hoàn thành</span>
                            <span className="text-sm font-bold" style={{ color: "#6366f1" }}>{(rates.completionRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}>
                            <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(rates.completionRate * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                        </div>
                    </div>
                </>}
        </SectionCard>
    );
}

// ─── System: Appointment Heatmap ─────────────────────
function AppointmentHeatmapCard() {
    const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { analyticsApi.getHeatmap().then(setHeatmap).catch(console.error).finally(() => setLoading(false)); }, []);
    return (
        <SectionCard title="Heatmap lịch hẹn theo giờ" subtitle="Giờ nào có nhiều lịch hẹn nhất (Toàn HT)">
            {loading ? <ChartSkeleton height={100} /> : heatmap.length === 0 ? <EmptyState message="Không có dữ liệu" /> : <div className="pt-2"><HeatmapChart data={heatmap} /></div>}
        </SectionCard>
    );
}

// ─── System: Property Trend ───────────────────────────
function PropertyTrendCard() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { analyticsApi.compareHouseLandMonthly().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);
    return (
        <SectionCard title="Nhà vs Đất theo tháng" subtitle="Xu hướng thị trường BĐS (Toàn HT)">
            {loading ? <ChartSkeleton /> : data.length === 0 ? <EmptyState message="Không có dữ liệu" /> : (
                <div>
                    <AnalyticsAreaChart data={data} dataKey="house" xKey="time" name="Nhà" color="#3b82f6" height={150} />
                    <AnalyticsAreaChart data={data} dataKey="land" xKey="time" name="Đất" color="#10b981" height={150} />
                </div>
            )}
        </SectionCard>
    );
}

// ─── Main Page ─────────────────────────────────────────
const EmployeeDashboardPage = () => {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [stats, setStats] = useState({ houses: 0, lands: 0, appointments: 0, posts: 0 });
    const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
    const [myHouses, setMyHouses] = useState<House[]>([]);
    const [myLands, setMyLands] = useState<Land[]>([]);

    useEffect(() => {
        const load = async () => {
            const [hRes, lRes, aRes, pRes, myApptRes, myHRes, myLRes] = await Promise.allSettled([
                houseApi.getMyHouses({ limit: 1 }),
                landApi.getMyLands({ limit: 1 }),
                appointmentApi.getAll({ limit: 1 } as any),
                postApi.getAll({ limit: 1 } as any),
                appointmentApi.getMyAssigned(),
                houseApi.getMyHouses({ limit: 999 }),
                landApi.getMyLands({ limit: 999 }),
            ]);
            setStats({
                houses: hRes.status === "fulfilled" ? (hRes.value.data?.totalItems || hRes.value.data?.total || 0) : 0,
                lands: lRes.status === "fulfilled" ? (lRes.value.data?.totalItems || lRes.value.data?.total || 0) : 0,
                appointments: aRes.status === "fulfilled" ? (aRes.value.data?.totalItems || aRes.value.data?.total || 0) : 0,
                posts: pRes.status === "fulfilled" ? (pRes.value.data?.totalItems || pRes.value.data?.total || 0) : 0,
            });
            if (myApptRes.status === "fulfilled") setMyAppointments(myApptRes.value.data || []);
            if (myHRes.status === "fulfilled") setMyHouses(myHRes.value.data?.items || myHRes.value.data?.data || []);
            if (myLRes.status === "fulfilled") setMyLands(myLRes.value.data?.items || myLRes.value.data?.data || []);
        };
        load().catch(console.error);
    }, []);

    const CARDS = [
        { label: "Nhà (Của tôi)", value: stats.houses, icon: Home, colors: "bg-blue-50 text-blue-600 border-blue-200" },
        { label: "Đất (Của tôi)", value: stats.lands, icon: Map, colors: "bg-green-50 text-green-600 border-green-200" },
        { label: "Lịch hẹn (Công ty)", value: stats.appointments, icon: CalendarIcon, colors: "bg-purple-50 text-purple-600 border-purple-200" },
        { label: "Bài đăng (Công ty)", value: stats.posts, icon: FileText, colors: "bg-amber-50 text-amber-600 border-amber-200" },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tổng quan công việc</h1>
                    <p className="text-gray-500 mt-1">Chào mừng bạn trở lại, chúc một ngày làm việc hiệu quả!</p>
                </div>
                <TimeFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {CARDS.map((card, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                            <h3 className="text-3xl font-bold text-gray-900">{card.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl border ${card.colors}`}><card.icon size={22} strokeWidth={2} /></div>
                    </div>
                ))}
            </div>

            {/* Section divider */}
            <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-dashed border-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Thống kê cá nhân</span>
                <div className="flex-1 border-t border-dashed border-gray-200" />
            </div>

            {/* Row 1: Goal + SLA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GoalTrackerCard appointments={myAppointments} month={month} year={year} />
                <SLAComplianceCard appointments={myAppointments} month={month} year={year} />
            </div>

            {/* Row 2: Response Time + Workload Calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ResponseTimeCard appointments={myAppointments} month={month} year={year} />
                <WorkloadCalendarCard appointments={myAppointments} />
            </div>

            {/* Row 3: Monthly Comparison + Upcoming */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <MonthlyComparisonCard appointments={myAppointments} month={month} year={year} />
                <UpcomingAppointmentsCard appointments={myAppointments} />
            </div>

            {/* Row 4: Appointment Trend + Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <MyAppointmentsTrendCard appointments={myAppointments} month={month} year={year} />
                <MyAppointmentPipelineCard appointments={myAppointments} month={month} year={year} />
            </div>

            {/* Row 5: Property Distribution + By Location */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <MyPropertyDistributionCard houses={stats.houses} lands={stats.lands} />
                <MyPropertyByLocationCard houses={myHouses} lands={myLands} />
            </div>

            {/* Section divider */}
            <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 border-t border-dashed border-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Toàn hệ thống</span>
                <div className="flex-1 border-t border-dashed border-gray-200" />
            </div>

            {/* Row 6: Top Locations + System Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <TopLocationsCard />
                <SystemAppointmentPipelineCard />
            </div>

            {/* Row 7: Heatmap + Property Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AppointmentHeatmapCard />
                <PropertyTrendCard />
            </div>

            {/* Tips */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Chỉ dẫn</h2>
                <ul className="list-disc pl-5 text-gray-600 space-y-1.5 text-sm">
                    <li>Dùng bộ lọc <b>Tháng / Năm</b> ở trên để xem thống kê theo kỳ cụ thể.</li>
                    <li>Kiểm tra <b>SLA</b> thường xuyên — phản hồi khách trong vòng 1 giờ sau khi được phân công.</li>
                    <li>Xem <b>Heatmap</b> để biết khung giờ nào khách hay đặt lịch, chủ động sắp xếp.</li>
                    <li>Cập nhật <b>Trạng thái thực tế</b> sau mỗi cuộc gặp để tỷ lệ hoàn thành được tính chính xác.</li>
                </ul>
            </div>
        </div>
    );
};

export default EmployeeDashboardPage;
