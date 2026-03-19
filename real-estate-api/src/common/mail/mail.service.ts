import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST'),
      port: Number(this.configService.get('MAIL_PORT')),
      secure: false,
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Real Estate Black's City" <${this.configService.get('MAIL_USER')}>`,
      to,
      subject,
      html,
    });
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  }

  // --- 1. TEMPLATE OTP ---
  getOtpEmailHtml(fullName: string, otp: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#254b86;text-align:center;">🔒 Mã Xác Thực OTP</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Để hoàn tất quá trình xác thực tại <strong>Black's City</strong>, vui lòng sử dụng mã OTP dưới đây:</p>
        <div style="text-align:center;margin:30px 0;">
          <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#254b86;background-color:#f0f5ff;padding:10px 20px;border-radius:4px;border:1px dashed #254b86;">
            ${otp}
          </span>
        </div>
        <p>Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong>.</p>
        <p style="color:#888;font-size:13px;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">Trân trọng,<br/>Đội ngũ BĐS Black's City</p>
      </div>
    `;
  }

  // --- 2. TEMPLATE LỊCH HẸN (APPOINTMENT) ---
  getConfirmationEmailHtml(fullName: string, appointmentDate: string, propertyTitle?: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#1677ff;">📅 Lịch hẹn đã được tạo</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Lịch hẹn xem bất động sản của bạn đã được tạo thành công và đang chờ xác nhận.</p>
        ${propertyTitle ? `<p><strong>Bất động sản:</strong> ${propertyTitle}</p>` : ''}
        <p><strong>Thời gian dự kiến:</strong> ${appointmentDate}</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }

  getApprovalEmailHtml(fullName: string, appointmentDate: string, propertyTitle?: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#52c41a;">✅ Lịch hẹn đã được duyệt</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Lịch hẹn xem bất động sản của bạn đã được chấp thuận.</p>
        ${propertyTitle ? `<p><strong>Bất động sản:</strong> ${propertyTitle}</p>` : ''}
        <p><strong>Thời gian:</strong> ${appointmentDate}</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }

  getCancellationEmailHtml(fullName: string, appointmentDate: string, propertyTitle?: string, cancelReason?: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#ff4d4f;">❌ Lịch hẹn đã bị từ chối</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Rất tiếc, lịch hẹn của bạn đã bị từ chối.</p>
        ${cancelReason ? `<p><strong>Lý do:</strong> ${cancelReason}</p>` : ''}
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }

  // --- 3. TEMPLATE THANH TOÁN (PAYMENT) ---
  getPaymentSuccessEmailHtml(fullName: string, amount: number, packageName: string, postTitle?: string, method?: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#52c41a;">✅ Thanh toán thành công</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Giao dịch gói <strong>${packageName}</strong> thành công.</p>
        <p><strong>Số tiền:</strong> ${this.formatCurrency(amount)}</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }

  getPaymentFailureEmailHtml(fullName: string, amount: number, packageName: string, postTitle?: string, method?: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#ff4d4f;">❌ Thanh toán thất bại</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Giao dịch gói <strong>${packageName}</strong> không thành công. Số tiền: ${this.formatCurrency(amount)}</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }

  // --- 4. TEMPLATE BÀI ĐĂNG (POST) ---
  getPostApprovedEmailHtml(fullName: string, postTitle: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#52c41a;">✅ Bài đăng đã được duyệt</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Bài đăng <strong>${postTitle}</strong> của bạn đã hiển thị.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }

  getPostRejectedEmailHtml(fullName: string, postTitle: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#ff4d4f;">❌ Bài đăng chưa được duyệt</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Rất tiếc, bài đăng <strong>${postTitle}</strong> cần chỉnh sửa thêm.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ Black's City</p>
      </div>
    `;
  }
}