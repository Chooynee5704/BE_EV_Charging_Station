// src/services/vnpay.service.ts
import crypto from "crypto";
import { getVnpConfig } from "../config/vnpay";

export interface BuildCheckoutInput {
  amount: number; // VND
  ipAddr: string; // client IPv4
  orderInfo: string; // description shown to customer
  orderId?: string; // vnp_TxnRef; if omitted, auto-generate
  bankCode?: string; // optional; in sandbox use "NCB" or omit
  locale?: "vn" | "en"; // default 'vn'
  orderType?: string; // default 'other'
  returnUrlOverride?: string;
  ipnUrlOverride?: string; // kept for future; not sent in params
}

export interface VnpSignedResult {
  paymentUrl: string;
  params: Record<string, string>;
}

export interface VnpVerifyResult {
  isValid: boolean;
  code: string; // vnp_ResponseCode (Return) or vnp_TransactionStatus (IPN)
  data: Record<string, string>;
  message?: string;
}

function requireString(name: string, v?: string): string {
  if (!v || typeof v !== "string" || v.trim() === "") {
    throw Object.assign(new Error(`VNPay config missing: ${name}`), {
      status: 500,
    });
  }
  return v;
}

function formatDateYmdHisInVN(d: Date) {
  // VNPay expects YYYYMMDDHHmmss (UTC+7)
  const tzOffset = 7 * 60;
  const local = new Date(
    d.getTime() + (tzOffset - d.getTimezoneOffset()) * 60000
  );
  const YYYY = local.getFullYear().toString();
  const MM = String(local.getMonth() + 1).padStart(2, "0");
  const DD = String(local.getDate()).padStart(2, "0");
  const hh = String(local.getHours()).padStart(2, "0");
  const mm = String(local.getMinutes()).padStart(2, "0");
  const ss = String(local.getSeconds()).padStart(2, "0");
  return `${YYYY}${MM}${DD}${hh}${mm}${ss}`;
}

function sortObject(obj: Record<string, unknown>): Record<string, string> {
  const sorted: Record<string, string> = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      sorted[k] = String(obj[k] ?? "");
    });
  return sorted;
}

function hmacSHA512(secret: string, data: string) {
  return crypto.createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

export function buildCheckoutUrl(input: BuildCheckoutInput): VnpSignedResult {
  const cfg = getVnpConfig();

  const version = requireString("version", cfg.version);
  const command = requireString("command", cfg.command);
  const tmnCode = requireString("tmnCode", cfg.tmnCode);
  const currCode = requireString("currCode", cfg.currCode);
  const payUrl = requireString("payUrl", cfg.payUrl);
  const hashSecret = requireString("hashSecret", cfg.hashSecret);

  // Use override if provided, else config
  const vnp_ReturnUrl = requireString(
    "returnUrl",
    input.returnUrlOverride ?? cfg.returnUrl
  );
  // NOTE: Do NOT include IPN URL in request params; it must be configured in VNPay portal.

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("amount must be positive"), { status: 400 });
  }
  if (!input.ipAddr || !input.orderInfo) {
    throw Object.assign(new Error("ipAddr and orderInfo are required"), {
      status: 400,
    });
  }

  const amountVndInteger = Math.round(input.amount);
  const vnp_Amount = String(amountVndInteger * 100); // VNPay requires *100

  const now = new Date();
  const createDate = formatDateYmdHisInVN(now);
  const expireDate = formatDateYmdHisInVN(
    new Date(now.getTime() + 15 * 60 * 1000)
  ); // +15m

  const vnp_TxnRef =
    input.orderId ??
    `${createDate}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const baseParams: Record<string, string> = {
    vnp_Version: version,
    vnp_Command: command,
    vnp_TmnCode: tmnCode,
    vnp_Amount,
    vnp_CurrCode: currCode,
    vnp_TxnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: input.orderType ?? "other",
    vnp_Locale: input.locale ?? "vn",
    vnp_ReturnUrl,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
  };
  if (input.bankCode) baseParams["vnp_BankCode"] = input.bankCode;

  const sorted = sortObject(baseParams);
  const signParams = new URLSearchParams(sorted);
  const signData = signParams.toString();
  const secureHash = hmacSHA512(hashSecret, signData);

  const urlParams = new URLSearchParams(sorted);
  urlParams.append("vnp_SecureHash", secureHash);

  const paymentUrl = `${payUrl}?${urlParams.toString()}`;
  return { paymentUrl, params: Object.fromEntries(urlParams.entries()) };
}

export function verifyVnpayReturn(
  rawQuery: Record<string, string | string[] | undefined>
): VnpVerifyResult {
  const cfg = getVnpConfig();
  const hashSecret = requireString("hashSecret", cfg.hashSecret);

  const input: Record<string, string> = {};
  Object.keys(rawQuery).forEach((k) => {
    const v = rawQuery[k];
    if (v !== undefined)
      input[k] = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
  });

  const secureHash = input["vnp_SecureHash"] || "";
  delete input["vnp_SecureHash"];
  delete input["vnp_SecureHashType"];

  const sorted = sortObject(input);
  const signParams = new URLSearchParams(sorted);
  const signData = signParams.toString();
  const calcHash = hmacSHA512(hashSecret, signData);

  const isValid = secureHash.toLowerCase() === calcHash.toLowerCase();
  return {
    isValid,
    code: input["vnp_ResponseCode"] || "",
    data: input,
    message: isValid ? "Valid signature" : "Invalid signature",
  };
}

export function verifyVnpayIpn(
  rawQuery: Record<string, string | string[] | undefined>
): VnpVerifyResult {
  const cfg = getVnpConfig();
  const hashSecret = requireString("hashSecret", cfg.hashSecret);

  const input: Record<string, string> = {};
  Object.keys(rawQuery).forEach((k) => {
    const v = rawQuery[k];
    if (v !== undefined)
      input[k] = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
  });

  const secureHash = input["vnp_SecureHash"] || "";
  delete input["vnp_SecureHash"];
  delete input["vnp_SecureHashType"];

  const sorted = sortObject(input);
  const signParams = new URLSearchParams(sorted);
  const signData = signParams.toString();
  const calcHash = hmacSHA512(hashSecret, signData);

  const isValid = secureHash.toLowerCase() === calcHash.toLowerCase();
  return {
    isValid,
    code: input["vnp_TransactionStatus"] || "",
    data: input,
    message: isValid ? "Valid signature" : "Invalid signature",
  };
}
