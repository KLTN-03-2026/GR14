import { useEffect, useState } from "react";
import { analyticsApi } from "@/api/analytics";
import type { EmployeePerformance } from "@/types/analytics";
import type { TimeType } from "@/types/analytics";

export const useEmployeeAnalytics = (timeType: string) => {
  const [data, setData] = useState<EmployeePerformance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [timeType]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await analyticsApi.getEmployeePerformance(
        timeType as TimeType,
      );

      setData(res || []);
    } catch (err) {
      console.error("Employee analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading };
};
