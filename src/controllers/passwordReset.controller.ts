import { Request, Response } from 'express';
import {
  requestPasswordReset,
  resetPasswordByEmail,
  verifyResetToken,
  verifyResetOtp,
} from '../services/passwordReset.service';

export async function forgotPasswordController(req: Request, res: Response) {
  try {
    const { email } = req.body as { email?: string };
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'InvalidInput', message: 'email is required' });
    }
    await requestPasswordReset(email);
    return res.status(200).json({
      success: true,
      message: 'If the email exists, an OTP and reset link have been sent.',
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? 'InvalidInput' : 'ServerError',
      message: error?.message || 'Unexpected server error',
    });
  }
}

/** ⚠️ Hai endpoint verify cũ vẫn dùng uid (tùy bạn có muốn đổi theo email luôn không) */
export async function verifyResetTokenController(req: Request, res: Response) {
  try {
    const { token, uid } = req.query as { token?: string; uid?: string };
    await verifyResetToken(String(token || ''), String(uid || ''));
    return res.status(200).json({ success: true, message: 'Token is valid' });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? 'InvalidToken' : 'ServerError',
      message: error?.message || 'Unexpected server error',
    });
  }
}

export async function verifyResetOtpController(req: Request, res: Response) {
  try {
    const { otp, uid } = req.query as { otp?: string; uid?: string };
    await verifyResetOtp(String(otp || ''), String(uid || ''));
    return res.status(200).json({ success: true, message: 'OTP is valid' });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? 'InvalidOtp' : 'ServerError',
      message: error?.message || 'Unexpected server error',
    });
  }
}

/** ✅ Reset mới: không cần uid, thay bằng email */
export async function resetPasswordController(req: Request, res: Response) {
  try {
    const { token, otp, email, newPassword, confirmNewPassword } = req.body as {
      token?: string;
      otp?: string;
      email?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    };

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'InvalidInput',
        message: 'email and newPassword are required',
      });
    }
    if (confirmNewPassword !== undefined && confirmNewPassword !== newPassword) {
      return res.status(400).json({
        success: false,
        error: 'InvalidInput',
        message: 'confirmNewPassword does not match',
      });
    }

    // Chỉ truyền field có giá trị để tránh exactOptionalPropertyTypes
    if (token && otp) {
      return res.status(400).json({
        success: false,
        error: 'InvalidInput',
        message: 'Provide either token or otp, not both',
      });
    } else if (token) {
      await resetPasswordByEmail({ email, token, newPassword });
    } else if (otp) {
      await resetPasswordByEmail({ email, otp, newPassword });
    } else {
      return res.status(400).json({
        success: false,
        error: 'InvalidInput',
        message: 'Either token or otp is required',
      });
    }

    return res.status(200).json({ success: true, message: 'Password has been reset' });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error:
        status === 400 ? 'InvalidInput'
        : status === 404 ? 'NotFound'
        : 'ServerError',
      message: error?.message || 'Unexpected server error',
    });
  }
}
