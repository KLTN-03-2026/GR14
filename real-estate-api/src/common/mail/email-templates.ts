/**
 * Email Templates — Black'S City BĐS
 * Tất cả HTML email templates tập trung tại đây.
 */

// ─── Brand Colors ───────────────────────────────────────────────────────────
const B = '#002f5e';      // Brand
const BL = '#e8f0fe';     // Brand light bg
const OK = '#16a34a';     // Success
const ERR = '#dc2626';    // Error
const WARN = '#f59e0b';   // Warning
const T = '#1f2937';      // Text
const TM = '#6b7280';     // Text muted

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMoney(v: number): string {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background:${B};padding:28px 32px;text-align:center;">
  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:.5px;">Black'S City BĐS</h1>
  <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:13px;">Nền tảng bất động sản uy tín hàng đầu</p>
</td></tr>
<tr><td style="padding:32px;">${body}</td></tr>
<tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0;color:${TM};font-size:12px;line-height:1.6;">© ${new Date().getFullYear()} Black'S City BĐS — Mọi quyền được bảo lưu<br/>Email này được gửi tự động, vui lòng không trả lời trực tiếp.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function badge(text: string, color: string): string {
  return `<div style="text-align:center;margin-bottom:20px;"><span style="display:inline-block;padding:6px 16px;border-radius:20px;background:${color};color:#fff;font-size:14px;font-weight:600;">${text}</span></div>`;
}

function hi(name: string): string {
  return `<p style="margin:0 0 16px;color:${T};font-size:15px;line-height:1.6;">Kính gửi <strong>${name}</strong>,</p>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;color:${TM};font-size:14px;width:140px;vertical-align:top;">${label}</td><td style="padding:8px 0;color:${T};font-size:14px;font-weight:600;">${value}</td></tr>`;
}

function table(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${BL};border-radius:8px;padding:16px;margin:20px 0;"><tbody>${rows}</tbody></table>`;
}

function msg(text: string): string {
  return `<p style="color:${T};font-size:14px;line-height:1.6;">${text}</p>`;
}

function note(icon: string, text: string, bg: string, border: string, color: string): string {
  return `<div style="background:${bg};border-left:4px solid ${border};padding:12px 16px;border-radius:6px;margin:16px 0;"><p style="margin:0;color:${color};font-size:13px;">${icon} ${text}</p></div>`;
}

function bye(): string {
  return `<p style="margin:24px 0 0;color:${TM};font-size:13px;line-height:1.6;">Trân trọng,<br/><strong style="color:${B};">Đội ngũ Black'S City BĐS</strong></p>`;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function otpRegisterHtml(name: string, otp: string): string {
  return wrap(`
    ${hi(name)}
    ${msg('Cảm ơn bạn đã đăng ký tài khoản tại <strong>Black\'S City BĐS</strong>. Vui lòng sử dụng mã OTP bên dưới để xác thực:')}
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:${B};color:#fff;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 40px;border-radius:12px;">${otp}</div>
      <p style="margin:12px 0 0;color:${TM};font-size:13px;">Mã có hiệu lực trong <strong>5 phút</strong></p>
    </div>
    ${note('⚠️', 'Không chia sẻ mã OTP này cho bất kỳ ai. Nhân viên Black\'S City không bao giờ yêu cầu mã OTP của bạn.', '#fef3c7', WARN, '#92400e')}
    ${bye()}
  `);
}

export function otpResetPasswordHtml(name: string, otp: string): string {
  return wrap(`
    ${hi(name)}
    ${msg('Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã OTP bên dưới:')}
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:${ERR};color:#fff;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 40px;border-radius:12px;">${otp}</div>
      <p style="margin:12px 0 0;color:${TM};font-size:13px;">Mã có hiệu lực trong <strong>5 phút</strong></p>
    </div>
    ${note('🔒', 'Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.', '#fef2f2', ERR, '#991b1b')}
    ${bye()}
  `);
}

// ─── Appointment ─────────────────────────────────────────────────────────────

export function appointmentCreatedHtml(name: string, date: string, property?: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('📅 Lịch hẹn đã được tạo', B)}
    ${msg('Lịch hẹn xem bất động sản của bạn đã được tạo thành công và đang chờ xác nhận.')}
    ${table(
      (property ? row('🏠 Bất động sản', property) : '') +
      row('📅 Thời gian', date) +
      row('📋 Trạng thái', `<span style="color:${WARN};font-weight:700;">Chờ xác nhận</span>`)
    )}
    ${msg('Chúng tôi sẽ liên hệ với bạn sớm nhất để xác nhận lịch hẹn.')}
    ${bye()}
  `);
}

export function appointmentApprovedHtml(name: string, date: string, property?: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('✅ Lịch hẹn đã được duyệt', OK)}
    ${msg('Lịch hẹn xem bất động sản của bạn đã được chấp thuận.')}
    ${table(
      (property ? row('🏠 Bất động sản', property) : '') +
      row('📅 Thời gian', date) +
      row('📋 Trạng thái', `<span style="color:${OK};font-weight:700;">Đã duyệt</span>`)
    )}
    ${note('📌', 'Vui lòng có mặt đúng giờ. Nhân viên của chúng tôi sẽ liên hệ với bạn trước giờ hẹn.', '#f0fdf4', OK, '#166534')}
    ${bye()}
  `);
}

export function appointmentRejectedHtml(name: string, date: string, property?: string, reason?: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('❌ Lịch hẹn đã bị từ chối', ERR)}
    ${msg('Rất tiếc, lịch hẹn xem bất động sản của bạn đã bị từ chối.')}
    ${table(
      (property ? row('🏠 Bất động sản', property) : '') +
      row('📅 Thời gian dự kiến', date) +
      (reason ? row('📝 Lý do', reason) : '')
    )}
    ${msg('Vui lòng liên hệ chúng tôi để được hỗ trợ đặt lại lịch hẹn.')}
    ${bye()}
  `);
}

// ─── Post ────────────────────────────────────────────────────────────────────

export function postApprovedHtml(name: string, title: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('✅ Bài đăng đã được duyệt', OK)}
    ${msg('Bài đăng của bạn đã được duyệt và hiển thị trên hệ thống.')}
    ${table(
      row('📰 Bài đăng', title) +
      row('📋 Trạng thái', `<span style="color:${OK};font-weight:700;">Đã duyệt — Đang hiển thị</span>`)
    )}
    ${msg('Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của chúng tôi.')}
    ${bye()}
  `);
}

export function postRejectedHtml(name: string, title: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('❌ Bài đăng chưa được duyệt', ERR)}
    ${msg('Rất tiếc, bài đăng của bạn chưa được duyệt.')}
    ${table(
      row('📰 Bài đăng', title) +
      row('📋 Trạng thái', `<span style="color:${ERR};font-weight:700;">Chưa duyệt</span>`)
    )}
    ${msg('Vui lòng kiểm tra lại nội dung hoặc liên hệ hỗ trợ để biết thêm chi tiết.')}
    ${bye()}
  `);
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function paymentSuccessHtml(name: string, amount: number, pkg: string, postTitle?: string, method?: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('✅ Thanh toán thành công', OK)}
    ${msg('Giao dịch thanh toán của bạn đã được xử lý thành công.')}
    ${table(
      row('📦 Gói dịch vụ', pkg) +
      (postTitle ? row('📰 Bài đăng', postTitle) : '') +
      row('💰 Số tiền', `<span style="color:${OK};font-size:18px;font-weight:700;">${fmtMoney(amount)}</span>`) +
      (method ? row('💳 Phương thức', method.toUpperCase()) : '')
    )}
    ${msg('Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.')}
    ${bye()}
  `);
}

export function paymentFailureHtml(name: string, amount: number, pkg: string, postTitle?: string, method?: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('❌ Thanh toán thất bại', ERR)}
    ${msg('Giao dịch thanh toán của bạn chưa thành công.')}
    ${table(
      row('📦 Gói dịch vụ', pkg) +
      (postTitle ? row('📰 Bài đăng', postTitle) : '') +
      row('💰 Số tiền', `<span style="color:${ERR};font-size:18px;font-weight:700;">${fmtMoney(amount)}</span>`) +
      (method ? row('💳 Phương thức', method.toUpperCase()) : '')
    )}
    ${note('', 'Vui lòng thử lại hoặc chọn phương thức khác. Nếu cần hỗ trợ, hãy liên hệ đội ngũ CSKH.', '#fef2f2', ERR, '#991b1b')}
    ${bye()}
  `);
}

// ─── Deposit ─────────────────────────────────────────────────────────────────

export function depositSuccessHtml(name: string, property: string, amount: number, expiresAt: string, depositType: string): string {
  const isAfterViewing = depositType === 'AFTER_VIEWING';
  return wrap(`
    ${hi(name)}
    ${badge('🎉 Đặt cọc thành công', OK)}
    ${msg('Giao dịch đặt cọc bất động sản của bạn đã được xác nhận thành công.')}
    ${table(
      row('🏠 Bất động sản', property) +
      row('💰 Số tiền cọc', `<span style="color:${OK};font-size:18px;font-weight:700;">${fmtMoney(amount)}</span>`) +
      row('⏰ Hết hạn giữ chỗ', expiresAt) +
      row('📋 Loại cọc', isAfterViewing ? 'Cọc chốt mua (sau khi xem)' : 'Giữ chỗ trước khi xem')
    )}
    ${isAfterViewing
      ? note('⚠️', 'Đây là cọc chốt mua sau khi xem. Số tiền này không được hoàn trả.', '#fef3c7', WARN, '#92400e')
      : note('ℹ️', 'Bạn có thể yêu cầu hoàn tiền trước khi hết hạn. Tỷ lệ hoàn tùy thuộc thời điểm hủy.', '#eff6ff', '#3b82f6', '#1e40af')
    }
    ${bye()}
  `);
}

export function refundApprovedHtml(name: string, property: string, amount: number): string {
  return wrap(`
    ${hi(name)}
    ${badge('✅ Hoàn tiền đã được duyệt', OK)}
    ${msg('Yêu cầu hoàn tiền đặt cọc của bạn đã được duyệt.')}
    ${table(
      row('🏠 Bất động sản', property) +
      row('💰 Số tiền hoàn', `<span style="color:${OK};font-size:18px;font-weight:700;">${fmtMoney(amount)}</span>`) +
      row('📋 Trạng thái', `<span style="color:${OK};font-weight:700;">Đã duyệt</span>`)
    )}
    ${msg('Số tiền sẽ được chuyển về tài khoản của bạn trong thời gian sớm nhất.')}
    ${bye()}
  `);
}

export function refundRejectedHtml(name: string, property: string, reason?: string): string {
  return wrap(`
    ${hi(name)}
    ${badge('❌ Hoàn tiền bị từ chối', ERR)}
    ${msg('Yêu cầu hoàn tiền đặt cọc của bạn đã bị từ chối.')}
    ${table(
      row('🏠 Bất động sản', property) +
      (reason ? row('📝 Lý do', reason) : '') +
      row('📋 Trạng thái', `<span style="color:${ERR};font-weight:700;">Từ chối — Vẫn giữ chỗ</span>`)
    )}
    ${msg('Giao dịch cọc của bạn vẫn đang trong trạng thái giữ chỗ. Nếu cần hỗ trợ, vui lòng liên hệ đội ngũ CSKH.')}
    ${bye()}
  `);
}
