import { Types } from "mongoose";
import {
  ChargingSession,
  IChargingSession,
} from "../models/chargingsession.model";
import { ChargingSlot } from "../models/chargingslot.model";
import { Vehicle } from "../models/vehicle.model";

export type StartChargingInput = {
  vehicleId: string;
  slotId: string;
  targetPercent?: number | null; // optional
  chargeRatePercentPerMinute?: number; // default 1.0
};

export async function startCharging(input: StartChargingInput) {
  const {
    vehicleId,
    slotId,
    targetPercent = null,
    chargeRatePercentPerMinute = 1.0,
  } = input;

  if (!Types.ObjectId.isValid(vehicleId))
    throw Object.assign(new Error("vehicleId invalid"), { status: 400 });
  if (!Types.ObjectId.isValid(slotId))
    throw Object.assign(new Error("slotId invalid"), { status: 400 });
  if (targetPercent !== null && (targetPercent <= 0 || targetPercent > 100)) {
    throw Object.assign(new Error("targetPercent must be 1..100"), {
      status: 400,
    });
  }
  if (
    typeof chargeRatePercentPerMinute !== "number" ||
    chargeRatePercentPerMinute <= 0
  ) {
    throw Object.assign(new Error("chargeRatePercentPerMinute must be > 0"), {
      status: 400,
    });
  }

  const [vehicle, slot] = await Promise.all([
    Vehicle.findById(vehicleId),
    ChargingSlot.findById(slotId).lean(),
  ]);
  if (!vehicle)
    throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  if (!slot) throw Object.assign(new Error("Slot not found"), { status: 404 });

  // Get initial percent from vehicle's current pin
  const initialPercent = vehicle.pin;

  // Check if slot is available - allow "in_use" (from reservations) and "available"
  // Only reject "inactive" slots
  if (slot.status === "inactive") {
    throw Object.assign(new Error("Slot is inactive"), { status: 400 });
  }

  const created = await ChargingSession.create({
    vehicle: new Types.ObjectId(vehicleId),
    slot: new Types.ObjectId(slotId),
    startedAt: new Date(),
    endedAt: null,
    initialPercent,
    targetPercent,
    chargeRatePercentPerMinute,
    status: "active",
  });

  return created.toJSON();
}

export async function stopCharging(
  sessionId: string,
  status: "completed" | "cancelled" = "completed"
) {
  if (!Types.ObjectId.isValid(sessionId))
    throw Object.assign(new Error("sessionId invalid"), { status: 400 });
  const doc = await ChargingSession.findById(sessionId);
  if (!doc)
    throw Object.assign(new Error("Session not found"), { status: 404 });
  if (doc.status !== "active") return doc.toJSON();
  
  // Calculate final percent
  const now = new Date();
  const durationMs = now.getTime() - doc.startedAt.getTime();
  const minutes = durationMs / 60000;
  const gained = minutes * doc.chargeRatePercentPerMinute;
  const rawPercent = doc.initialPercent + gained;
  const capTarget = doc.targetPercent ?? 100;
  const finalPercent = Math.max(0, Math.min(capTarget, Math.min(100, rawPercent)));
  
  // Update vehicle's pin
  await Vehicle.findByIdAndUpdate(doc.vehicle, { pin: Math.round(finalPercent) });
  
  doc.status = status;
  doc.endedAt = new Date();
  await doc.save();
  return doc.toJSON();
}

export async function getChargingProgress(sessionId: string) {
  if (!Types.ObjectId.isValid(sessionId))
    throw Object.assign(new Error("sessionId invalid"), { status: 400 });
  const doc = await ChargingSession.findById(sessionId).lean();
  if (!doc)
    throw Object.assign(new Error("Session not found"), { status: 404 });

  const now = new Date();
  const durationMs = (doc.endedAt ?? now).getTime() - doc.startedAt.getTime();
  const minutes = durationMs / 60000;

  const gained = minutes * doc.chargeRatePercentPerMinute;
  const rawPercent = doc.initialPercent + gained;
  const capTarget = doc.targetPercent ?? 100;
  const percent = Math.max(0, Math.min(capTarget, Math.min(100, rawPercent)));

  const isFinished = percent >= capTarget || doc.status !== "active";

  // Update vehicle's pin in real-time during active charging
  if (doc.status === "active") {
    await Vehicle.findByIdAndUpdate(doc.vehicle, { pin: Math.round(percent) });
  }

  return {
    sessionId: String(doc._id),
    vehicleId: String(doc.vehicle),
    percent: Number(percent.toFixed(2)),
    finished: isFinished,
    target: capTarget,
    ratePercentPerMinute: doc.chargeRatePercentPerMinute,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt ?? null,
    status: doc.status,
  };
}

export interface ListSessionsOptions {
  userId?: string;
  forAll?: boolean;
  status?: "active" | "completed" | "cancelled";
  page?: number;
  limit?: number;
}

export async function listUserChargingSessions(opts: ListSessionsOptions) {
  const { userId, forAll = false, status, page = 1, limit = 20 } = opts;

  if (!forAll && (!userId || !Types.ObjectId.isValid(userId))) {
    throw Object.assign(new Error("userId invalid"), { status: 400 });
  }

  let vehicleIds: Types.ObjectId[] = [];
  if (!forAll && userId) {
    // Find all vehicles owned by the user
    const userVehicles = await Vehicle.find({ owner: userId }, { _id: 1 }).lean();
    vehicleIds = userVehicles.map((v) => v._id);
  }

  if (!forAll && vehicleIds.length === 0) {
    return {
      items: [],
      pagination: {
        page: 1,
        limit,
        total: 0,
        pages: 0,
      },
    };
  }

  // Build filter
  const filter: any = {};
  if (!forAll) {
    filter.vehicle = { $in: vehicleIds };
  }

  if (status) {
    filter.status = status;
  }

  const safeLimit = Math.max(Number(limit) || 1, 1);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [sessions, total] = await Promise.all([
    ChargingSession.find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("vehicle")
      .populate({
        path: "slot",
        populate: { path: "port", populate: { path: "station" } },
      })
      .lean(),
    ChargingSession.countDocuments(filter),
  ]);

  return {
    items: sessions,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

export interface ListSessionsByVehicleOptions {
  vehicleId: string;
  status?: "active" | "completed" | "cancelled";
  page?: number;
  limit?: number;
}

export async function listChargingSessionsByVehicle(opts: ListSessionsByVehicleOptions) {
  const { vehicleId, status, page = 1, limit = 20 } = opts;

  if (!Types.ObjectId.isValid(vehicleId)) {
    throw Object.assign(new Error("vehicleId invalid"), { status: 400 });
  }

  // Check if vehicle exists
  const vehicle = await Vehicle.findById(vehicleId).lean();
  if (!vehicle) {
    throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  }

  // Build filter
  const filter: any = {
    vehicle: new Types.ObjectId(vehicleId),
  };

  if (status) {
    filter.status = status;
  }

  const safeLimit = Math.max(Number(limit) || 1, 1);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [sessions, total] = await Promise.all([
    ChargingSession.find(filter)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("vehicle")
      .populate("slot")
      .lean(),
    ChargingSession.countDocuments(filter),
  ]);

  return {
    items: sessions,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}
