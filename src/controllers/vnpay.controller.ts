// src/controllers/vnpay.controller.ts
import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import {
  BuildCheckoutInput,
  buildCheckoutUrl,
  verifyVnpayReturn,
  verifyVnpayIpn,
} from "../services/vnpay.service";

function getClientIp(req: AuthenticatedRequest) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  let ip = xf.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "";
  ip = ip.replace(/^::ffff:/, "");
  // Force IPv4 for local / IPv6 cases
  if (ip === "::1" || ip.includes(":")) ip = "127.0.0.1";
  return ip;
}

// POST /vnpay/checkout-url
export async function createVnpayCheckoutUrlController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { amount, orderInfo, orderId, bankCode, locale, orderType } =
      req.body as Partial<BuildCheckoutInput> & { amount?: number | string };

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0 || !orderInfo) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "amount (number > 0) and orderInfo are required",
      });
    }

    // Tip: in sandbox, omit bankCode or use "NCB"
    const payload: BuildCheckoutInput = {
      amount: amountNum,
      orderInfo: String(orderInfo),
      ipAddr: getClientIp(req),
      ...(orderId ? { orderId: String(orderId) } : {}),
      ...(bankCode ? { bankCode: String(bankCode) } : {}),
      ...(locale ? { locale: locale as "vn" | "en" } : {}),
      ...(orderType ? { orderType: String(orderType) } : {}),
    };

    const result = buildCheckoutUrl(payload);
    return res.status(200).json({ success: true, message: "OK", data: result });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? "InvalidInput" : "ServerError",
      message: err?.message || "Failed to create VNPay checkout URL",
    });
  }
}

// GET /vnpay/return
export async function vnpayReturnController(
  req: AuthenticatedRequest,
  res: Response
) {
  const verification = verifyVnpayReturn(req.query as any);
  return res.status(200).json({
    success: true,
    message: verification.message,
    data: {
      isValid: verification.isValid,
      vnp_ResponseCode: verification.code,
      params: verification.data,
    },
  });
}

// GET /vnpay/ipn
export async function vnpayIpnController(
  req: AuthenticatedRequest,
  res: Response
) {
  const verification = verifyVnpayIpn(req.query as any);

  if (!verification.isValid) {
    return res.json({ RspCode: "97", Message: "Invalid signature" });
  }
  // TODO: lookup order by vnp_TxnRef, verify amount, idempotency, mark paid on code === "00"
  return res.json({ RspCode: "00", Message: "Confirm Success" });
}
