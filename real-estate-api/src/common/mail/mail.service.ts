import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as tpl from './email-templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resendApiKey: string | undefined;
  private transporter: nodemailer.Transporter | undefined;

  constructor(private configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (this.resendApiKey) {
      const masked =
        this.resendApiKey.slice(0, 6) + '...' + this.resendApiKey.slice(-4);
      this.logger.log(`Mail provider: Resend (HTTP API) | Key: ${masked}`);
      this.logger.log(
        `Resend From: ${this.configService.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'}`,
      );
    } else {
      const port = Number(this.configService.get('MAIL_PORT') || 587);
      const secure = port === 465;
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('MAIL_HOST') || 'smtp.gmail.com',
        port,
        secure,
        auth: {
          user: this.configService.get('MAIL_USER'),
          pass: this.configService.get('MAIL_PASSWORD'),
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      this.logger.log(
        `Mail provider: SMTP ${this.configService.get('MAIL_HOST')}:${port}`,
      );
    }
  }

  // ── Sending ─────────────────────────────────────────────────────────────────

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (this.resendApiKey) {
      await this.sendViaResend(to, subject, html);
    } else {
      await this.sendViaSmtp(to, subject, html);
    }
  }

  private async sendViaResend(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const from = `${this.configService.get('RESEND_FROM_NAME') || "Black'S City BĐS"} <${this.configService.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'}>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    this.logger.log(`[Resend] → ${to}`);
  }

  private async sendViaSmtp(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.transporter) throw new Error('SMTP not initialized');
    await this.transporter.sendMail({
      from: `"Black'S City BĐS" <${this.configService.get('MAIL_USER')}>`,
      to,
      subject,
      html,
    });
  }

  // ── Templates (delegate to email-templates.ts) ──────────────────────────────

  // Auth
  getOtpRegisterEmailHtml(name: string, otp: string) {
    return tpl.otpRegisterHtml(name, otp);
  }
  getOtpResetPasswordEmailHtml(name: string, otp: string) {
    return tpl.otpResetPasswordHtml(name, otp);
  }

  // Appointment
  getConfirmationEmailHtml(name: string, date: string, property?: string) {
    return tpl.appointmentCreatedHtml(name, date, property);
  }
  getApprovalEmailHtml(name: string, date: string, property?: string) {
    return tpl.appointmentApprovedHtml(name, date, property);
  }
  getCancellationEmailHtml(
    name: string,
    date: string,
    property?: string,
    reason?: string,
  ) {
    return tpl.appointmentRejectedHtml(name, date, property, reason);
  }

  // Post
  getPostApprovedEmailHtml(name: string, title: string) {
    return tpl.postApprovedHtml(name, title);
  }
  getPostRejectedEmailHtml(name: string, title: string) {
    return tpl.postRejectedHtml(name, title);
  }

  // Payment
  getPaymentSuccessEmailHtml(
    name: string,
    amount: number,
    pkg: string,
    post?: string,
    method?: string,
  ) {
    return tpl.paymentSuccessHtml(name, amount, pkg, post, method);
  }
  getPaymentFailureEmailHtml(
    name: string,
    amount: number,
    pkg: string,
    post?: string,
    method?: string,
  ) {
    return tpl.paymentFailureHtml(name, amount, pkg, post, method);
  }

  // Deposit
  getDepositSuccessEmailHtml(
    name: string,
    property: string,
    amount: number,
    expiresAt: string,
    depositType: string,
  ) {
    return tpl.depositSuccessHtml(
      name,
      property,
      amount,
      expiresAt,
      depositType,
    );
  }
  getRefundApprovedEmailHtml(name: string, property: string, amount: number) {
    return tpl.refundApprovedHtml(name, property, amount);
  }
  getRefundRejectedEmailHtml(name: string, property: string, note?: string) {
    return tpl.refundRejectedHtml(name, property, note);
  }
}
