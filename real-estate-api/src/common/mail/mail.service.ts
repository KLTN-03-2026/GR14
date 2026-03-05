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
            from: `"Real Estate" <${this.configService.get('MAIL_USER')}>`,
            to,
            subject,
            html,
        });
    }

    getApprovalEmailHtml(fullName: string, appointmentDate: string, propertyTitle?: string): string {
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

    getConfirmationEmailHtml(fullName: string, appointmentDate: string, propertyTitle?: string): string {
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

    getCancellationEmailHtml(fullName: string, appointmentDate: string, propertyTitle?: string, cancelReason?: string): string {
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
}
