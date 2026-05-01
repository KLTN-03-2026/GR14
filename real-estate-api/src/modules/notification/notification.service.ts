import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type NotificationType =
  | 'APPOINTMENT_APPROVED'
  | 'APPOINTMENT_REJECTED'
  | 'POST_APPROVED'
  | 'POST_REJECTED'
  | 'VIP_EXPIRING'
  | 'DEPOSIT_REFUND_APPROVED'
  | 'DEPOSIT_REFUND_REJECTED'
  | 'SYSTEM';

export interface CreateNotificationDto {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  refId?: number;
  refType?: 'appointment' | 'post';
}

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // Tạo thông báo mới
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        refId: dto.refId ?? null,
        refType: dto.refType ?? null,
      },
    });
  }

  // Lấy danh sách thông báo của user (phân trang)
  async findByUser(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      unreadCount,
    };
  }

  // Đếm số thông báo chưa đọc
  async countUnread(userId: number) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  // Đánh dấu một thông báo là đã đọc
  async markAsRead(id: number, userId: number) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { message: 'Đã đánh dấu đã đọc' };
  }

  // Đánh dấu tất cả thông báo là đã đọc
  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  // Xóa một thông báo
  async delete(id: number, userId: number) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { message: 'Đã xóa thông báo' };
  }

  // Xóa tất cả thông báo đã đọc
  async deleteAllRead(userId: number) {
    await this.prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });
    return { message: 'Đã xóa tất cả thông báo đã đọc' };
  }

  // ===== HELPER: Tạo thông báo lịch hẹn được duyệt =====
  async notifyAppointmentApproved(
    userId: number,
    appointmentId: number,
    propertyTitle: string,
    appointmentDate: Date,
  ) {
    const dateStr = appointmentDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return this.create({
      userId,
      type: 'APPOINTMENT_APPROVED',
      title: 'Lịch hẹn đã được duyệt ✅',
      message: `Lịch hẹn xem "${propertyTitle}" vào ${dateStr} đã được xác nhận. Nhân viên sẽ liên hệ với bạn sớm.`,
      refId: appointmentId,
      refType: 'appointment',
    });
  }

  // ===== HELPER: Tạo thông báo lịch hẹn bị từ chối =====
  async notifyAppointmentRejected(
    userId: number,
    appointmentId: number,
    propertyTitle: string,
    cancelReason?: string,
  ) {
    const reasonText = cancelReason ? ` Lý do: ${cancelReason}.` : '';
    return this.create({
      userId,
      type: 'APPOINTMENT_REJECTED',
      title: 'Lịch hẹn đã bị từ chối ❌',
      message: `Lịch hẹn xem "${propertyTitle}" của bạn đã bị hủy.${reasonText} Bạn có thể đặt lại lịch hẹn khác.`,
      refId: appointmentId,
      refType: 'appointment',
    });
  }

  // ===== HELPER: Tạo thông báo bài đăng được duyệt =====
  async notifyPostApproved(userId: number, postId: number, postTitle: string) {
    return this.create({
      userId,
      type: 'POST_APPROVED',
      title: 'Bài đăng đã được duyệt ✅',
      message: `Bài đăng "${postTitle}" của bạn đã được phê duyệt và hiển thị trên hệ thống.`,
      refId: postId,
      refType: 'post',
    });
  }

  // ===== HELPER: Tạo thông báo bài đăng bị từ chối =====
  async notifyPostRejected(userId: number, postId: number, postTitle: string) {
    return this.create({
      userId,
      type: 'POST_REJECTED',
      title: 'Bài đăng chưa được phê duyệt ❌',
      message: `Bài đăng "${postTitle}" của bạn chưa được duyệt. Vui lòng kiểm tra lại nội dung và chỉnh sửa.`,
      refId: postId,
      refType: 'post',
    });
  }
}
