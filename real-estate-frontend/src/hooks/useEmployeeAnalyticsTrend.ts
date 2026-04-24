// src/hooks/useEmployeeAnalyticsTrend.ts
import { useEffect, useState } from "react";
import { analyticsApi } from "@/api/analytics";
import type { TimeType } from "@/types/analytics";

// ── Shape of one time-series data point ──────────────────────────────────────
export interface EmployeePerformanceTrendPoint {
  /** "YYYY-MM-DD" for day, "YYYY-MM" for month, "YYYY" for year */
  time: string;
  totalAppointments: number;
  completed: number;
  /** 0–1 float, e.g. 0.75 = 75% */
  completionRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export const useEmployeeAnalyticsTrend = (timeType: TimeType) => {
  const [trendData, setTrendData] = useState<EmployeePerformanceTrendPoint[]>(
    [],
  );
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setTrendLoading(true);

    analyticsApi
      .getEmployeePerformanceTrend(timeType)
      .then((data) => {
        if (isMounted) setTrendData(data ?? []);
      })
      .catch((err) => {
        console.error("[useEmployeeAnalyticsTrend] fetch error:", err);
        if (isMounted) setTrendData([]);
      })
      .finally(() => {
        if (isMounted) setTrendLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [timeType]);

  return { trendData, trendLoading };
};
