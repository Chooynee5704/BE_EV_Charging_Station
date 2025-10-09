// src/config/vnpay.ts
export interface VnpConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
  returnUrl: string;
  ipnUrl: string;
  version: string;
  command: string;
  currCode: string;
}

function requireEnv(name: string, fallback?: string): string {
  const v = (process.env[name] ?? fallback ?? "").toString().trim();
  if (!v) throw new Error(`[VNPay] Missing env ${name}`);
  return v;
}

export function getVnpConfig(): VnpConfig {
  // Sandbox defaults when NODE_ENV !== production
  const defaultPayUrl =
    process.env.NODE_ENV === "production"
      ? "https://pay.vnpay.vn/vpcpay.html"
      : "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

  return {
    tmnCode: requireEnv("VNP_TMN_CODE"),
    hashSecret: requireEnv("VNP_HASH_SECRET"),
    // accept either VNP_PAY_URL or VNP_URL
    payUrl: (
      process.env.VNP_PAY_URL ||
      process.env.VNP_URL ||
      defaultPayUrl
    ).trim(),
    returnUrl: requireEnv("VNP_RETURN_URL"),
    ipnUrl: requireEnv("VNP_IPN_URL"),
    version: process.env.VNP_VERSION?.trim() || "2.1.0",
    command: process.env.VNP_COMMAND?.trim() || "pay",
    currCode: process.env.VNP_CURR_CODE?.trim() || "VND",
  };
}
