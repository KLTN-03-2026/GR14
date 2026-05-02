import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resendApiKey: string | undefined;
  private transporter: nodemailer.Transporter | undefined;

  constructor(private configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (this.resendApiKey) {
      // ── Ưu tiên Resend (HTTP API) — không bị VPS block SMTP port ──
      this.logger.log('Mail provider: Resend (HTTP API)');
    } else {
      // ── Fallback: nodemailer SMTP (dùng khi dev local) ──
      const mailPort = Number(this.configService.get('MAIL_PORT') || 587);
      const isSecure = mailPort === 465;
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('MAIL_HOST') || 'smtp.gmail.com',
        port: mailPort,
        secure: isSecure,
        auth: {
          user: this.configService.get('MAIL_USER'),
          pass: this.configService.get('MAIL_PASSWORD'),
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      this.logger.log(
        `Mail provider: nodemailer SMTP ${this.configService.get('MAIL_HOST')}:${mailPort} secure=${isSecure}`,
      );
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (this.resendApiKey) {
      await this.sendViaResend(to, subject, html);
    } else {
      await this.sendViaSmtp(to, subject, html);
    }
  }

  /** Gửi qua Resend HTTP API — không cần SMTP port, không bị VPS block */
  private async sendViaResend(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'onboarding@resend.dev';
    const fromName =
      this.configService.get<string>('RESEND_FROM_NAME') ||
      "Black'S City BĐS";

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error ${response.status}: ${error}`);
    }

    this.logger.log(`[Resend] Email sent → ${to}`);
  }

  /** Fallback SMTP qua nodemailer (dùng khi dev local, không có RESEND_API_KEY) */
  private async sendViaSmtp(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.transporter) throw new Error('SMTP transporter not initialized');
    await this.transporter.sendMail({
      from: `"Black'S City BĐS" <${this.configService.get('MAIL_USER')}>`,
      to,
      subject,
      html,
    });
  }

  private formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
    });
  }

  getApprovalEmailHtml(
    fullName: string,
    appointmentDate: string,
    propertyTitle?: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#52c41a;">✅ Lịch hẹn đã được duyệt</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Lịch hẹn xem bất động sản của bạn đã được chấp thuận.</p>
        ${propertyTitle ? `<p><strong>Bất động sản:</strong> ${propertyTitle}</p>` : ''}
        <p><strong>Thời gian:</strong> ${appointmentDate}</p>
        <p>Vui lòng có mặt đúng giờ. Nhân viên của chúng tôi sẽ liên hệ với bạn trước giờ hẹn.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }

  getConfirmationEmailHtml(
    fullName: string,
    appointmentDate: string,
    propertyTitle?: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#1677ff;">📅 Lịch hẹn đã được tạo</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Lịch hẹn xem bất động sản của bạn đã được tạo thành công và đang chờ xác nhận.</p>
        ${propertyTitle ? `<p><strong>Bất động sản:</strong> ${propertyTitle}</p>` : ''}
        <p><strong>Thời gian:</strong> ${appointmentDate}</p>
        <p>Chúng tôi sẽ liên hệ với bạn sớm nhất để xác nhận lịch hẹn.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }

  getCancellationEmailHtml(
    fullName: string,
    appointmentDate: string,
    propertyTitle?: string,
    cancelReason?: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#ff4d4f;">❌ Lịch hẹn đã bị từ chối</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Rất tiếc, lịch hẹn xem bất động sản của bạn đã bị từ chối.</p>
        ${propertyTitle ? `<p><strong>Bất động sản:</strong> ${propertyTitle}</p>` : ''}
        <p><strong>Thời gian dự kiến:</strong> ${appointmentDate}</p>
        ${cancelReason ? `<p><strong>Lý do:</strong> ${cancelReason}</p>` : ''}
        <p>Vui lòng liên hệ chúng tôi để được hỗ trợ đặt lại lịch hẹn.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }

  getPaymentSuccessEmailHtml(
    fullName: string,
    amount: number,
    packageName: string,
    postTitle?: string,
    method?: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#52c41a;">✅ Thanh toán thành công</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Bạn đã thanh toán thành công gói <strong>${packageName}</strong>${postTitle ? ` cho tin: <strong>${postTitle}</strong>` : ''}.</p>
        <p><strong>Số tiền:</strong> ${this.formatCurrency(amount)}</p>
        ${method ? `<p><strong>Phương thức:</strong> ${method.toUpperCase()}</p>` : ''}
        <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }

  getPaymentFailureEmailHtml(
    fullName: string,
    amount: number,
    packageName: string,
    postTitle?: string,
    method?: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#ff4d4f;">❌ Thanh toán thất bại</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Thanh toán gói <strong>${packageName}</strong>${postTitle ? ` cho tin: <strong>${postTitle}</strong>` : ''} chưa thành công.</p>
        <p><strong>Số tiền:</strong> ${this.formatCurrency(amount)}</p>
        ${method ? `<p><strong>Phương thức:</strong> ${method.toUpperCase()}</p>` : ''}
        <p>Vui lòng thử lại hoặc chọn phương thức khác. Nếu cần hỗ trợ, hãy liên hệ đội ngũ CSKH.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }

  getPostApprovedEmailHtml(fullName: string, postTitle: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#52c41a;">✅ Bài đăng đã được duyệt</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Bài đăng <strong>${postTitle}</strong> của bạn đã được duyệt và hiển thị.</p>
        <p>Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của chúng tôi.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }

  getPostRejectedEmailHtml(fullName: string, postTitle: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e8e8e8;border-radius:8px;">
        <h2 style="color:#ff4d4f;">❌ Bài đăng chưa được duyệt</h2>
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Rất tiếc, bài đăng <strong>${postTitle}</strong> của bạn chưa được duyệt.</p>
        <p>Vui lòng kiểm tra lại nội dung hoặc liên hệ hỗ trợ để biết thêm chi tiết.</p>
        <p style="color:#888;font-size:13px;">Trân trọng,<br/>Đội ngũ BĐS</p>
      </div>
    `;
  }
}
