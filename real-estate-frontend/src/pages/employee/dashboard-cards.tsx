import { useMemo } from "react";
import dayjs from "dayjs";
import { Target, ShieldCheck, Zap, TrendingUp, TrendingDown } from "lucide-react";
import type { Appointment, House, Land } from "@/types";
import { HorizontalBar, EmptyState } from "@/components/analytics/charts";

// ─── Shared ───────────────────────────────────────────
export function SectionCard({ title, subtitle, children, headerRight }: {
    title: string; subtitle?: string; children: React.ReactNode; headerRight?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-6" style={{ border: "1px solid #e5e7eb" }}>
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h3 className="text-gray-800 font-semibold text-base">{title}</h3>
                    {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
                </div>
                {headerRight}
            </div>
            {children}
        </div>
    );
}

// ─── SVG Progress Ring ────────────────────────────────
function ProgressRing({ pct, color, size = 120 }: { pct: number; color: string; size?: number }) {
    const r = (size - 12) / 2, c = 2 * Math.PI * r;
    const offset = c - (Math.min(pct, 100) / 100) * c;
    return (
        <svg width={size} height={size} className="block mx-auto">
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{ transition: "stroke-dashoffset 1s ease" }} />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
                className="text-xl font-bold" fill="#0f172a">{Math.round(pct)}%</text>
        </svg>
    );
}

// ─── 1. Goal Tracker ──────────────────────────────────
export function GoalTrackerCard({ appointments, month, year }: {
    appointments: Appointment[]; month: number; year: number;
}) {
    const { completed, total, target, pct } = useMemo(() => {
        const thisMonth = appointments.filter(a => {
            const d = new Date(a.appointmentDate || a.createdAt);
            return d.getMonth() + 1 === month && d.getFullYear() === year;
        });
        const comp = thisMonth.filter(a => a.actualStatus === 1).length;

        // target = avg of last 3 months
        let sum = 0, cnt = 0;
        for (let i = 1; i <= 3; i++) {
            let m = month - i, y = year;
            if (m <= 0) { m += 12; y--; }
            const c = appointments.filter(a => {
                const d = new Date(a.appointmentDate || a.createdAt);
                return d.getMonth() + 1 === m && d.getFullYear() === y;
            }).length;
            if (c > 0) { sum += c; cnt++; }
        }
        const tgt = cnt > 0 ? Math.round(sum / cnt) : Math.max(thisMonth.length, 5);
        return { completed: comp, total: thisMonth.length, target: tgt, pct: tgt > 0 ? (comp / tgt) * 100 : 0 };
    }, [appointments, month, year]);

    const color = pct >= 100 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";

    return (
        <SectionCard title="🎯 Mục tiêu tháng" subtitle={`Tháng ${month}/${year}`}>
            <ProgressRing pct={pct} color={color} />
            <div className="text-center mt-3">
                <p className="text-sm text-gray-600">
                    <span className="font-bold text-gray-900">{completed}</span> / {target} hoàn thành
                </p>
                <p className="text-xs text-gray-400 mt-1">{total} lịch hẹn tổng trong tháng</p>
            </div>
            {pct >= 100 && (
                <div className="mt-3 text-center text-sm font-medium px-3 py-1.5 rounded-full mx-auto w-fit"
                    style={{ background: "#10b98114", color: "#10b981" }}>
                    🎉 Đạt mục tiêu!
                </div>
            )}
        </SectionCard>
    );
}

// ─── 2. SLA Compliance ────────────────────────────────
export function SLAComplianceCard({ appointments, month, year }: {
    appointments: Appointment[]; month: number; year: number;
}) {
    const { onTrack, atRisk, breached, total, rate } = useMemo(() => {
        const filtered = appointments.filter(a => {
            const d = new Date(a.appointmentDate || a.createdAt);
            return d.getMonth() + 1 === month && d.getFullYear() === year && a.slaStatus !== undefined;
        });
        let on = 0, at = 0, br = 0;
        filtered.forEach(a => {
            if (a.slaStatus === 0) on++;
            else if (a.slaStatus === 1) at++;
            else if (a.slaStatus === 2) br++;
        });
        const t = on + at + br;
        return { onTrack: on, atRisk: at, breached: br, total: t, rate: t > 0 ? (on / t) * 100 : 0 };
    }, [appointments, month, year]);

    const items = [
        { label: "Đúng hạn", value: onTrack, color: "#10b981", icon: "✅" },
        { label: "Sắp trễ", value: atRisk, color: "#f59e0b", icon: "⚠️" },
        { label: "Trễ hạn", value: breached, color: "#ef4444", icon: "❌" },
    ];

    return (
        <SectionCard title="⚡ Tuân thủ SLA" subtitle={`Tháng ${month}/${year}`}
            headerRight={
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: rate >= 80 ? "#10b98114" : "#ef444414", color: rate >= 80 ? "#10b981" : "#ef4444" }}>
                    {rate.toFixed(0)}% đúng hạn
                </span>
            }>
            {total === 0 ? <EmptyState message="Chưa có dữ liệu SLA" /> : (
                <>
                    <div className="space-y-3 mb-4">
                        {items.map(it => {
                            const pct = total > 0 ? (it.value / total) * 100 : 0;
                            return (
                                <div key={it.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">{it.icon} {it.label}</span>
                                        <span className="font-bold" style={{ color: it.color }}>{it.value}</span>
                                    </div>
                                    <div className="h-2 rounded-full" style={{ background: "#f1f5f9" }}>
                                        <div className="h-2 rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%`, background: it.color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <ProgressRing pct={rate} color={rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444"} size={100} />
                </>
            )}
        </SectionCard>
    );
}

// ─── 3. Response Time ─────────────────────────────────
export function ResponseTimeCard({ appointments, month, year }: {
    appointments: Appointment[]; month: number; year: number;
}) {
    const { avgHours, level, color, prevAvg, trend } = useMemo(() => {
        const calc = (m: number, y: number) => {
            const filtered = appointments.filter(a => {
                const d = new Date(a.appointmentDate || a.createdAt);
                return d.getMonth() + 1 === m && d.getFullYear() === y && a.assignedAt && a.firstContactAt;
            });
            if (filtered.length === 0) return null;
            const sum = filtered.reduce((s, a) => {
                return s + (new Date(a.firstContactAt!).getTime() - new Date(a.assignedAt!).getTime());
            }, 0);
            return sum / filtered.length / 3600000; // hours
        };
        const avg = calc(month, year);
        let pm = month - 1, py = year;
        if (pm <= 0) { pm = 12; py--; }
        const prev = calc(pm, py);

        const h = avg ?? 0;
        let lv: string, cl: string;
        if (h < 1) { lv = "Xuất sắc"; cl = "#10b981"; }
        else if (h < 4) { lv = "Tốt"; cl = "#3b82f6"; }
        else if (h < 8) { lv = "Cần cải thiện"; cl = "#f59e0b"; }
        else { lv = "Chậm"; cl = "#ef4444"; }

        return {
            avgHours: avg, level: lv, color: cl, prevAvg: prev,
            trend: avg !== null && prev !== null ? ((avg - prev) / prev) * 100 : null,
        };
    }, [appointments, month, year]);

    return (
        <SectionCard title="🕐 Thời gian phản hồi" subtitle={`TB từ phân công → liên hệ khách`}>
            <div className="text-center py-2">
                {avgHours === null ? <EmptyState message="Chưa có dữ liệu phản hồi" /> : (
                    <>
                        <div className="text-4xl font-bold" style={{ color }}>{avgHours.toFixed(1)}</div>
                        <div className="text-sm text-gray-500 mt-1">giờ trung bình</div>
                        <div className="mt-2 inline-block text-xs font-medium px-3 py-1 rounded-full"
                            style={{ background: `${color}14`, color }}>{level}</div>
                        {trend !== null && (
                            <div className="flex items-center justify-center gap-1 mt-3 text-xs">
                                {trend <= 0 ? <TrendingDown size={14} className="text-green-500" /> : <TrendingUp size={14} className="text-red-500" />}
                                <span style={{ color: trend <= 0 ? "#10b981" : "#ef4444" }}>
                                    {Math.abs(trend).toFixed(0)}% so tháng trước
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </SectionCard>
    );
}

// ─── 4. Workload Calendar ─────────────────────────────
export function WorkloadCalendarCard({ appointments }: { appointments: Appointment[] }) {
    const days = useMemo(() => {
        const today = dayjs();
        const startOfWeek = today.startOf("week").add(1, "day"); // Monday
        const result: { label: string; date: string; count: number; isToday: boolean }[] = [];
        const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
        for (let i = 0; i < 7; i++) {
            const d = startOfWeek.add(i, "day");
            const dateStr = d.format("YYYY-MM-DD");
            const count = appointments.filter(a => {
                return dayjs(a.appointmentDate).format("YYYY-MM-DD") === dateStr && a.status === 1;
            }).length;
            result.push({ label: labels[i], date: d.format("DD/MM"), count, isToday: d.isSame(today, "day") });
        }
        return result;
    }, [appointments]);

    const max = Math.max(...days.map(d => d.count), 1);

    return (
        <SectionCard title="📅 Lịch tuần này" subtitle="Số lịch hẹn đã duyệt mỗi ngày">
            <div className="grid grid-cols-7 gap-2">
                {days.map(d => {
                    const intensity = d.count / max;
                    const bg = d.count === 0 ? "#f8fafc" : `rgba(99,102,241,${0.1 + intensity * 0.5})`;
                    const textColor = intensity > 0.6 ? "#fff" : "#0f172a";
                    return (
                        <div key={d.label} className="text-center">
                            <div className="text-xs font-medium mb-1" style={{ color: d.isToday ? "#6366f1" : "#94a3b8" }}>
                                {d.label}
                            </div>
                            <div className="rounded-xl p-3 transition-all" style={{
                                background: bg,
                                border: d.isToday ? "2px solid #6366f1" : "1px solid #e5e7eb",
                            }}>
                                <div className="text-lg font-bold" style={{ color: textColor }}>{d.count}</div>
                                <div className="text-[10px] mt-0.5" style={{ color: d.isToday ? "#6366f1" : "#94a3b8" }}>
                                    {d.date}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}

// ─── 5. Monthly Comparison ────────────────────────────
export function MonthlyComparisonCard({ appointments, month, year }: {
    appointments: Appointment[]; month: number; year: number;
}) {
    const { curr, prev } = useMemo(() => {
        const calc = (m: number, y: number) => {
            const f = appointments.filter(a => {
                const d = new Date(a.appointmentDate || a.createdAt);
                return d.getMonth() + 1 === m && d.getFullYear() === y;
            });
            const comp = f.filter(a => a.actualStatus === 1).length;
            return { total: f.length, completed: comp, rate: f.length > 0 ? (comp / f.length) * 100 : 0 };
        };
        let pm = month - 1, py = year;
        if (pm <= 0) { pm = 12; py--; }
        return { curr: calc(month, year), prev: calc(pm, py) };
    }, [appointments, month, year]);

    const metrics = [
        { label: "Tổng lịch hẹn", c: curr.total, p: prev.total, color: "#6366f1" },
        { label: "Hoàn thành", c: curr.completed, p: prev.completed, color: "#10b981" },
        { label: "Tỷ lệ %", c: Math.round(curr.rate), p: Math.round(prev.rate), color: "#f59e0b", suffix: "%" },
    ];

    return (
        <SectionCard title="📊 So sánh tháng" subtitle={`Tháng ${month} vs tháng ${month === 1 ? 12 : month - 1}`}>
            <div className="space-y-4">
                {metrics.map(m => {
                    const diff = m.c - m.p;
                    const isUp = diff > 0;
                    return (
                        <div key={m.label} className="rounded-xl p-3" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">{m.label}</span>
                                <div className="flex items-center gap-1">
                                    {diff !== 0 && (
                                        <span className="text-xs font-medium" style={{ color: isUp ? "#10b981" : "#ef4444" }}>
                                            {isUp ? "▲" : "▼"} {Math.abs(diff)}{m.suffix || ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <div className="text-xs text-gray-400 mb-1">Tháng này</div>
                                    <div className="h-6 rounded-full" style={{ background: m.color, width: `${Math.max((m.c / Math.max(m.c, m.p, 1)) * 100, 8)}%`, transition: "width 0.7s" }} />
                                    <span className="text-sm font-bold text-gray-800">{m.c}{m.suffix || ""}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-gray-400 mb-1">Tháng trước</div>
                                    <div className="h-6 rounded-full" style={{ background: `${m.color}40`, width: `${Math.max((m.p / Math.max(m.c, m.p, 1)) * 100, 8)}%`, transition: "width 0.7s" }} />
                                    <span className="text-sm text-gray-500">{m.p}{m.suffix || ""}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}

// ─── 6. My Property by Location ───────────────────────
export function MyPropertyByLocationCard({ houses, lands }: { houses: House[]; lands: Land[] }) {
    const data = useMemo(() => {
        const map: Record<string, { houses: number; lands: number }> = {};
        houses.forEach(h => {
            const city = h.city || "Khác";
            if (!map[city]) map[city] = { houses: 0, lands: 0 };
            map[city].houses++;
        });
        lands.forEach(l => {
            const city = l.city || "Khác";
            if (!map[city]) map[city] = { houses: 0, lands: 0 };
            map[city].lands++;
        });
        return Object.entries(map)
            .map(([city, v]) => ({ city, ...v, total: v.houses + v.lands }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);
    }, [houses, lands]);

    const max = data[0]?.total ?? 1;

    return (
        <SectionCard title="🏠 BĐS theo khu vực" subtitle="Nhà + đất bạn quản lý theo tỉnh/thành">
            {data.length === 0 ? <EmptyState message="Chưa có dữ liệu" /> : (
                <div className="space-y-3">
                    {data.map(d => (
                        <div key={d.city}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-gray-700">{d.city}</span>
                                <span className="text-gray-400">
                                    <span style={{ color: "#3b82f6" }}>{d.houses} nhà</span>
                                    {" · "}
                                    <span style={{ color: "#10b981" }}>{d.lands} đất</span>
                                </span>
                            </div>
                            <HorizontalBar label="" value={d.total} max={max} color="#6366f1" suffix=" tin" />
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}
