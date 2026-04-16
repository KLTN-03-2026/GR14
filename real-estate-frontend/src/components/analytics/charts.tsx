import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
  payload: Record<string, unknown>;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}

interface KPICardProps {
  title: string;
  value: string | number;
  growth?: number | null;
  icon: ReactNode;
  accent: string;
}

interface AreaChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  color?: string;
  xKey?: string;
  name?: string;
  height?: number;
  formatter?: (v: number) => string;
}

interface BarDef {
  key: string;
  name: string;
  color: string;
}

interface BarChartProps {
  data: Record<string, unknown>[];
  bars: BarDef[];
  xKey?: string;
  height?: number;
  formatter?: (v: number) => string;
}

interface LineDef {
  key: string;
  name: string;
  color: string;
}

interface MultiLineChartProps {
  data: Record<string, unknown>[];
  lines: LineDef[];
  xKey?: string;
  height?: number;
  formatter?: (v: number) => string;
}

interface DonutChartProps {
  data: Record<string, unknown>[];
  nameKey?: string;
  valueKey?: string;
  colors: string[];
  height?: number;
}

interface HorizontalBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}

interface HeatmapChartProps {
  data: { hour: number; label: string; total: number }[];
}

// ─── Light-theme constants ────────────────────────────────────────────────────
const AXIS_STYLE = { fill: "#64748b", fontSize: 11 };
const GRID_COLOR = "#e5e7eb";

// ─── ChartCard ────────────────────────────────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  children,
  action,
}: ChartCardProps) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-semibold text-base" style={{ color: "#0f172a" }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── KPICard ──────────────────────────────────────────────────────────────────
export function KPICard({ title, value, growth, icon, accent }: KPICardProps) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Soft accent tint */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 pointer-events-none"
        style={{ background: accent, filter: "blur(20px)" }}
      />
      <div className="flex items-start justify-between relative">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider mb-3"
            style={{ color: "#94a3b8" }}
          >
            {title}
          </p>
          <p className="text-2xl font-bold" style={{ color: "#0f172a" }}>
            {value}
          </p>
          {growth !== undefined && growth !== null && (
            <p
              className="text-xs mt-1.5 font-medium"
              style={{ color: growth >= 0 ? "#10b981" : "#ef4444" }}
            >
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% so với tháng trước
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-lg"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        color: "#0f172a",
      }}
    >
      <p className="font-medium mb-2" style={{ color: "#64748b" }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span style={{ color: "#64748b" }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: "#0f172a" }}>
            {formatter
              ? formatter(entry.value)
              : entry.value.toLocaleString("vi-VN")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────
export function AnalyticsAreaChart({
  data,
  dataKey,
  color = "#6366f1",
  xKey = "time",
  name = "Giá trị",
  height = 280,
  formatter,
}: AreaChartProps) {
  const gradId = `grad-${dataKey}-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatter}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as unknown as TooltipEntry[]}
              label={label as string}
              formatter={formatter}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Multi-Line Chart ─────────────────────────────────────────────────────────
export function AnalyticsMultiLineChart({
  data,
  lines,
  xKey = "time",
  height = 280,
  formatter,
}: MultiLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatter}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as unknown as TooltipEntry[]}
              label={label as string}
              formatter={formatter}
            />
          )}
        />
        <Legend
          wrapperStyle={{ color: "#64748b", fontSize: 12, paddingTop: 12 }}
        />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
export function AnalyticsBarChart({
  data,
  bars,
  xKey = "time",
  height = 280,
  formatter,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatter}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as unknown as TooltipEntry[]}
              label={label as string}
              formatter={formatter}
            />
          )}
        />
        {bars.length > 1 && (
          <Legend
            wrapperStyle={{ color: "#64748b", fontSize: 12, paddingTop: 12 }}
          />
        )}
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name}
            fill={b.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
export function AnalyticsDonutChart({
  data,
  nameKey = "name",
  valueKey = "value",
  colors,
  height = 280,
}: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          dataKey={valueKey}
          nameKey={nameKey}
          paddingAngle={3}
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0] as TooltipEntry;
            return (
              <div
                className="rounded-xl px-4 py-3 text-sm shadow-lg"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  color: "#0f172a",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span style={{ color: "#64748b" }}>{item.name}:</span>
                  <span className="font-bold" style={{ color: "#0f172a" }}>
                    {item.value.toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ color: "#64748b", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Horizontal Bar ───────────────────────────────────────────────────────────
export function HorizontalBar({
  label,
  value,
  max,
  color,
  suffix = "",
}: HorizontalBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs truncate" style={{ color: "#64748b" }}>
        {label}
      </div>
      <div
        className="flex-1 h-2 rounded-full"
        style={{ background: "#f1f5f9" }}
      >
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div
        className="text-xs font-semibold w-20 text-right"
        style={{ color: "#0f172a" }}
      >
        {value.toLocaleString("vi-VN")}
        {suffix}
      </div>
    </div>
  );
}

// ─── Heatmap Chart ────────────────────────────────────────────────────────────
export function HeatmapChart({ data }: HeatmapChartProps) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="grid grid-cols-12 gap-1.5">
      {data.map((d) => {
        const intensity = d.total / max;
        const bg = `rgba(99,102,241,${0.06 + intensity * 0.7})`;
        const textColor = intensity > 0.55 ? "#ffffff" : "#0f172a";
        return (
          <div key={d.hour} className="group relative">
            <div
              className="h-12 rounded-lg flex items-end justify-center pb-1 cursor-default transition-all duration-200"
              style={{ background: bg }}
            >
              {d.total > 0 && (
                <span
                  className="text-xs font-bold"
                  style={{ color: textColor }}
                >
                  {d.total}
                </span>
              )}
            </div>
            <p
              className="text-center mt-1"
              style={{ color: "#94a3b8", fontSize: 10 }}
            >
              {d.label}
            </p>
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 rounded-lg px-2 py-1 text-xs whitespace-nowrap pointer-events-none"
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#0f172a",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              {d.label}: {d.total} lịch
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton / Empty ─────────────────────────────────────────────────────────
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="rounded-xl animate-pulse"
      style={{ height, background: "#f1f5f9" }}
    />
  );
}

export function EmptyState({
  message = "Không có dữ liệu",
}: {
  message?: string;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{
        height: 200,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
      }}
    >
      <p style={{ color: "#94a3b8" }}>{message}</p>
    </div>
  );
}
