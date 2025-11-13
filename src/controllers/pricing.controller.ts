import { Response } from "express";
import { estimateCost, EstimateCostInput } from "../services/pricing.sevice";
import { AuthenticatedRequest } from "../types";
import { Types } from "mongoose";
import { ChargingSession } from "../models/chargingsession.model";
import { Vehicle } from "../models/vehicle.model";

export async function estimateCostController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { portId, startAt, endAt, assumePowerKw } =
      req.body as Partial<EstimateCostInput>;

    if (!portId || !startAt || !endAt) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "portId, startAt, endAt are required",
      });
    }

    const result = await estimateCost({
      portId: String(portId),
      startAt,
      endAt,
      ...(assumePowerKw !== undefined
        ? { assumePowerKw: Number(assumePowerKw) }
        : {}),
    });

    return res.status(200).json({
      success: true,
      message: "OK",
      data: result,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 400
          ? "InvalidInput"
          : status === 404
          ? "NotFound"
          : "ServerError",
      message,
    });
  }
}

/**
 * Stream Pricing Estimation for Vehicle's Completed Sessions
 * Calculates pricing same as VNPay payment (using actual port power)
 * Streams the result via SSE
 */
export async function streamPricingEstimationController(
  req: AuthenticatedRequest,
  res: Response
) {
  // Validation
  const { vehicleId } = req.body as { vehicleId?: string };

  if (!req.user?.userId) {
    res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Chưa đăng nhập",
    });
    return;
  }

  if (!vehicleId) {
    res.status(400).json({
      success: false,
      error: "InvalidInput",
      message: "vehicleId là bắt buộc",
    });
    return;
  }

  if (!Types.ObjectId.isValid(vehicleId)) {
    res.status(400).json({
      success: false,
      error: "InvalidInput",
      message: "vehicleId không hợp lệ",
    });
    return;
  }

  try {

    // Check if vehicle exists and belongs to user
    const vehicle = await Vehicle.findById(vehicleId).lean();
    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Không tìm thấy xe",
      });
      return;
    }

    if (String(vehicle.owner) !== req.user.userId) {
      res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Xe không thuộc sở hữu của bạn",
      });
      return;
    }

    // Get all completed charging sessions for this vehicle
    const completedSessions = await ChargingSession.find({
      vehicle: vehicleId,
      status: "completed",
    })
      .populate({
        path: "slot",
        populate: {
          path: "port",
          model: "ChargingPort",
        },
      })
      .lean();

    if (completedSessions.length === 0) {
      res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Không có phiên sạc nào đã hoàn thành để tính giá",
      });
      return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendEvent = (eventName: string, data: any) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Calculate pricing (same as VNPay payment)
    let totalMinutes = 0;
    const sessionDetails = [];

    for (const session of completedSessions) {
      const startTime = new Date(session.startedAt).getTime();
      const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
      const minutes = (endTime - startTime) / 60000;
      totalMinutes += minutes;

      sessionDetails.push({
        sessionId: String(session._id),
        startAt: session.startedAt,
        endAt: session.endedAt,
        minutes: Number(minutes.toFixed(2)),
        port: (session.slot as any)?.port,
      });
    }

    const totalDurationHours = totalMinutes / 60;

    // Get port type from first session
    const firstPort = sessionDetails[0]?.port;
    let portType: "ac" | "dc" | "dc_ultra" = "ac";
    
    if (firstPort) {
      const typeStr = String(firstPort.type || "").toLowerCase();
      if (typeStr.includes("ultra")) portType = "dc_ultra";
      else if (typeStr.includes("dc")) portType = "dc";
      else portType = "ac";
    }

    // Pricing constants
    const BOOKING_BASE_PRICE: Record<typeof portType, number> = {
      ac: 10000,
      dc: 15000,
      dc_ultra: 20000,
    };
    const ENERGY_PRICE_VND_PER_KWH = 3858;

    // Use actual power from port (matching VNPay calculation)
    const powerKw = firstPort?.powerKw || 7;

    // Calculate costs - FIXED: Base price charged ONCE, not per session
    const bookingCost = BOOKING_BASE_PRICE[portType]; // One-time base price
    const energyKwh = powerKw * totalDurationHours;
    const energyCost = Math.round(totalDurationHours * energyKwh * ENERGY_PRICE_VND_PER_KWH);
    const total = bookingCost + energyCost;

    const pricingData = {
      vehicleId,
      totalSessions: completedSessions.length,
      totalMinutes: Number(totalMinutes.toFixed(2)),
      totalDurationHours: Number(totalDurationHours.toFixed(4)),
      portType: portType === "ac" ? "AC" : portType === "dc" ? "DC" : "DC Ultra",
      powerKw: Number(powerKw.toFixed(2)),
      bookingBasePrice: bookingCost,
      energyKwh: Number(energyKwh.toFixed(4)),
      energyPricePerKwh: ENERGY_PRICE_VND_PER_KWH,
      bookingCost,
      energyCost,
      total,
      currency: "VND",
      sessionDetails: sessionDetails.map((s) => ({
        sessionId: s.sessionId,
        startAt: s.startAt,
        endAt: s.endAt,
        minutes: s.minutes,
        hours: Number((s.minutes / 60).toFixed(4)),
      })),
    };

    // Send pricing data
    sendEvent("pricing_data", pricingData);

    // Set up polling to check for new completed sessions
    let previousSessionCount = completedSessions.length;
    
    const pollInterval = setInterval(async () => {
      try {
        const updatedSessions = await ChargingSession.find({
          vehicle: vehicleId,
          status: "completed",
        }).lean();

        if (updatedSessions.length !== previousSessionCount) {
          // Session count changed, recalculate
          sendEvent("session_count_changed", {
            previousCount: previousSessionCount,
            newCount: updatedSessions.length,
            message: "Phát hiện phiên sạc mới hoàn thành",
          });
          previousSessionCount = updatedSessions.length;
        }
      } catch (err) {
        console.error("Error polling sessions:", err);
      }
    }, 1000); // Poll every 1 second

    // Handle client disconnect
    req.on("close", () => {
      clearInterval(pollInterval);
      res.end();
    });
    
    // SSE connection remains open - no return needed
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Lỗi khi tính giá";
    res.status(status).json({
      success: false,
      error:
        status === 400
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
