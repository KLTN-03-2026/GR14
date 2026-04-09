// src/pages/admin/analytics/behavior.tsx
import { useEffect, useState } from "react";
import { Heart, MapPin, Home, TrendingUp } from "lucide-react";
import { analyticsApi } from "@/api/analytics";
import { useAnalyticsContext } from "@/pages/admin/DashboardPage";
import type {
  TimeType,
  TimeSeriesPoint,
  LocationStat,
  PropertyComparison,
  MonthlyComparison,
} from "@/types/analytics";
import {
  ChartCard,
  KPICard,
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsMultiLineChart,
  AnalyticsDonutChart,
  HorizontalBar,
  ChartSkeleton,
  EmptyState,
} from "@/components/analytics/charts";

const CITY_COLOR = "#f43f5e";
const HOUSE_COLOR = "#3b82f6";
const LAND_COLOR = "#f59e0b";

const TIME_LABEL: Record<TimeType, string> = {
  day: "ngày",
  month: "tháng",
  year: "năm",
};

export default function BehaviorAnalyticsPage() {
  const { timeType } = useAnalyticsContext();

  const [favTrend, setFavTrend] = useState<TimeSeriesPoint[]>([]);
  const [locations, setLocations] = useState<LocationStat[]>([]);
  const [comparison, setComparison] = useState<PropertyComparison[]>([]);
  const [compMonthly, setCompMonthly] = useState<MonthlyComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getFavoriteTrend(timeType),
      analyticsApi.getTopLocations(),
      analyticsApi.compareHouseLand(),
      analyticsApi.compareHouseLandMonthly(),
    ])
      .then(([favData, locData, compData, monthlyData]) => {
        setFavTrend(favData);
        setLocations(locData);
        setComparison(compData);
        setCompMonthly(monthlyData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeType]);

  const totalHouse = comparison.find((c) => c.type === "Nhà")?.total ?? 0;
  const totalLand = comparison.find((c) => c.type === "Đất")?.total ?? 0;
  const maxLoc = Math.max(...locations.map((l) => l.total), 1);
  const totalFavs = favTrend.reduce((s, d) => s + d.total, 0);

  const PROP_COLORS = [HOUSE_COLOR, LAND_COLOR];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tổng lượt yêu thích"
          value={totalFavs.toLocaleString("vi-VN")}
          icon={<Heart size={18} />}
          accent="#f43f5e"
        />
        <KPICard
          title="Thành phố phổ biến nhất"
          value={locations[0]?.city ?? "—"}
          icon={<MapPin size={18} />}
          accent="#8b5cf6"
        />
        <KPICard
          title="Tổng tin nhà"
          value={totalHouse.toLocaleString("vi-VN")}
          icon={<Home size={18} />}
          accent="#3b82f6"
        />
        <KPICard
          title="Tổng tin đất"
          value={totalLand.toLocaleString("vi-VN")}
          icon={<TrendingUp size={18} />}
          accent="#f59e0b"
        />
      </div>

      {/* Favorite trend */}
      <ChartCard
        title="Lượt yêu thích (Favorites) theo thời gian"
        subtitle={`Số lần user lưu bất động sản — theo ${TIME_LABEL[timeType]}`}
      >
        {loading ? (
          <ChartSkeleton />
        ) : favTrend.length === 0 ? (
          <EmptyState />
        ) : (
          <AnalyticsAreaChart
            data={favTrend as unknown as Record<string, unknown>[]}
            dataKey="total"
            xKey="time"
            name="Lượt yêu thích"
            color="#f43f5e"
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top locations — HorizontalBar ranking */}
        <ChartCard
          title="Top 10 thành phố có nhiều tin nhất"
          subtitle="Tổng hợp nhà và đất"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : locations.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4 py-2">
              {locations.map((loc) => (
                <div key={loc.city}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "#94a3b8" }}>{loc.city}</span>
                    <span style={{ color: "#64748b" }}>
                      🏠 {loc.houses} · 🏕️ {loc.lands}
                    </span>
                  </div>
                  <HorizontalBar
                    label={loc.city}
                    value={loc.total}
                    max={maxLoc}
                    color={CITY_COLOR}
                  />
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* House vs Land — Donut */}
        <ChartCard
          title="So sánh nhà vs đất (tổng)"
          subtitle="Tỷ lệ bất động sản theo loại"
        >
          {loading ? (
            <ChartSkeleton height={280} />
          ) : comparison.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <AnalyticsDonutChart
                data={comparison.map((c) => ({ name: c.type, value: c.total }))}
                nameKey="name"
                valueKey="value"
                colors={PROP_COLORS}
                height={200}
              />
              <div className="grid grid-cols-2 gap-4 mt-4">
                {comparison.map((c, i) => (
                  <div
                    key={c.type}
                    className="rounded-xl p-4 text-center"
                    style={{
                      background: `${PROP_COLORS[i]}10`,
                      border: `1px solid ${PROP_COLORS[i]}25`,
                    }}
                  >
                    <p
                      className="text-xs uppercase font-medium mb-2"
                      style={{ color: PROP_COLORS[i] }}
                    >
                      {c.type}
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "#0f172a" }}
                    >
                      {c.total.toLocaleString("vi-VN")}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                      {totalHouse + totalLand > 0
                        ? `${((c.total / (totalHouse + totalLand)) * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Monthly trend — multi-line */}
      <ChartCard
        title="Nhà vs Đất — Xu hướng theo tháng"
        subtitle="So sánh loại BĐS nào được đăng nhiều hơn theo từng tháng"
      >
        {loading ? (
          <ChartSkeleton />
        ) : compMonthly.length === 0 ? (
          <EmptyState />
        ) : (
          <AnalyticsMultiLineChart
            data={compMonthly as unknown as Record<string, unknown>[]}
            lines={[
              { key: "house", name: "Nhà", color: HOUSE_COLOR },
              { key: "land", name: "Đất", color: LAND_COLOR },
            ]}
            xKey="time"
          />
        )}
      </ChartCard>

      {/* City breakdown — grouped bar */}
      {locations.length > 0 && (
        <ChartCard
          title="Chi tiết: Nhà và Đất theo thành phố"
          subtitle="Top 10 thành phố — so sánh nhà vs đất"
        >
          {loading ? (
            <ChartSkeleton />
          ) : (
            <AnalyticsBarChart
              data={locations as unknown as Record<string, unknown>[]}
              bars={[
                { key: "houses", name: "Nhà", color: HOUSE_COLOR },
                { key: "lands", name: "Đất", color: LAND_COLOR },
              ]}
              xKey="city"
            />
          )}
        </ChartCard>
      )}
    </div>
  );
}
