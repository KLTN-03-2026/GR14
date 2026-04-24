import { Users, Calendar, Award } from "lucide-react";
import { KPICard } from "@/components/analytics/charts";

interface Props {
  perfLoading: boolean;
  globalTotalEmployees: number;
  globalTotalAppointments: number;
  topPerformer: any;
  displayName: (emp: any) => string;
}

export const EmployeeKPISection = ({
  perfLoading,
  globalTotalEmployees,
  globalTotalAppointments,
  topPerformer,
  displayName,
}: Props) => {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        <KPICard
          title="Tổng nhân viên"
          value={globalTotalEmployees}
          icon={<Users size={20} />}
          accent="#0ea5e9"
          loading={perfLoading}
        />

        <KPICard
          title="Tổng lịch hẹn toàn hệ thống"
          value={globalTotalAppointments}
          icon={<Calendar size={20} />}
          accent="#6366f1"
          loading={perfLoading}
        />

        <KPICard
          title="Nhân viên xuất sắc"
          value={
            perfLoading ? "..." : topPerformer ? displayName(topPerformer) : "—"
          }
          subtitle={
            topPerformer
              ? `${topPerformer.totalAppointments} lịch hẹn`
              : undefined
          }
          icon={<Award size={20} />}
          accent="#f59e0b"
          loading={perfLoading}
          isText
        />
      </div>
    </div>
  );
};
