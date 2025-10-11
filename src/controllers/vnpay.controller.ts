// src/controllers/vnpay.controller.ts
import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import {
  BuildCheckoutInput,
  buildCheckoutUrl,
  verifyVnpayReturn,
  verifyVnpayIpn,
} from "../services/vnpay.service";
import {
  createTransaction,
  findTransactionByVnpTxnRef,
  updateTransaction,
} from "../services/transaction.service";

function getClientIp(req: AuthenticatedRequest) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  let ip = xf.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "";
  ip = ip.replace(/^::ffff:/, "");
  // Force IPv4 for local / IPv6 cases
  if (ip === "::1" || ip.includes(":")) ip = "127.0.0.1";
  return ip;
}

/**
 * Map VNPay response/transaction code sang thông báo tiếng Việt
 */
function getVnpayErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    "00": "Giao dịch thành công",
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)",
    "09": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng",
    "10": "Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
    "11": "Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch",
    "12": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa",
    "13": "Giao dịch không thành công do: Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch",
    "24": "Giao dịch không thành công do: Khách hàng hủy giao dịch",
    "51": "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch",
    "65": "Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày",
    "75": "Ngân hàng thanh toán đang bảo trì",
    "79": "Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch",
    "99": "Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)",
  };
  
  return errorMessages[code] || `Lỗi không xác định (Code: ${code})`;
}

/**
 * Xác định transaction status từ VNPay response code
 */
function determineTransactionStatus(
  code: string,
  isValid: boolean
): { status: "success" | "failed" | "cancelled"; reason?: string } {
  if (isValid && code === "00") {
    return { status: "success" };
  } else if (code === "24") {
    return { status: "cancelled", reason: getVnpayErrorMessage(code) };
  } else {
    return { status: "failed", reason: getVnpayErrorMessage(code) };
  }
}

// POST /vnpay/checkout-url
export async function createVnpayCheckoutUrlController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { amount, orderInfo, orderId, bankCode, locale, orderType, reservationId } =
      req.body as Partial<BuildCheckoutInput> & { 
        amount?: number | string;
        reservationId?: string;
      };

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0 || !orderInfo) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "amount (number > 0) and orderInfo are required",
      });
    }

    // User must be authenticated to create payment
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
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

    // Tạo giao dịch pending khi tạo URL thanh toán
    try {
      const vnpDetails: any = {};
      if (result.params.vnp_TxnRef) vnpDetails.vnp_TxnRef = result.params.vnp_TxnRef;
      if (result.params.vnp_Amount) vnpDetails.vnp_Amount = Number(result.params.vnp_Amount);
      if (orderInfo) vnpDetails.vnp_OrderInfo = String(orderInfo);

      const txnInput: any = {
        userId: req.user.userId,
        amount: amountNum,
        currency: "VND",
        status: "pending",
        paymentMethod: "vnpay",
        description: String(orderInfo),
        vnpayDetails: vnpDetails,
        metadata: {
          ipAddr: getClientIp(req),
          createdFrom: "checkout_url",
        },
      };
      
      if (reservationId) {
        txnInput.reservationId = reservationId;
      }

      await createTransaction(txnInput);
    } catch (txnErr) {
      console.error("Failed to create transaction record:", txnErr);
      // Không dừng flow, vẫn trả về payment URL
    }

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

  // Cập nhật trạng thái giao dịch nếu tìm thấy
  try {
    const vnpTxnRef = verification.data.vnp_TxnRef;
    if (vnpTxnRef) {
      const existingTransaction = await findTransactionByVnpTxnRef(vnpTxnRef);
      
      if (existingTransaction) {
        // Xác định trạng thái dựa trên response code
        const { status: newStatus, reason: failureReason } = 
          determineTransactionStatus(verification.code, verification.isValid);

        const updatedVnpDetails: any = { ...existingTransaction.vnpayDetails };
        if (verification.data.vnp_ResponseCode) updatedVnpDetails.vnp_ResponseCode = verification.data.vnp_ResponseCode;
        if (verification.data.vnp_TransactionNo) updatedVnpDetails.vnp_TransactionNo = verification.data.vnp_TransactionNo;
        if (verification.data.vnp_BankCode) updatedVnpDetails.vnp_BankCode = verification.data.vnp_BankCode;
        if (verification.data.vnp_CardType) updatedVnpDetails.vnp_CardType = verification.data.vnp_CardType;
        if (verification.data.vnp_PayDate) updatedVnpDetails.vnp_PayDate = verification.data.vnp_PayDate;
        if (verification.data.vnp_TransactionStatus) updatedVnpDetails.vnp_TransactionStatus = verification.data.vnp_TransactionStatus;

        await updateTransaction({
          transactionId: String(existingTransaction._id),
          status: newStatus,
          vnpayDetails: updatedVnpDetails,
          metadata: {
            ...existingTransaction.metadata,
            updatedFrom: "return_url",
            returnTime: new Date().toISOString(),
            ...(failureReason ? { failureReason } : {}),
          },
        });
      }
    }
  } catch (updateErr) {
    console.error("Failed to update transaction from return URL:", updateErr);
    // Không dừng flow, vẫn trả về kết quả
  }

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

// POST /vnpay/check-payment-status
// Kiểm tra trạng thái thanh toán từ VNPay return URL
export async function checkPaymentStatusController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // Có thể nhận từ body hoặc query
    const queryData = req.method === "POST" ? req.body : req.query;
    
    if (!queryData || Object.keys(queryData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Thiếu thông tin từ VNPay return URL",
      });
    }

    // Verify signature
    const verification = verifyVnpayReturn(queryData as any);

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        error: "InvalidSignature",
        message: "Chữ ký không hợp lệ",
        paymentStatus: "invalid",
      });
    }

    // Xác định trạng thái thanh toán
    const { status: paymentStatus, reason } = determineTransactionStatus(
      verification.code,
      verification.isValid
    );

    // Lấy thông tin giao dịch từ database nếu có
    const vnpTxnRef = verification.data.vnp_TxnRef;
    const vnpAmount = verification.data.vnp_Amount 
      ? Number(verification.data.vnp_Amount) / 100 
      : 0;
    
    let transaction = vnpTxnRef ? await findTransactionByVnpTxnRef(vnpTxnRef) : null;
    let transactionInfo = null;
    let isNewTransaction = false;

    // Nếu transaction chưa tồn tại, tạo mới
    if (!transaction && vnpTxnRef) {
      console.log(`Creating new transaction for vnp_TxnRef: ${vnpTxnRef}`);
      
      try {
        // Lấy thông tin từ VNPay response
        const updatedVnpDetails: any = {};
        if (verification.data.vnp_ResponseCode) updatedVnpDetails.vnp_ResponseCode = verification.data.vnp_ResponseCode;
        if (verification.data.vnp_TransactionNo) updatedVnpDetails.vnp_TransactionNo = verification.data.vnp_TransactionNo;
        if (verification.data.vnp_BankCode) updatedVnpDetails.vnp_BankCode = verification.data.vnp_BankCode;
        if (verification.data.vnp_CardType) updatedVnpDetails.vnp_CardType = verification.data.vnp_CardType;
        if (verification.data.vnp_PayDate) updatedVnpDetails.vnp_PayDate = verification.data.vnp_PayDate;
        if (verification.data.vnp_TransactionStatus) updatedVnpDetails.vnp_TransactionStatus = verification.data.vnp_TransactionStatus;
        updatedVnpDetails.vnp_TxnRef = vnpTxnRef;
        if (verification.data.vnp_Amount) updatedVnpDetails.vnp_Amount = Number(verification.data.vnp_Amount);
        if (verification.data.vnp_OrderInfo) updatedVnpDetails.vnp_OrderInfo = verification.data.vnp_OrderInfo;

        // Tạo transaction mới (cần userId - có thể extract từ txnRef hoặc để null)
        // TODO: Cần có cách lấy userId, có thể từ session hoặc txnRef format
        // Tạm thời skip nếu không có userId
        console.warn("Cannot create transaction without userId");
        isNewTransaction = false;
      } catch (createErr) {
        console.error("Failed to create transaction:", createErr);
      }
    } else if (transaction) {
      // Transaction đã tồn tại, cập nhật status
      console.log(`Updating existing transaction: ${transaction._id}`);
      
      try {
        const updatedVnpDetails: any = { ...transaction.vnpayDetails };
        if (verification.data.vnp_ResponseCode) updatedVnpDetails.vnp_ResponseCode = verification.data.vnp_ResponseCode;
        if (verification.data.vnp_TransactionNo) updatedVnpDetails.vnp_TransactionNo = verification.data.vnp_TransactionNo;
        if (verification.data.vnp_BankCode) updatedVnpDetails.vnp_BankCode = verification.data.vnp_BankCode;
        if (verification.data.vnp_CardType) updatedVnpDetails.vnp_CardType = verification.data.vnp_CardType;
        if (verification.data.vnp_PayDate) updatedVnpDetails.vnp_PayDate = verification.data.vnp_PayDate;
        if (verification.data.vnp_TransactionStatus) updatedVnpDetails.vnp_TransactionStatus = verification.data.vnp_TransactionStatus;

        const updatedTransaction = await updateTransaction({
          transactionId: String(transaction._id),
          status: paymentStatus,
          vnpayDetails: updatedVnpDetails,
          metadata: {
            ...transaction.metadata,
            updatedFrom: "check_payment_status",
            checkTime: new Date().toISOString(),
            ...(reason ? { failureReason: reason } : {}),
          },
        });

        // Cập nhật reservation status nếu có
        if (updatedTransaction.reservation) {
          const Reservation = require("../models/reservation.model").Reservation;
          const reservationId = updatedTransaction.reservation;
          
          try {
            const newReservationStatus = paymentStatus === "success" ? "confirmed" : "pending";
            await Reservation.findByIdAndUpdate(reservationId, {
              status: newReservationStatus,
            });
            console.log(`Updated reservation ${reservationId} status to ${newReservationStatus}`);
          } catch (resErr) {
            console.error("Failed to update reservation status:", resErr);
          }
        }

        transaction = updatedTransaction;
      } catch (updateErr) {
        console.error("Failed to update transaction:", updateErr);
      }
    }

    // Prepare transaction info for response
    if (transaction) {
      transactionInfo = {
        transactionId: String(transaction._id),
        amount: transaction.amount,
        description: transaction.description,
        status: transaction.status,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        reservationId: transaction.reservation ? String(transaction.reservation) : null,
      };
    }

    // Trả về response chi tiết
    return res.status(200).json({
      success: true,
      message: getVnpayErrorMessage(verification.code),
      paymentStatus, // "success", "failed", "cancelled"
      data: {
        // Trạng thái
        status: paymentStatus,
        isSuccess: paymentStatus === "success",
        isNewTransaction,
        
        // Thông tin giao dịch VNPay
        vnpayInfo: {
          responseCode: verification.data.vnp_ResponseCode,
          transactionNo: verification.data.vnp_TransactionNo,
          txnRef: verification.data.vnp_TxnRef,
          amount: vnpAmount,
          bankCode: verification.data.vnp_BankCode,
          cardType: verification.data.vnp_CardType,
          orderInfo: verification.data.vnp_OrderInfo,
          payDate: verification.data.vnp_PayDate,
        },
        
        // Thông tin từ database
        transaction: transactionInfo,
        
        // Lý do (nếu thất bại)
        reason: reason || null,
      },
    });
  } catch (error: any) {
    console.error("Check payment status error:", error);
    return res.status(500).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi kiểm tra trạng thái thanh toán",
      paymentStatus: "error",
    });
  }
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

  try {
    const vnpTxnRef = verification.data.vnp_TxnRef;
    const vnpTransactionStatus = verification.data.vnp_TransactionStatus;
    const vnpAmount = verification.data.vnp_Amount;

    if (!vnpTxnRef) {
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    // Tìm giao dịch theo vnp_TxnRef
    const existingTransaction = await findTransactionByVnpTxnRef(vnpTxnRef);

    if (!existingTransaction) {
      // Nếu chưa có transaction, có thể tạo mới (trường hợp IPN đến trước return URL)
      console.warn(`Transaction not found for vnp_TxnRef: ${vnpTxnRef}`);
      return res.json({ RspCode: "01", Message: "Order not found" });
    }

    // Kiểm tra idempotency - nếu đã success rồi thì không xử lý lại
    if (existingTransaction.status === "success") {
      return res.json({ RspCode: "00", Message: "Already confirmed" });
    }

    // Verify amount
    const expectedAmount = existingTransaction.amount * 100; // VNPay requires *100
    if (Number(vnpAmount) !== expectedAmount) {
      console.error(
        `Amount mismatch: expected ${expectedAmount}, got ${vnpAmount}`
      );
      await updateTransaction({
        transactionId: String(existingTransaction._id),
        status: "failed",
        metadata: {
          error: "Amount mismatch",
          expectedAmount,
          receivedAmount: vnpAmount,
        },
      });
      return res.json({ RspCode: "04", Message: "Amount invalid" });
    }

    // Xác định trạng thái dựa trên vnp_TransactionStatus
    const { status: newStatus, reason: failureReason } = 
      determineTransactionStatus(vnpTransactionStatus || "99", true);

    const updatedVnpDetails: any = { ...existingTransaction.vnpayDetails };
    if (vnpTransactionStatus) updatedVnpDetails.vnp_TransactionStatus = vnpTransactionStatus;
    if (verification.data.vnp_TransactionNo) updatedVnpDetails.vnp_TransactionNo = verification.data.vnp_TransactionNo;
    if (verification.data.vnp_BankCode) updatedVnpDetails.vnp_BankCode = verification.data.vnp_BankCode;
    if (verification.data.vnp_CardType) updatedVnpDetails.vnp_CardType = verification.data.vnp_CardType;
    if (verification.data.vnp_PayDate) updatedVnpDetails.vnp_PayDate = verification.data.vnp_PayDate;
    if (verification.data.vnp_ResponseCode) updatedVnpDetails.vnp_ResponseCode = verification.data.vnp_ResponseCode;

    await updateTransaction({
      transactionId: String(existingTransaction._id),
      status: newStatus,
      vnpayDetails: updatedVnpDetails,
      metadata: {
        ...existingTransaction.metadata,
        updatedFrom: "ipn",
        ipnTime: new Date().toISOString(),
        ...(failureReason ? { failureReason } : {}),
      },
    });

    // TODO: Nếu thanh toán thành công, cập nhật trạng thái reservation nếu có
    if (newStatus === "success" && existingTransaction.reservation) {
      // Có thể cập nhật reservation status ở đây
      console.log(
        `Payment success for reservation: ${existingTransaction.reservation}`
      );
    }

    return res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (err: any) {
    console.error("IPN processing error:", err);
    return res.json({ RspCode: "99", Message: "Unknown error" });
  }
}
