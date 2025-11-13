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
import { Reservation } from "../models/reservation.model";
import { activateSubscription } from "../services/subscription.service";

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
    const { vehicleId, locale, orderType } =
      req.body as { 
        vehicleId?: string;
        locale?: "vn" | "en";
        orderType?: string;
      };

    // User must be authenticated to create payment
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
      });
    }

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "vehicleId là bắt buộc",
      });
    }

    // Import required services
    const { Vehicle } = require("../models/vehicle.model");
    const { ChargingSession } = require("../models/chargingsession.model");
    const { ChargingSlot } = require("../models/chargingslot.model");
    const { ChargingPort } = require("../models/chargingport.model");
    const Types = require("mongoose").Types;

    // Validate vehicleId
    if (!Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "vehicleId không hợp lệ",
      });
    }

    // Check if vehicle exists and belongs to user
    const vehicle = await Vehicle.findById(vehicleId).lean();
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Không tìm thấy xe",
      });
    }

    if (String(vehicle.owner) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Xe không thuộc sở hữu của bạn",
      });
    }

    // Get all completed charging sessions for this vehicle
    const completedSessions = await ChargingSession.find({
      vehicle: vehicleId,
      status: "completed",
    }).populate({
      path: "slot",
      populate: {
        path: "port",
        model: "ChargingPort",
      },
    }).lean();

    if (completedSessions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Không có phiên sạc nào đã hoàn thành để thanh toán",
      });
    }

    // Calculate total minutes and pricing
    let totalMinutes = 0;
    const sessionDetails = [];

    for (const session of completedSessions) {
      const startTime = new Date(session.startedAt).getTime();
      const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
      const minutes = (endTime - startTime) / 60000; // Convert to minutes
      totalMinutes += minutes;

      sessionDetails.push({
        sessionId: String(session._id),
        startAt: session.startedAt,
        endAt: session.endedAt,
        minutes: Number(minutes.toFixed(2)),
        port: session.slot?.port,
      });
    }

    const durationHours = totalMinutes / 60;

    // Get port type from first session (assuming same type for simplicity)
    const firstPort = sessionDetails[0]?.port;
    let portType: "ac" | "dc" | "dc_ultra" = "ac";
    
    if (firstPort) {
      const typeStr = String(firstPort.type || "").toLowerCase();
      if (typeStr.includes("ultra")) portType = "dc_ultra";
      else if (typeStr.includes("dc")) portType = "dc";
      else portType = "ac";
    }

    // Pricing calculation (matching frontend logic)
    const BOOKING_BASE_PRICE: Record<typeof portType, number> = {
      ac: 10000,
      dc: 15000,
      dc_ultra: 20000,
    };
    const ENERGY_PRICE_VND_PER_KWH = 3858;

    // Get actual power from port (not fixed 1kW)
    const powerKw = firstPort?.powerKw || 7;

    // Calculate costs
    const bookingCost = BOOKING_BASE_PRICE[portType]; // Fixed base price
    const energyKwh = powerKw * durationHours; // Actual energy consumed
    const energyCost = durationHours * energyKwh * ENERGY_PRICE_VND_PER_KWH; // Frontend formula
    const total = Math.round(bookingCost + energyCost);

    // Generate order info
    const orderInfo = `Thanh toan ${completedSessions.length} phien sac - Xe ${vehicle.plateNumber}`;
    const orderId = `CHARGE-${vehicleId}-${Date.now()}`;

    // Create VNPay checkout URL
    const payload: BuildCheckoutInput = {
      amount: total,
      orderInfo,
      ipAddr: getClientIp(req),
      orderId,
      ...(locale ? { locale } : {}),
      ...(orderType ? { orderType: String(orderType) } : {}),
    };

    const result = buildCheckoutUrl(payload);

    // Create transaction record
    try {
      const vnpDetails: any = {};
      if (result.params.vnp_TxnRef) vnpDetails.vnp_TxnRef = result.params.vnp_TxnRef;
      if (result.params.vnp_Amount) vnpDetails.vnp_Amount = Number(result.params.vnp_Amount);
      if (orderInfo) vnpDetails.vnp_OrderInfo = String(orderInfo);

      const txnInput: any = {
        userId: req.user.userId,
        amount: total,
        currency: "VND",
        status: "pending",
        paymentMethod: "vnpay",
        description: orderInfo,
        vnpayDetails: vnpDetails,
        metadata: {
          ipAddr: getClientIp(req),
          createdFrom: "checkout_url_charging",
          vehicleId,
          sessionCount: completedSessions.length,
          totalMinutes: Number(totalMinutes.toFixed(2)),
          durationHours: Number(durationHours.toFixed(4)),
          portType,
          bookingCost,
          energyCost,
          sessionDetails,
        },
      };

      await createTransaction(txnInput);
    } catch (txnErr) {
      console.error("Failed to create transaction record:", txnErr);
    }

    return res.status(200).json({ 
      success: true, 
      message: "OK", 
      data: {
        ...result,
        pricingDetails: {
          totalSessions: completedSessions.length,
          totalMinutes: Number(totalMinutes.toFixed(2)),
          durationHours: Number(durationHours.toFixed(4)),
          portType,
          powerKw: Number(powerKw.toFixed(2)),
          bookingBasePrice: bookingCost,
          energyKwh: Number(energyKwh.toFixed(4)),
          bookingCost,
          energyCost,
          total,
          currency: "VND",
        },
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? "InvalidInput" : status === 404 ? "NotFound" : status === 403 ? "Forbidden" : "ServerError",
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

        // Nếu thanh toán thành công và là subscription payment -> activate subscription
        if (newStatus === "success" && existingTransaction.metadata?.paymentType === "subscription") {
          const subscriptionId = existingTransaction.metadata.subscriptionId;
          if (subscriptionId) {
            try {
              await activateSubscription(subscriptionId);
              console.log(`Activated subscription ${subscriptionId} after successful payment`);
            } catch (activateErr) {
              console.error(`Failed to activate subscription ${subscriptionId}:`, activateErr);
            }
          }
        }
      }
    }
  } catch (updateErr) {
    console.error("Failed to update transaction from return URL:", updateErr);
    // Không dừng flow, vẫn redirect
  }

  // Xác định trạng thái thanh toán để redirect đúng trang
  const { status: paymentStatus } = determineTransactionStatus(verification.code, verification.isValid);
  
  // Redirect về frontend dựa trên trạng thái thanh toán
  if (paymentStatus === "success") {
    // Thanh toán thành công -> redirect về trang success
    return res.redirect("http://localhost:5173/payment-success");
  } else if (paymentStatus === "cancelled") {
    // User hủy thanh toán -> redirect về trang cancelled
    return res.redirect("http://localhost:5173/payment-cancelled");
  } else {
    // Thanh toán thất bại -> redirect về trang failed
    return res.redirect("http://localhost:5173/payment-failed");
  }
}

// POST /vnpay/check-payment-status
export async function checkPaymentStatusController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { vehicleId, reservationId, ...vnpayParams } = req.body as { 
      vehicleId?: string;
      reservationId?: string;
      vnp_Amount?: string;
      vnp_BankCode?: string;
      vnp_BankTranNo?: string;
      vnp_CardType?: string;
      vnp_OrderInfo?: string;
      vnp_PayDate?: string;
      vnp_ResponseCode?: string;
      vnp_TmnCode?: string;
      vnp_TransactionNo?: string;
      vnp_TransactionStatus?: string;
      vnp_TxnRef?: string;
      vnp_SecureHash?: string;
    };

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Chưa đăng nhập",
      });
    }

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "vehicleId là bắt buộc",
      });
    }

    // Check if we have VNPay params to verify
    if (!vnpayParams.vnp_TxnRef || !vnpayParams.vnp_SecureHash) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Thiếu thông tin từ VNPay (vnp_TxnRef và vnp_SecureHash là bắt buộc)",
      });
    }

    const Types = require("mongoose").Types;
    const { Vehicle } = require("../models/vehicle.model");
    const { ChargingSession } = require("../models/chargingsession.model");
    const { ChargingSlot } = require("../models/chargingslot.model");
    const { Transaction } = require("../models/transaction.model");
    const { Reservation } = require("../models/reservation.model");

    // Validate vehicleId
    if (!Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "vehicleId không hợp lệ",
      });
    }

    // Validate reservationId if provided
    if (reservationId && !Types.ObjectId.isValid(reservationId)) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "reservationId không hợp lệ",
      });
    }

    // Check if vehicle exists and belongs to user
    const vehicle = await Vehicle.findById(vehicleId).lean();
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Không tìm thấy xe",
      });
    }

    if (String(vehicle.owner) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Xe không thuộc sở hữu của bạn",
      });
    }

    // Verify VNPay signature
    const verification = verifyVnpayReturn(vnpayParams as any);

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        error: "InvalidSignature",
        message: "Chữ ký VNPay không hợp lệ",
        data: {
          paymentStatus: "invalid",
        },
      });
    }

    // Determine payment status from VNPay response
    const { status: paymentStatus, reason } = determineTransactionStatus(
      verification.code,
      verification.isValid
    );

    // Find the transaction by vnp_TxnRef
    const vnpTxnRef = vnpayParams.vnp_TxnRef;
    const transaction = await findTransactionByVnpTxnRef(vnpTxnRef);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Không tìm thấy giao dịch thanh toán với mã " + vnpTxnRef,
      });
    }

    // Verify the transaction belongs to this user
    if (String(transaction.user) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Giao dịch không thuộc về bạn",
      });
    }

    // Verify vehicleId matches transaction metadata
    if (transaction.metadata?.vehicleId !== vehicleId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "vehicleId không khớp với giao dịch",
      });
    }

    // Update transaction with VNPay details
    const updatedVnpDetails: any = { ...transaction.vnpayDetails };
    if (verification.data.vnp_ResponseCode) updatedVnpDetails.vnp_ResponseCode = verification.data.vnp_ResponseCode;
    if (verification.data.vnp_TransactionNo) updatedVnpDetails.vnp_TransactionNo = verification.data.vnp_TransactionNo;
    if (verification.data.vnp_BankCode) updatedVnpDetails.vnp_BankCode = verification.data.vnp_BankCode;
    if (verification.data.vnp_CardType) updatedVnpDetails.vnp_CardType = verification.data.vnp_CardType;
    if (verification.data.vnp_PayDate) updatedVnpDetails.vnp_PayDate = verification.data.vnp_PayDate;
    if (verification.data.vnp_TransactionStatus) updatedVnpDetails.vnp_TransactionStatus = verification.data.vnp_TransactionStatus;

    await updateTransaction({
      transactionId: String(transaction._id),
      status: paymentStatus,
      vnpayDetails: updatedVnpDetails,
      metadata: {
        ...transaction.metadata,
        updatedFrom: "check_payment_status",
        checkTime: new Date().toISOString(),
        ...(reservationId ? { reservationId } : {}),
        ...(reason ? { failureReason: reason } : {}),
      },
    });

    // If payment is NOT successful, return status without updating sessions/reservation
    if (paymentStatus !== "success") {
      return res.status(200).json({
        success: true,
        message: paymentStatus === "cancelled" ? "Thanh toán đã bị hủy" : "Thanh toán thất bại",
        data: {
          paymentStatus,
          transactionId: String(transaction._id),
          amount: transaction.amount,
          currency: transaction.currency,
          reason: reason || null,
          vnpayInfo: {
            responseCode: verification.data.vnp_ResponseCode,
            transactionNo: verification.data.vnp_TransactionNo,
            bankCode: verification.data.vnp_BankCode,
          },
        },
      });
    }

    // Payment is successful - update charging sessions, slots, and reservation
    const completedSessions = await ChargingSession.find({
      vehicle: vehicleId,
      status: "completed",
    }).populate("slot");

    // Update all completed sessions to success status
    const sessionIds = completedSessions.map((s: any) => s._id);
    const slotIds = completedSessions
      .map((s: any) => s.slot?._id)
      .filter((id: any) => id !== undefined && id !== null);

    if (sessionIds.length > 0) {
      // Update sessions
      await ChargingSession.updateMany(
        { _id: { $in: sessionIds } },
        { $set: { status: "success" } }
      );
    }

    // Update slots back to available
    let updatedSlots = 0;
    if (slotIds.length > 0) {
      const slotUpdateResult = await ChargingSlot.updateMany(
        { _id: { $in: slotIds } },
        { $set: { status: "available" } }
      );
      updatedSlots = slotUpdateResult.modifiedCount || 0;
    }

    // Update reservation status if reservationId provided
    let reservationUpdated = false;
    if (reservationId) {
      try {
        const reservation = await Reservation.findById(reservationId).lean();
        
        if (reservation) {
          // Verify reservation belongs to the vehicle
          if (String(reservation.vehicle) === vehicleId) {
            await Reservation.findByIdAndUpdate(reservationId, {
              $set: { status: "payment-success" },
            });
            reservationUpdated = true;
            console.log(`Updated reservation ${reservationId} status to payment-success`);
          } else {
            console.warn(`Reservation ${reservationId} does not belong to vehicle ${vehicleId}`);
          }
        } else {
          console.warn(`Reservation ${reservationId} not found`);
        }
      } catch (resErr) {
        console.error("Error updating reservation:", resErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Thanh toán thành công và đã cập nhật trạng thái",
      data: {
        paymentStatus: "success",
        transactionId: String(transaction._id),
        amount: transaction.amount,
        currency: transaction.currency,
        updatedSessions: sessionIds.length,
        updatedSlots,
        sessionIds: sessionIds.map((id: any) => String(id)),
        slotIds: slotIds.map((id: any) => String(id)),
        reservationUpdated,
        ...(reservationId ? { reservationId } : {}),
        vnpayInfo: {
          responseCode: verification.data.vnp_ResponseCode,
          transactionNo: verification.data.vnp_TransactionNo,
          bankCode: verification.data.vnp_BankCode,
          cardType: verification.data.vnp_CardType,
          payDate: verification.data.vnp_PayDate,
        },
      },
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 400 ? "InvalidInput" : status === 404 ? "NotFound" : status === 403 ? "Forbidden" : "ServerError",
      message: err?.message || "Failed to check payment status",
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

    // Nếu thanh toán thành công
    if (newStatus === "success") {
      // 1. Cập nhật trạng thái reservation nếu có
      if (existingTransaction.reservation) {
        try {
          await Reservation.findByIdAndUpdate(existingTransaction.reservation, {
            status: "confirmed",
          });
          console.log(
            `Payment success for reservation: ${existingTransaction.reservation}`
          );
        } catch (resErr) {
          console.error("Failed to update reservation:", resErr);
        }
      }

      // 2. Activate subscription nếu là subscription payment
      if (existingTransaction.metadata?.paymentType === "subscription") {
        const subscriptionId = existingTransaction.metadata.subscriptionId;
        if (subscriptionId) {
          try {
            await activateSubscription(subscriptionId);
            console.log(`Activated subscription ${subscriptionId} after successful payment (IPN)`);
          } catch (activateErr) {
            console.error(`Failed to activate subscription ${subscriptionId}:`, activateErr);
          }
        }
      }
    }

    return res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (err: any) {
    console.error("IPN processing error:", err);
    return res.json({ RspCode: "99", Message: "Unknown error" });
  }
}
