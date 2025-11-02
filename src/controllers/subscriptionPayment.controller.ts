import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { buildCheckoutUrl, BuildCheckoutInput, verifyVnpayReturn } from "../services/vnpay.service";
import { createSubscription, getSubscriptionById, activateSubscription } from "../services/subscription.service";
import { createTransaction, findTransactionByVnpTxnRef, updateTransaction } from "../services/transaction.service";
import { getSubscriptionPlanById } from "../services/subscriptionPlan.service";

/**
 * Tạo URL thanh toán VNPay cho subscription bằng planId
 * POST /subscriptions/payment
 */
export async function createSubscriptionPaymentController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { planId, locale } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "planId là bắt buộc",
      });
    }

    // User must be authenticated
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
      });
    }

    // Lấy thông tin plan
    const plan = await getSubscriptionPlanById(planId);

    if (!plan.isActive) {
      return res.status(400).json({
        success: false,
        error: "InvalidPlan",
        message: "Gói subscription này không còn hoạt động",
      });
    }

    // Tạo subscription cho user (status: pending)
    const subscription = await createSubscription({
      userId: req.user.userId,
      planId: planId,
      autoRenew: false,
    });

    const subscriptionId = String(subscription._id);

    // Lấy client IP
    const ipAddr =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    // Tạo order info
    const orderInfo = `Thanh toan goi ${plan.name}`;

    // Build VNPay checkout URL
    const payload: BuildCheckoutInput = {
      amount: plan.price,
      orderInfo,
      ipAddr,
      orderId: subscriptionId, // Sử dụng subscriptionId làm orderId
      locale: (locale as "vn" | "en") || "vn",
      orderType: "subscription", // Loại đơn hàng: subscription
    };

    const result = buildCheckoutUrl(payload);

    // Lấy vnp_TxnRef từ params
    const vnpTxnRef = result.params.vnp_TxnRef || subscriptionId;

    // Tạo transaction pending
    try {
      const transaction = await createTransaction({
        userId: req.user.userId,
        amount: plan.price,
        currency: "VND",
        status: "pending",
        paymentMethod: "vnpay",
        description: orderInfo,
        vnpayDetails: {
          vnp_TxnRef: String(vnpTxnRef),
          vnp_OrderInfo: orderInfo,
          vnp_Amount: plan.price * 100,
        },
        metadata: {
          subscriptionId: subscriptionId,
          planId: planId,
          subscriptionType: plan.type,
          subscriptionDuration: plan.duration,
          paymentType: "subscription",
        },
      });

      console.log(
        `Created pending transaction ${transaction._id} for subscription ${subscriptionId}`
      );
    } catch (txError: any) {
      console.error("Error creating transaction:", txError?.message);
      // Không block việc tạo URL thanh toán
    }

    return res.status(200).json({
      success: true,
      message: "Tạo URL thanh toán thành công",
      data: {
        paymentUrl: result.paymentUrl,
        vnp_TxnRef: vnpTxnRef,
        subscriptionId: subscriptionId, // ID của subscription vừa tạo
        planInfo: {
          id: plan._id,
          name: plan.name,
          type: plan.type,
          duration: plan.duration,
          price: plan.price,
        },
        subscriptionInfo: {
          id: subscription._id,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi tạo URL thanh toán",
    });
  }
}

/**
 * Kiểm tra trạng thái thanh toán subscription từ VNPay return URL
 * POST /subscriptions/check-payment-status
 */
export async function checkSubscriptionPaymentStatusController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { subscriptionId, ...vnpayData } = req.body;
    
    // Có thể nhận từ body hoặc query
    const queryData = Object.keys(vnpayData).length > 0 ? vnpayData : req.query;
    
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "subscriptionId là bắt buộc",
      });
    }

    if (!queryData || Object.keys(queryData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Thiếu thông tin từ VNPay return URL",
      });
    }

    // Verify signature từ VNPay
    const verification = verifyVnpayReturn(queryData as any);

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        error: "InvalidSignature",
        message: "Chữ ký từ VNPay không hợp lệ",
        vnpayData: verification.data,
      });
    }

    // Xác định trạng thái thanh toán
    const vnpResponseCode = verification.data.vnp_ResponseCode || "99";
    let paymentStatus: "success" | "failed" | "cancelled" = "failed";
    let reason = "Unknown error";

    if (vnpResponseCode === "00") {
      paymentStatus = "success";
      reason = "Thanh toán thành công";
    } else if (vnpResponseCode === "24") {
      paymentStatus = "cancelled";
      reason = "Giao dịch bị hủy bởi user";
    } else {
      paymentStatus = "failed";
      reason = getVnpayErrorMessage(vnpResponseCode);
    }

    // Lấy subscription
    const subscription = await getSubscriptionById(subscriptionId);

    // Cho phép tất cả authenticated users check payment
    // Không cần kiểm tra quyền owner

    const vnpTxnRef = verification.data.vnp_TxnRef;
    let transaction = vnpTxnRef ? await findTransactionByVnpTxnRef(vnpTxnRef) : null;
    let transactionInfo = null;

    // Cập nhật transaction nếu có
    if (transaction) {
      const transactionStatus = paymentStatus === "success" ? "success" : 
                                paymentStatus === "cancelled" ? "cancelled" : "failed";

      const updatedVnpDetails: any = { ...transaction.vnpayDetails };
      if (verification.data.vnp_ResponseCode) updatedVnpDetails.vnp_ResponseCode = verification.data.vnp_ResponseCode;
      if (verification.data.vnp_TransactionNo) updatedVnpDetails.vnp_TransactionNo = verification.data.vnp_TransactionNo;
      if (verification.data.vnp_BankCode) updatedVnpDetails.vnp_BankCode = verification.data.vnp_BankCode;
      if (verification.data.vnp_CardType) updatedVnpDetails.vnp_CardType = verification.data.vnp_CardType;
      if (verification.data.vnp_PayDate) updatedVnpDetails.vnp_PayDate = verification.data.vnp_PayDate;

      const updatedTransaction = await updateTransaction({
        transactionId: String(transaction._id),
        status: transactionStatus,
        vnpayDetails: updatedVnpDetails,
        metadata: {
          ...transaction.metadata,
          updatedFrom: "check_payment_status",
          checkTime: new Date().toISOString(),
          ...(paymentStatus !== "success" ? { failureReason: reason } : {}),
        },
      });

      transactionInfo = {
        id: updatedTransaction._id,
        status: updatedTransaction.status,
        amount: updatedTransaction.amount,
        currency: updatedTransaction.currency,
        paymentMethod: updatedTransaction.paymentMethod,
        createdAt: updatedTransaction.createdAt,
        updatedAt: updatedTransaction.updatedAt,
      };
    }

    // Nếu thanh toán thành công -> activate subscription
    if (paymentStatus === "success") {
      try {
        await activateSubscription(subscriptionId);
        console.log(`Activated subscription ${subscriptionId} after successful payment check`);
      } catch (activateErr) {
        console.error(`Failed to activate subscription ${subscriptionId}:`, activateErr);
      }
    }

    // Lấy subscription mới nhất sau khi activate
    const updatedSubscription = await getSubscriptionById(subscriptionId);

    // Prepare redirect data so the frontend can navigate with full VNPay payload
    const redirectParams = buildSubscriptionRedirectParams(
      queryData as Record<string, unknown>,
      String(subscriptionId)
    );
    const redirectUrl = buildSubscriptionRedirectUrl(paymentStatus, redirectParams);

    return res.status(200).json({
      success: true,
      message: `Thanh toán ${paymentStatus === "success" ? "thành công" : "không thành công"}`,
      data: {
        paymentStatus,
        reason,
        subscriptionId,
        vnpayInfo: {
          responseCode: vnpResponseCode,
          transactionNo: verification.data.vnp_TransactionNo,
          bankCode: verification.data.vnp_BankCode,
          cardType: verification.data.vnp_CardType,
          payDate: verification.data.vnp_PayDate,
          amount: verification.data.vnp_Amount ? Number(verification.data.vnp_Amount) / 100 : 0,
        },
        subscription: {
          id: updatedSubscription._id,
          status: updatedSubscription.status,
          type: updatedSubscription.type,
          duration: updatedSubscription.duration,
          startDate: updatedSubscription.startDate,
          endDate: updatedSubscription.endDate,
          price: updatedSubscription.price,
        },
        transaction: transactionInfo,
        redirect: {
          url: redirectUrl,
          params: redirectParams,
        },
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi kiểm tra trạng thái thanh toán",
    });
  }
}

// Helper function để map VNPay error code sang message
function getVnpayErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).",
    "09": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.",
    "10": "Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
    "11": "Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.",
    "12": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.",
    "13": "Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).",
    "24": "Giao dịch không thành công do: Khách hàng hủy giao dịch",
    "51": "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.",
    "65": "Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.",
    "75": "Ngân hàng thanh toán đang bảo trì.",
    "79": "Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.",
    "99": "Lỗi không xác định",
  };

  return errorMessages[code] || `Lỗi không xác định (${code})`;
}

function buildSubscriptionRedirectParams(
  rawParams: Record<string, unknown>,
  subscriptionId: string
): Record<string, string> {
  const params: Record<string, string> = {};

  if (rawParams) {
    Object.entries(rawParams).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        const firstDefined = value.find(
          (item) => item !== undefined && item !== null && item !== ""
        );
        if (firstDefined === undefined || firstDefined === null) return;
        params[key] = String(firstDefined);
        return;
      }

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        params[key] = String(value);
      }
    });
  }

  params.subscriptionId = subscriptionId;
  return params;
}

function buildSubscriptionRedirectUrl(
  status: "success" | "failed" | "cancelled",
  params: Record<string, string>
): string | null {
  const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const targetPath = {
    success: "/payment-success",
    failed: "/payment-failed",
    cancelled: "/payment-cancelled",
  } as const;

  const path = targetPath[status];
  if (!path) return null;

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (!entries.length) {
    return `${frontendBase}${path}`;
  }

  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${frontendBase}${path}?${query}`;
}

