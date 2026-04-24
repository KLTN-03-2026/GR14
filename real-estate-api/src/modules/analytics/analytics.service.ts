// src/modules/analytics/analytics.service.ts
//
// NOTE: After pulling this file, run `npx prisma generate` once so the
// Prisma client picks up the UserBehavior model (→ this.prisma.userBehavior).
// The model is defined in schema.prisma; the TS errors disappear after generation.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────

  private getKey(date: Date, type: string): string {
    const iso = date.toISOString();
    if (type === 'year') return iso.slice(0, 4);
    if (type === 'month') return iso.slice(0, 7);
    return iso.slice(0, 10); // day
  }

  private groupByTime<T extends { createdAt: Date }>(
    records: T[],
    type: string,
  ): { time: string; total: number }[] {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      const key = this.getKey(r.createdAt, type);
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, total]) => ({ time, total }));
  }

  // ─────────────────────────────────────────────────────────
  // USER ANALYTICS
  // ─────────────────────────────────────────────────────────

  /** New user registrations grouped by day / month / year. */
  async getUserGrowth(type: string) {
    const users = await this.prisma.user.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.groupByTime(users, type);
  }

  /**
   * DAU — Daily Active Users from user_behaviors.
   * Counts unique users who performed any action (view / click / save) per day.
   */
  async getDAU() {
    const data = await this.prisma.userBehavior.findMany({
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const map: Record<string, Set<number>> = {};
    data.forEach((b) => {
      const date = b.createdAt.toISOString().slice(0, 10);
      if (!map[date]) map[date] = new Set();
      map[date].add(b.userId);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date, total: users.size }));
  }

  /**
   * MAU — Monthly Active Users from user_behaviors.
   * Counts unique users with any interaction per calendar month.
   */
  async getMAU() {
    const data = await this.prisma.userBehavior.findMany({
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const map: Record<string, Set<number>> = {};
    data.forEach((b) => {
      const month = b.createdAt.toISOString().slice(0, 7);
      if (!map[month]) map[month] = new Set();
      map[month].add(b.userId);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, users]) => ({ month, total: users.size }));
  }

  /**
   * Retention D1 / D7 / D30.
   * For each user registered at least `days` ago, checks whether they
   * performed any behavior action on day X+N (exact date match).
   */
  async getRetention(days: number) {
    const [users, behaviors] = await Promise.all([
      this.prisma.user.findMany({ select: { id: true, createdAt: true } }),
      this.prisma.userBehavior.findMany({
        select: { userId: true, createdAt: true },
      }),
    ]);

    const activeSet = new Set<string>();
    behaviors.forEach((b) => {
      const date = b.createdAt.toISOString().slice(0, 10);
      activeSet.add(`${b.userId}_${date}`);
    });

    const windowMs = days * 24 * 60 * 60 * 1000;
    const eligible = users.filter(
      (u) => Date.now() - u.createdAt.getTime() >= windowMs,
    );

    const retained = eligible.filter((u) => {
      const targetDate = new Date(u.createdAt.getTime() + windowMs);
      return activeSet.has(`${u.id}_${targetDate.toISOString().slice(0, 10)}`);
    }).length;

    const total = eligible.length;
    return {
      days,
      retained,
      total,
      rate: total > 0 ? +(retained / total).toFixed(4) : 0,
    };
  }

  // ─────────────────────────────────────────────────────────
  // POST ANALYTICS
  // ─────────────────────────────────────────────────────────

  /** Post approval funnel: pending(1) → approved(2) → rejected(3). */
  async getPostFunnel() {
    const data = await this.prisma.post.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const STATUS_LABEL: Record<number, string> = {
      1: 'Chờ duyệt',
      2: 'Đã duyệt',
      3: 'Từ chối',
    };

    return data.map((i) => ({
      status: i.status,
      label: STATUS_LABEL[i.status] ?? `Status ${i.status}`,
      total: i._count.status,
    }));
  }

  /** New posts over time grouped by day / month / year. */
  async getPostByTime(type: string) {
    const posts = await this.prisma.post.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.groupByTime(posts, type);
  }

  /** Approval rate statistics from the posts table. */
  async getApprovalRate() {
    const [total, approved, rejected, pending] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.post.count({ where: { status: 2 } }),
      this.prisma.post.count({ where: { status: 3 } }),
      this.prisma.post.count({ where: { status: 1 } }),
    ]);

    return {
      total,
      approved,
      rejected,
      pending,
      approvalRate: total ? +(approved / total).toFixed(4) : 0,
    };
  }

  /** Count of currently active VIP subscriptions. */
  async getVipActive() {
    const count = await this.prisma.vipSubscription.count({
      where: { status: 1 },
    });
    return { activeVip: count };
  }

  /** VIP subscriptions activated over time. */
  async getVipGrowth(type: string) {
    const subs = await this.prisma.vipSubscription.findMany({
      where: { status: { in: [1, 2] }, startDate: { not: null } },
      select: { startDate: true },
      orderBy: { startDate: 'asc' },
    });

    const map: Record<string, number> = {};
    subs.forEach((s) => {
      if (!s.startDate) return;
      const key = this.getKey(s.startDate, type);
      map[key] = (map[key] ?? 0) + 1;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, total]) => ({ time, total }));
  }

  // ─────────────────────────────────────────────────────────
  // REVENUE ANALYTICS
  // ─────────────────────────────────────────────────────────

  /**
   * Revenue by day / month / year.
   * Only counts successful payments (status=1) using paidAt (not createdAt).
   */
  async getRevenue(type: string) {
    const data = await this.prisma.payment.findMany({
      where: { status: 1, paidAt: { not: null } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const map: Record<string, number> = {};
    data.forEach((t) => {
      if (!t.paidAt) return;
      const key = this.getKey(t.paidAt, type);
      map[key] = (map[key] ?? 0) + Number(t.amount);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, total]) => ({ time, total: +total.toFixed(0) }));
  }

  /** Transaction counts by status over time. */
  async getTransactionsByStatus(type: string) {
    const data = await this.prisma.payment.findMany({
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const STATUS_LABEL: Record<number, string> = {
      0: 'Chờ xử lý',
      1: 'Thành công',
      2: 'Thất bại',
      3: 'Đã hủy',
    };

    const map: Record<string, Record<string, number>> = {};
    data.forEach((p) => {
      const key = this.getKey(p.createdAt, type);
      if (!map[key]) map[key] = {};
      const label = STATUS_LABEL[p.status] ?? 'Khác';
      map[key][label] = (map[key][label] ?? 0) + 1;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, statuses]) => ({ time, ...statuses }));
  }

  /** Revenue by payment gateway (VNPay / MoMo). Only successful payments. */
  async getRevenueByGateway() {
    const data = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { status: 1 },
      _sum: { amount: true },
      _count: { id: true },
    });

    return data.map((i) => ({
      gateway: i.paymentMethod,
      revenue: Number(i._sum.amount ?? 0),
      transactions: i._count.id,
    }));
  }

  /** Revenue broken down by VIP package name. */
  async getRevenueByPackage() {
    const data = await this.prisma.vipSubscription.findMany({
      where: { payment: { status: 1 } },
      include: {
        package: { select: { name: true, durationDays: true } },
        payment: { select: { amount: true } },
      },
    });

    const map: Record<
      string,
      { name: string; days: number; total: number; count: number }
    > = {};
    data.forEach((item) => {
      if (!item.payment) return;
      const key = item.package.name;
      if (!map[key]) {
        map[key] = {
          name: key,
          days: item.package.durationDays,
          total: 0,
          count: 0,
        };
      }
      map[key].total += Number(item.payment.amount);
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  /** Top 10 spenders with user info (name + email). */
  async getTopSpenders() {
    const data = await this.prisma.payment.groupBy({
      by: ['userId'],
      where: { status: 1 },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    const userIds = data.map((d) => d.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return data.map((d, idx) => ({
      rank: idx + 1,
      userId: d.userId,
      fullName: userMap.get(d.userId)?.fullName ?? 'N/A',
      email: userMap.get(d.userId)?.email ?? 'N/A',
      totalSpent: Number(d._sum.amount ?? 0),
      transactions: d._count.id,
    }));
  }

  // ─────────────────────────────────────────────────────────
  // APPOINTMENT ANALYTICS
  // ─────────────────────────────────────────────────────────

  /** Appointments over time grouped by creation date. */
  async getAppointments(type: string) {
    const data = await this.prisma.appointment.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.groupByTime(data, type);
  }

  /** Approval, rejection, and completion rates. */
  async getAppointmentRates() {
    const [total, approved, rejected, pending, completed] = await Promise.all([
      this.prisma.appointment.count(),
      this.prisma.appointment.count({ where: { status: 1 } }),
      this.prisma.appointment.count({ where: { status: 2 } }),
      this.prisma.appointment.count({ where: { status: 0 } }),
      this.prisma.appointment.count({ where: { actualStatus: 1 } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      completed,
      approvalRate: total ? +(approved / total).toFixed(4) : 0,
      rejectionRate: total ? +(rejected / total).toFixed(4) : 0,
      completionRate: approved > 0 ? +(completed / approved).toFixed(4) : 0,
    };
  }

  /**
   * Employee performance: appointments assigned, completed, completion rate.
   * NEW FEATURE: Extended with score, activityStatus, trend, strength, alerts,
   * recommendation — all computed in a single parallel batch (no N+1).
   */
  async getEmployeePerformance(type?: string) {
    const now = new Date();

    // ─────────────────────────────────────────────────────────────────────
    // NEW FEATURE: Batch-fetch enrichment data ONCE for both code paths.
    // Three queries, all run in parallel → zero N+1, minimal added latency.
    // ─────────────────────────────────────────────────────────────────────
    const [houseGroups, landGroups, enrichAppts] = await Promise.all([
      this.prisma.house.groupBy({
        by: ['employeeId'],
        _count: { id: true },
      }),
      this.prisma.land.groupBy({
        by: ['employeeId'],
        _count: { id: true },
      }),
      this.prisma.appointment.findMany({
        select: {
          employeeId: true,
          actualStatus: true,
          createdAt: true,
          appointmentDate: true,
        },
        where: { employeeId: { not: null } },
      }),
    ]);

    // NEW FEATURE: O(1) lookup maps — no nested loops
    const houseMap = new Map<number, number>(
      houseGroups
        .filter(
          (h): h is typeof h & { employeeId: number } => h.employeeId !== null,
        )
        .map((h) => [h.employeeId, h._count.id]),
    );
    const landMap = new Map<number, number>(
      landGroups
        .filter(
          (l): l is typeof l & { employeeId: number } => l.employeeId !== null,
        )
        .map((l) => [l.employeeId, l._count.id]),
    );

    // NEW FEATURE: Most recent appointmentDate per employee (for activity status)
    const lastApptMap = new Map<number, Date>();
    for (const a of enrichAppts) {
      if (a.employeeId === null) continue;
      const d = new Date(a.appointmentDate);
      const existing = lastApptMap.get(a.employeeId);
      if (!existing || d > existing) lastApptMap.set(a.employeeId, d);
    }

    // NEW FEATURE: Period-start helper for trend computation
    const getPeriodStart = (t: string, offsetPeriods: number): Date => {
      if (t === 'day') {
        const d = new Date(now);
        d.setDate(d.getDate() - offsetPeriods);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      if (t === 'year') {
        return new Date(now.getFullYear() - offsetPeriods, 0, 1);
      }
      // default: month
      return new Date(now.getFullYear(), now.getMonth() - offsetPeriods, 1);
    };

    const effectiveType = type || 'month';
    const curStart = getPeriodStart(effectiveType, 0);
    const prevStart = getPeriodStart(effectiveType, 1);

    // NEW FEATURE: Current-period and previous-period appointment counts per employee
    const curPeriodMap = new Map<number, number>();
    const prevPeriodMap = new Map<number, number>();
    for (const a of enrichAppts) {
      if (a.employeeId === null) continue;
      const d = new Date(a.createdAt);
      if (d >= curStart) {
        curPeriodMap.set(
          a.employeeId,
          (curPeriodMap.get(a.employeeId) ?? 0) + 1,
        );
      } else if (d >= prevStart && d < curStart) {
        prevPeriodMap.set(
          a.employeeId,
          (prevPeriodMap.get(a.employeeId) ?? 0) + 1,
        );
      }
    }

    // NEW FEATURE: Per-employee enrichment builder
    // Accepts pre-computed maxTotal & maxProps to keep normalization accurate.
    const buildEnrichment = (
      empId: number,
      total: number,
      done: number,
      completionRate: number,
      maxTotal: number,
      maxProps: number,
    ) => {
      const houses = houseMap.get(empId) ?? 0;
      const lands = landMap.get(empId) ?? 0;
      const totalProperties = houses + lands;

      // NEW FEATURE: Performance score (0–100)
      // Formula: 0.4 * completionRate + 0.3 * norm(appointments) + 0.3 * norm(properties)
      const nTotal = maxTotal > 0 ? total / maxTotal : 0;
      const nProps = maxProps > 0 ? totalProperties / maxProps : 0;
      const score = +(
        (0.4 * completionRate + 0.3 * nTotal + 0.3 * nProps) *
        100
      ).toFixed(1);

      // NEW FEATURE: Activity status from most recent appointment date
      const lastAppt = lastApptMap.get(empId);
      const daysSince = lastAppt
        ? (now.getTime() - lastAppt.getTime()) / 86_400_000
        : Infinity;
      const activityStatus: 'active' | 'idle' | 'inactive' =
        daysSince <= 3 ? 'active' : daysSince <= 7 ? 'idle' : 'inactive';

      // NEW FEATURE: Trend — % change current period vs previous period
      const cur = curPeriodMap.get(empId) ?? 0;
      const prev = prevPeriodMap.get(empId) ?? 0;
      const trend: number | null =
        cur === 0 && prev === 0
          ? null
          : prev === 0
            ? cur > 0
              ? 100
              : 0
            : +(((cur - prev) / prev) * 100).toFixed(1);

      // NEW FEATURE: Property specialization strength
      const strength: 'house' | 'land' | 'neutral' =
        houses > lands ? 'house' : lands > houses ? 'land' : 'neutral';

      // NEW FEATURE: Alert codes
      const alerts: string[] = [];

      if (total === 0) {
        alerts.push('no_activity');
      }

      if (completionRate < 0.3) {
        alerts.push('low_performance');
      }

      if (total > 5 && done === 0) {
        alerts.push('no_completion');
      }

      // NEW FEATURE: Rule-based recommendation text
      let recommendation: string;
      if (activityStatus === 'inactive') {
        recommendation = 'Không hoạt động, cần theo dõi';
      } else if (total === 0) {
        recommendation = 'Chưa có lịch hẹn, cần phân công';
      } else if (completionRate >= 0.7 && activityStatus === 'active') {
        recommendation = 'Hiệu suất tốt, duy trì nhịp độ';
      } else if (total > 5 && done === 0) {
        recommendation = 'Tập trung chốt giao dịch';
      } else if (completionRate < 0.3) {
        recommendation = 'Cần cải thiện tỷ lệ chốt hẹn';
      } else if (activityStatus === 'idle') {
        recommendation = 'Tăng cường theo dõi khách hàng';
      } else {
        recommendation = 'Hiệu suất ổn định, tiếp tục duy trì';
      }

      return {
        houses,
        lands,
        totalProperties,
        score,
        activityStatus,
        trend,
        strength,
        alerts,
        recommendation,
      };
    };

    // ── Original path (no type) ───────────────────────────────────────────────
    // Existing groupBy queries for efficiency — fully preserved.
    if (!type) {
      const employees = await this.prisma.employee.findMany({
        include: {
          user: true,
        },
      });

      const [data, completed] = await Promise.all([
        this.prisma.appointment.groupBy({
          by: ['employeeId'],
          _count: { id: true },
        }),
        this.prisma.appointment.groupBy({
          by: ['employeeId'],
          where: { actualStatus: 1 },
          _count: { id: true },
        }),
      ]);

      const totalMap = new Map(data.map((d) => [d.employeeId, d._count.id]));
      const completedMap = new Map(
        completed.map((d) => [d.employeeId, d._count.id]),
      );

      // NEW FEATURE: Pre-compute normalisation denominators in a single pass
      let maxTotal = 1;
      let maxProps = 1;
      for (const e of employees) {
        const t = totalMap.get(e.id) ?? 0;
        const p = (houseMap.get(e.id) ?? 0) + (landMap.get(e.id) ?? 0);
        if (t > maxTotal) maxTotal = t;
        if (p > maxProps) maxProps = p;
      }

      return employees
        .map((e) => {
          const total = totalMap.get(e.id) || 0;
          const done = completedMap.get(e.id) || 0;
          const completionRate = total > 0 ? done / total : 0;

          return {
            // ── Existing fields (unchanged) ──
            employeeId: e.id,
            employeeCode: e.user?.username || `NV${e.id}`,
            fullName: e.user?.fullName || 'N/A',
            totalAppointments: total,
            completed: done,
            completionRate,
            // ── NEW FEATURE: enriched fields ──
            ...buildEnrichment(
              e.id,
              total,
              done,
              completionRate,
              maxTotal,
              maxProps,
            ),
          };
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    // ── Extended path (with type) ─────────────────────────────────────────────
    const [employees, appointments] = await Promise.all([
      this.prisma.employee.findMany({ include: { user: true } }),
      this.prisma.appointment.findMany({
        select: { employeeId: true, actualStatus: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Aggregate per employee using the requested time granularity key.
    // Each unique (employeeId, timeKey) pair is counted separately, then
    // summed so the result still matches the flat structure expected by the UI.
    const totalMap = new Map<number, number>();
    const completedMap = new Map<number, number>();
    // Only count appointments that belong to the chosen time bucket of today's perspective.
    // We aggregate ALL appointments grouped by employee (time key is used for filtering
    // context but the returned structure is per-employee totals, consistent with original).
    // validate key format (no-op side-effect)

    appointments.forEach((a) => {
      if (a.employeeId === null) return;

      const date = new Date(a.createdAt);

      let isValid = false;

      if (type === 'day') {
        isValid =
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate();
      }

      if (type === 'month') {
        isValid =
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth();
      }

      if (type === 'year') {
        isValid = date.getFullYear() === now.getFullYear();
      }

      if (!isValid) return;

      totalMap.set(a.employeeId, (totalMap.get(a.employeeId) ?? 0) + 1);

      if (a.actualStatus === 1) {
        completedMap.set(
          a.employeeId,
          (completedMap.get(a.employeeId) ?? 0) + 1,
        );
      }
    });

    // NEW FEATURE: Pre-compute normalisation denominators in a single pass
    let maxTotal = 1;
    let maxProps = 1;
    for (const e of employees) {
      const t = totalMap.get(e.id) ?? 0;
      const p = (houseMap.get(e.id) ?? 0) + (landMap.get(e.id) ?? 0);
      if (t > maxTotal) maxTotal = t;
      if (p > maxProps) maxProps = p;
    }

    return employees
      .map((e) => {
        const total = totalMap.get(e.id) ?? 0;
        const done = completedMap.get(e.id) ?? 0;
        const completionRate = total > 0 ? +(done / total).toFixed(4) : 0;

        return {
          // ── Existing fields (unchanged) ──
          employeeId: e.id,
          employeeCode: e.user?.username || `NV${e.id}`,
          fullName: e.user?.fullName || 'N/A',
          totalAppointments: total,
          completed: done,
          completionRate,
          // ── NEW FEATURE: enriched fields ──
          ...buildEnrichment(
            e.id,
            total,
            done,
            completionRate,
            maxTotal,
            maxProps,
          ),
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
  async getEmployeePerformanceTrend(type: string) {
    const now = new Date();

    // ── 1. Build pre-filled bucket map and derive startDate ─────────────────
    //
    // We pre-fill every bucket with zero so that periods with no data still
    // appear in the chart (avoids gaps in the x-axis).

    type Bucket = {
      time: string;
      totalAppointments: number;
      completed: number;
    };
    const buckets = new Map<string, Bucket>();

    let startDate: Date;
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (type === 'day') {
      // Last 7 days inclusive (today = offset 0, oldest = offset 6)
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
        buckets.set(key, { time: key, totalAppointments: 0, completed: 0 });
      }
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (type === 'year') {
      // Last 5 calendar years inclusive
      for (let i = 4; i >= 0; i--) {
        const key = String(now.getFullYear() - i); // "YYYY"
        buckets.set(key, { time: key, totalAppointments: 0, completed: 0 });
      }
      startDate = new Date(now.getFullYear() - 4, 0, 1);
    } else {
      // Default: month — last 12 calendar months inclusive
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7); // "YYYY-MM"
        buckets.set(key, { time: key, totalAppointments: 0, completed: 0 });
      }
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    }

    // ── 2. Fetch appointments within the date range ──────────────────────────
    //
    // IMPORTANT: We use explicit date >= startDate && date <= endDate filtering
    // here — intentionally NOT reusing the isValid logic from
    // getEmployeePerformance() as required by the spec.

    const appointments = await this.prisma.appointment.findMany({
      select: {
        actualStatus: true,
        createdAt: true,
      },
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // ── 3. Accumulate into buckets ───────────────────────────────────────────

    appointments.forEach((a) => {
      let key: string;

      if (type === 'day') {
        key = a.createdAt.toISOString().slice(0, 10);
      } else if (type === 'year') {
        key = String(a.createdAt.getFullYear());
      } else {
        key = a.createdAt.toISOString().slice(0, 7);
      }

      const bucket = buckets.get(key);
      if (!bucket) return; // outside our pre-defined range (shouldn't happen)

      bucket.totalAppointments += 1;
      if (a.actualStatus === 1) {
        bucket.completed += 1;
      }
    });

    // ── 4. Serialize — order is guaranteed by insertion order of the Map ─────

    return [...buckets.values()].map((b) => ({
      time: b.time,
      totalAppointments: b.totalAppointments,
      completed: b.completed,
      completionRate:
        b.totalAppointments > 0
          ? +(b.completed / b.totalAppointments).toFixed(4)
          : 0,
    }));
  }

  /** Appointment heatmap by hour of day (0–23). */
  async getHeatmap() {
    const data = await this.prisma.appointment.findMany({
      select: { appointmentDate: true },
    });

    const map: Record<number, number> = {};
    data.forEach((a) => {
      const hour = new Date(a.appointmentDate).getHours();
      map[hour] = (map[hour] ?? 0) + 1;
    });

    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      total: map[h] ?? 0,
    }));
  }

  // ─────────────────────────────────────────────────────────
  // BEHAVIOR / FAVORITES ANALYTICS
  // ─────────────────────────────────────────────────────────

  /** Favorites added over time. */
  async getFavoriteTrend(type: string) {
    const data = await this.prisma.favorite.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return this.groupByTime(data, type);
  }

  /** Top 10 cities by listing count (houses + lands merged). */
  async getTopLocations() {
    const [houses, lands] = await Promise.all([
      this.prisma.house.groupBy({
        by: ['city'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      this.prisma.land.groupBy({
        by: ['city'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);

    const cityMap = new Map<
      string,
      { city: string; houses: number; lands: number; total: number }
    >();

    const upsert = (
      city: string | null,
      type: 'houses' | 'lands',
      count: number,
    ) => {
      const key = city ?? 'Không xác định';
      if (!cityMap.has(key))
        cityMap.set(key, { city: key, houses: 0, lands: 0, total: 0 });
      const entry = cityMap.get(key)!;
      entry[type] += count;
      entry.total += count;
    };

    houses.forEach((h) => upsert(h.city, 'houses', h._count.id));
    lands.forEach((l) => upsert(l.city, 'lands', l._count.id));

    return [...cityMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  }

  /** Monthly comparison: house vs land listings per month. */
  async compareHouseLandMonthly() {
    const [houses, lands] = await Promise.all([
      this.prisma.house.findMany({
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.land.findMany({
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const map = new Map<
      string,
      { time: string; house: number; land: number }
    >();

    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { time: key, house: 0, land: 0 });
      return map.get(key)!;
    };

    houses.forEach((h) => {
      ensure(h.createdAt.toISOString().slice(0, 7)).house += 1;
    });
    lands.forEach((l) => {
      ensure(l.createdAt.toISOString().slice(0, 7)).land += 1;
    });

    return [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
  }

  /** Simple total: houses vs lands. */
  async compareHouseLand() {
    const [house, land] = await Promise.all([
      this.prisma.house.count(),
      this.prisma.land.count(),
    ]);
    return [
      { type: 'Nhà', total: house },
      { type: 'Đất', total: land },
    ];
  }

  // ─────────────────────────────────────────────────────────
  // SUMMARY KPI
  // ─────────────────────────────────────────────────────────

  async getSummaryKPI() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      totalPosts,
      newPostsThisMonth,
      revenueThisMonth,
      revenueLastMonth,
      totalAppointments,
      appointmentsThisMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      this.prisma.post.count(),
      this.prisma.post.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.payment.aggregate({
        where: { status: 1, paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 1,
          paidAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    const revThis = Number(revenueThisMonth._sum.amount ?? 0);
    const revLast = Number(revenueLastMonth._sum.amount ?? 0);

    const growthRate = (current: number, previous: number): number | null =>
      previous > 0
        ? +(((current - previous) / previous) * 100).toFixed(1)
        : null;

    return {
      totalUsers,
      newUsersThisMonth,
      userGrowth: growthRate(newUsersThisMonth, newUsersLastMonth),
      totalPosts,
      newPostsThisMonth,
      revenueThisMonth: revThis,
      revenueLastMonth: revLast,
      revenueGrowth: growthRate(revThis, revLast),
      totalAppointments,
      appointmentsThisMonth,
    };
  }

  async getEmployeeProperties() {
    const [houses, lands] = await Promise.all([
      this.prisma.house.groupBy({
        by: ['employeeId'],
        _count: { id: true },
      }),
      this.prisma.land.groupBy({
        by: ['employeeId'],
        _count: { id: true },
      }),
    ]);

    // Collect all unique non-null employee IDs
    const employeeIdSet = new Set<number>([
      ...houses
        .filter(
          (h): h is typeof h & { employeeId: number } => h.employeeId !== null,
        )
        .map((h) => h.employeeId),
      ...lands
        .filter(
          (l): l is typeof l & { employeeId: number } => l.employeeId !== null,
        )
        .map((l) => l.employeeId),
    ]);

    const employeeIds = [...employeeIdSet];

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: { select: { fullName: true } } },
    });

    const empMap = new Map(employees.map((e) => [e.id, e]));

    const houseMap = new Map<number, number>(
      houses
        .filter(
          (h): h is typeof h & { employeeId: number } => h.employeeId !== null,
        )
        .map((h) => [h.employeeId, h._count.id]),
    );

    const landMap = new Map<number, number>(
      lands
        .filter(
          (l): l is typeof l & { employeeId: number } => l.employeeId !== null,
        )
        .map((l) => [l.employeeId, l._count.id]),
    );

    return employeeIds
      .map((id) => {
        const emp = empMap.get(id);
        const houseCount = houseMap.get(id) ?? 0;
        const landCount = landMap.get(id) ?? 0;
        return {
          employeeId: id,
          employeeCode: emp?.code ?? 'N/A',
          fullName: emp?.user?.fullName ?? 'N/A',
          houses: houseCount,
          lands: landCount,
          total: houseCount + landCount,
        };
      })
      .sort((a, b) => b.total - a.total);
  }
}
