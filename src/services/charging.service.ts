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
  initialPercent: number; // 0-100
  targetPercent?: number | null; // optional
  chargeRatePercentPerMinute?: number; // default 1.0
};

export async function startCharging(input: StartChargingInput) {
  const {
    vehicleId,
    slotId,
    initialPercent,
    targetPercent = null,
    chargeRatePercentPerMinute = 1.0,
  } = input;

  if (!Types.ObjectId.isValid(vehicleId))
    throw Object.assign(new Error("vehicleId invalid"), { status: 400 });
  if (!Types.ObjectId.isValid(slotId))
    throw Object.assign(new Error("slotId invalid"), { status: 400 });
  if (
    typeof initialPercent !== "number" ||
    initialPercent < 0 ||
    initialPercent > 100
  ) {
    throw Object.assign(new Error("initialPercent must be 0..100"), {
      status: 400,
    });
  }
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
    Vehicle.findById(vehicleId).lean(),
    ChargingSlot.findById(slotId).lean(),
  ]);
  if (!vehicle)
    throw Object.assign(new Error("Vehicle not found"), { status: 404 });
  if (!slot) throw Object.assign(new Error("Slot not found"), { status: 404 });

  // Check if slot is available (not booked or in_use)
  if (slot.status === "booked") {
    throw Object.assign(
      new Error("Slot is booked and not available for charging"),
      { status: 409 }
    );
  }
  if (slot.status === "in_use") {
    throw Object.assign(new Error("Slot is already in use"), { status: 409 });
  }
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

  return {
    sessionId: String(doc._id),
    percent,
    finished: isFinished,
    target: capTarget,
    ratePercentPerMinute: doc.chargeRatePercentPerMinute,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt ?? null,
    status: doc.status,
  };
}
