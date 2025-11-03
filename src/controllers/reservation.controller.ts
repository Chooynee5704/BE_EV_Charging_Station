import { Response } from "express";
import {
  createReservation,
  listReservations,
  getReservationById,
  cancelReservation,
  completeReservation,
  CreateReservationInput,
} from "../services/reservation.service";
import { AuthenticatedRequest } from "../types";
import { Vehicle } from "../models/vehicle.model";
import { Reservation } from "../models/reservation.model";

export async function createReservationController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { vehicleId, items, status } = req.body as {
      vehicleId?: string;
      items?: any[];
      status?: "pending" | "confirmed";
    };

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "vehicleId is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "items is required (non-empty array)",
      });
    }

    const isAdminOrStaff =
      req.user.role === "admin" || req.user.role === "staff";
    if (!isAdminOrStaff) {
      const v = await Vehicle.findById(vehicleId).lean();
      if (!v) {
        return res.status(404).json({
          success: false,
          error: "NotFound",
          message: "Vehicle not found",
        });
      }
      if (String(v.owner) !== req.user.userId) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden", message: "Not allowed" });
      }
    }

    const payload: CreateReservationInput = {
      vehicleId,
      items: items.map((i, idx) => {
        if (!i?.slotId || !i?.startAt || !i?.endAt) {
          throw Object.assign(
            new Error(`items[${idx}] requires slotId, startAt, endAt`),
            { status: 400 }
          );
        }
        return {
          slotId: String(i.slotId),
          startAt: i.startAt,
          endAt: i.endAt,
        };
      }),
      ...(status ? { status } : {}),
    };

    const created = await createReservation(payload);
    return res
      .status(201)
      .json({ success: true, message: "Reservation created", data: created });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 409
          ? "Conflict"
          : status === 400
          ? "InvalidInput"
          : status === 404
          ? "NotFound"
          : status === 403
          ? "Forbidden"
          : "ServerError",
      message,
    });
  }
}

export async function listMyReservationsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { status, page, limit, vehicleId } = req.query as {
      status?: any;
      page?: any;
      limit?: any;
      vehicleId?: any;
    };

    const result = await listReservations({
      ...(vehicleId
        ? { vehicleId: String(vehicleId) }
        : { ownerUserId: req.user.userId }),
      ...(status ? { status: String(status) as any } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });

    return res.status(200).json({ success: true, message: "OK", data: result });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res
      .status(status)
      .json({ success: false, error: "ServerError", message });
  }
}

export async function getReservationController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = (req.params || {}) as { id?: string };
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Missing reservation id",
      });
    }

    const doc = await getReservationById(id);

    const role = req.user?.role;
    const userId = req.user?.userId;
    if (
      !role ||
      (role === "user" &&
        userId &&
        String((doc as any).vehicle.owner) !== String(userId))
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Not allowed to access this reservation",
      });
    }

    return res.status(200).json({ success: true, message: "OK", data: doc });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 404
          ? "NotFound"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message,
    });
  }
}

export async function cancelReservationController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = (req.params || {}) as { id?: string };
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Missing reservation id",
      });
    }

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const isAdminOrStaff =
      req.user.role === "admin" || req.user.role === "staff";
    const doc = await cancelReservation(id, req.user.userId, isAdminOrStaff);

    return res
      .status(200)
      .json({ success: true, message: "Reservation cancelled", data: doc });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 404
          ? "NotFound"
          : status === 403
          ? "Forbidden"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message,
    });
  }
}

/**
 * QR Check Controller - Staff/Admin only
 * Check reservation with QR code
 */
export async function qrCheckController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // Chỉ staff và admin có thể dùng
    if (req.user?.role !== "staff" && req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Chỉ staff và admin có thể sử dụng chức năng này",
      });
    }

    const reservationId = req.body.reservationId || req.query.reservationId;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "reservationId là bắt buộc",
      });
    }

    // Tìm reservation
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Không tìm thấy reservation",
      });
    }

    // Kiểm tra status
    if (reservation.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        error: "PaymentRequired",
        message: "Reservation chưa thanh toán",
        data: {
          reservationId: String(reservation._id),
          status: reservation.status,
          qrCheck: reservation.qrCheck,
        },
      });
    }

    // Kiểm tra qrCheck
    if (reservation.qrCheck) {
      return res.status(200).json({
        success: false,
        error: "AlreadyUsed",
        message: "QR code đã được sử dụng",
        data: {
          reservationId: String(reservation._id),
          status: reservation.status,
          qrCheck: reservation.qrCheck,
        },
      });
    }

    // Update qrCheck = true
    reservation.qrCheck = true;
    await reservation.save();

    return res.status(200).json({
      success: true,
      message: "Check-in thành công",
      data: {
        reservationId: String(reservation._id),
        status: reservation.status,
        qrCheck: reservation.qrCheck,
        checkedAt: new Date().toISOString(),
        checkedBy: {
          userId: req.user.userId,
          role: req.user.role,
        },
      },
    });
  } catch (error: any) {
    console.error("QR check error:", error);
    const status = error?.status || 500;
    const message = error?.message || "Lỗi khi kiểm tra QR code";
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message,
    });
  }
}

export async function completeReservationController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = (req.params || {}) as { id?: string };
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Missing reservation id",
      });
    }

    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const isAdminOrStaff =
      req.user.role === "admin" || req.user.role === "staff";
    const doc = await completeReservation(id, req.user.userId, isAdminOrStaff);

    return res
      .status(200)
      .json({ success: true, message: "Reservation completed", data: doc });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 404
          ? "NotFound"
          : status === 403
          ? "Forbidden"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message,
    });
  }
}
