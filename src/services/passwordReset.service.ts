import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { PasswordResetToken } from '../models/passwordResetToken.model';
import { sendMail } from '../config/mail';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getBaseUrl() {
  return (process.env.APP_BASE_URL || 'http://localhost:5173').trim();
}
function getTokenTtlMinutes() {
  return Number(process.env.RESET_TOKEN_EXPIRES_MINUTES || 30);
}
function getOtpTtlMinutes() {
  return Number(process.env.RESET_OTP_EXPIRES_MINUTES || 10);
}
function pad6(n: number) {
  return n.toString().padStart(6, '0');
}

function validateNewPassword(newPassword: string) {
  if (!newPassword || newPassword.length < 8) {
    const err = new Error('newPassword must be at least 8 characters');
    (err as any).status = 400;
    throw err;
  }
}

export async function requestPasswordReset(emailRaw: string) {
  const email = (emailRaw || '').trim().toLowerCase();
  if (!emailRegex.test(email)) {
    const err = new Error('Invalid email');
    (err as any).status = 400;
    throw err;
  }

  const user = await User.findOne({ email });
  // Không lộ thông tin email tồn tại hay không
  if (!user) return { ok: true };

  // Dọn token/otp cũ chưa dùng
  await PasswordResetToken.deleteMany({ userId: user._id, usedAt: null });

  // Tạo token link
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenExpiresAt = new Date(Date.now() + getTokenTtlMinutes() * 60 * 1000);

  // Tạo OTP 6 số
  const otpCode = pad6(Math.floor(Math.random() * 1000000));
  const otpCodeHash = crypto.createHash('sha256').update(otpCode).digest('hex');
  const otpExpiresAt = new Date(Date.now() + getOtpTtlMinutes() * 60 * 1000);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: tokenExpiresAt,
    otpCodeHash,
    otpExpiresAt,
  });

  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const subject = 'Reset your password (OTP + Link)';
  const text = `OTP: ${otpCode}\nOTP expires in ${getOtpTtlMinutes()} minutes.\n\nOr reset via link (expires in ${getTokenTtlMinutes()} minutes):\n${resetUrl}`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
      <p>Chào ${user.profile?.fullName || user.username},</p>
      <p>OTP để đặt lại mật khẩu của bạn là:</p>
      <p style="font-size:20px;font-weight:700;letter-spacing:2px">${otpCode}</p>
      <p>OTP hết hạn trong <b>${getOtpTtlMinutes()} phút</b>.</p>
      <hr/>
      <p>Hoặc dùng liên kết bên dưới (hết hạn trong ${getTokenTtlMinutes()} phút):</p>
      <p style="margin:16px 0">
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;background:#111;color:#fff">
          Đặt lại mật khẩu
        </a>
      </p>
      <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    </div>
  `;

  await sendMail({ to: email, subject, html, text });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[reset] OTP for ${email}: ${otpCode}`);
    console.log(`[reset] Link for ${email}: ${resetUrl}`);
  }

  return { ok: true };
}

export async function verifyResetToken(token: string, uid: string) {
  if (!token || !uid) {
    const err = new Error('Missing token or uid');
    (err as any).status = 400;
    throw err;
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const doc = await PasswordResetToken.findOne({ userId: uid, tokenHash, usedAt: null });
  if (!doc) {
    const err = new Error('Invalid or used token');
    (err as any).status = 400;
    throw err;
  }
  if (!doc.expiresAt || doc.expiresAt.getTime() < Date.now()) {
    const err = new Error('Token expired');
    (err as any).status = 400;
    throw err;
  }
  return { ok: true };
}

export async function verifyResetOtp(otp: string, uid: string) {
  if (!otp || !uid) {
    const err = new Error('Missing otp or uid');
    (err as any).status = 400;
    throw err;
  }
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const doc = await PasswordResetToken.findOne({ userId: uid, otpCodeHash: otpHash, usedAt: null });
  if (!doc) {
    const err = new Error('Invalid or used otp');
    (err as any).status = 400;
    throw err;
  }
  if (!doc.otpExpiresAt || doc.otpExpiresAt.getTime() < Date.now()) {
    const err = new Error('OTP expired');
    (err as any).status = 400;
    throw err;
  }
  return { ok: true };
}

async function finalizeReset(userId: string, newPassword: string) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }
  validateNewPassword(newPassword);
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

  if (user.password && (await bcrypt.compare(newPassword, user.password))) {
    const err = new Error('New password must be different from old password');
    (err as any).status = 400;
    throw err;
  }

  user.password = await bcrypt.hash(newPassword, saltRounds);
  await user.save();

  // đánh dấu đã dùng & dọn hết các token/otp
  await PasswordResetToken.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } });
  await PasswordResetToken.deleteMany({ userId });
}

/** 🔁 NEW: Reset password by EMAIL (no uid on API) */
export type ResetPasswordByEmailParams =
  | { email: string; token: string; newPassword: string } // token + email
  | { email: string; otp: string; newPassword: string };  // otp + email

export async function resetPasswordByEmail(params: ResetPasswordByEmailParams) {
  const email = (params.email || '').trim().toLowerCase();
  if (!emailRegex.test(email)) {
    const err = new Error('Invalid email');
    (err as any).status = 400;
    throw err;
  }
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }
  const uid = String(user._id);

  if ('token' in params) {
    await verifyResetToken(params.token, uid);
    await finalizeReset(uid, params.newPassword);
    return { ok: true };
  }

  if ('otp' in params) {
    await verifyResetOtp(params.otp, uid);
    await finalizeReset(uid, params.newPassword);
    return { ok: true };
  }

  const err = new Error('Either token or otp is required');
  (err as any).status = 400;
  throw err;
}
