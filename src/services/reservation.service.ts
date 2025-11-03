import mongoose, { Types, HydratedDocument } from "mongoose";
import { Reservation, IReservation } from "../models/reservation.model";
import { ChargingSlot } from "../models/chargingslot.model";
import { Vehicle } from "../models/vehicle.model";

export type BookItemInput = {
  slotId: string;
  startAt: Date | string;
  endAt: Date | string;
};

export interface CreateReservationInput {
  vehicleId: string;
  items: BookItemInput[];
  status?: "pending" | "confirmed";
}

export interface ListReservationsOptions {
  vehicleId?: string;
  ownerUserId?: string; // list all reservations for vehicles owned by this user
  status?: "pending" | "confirmed" | "cancelled" | "completed";
  page?: number;
  limit?: number;
}

export async function createReservation(input: CreateReservationInput) {
  const { vehicleId, items, status = "pending" } = input;

  if (!Types.ObjectId.isValid(vehicleId)) {
    const e: any = new Error("vehicleId is not a valid ObjectId");
    e.status = 400;
    throw e;
  }
  if (!Array.isArray(items) || items.length === 0) {
    const e: any = new Error("items must contain at least one slot/time range");
    e.status = 400;
    throw e;
  }

  const vehicle = await Vehicle.findById(vehicleId).lean();
  if (!vehicle) {
    const e: any = new Error("Vehicle not found");
    e.status = 404;
    throw e;
  }

  type Norm = { slot: Types.ObjectId; startAt: Date; endAt: Date };
  const normalized: Norm[] = [];
  const bySlot: Record<string, Norm[]> = {};

  for (const [idx, it] of items.entries()) {
    const { slotId, startAt, endAt } = it;

    if (!slotId || !Types.ObjectId.isValid(slotId)) {
      const e: any = new Error(`items[${idx}].slotId is invalid`);
      e.status = 400;
      throw e;
    }
    const s = new Date(startAt as any);
    const eDate = new Date(endAt as any);
    if (Number.isNaN(s.getTime()) || Number.isNaN(eDate.getTime())) {
      const err: any = new Error(`items[${idx}] has invalid startAt/endAt`);
      err.status = 400;
      throw err;
    }
    if (s >= eDate) {
      const err: any = new Error(
        `items[${idx}]: startAt must be earlier than endAt`
      );
      err.status = 400;
      throw err;
    }

    const item: Norm = {
      slot: new Types.ObjectId(slotId),
      startAt: s,
      endAt: eDate,
    };
    normalized.push(item);

    const key = String(item.slot);
    bySlot[key] ??= [];
    for (const existed of bySlot[key]) {
      if (item.startAt < existed.endAt && item.endAt > existed.startAt) {
        const err: any = new Error(
          `items[${idx}] overlaps another item for the same slot`
        );
        err.status = 400;
        throw err;
      }
    }
    bySlot[key].push(item);
  }

  const slotIds = [...new Set(normalized.map((i) => String(i.slot)))];
  const slotsCount = await ChargingSlot.countDocuments({
    _id: { $in: slotIds },
  });
  if (slotsCount !== slotIds.length) {
    const e: any = new Error("One or more slotIds do not exist");
    e.status = 404;
    throw e;
  }

  const session = await mongoose.startSession();
  try {
    const created = (await session.withTransaction(async () => {
      for (const it of normalized) {
        const conflict = !!(await Reservation.exists({
          status: { $in: ["pending", "confirmed"] },
          items: {
            $elemMatch: {
              slot: it.slot,
              startAt: { $lt: it.endAt },
              endAt: { $gt: it.startAt },
            },
          },
        }).session(session));

        if (conflict) {
          const err: any = new Error(
            `Time range overlaps an existing reservation for slot ${it.slot.toString()}`
          );
          err.status = 409;
          throw err;
        }
      }

      const doc = new Reservation({
        vehicle: new Types.ObjectId(vehicleId),
        items: normalized,
        status,
      });
      const savedDoc = await doc.save({ session });

      // Update slot status to "booked" for all slots in the reservation
      const slotIdsToUpdate = normalized.map((i) => i.slot);
      await ChargingSlot.updateMany(
        { _id: { $in: slotIdsToUpdate } },
        { $set: { status: "booked" } }
      ).session(session);

      return savedDoc;
    })) as HydratedDocument<IReservation> | null;

    if (!created) {
      const err: any = new Error("Failed to create reservation");
      err.status = 500;
      throw err;
    }
    return created.toJSON();
  } finally {
    session.endSession();
  }
}

export async function listReservations(opts: ListReservationsOptions) {
  const { vehicleId, ownerUserId, status, page = 1, limit = 20 } = opts;

  const filter: any = {};
  if (status) filter.status = status;

  if (vehicleId) {
    if (!Types.ObjectId.isValid(vehicleId)) {
      const e: any = new Error("vehicleId is not a valid ObjectId");
      e.status = 400;
      throw e;
    }
    filter.vehicle = new Types.ObjectId(vehicleId);
  } else if (ownerUserId) {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      const e: any = new Error("ownerUserId is not a valid ObjectId");
      e.status = 400;
      throw e;
    }
    const ownedVehicles = await Vehicle.find(
      { owner: ownerUserId },
      { _id: 1 }
    ).lean();
    const ids = ownedVehicles.map((v) => v._id);
    filter.vehicle = { $in: ids.length ? ids : [new Types.ObjectId()] };
  } else {
    const e: any = new Error("Either vehicleId or ownerUserId is required");
    e.status = 400;
    throw e;
  }

  const safeLimit = Math.max(Number(limit) || 1, 1);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [docs, total] = await Promise.all([
    Reservation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("items.slot")
      .populate("vehicle")
      .lean(),
    Reservation.countDocuments(filter),
  ]);

  return {
    items: docs,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getReservationById(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    const e: any = new Error("id is not a valid ObjectId");
    e.status = 400;
    throw e;
  }
  const doc = await Reservation.findById(id)
    .populate("items.slot")
    .populate("vehicle");
  if (!doc) {
    const e: any = new Error("Reservation not found");
    e.status = 404;
    throw e;
  }
  return doc.toJSON();
}

export async function cancelReservation(
  id: string,
  requesterUserId?: string,
  isAdminOrStaff = false
) {
  if (!Types.ObjectId.isValid(id)) {
    const e: any = new Error("id is not a valid ObjectId");
    e.status = 400;
    throw e;
  }

  const doc = await Reservation.findById(id).populate("vehicle");
  if (!doc) {
    const e: any = new Error("Reservation not found");
    e.status = 404;
    throw e;
  }

  if (!isAdminOrStaff) {
    const vehicle: any = doc.vehicle;
    if (!vehicle || String(vehicle.owner) !== String(requesterUserId)) {
      const e: any = new Error("Forbidden");
      e.status = 403;
      throw e;
    }
  }

  if (doc.status === "cancelled" || doc.status === "completed") {
    const e: any = new Error(`Cannot cancel a ${doc.status} reservation`);
    e.status = 400;
    throw e;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      doc.status = "cancelled";
      await doc.save({ session });

      // Update slot status back to "available" for all slots in the reservation
      const slotIdsToUpdate = doc.items.map((i) => i.slot);
      await ChargingSlot.updateMany(
        { _id: { $in: slotIdsToUpdate } },
        { $set: { status: "available" } }
      ).session(session);
    });
    return doc.toJSON();
  } finally {
    session.endSession();
  }
}

export async function completeReservation(
  id: string,
  requesterUserId?: string,
  isAdminOrStaff = false
) {
  if (!Types.ObjectId.isValid(id)) {
    const e: any = new Error("id is not a valid ObjectId");
    e.status = 400;
    throw e;
  }

  const doc = await Reservation.findById(id).populate("vehicle");
  if (!doc) {
    const e: any = new Error("Reservation not found");
    e.status = 404;
    throw e;
  }

  if (!isAdminOrStaff) {
    const vehicle: any = doc.vehicle;
    if (!vehicle || String(vehicle.owner) !== String(requesterUserId)) {
      const e: any = new Error("Forbidden");
      e.status = 403;
      throw e;
    }
  }

  if (doc.status === "cancelled") {
    const e: any = new Error(`Cannot complete a cancelled reservation`);
    e.status = 400;
    throw e;
  }

  if (doc.status === "completed") {
    const e: any = new Error(`Reservation is already completed`);
    e.status = 400;
    throw e;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      doc.status = "completed";
      await doc.save({ session });

      // Update slot status back to "available" for all slots in the reservation
      const slotIdsToUpdate = doc.items.map((i) => i.slot);
      await ChargingSlot.updateMany(
        { _id: { $in: slotIdsToUpdate } },
        { $set: { status: "available" } }
      ).session(session);
    });
    return doc.toJSON();
  } finally {
    session.endSession();
  }
}
