import mongoose, { Types } from "mongoose";
import {
  ChargingStation,
  ChargingStationStatus,
} from "../models/chargingstation.model";
import {
  ChargingPort,
  IChargingPort,
  PortType,
  PortStatus,
  ChargeSpeed,
} from "../models/chargingport.model";
import {
  ChargingSlot,
  IChargingSlot,
  ChargingSlotStatus,
} from "../models/chargingslot.model";

/* ======================= Types ======================= */

export interface CreateStationInput {
  name: string;
  longitude: number;
  latitude: number;
  status?: ChargingStationStatus;
  address?: string;
  provider?: string;
  ports?: PortCreateInput[];
}

export interface UpdateStationInput {
  id: string;
  name?: string;
  longitude?: number;
  latitude?: number;
  status?: ChargingStationStatus;
  address?: string;
  provider?: string;
  ports?: PortUpsertInput[];
  removeMissingPorts?: boolean; // default true
}

export interface ListStationsOptions {
  status?: ChargingStationStatus;
  name?: string;
  address?: string;
  provider?: string;
  page?: number;
  limit?: number;
  includePorts?: boolean; // default true
}

export type PortCreateInput = {
  type: PortType;
  status?: PortStatus;
  powerKw: number;
  speed: ChargeSpeed;
  price: number;
};

export type PortUpsertInput = PortCreateInput & { id?: string };
export type PortUpdateInput = Partial<PortCreateInput>;

/* --------- Slots --------- */
export type SlotCreateInput = {
  order?: number; // integer >= 1; if missing, auto-assign next order
  status?: ChargingSlotStatus; // default: 'available'
  nextAvailableAt?: Date | null; // default: null (forced null when status is 'available')
};
export type SlotUpdateInput = Partial<SlotCreateInput>;

/* ======================= Helpers ======================= */

function ensureValidObjectId(id: string, fieldName = "id") {
  if (!id) {
    const e: any = new Error(`${fieldName} is required`);
    e.status = 400;
    throw e;
  }
  if (!Types.ObjectId.isValid(id)) {
    const e: any = new Error(`${fieldName} is not a valid ObjectId`);
    e.status = 400;
    throw e;
  }
}

function assertCoords(longitude?: number, latitude?: number) {
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    const e: any = new Error("longitude must be between -180 and 180");
    e.status = 400;
    throw e;
  }
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    const e: any = new Error("latitude must be between -90 and 90");
    e.status = 400;
    throw e;
  }
}

function sanitizePortsCreate(ports?: PortCreateInput[]): PortCreateInput[] {
  if (!ports) return [];
  if (!Array.isArray(ports)) {
    const e: any = new Error("ports must be an array");
    e.status = 400;
    throw e;
  }
  return ports.map((p, idx) => {
    const { type, status, powerKw, speed, price } = p;
    if (!type || !["CCS", "CHAdeMO", "AC"].includes(type)) {
      const e: any = new Error(`ports[${idx}].type invalid`);
      e.status = 400;
      throw e;
    }
    if (status && !["available", "in_use"].includes(status)) {
      const e: any = new Error(`ports[${idx}].status invalid`);
      e.status = 400;
      throw e;
    }
    if (typeof powerKw !== "number" || powerKw < 1) {
      const e: any = new Error(`ports[${idx}].powerKw must be >= 1`);
      e.status = 400;
      throw e;
    }
    if (!["fast", "slow"].includes(speed as any)) {
      const e: any = new Error(`ports[${idx}].speed invalid`);
      e.status = 400;
      throw e;
    }
    if (typeof price !== "number" || price < 0) {
      const e: any = new Error(`ports[${idx}].price must be >= 0`);
      e.status = 400;
      throw e;
    }
    return { type, status: status ?? "available", powerKw, speed, price };
  });
}

function sanitizePortsUpsert(ports?: PortUpsertInput[]): PortUpsertInput[] {
  if (!ports) return [];
  if (!Array.isArray(ports)) {
    const e: any = new Error("ports must be an array");
    e.status = 400;
    throw e;
  }
  return ports.map((p, idx) => {
    const { id, type, status, powerKw, speed, price } = p;
    if (id !== undefined) {
      if (!id) {
        const e: any = new Error(`ports[${idx}].id is empty string`);
        e.status = 400;
        throw e;
      }
      if (!Types.ObjectId.isValid(id)) {
        const e: any = new Error(`ports[${idx}].id is not a valid ObjectId`);
        e.status = 400;
        throw e;
      }
    }
    if (!type || !["CCS", "CHAdeMO", "AC"].includes(type)) {
      const e: any = new Error(`ports[${idx}].type invalid`);
      e.status = 400;
      throw e;
    }
    if (status && !["available", "in_use"].includes(status)) {
      const e: any = new Error(`ports[${idx}].status invalid`);
      e.status = 400;
      throw e;
    }
    if (typeof powerKw !== "number" || powerKw < 1) {
      const e: any = new Error(`ports[${idx}].powerKw must be >= 1`);
      e.status = 400;
      throw e;
    }
    if (!["fast", "slow"].includes(speed as any)) {
      const e: any = new Error(`ports[${idx}].speed invalid`);
      e.status = 400;
      throw e;
    }
    if (typeof price !== "number" || price < 0) {
      const e: any = new Error(`ports[${idx}].price must be >= 0`);
      e.status = 400;
      throw e;
    }

    const base: Omit<PortUpsertInput, "id"> = {
      type,
      status: status ?? "available",
      powerKw,
      speed,
      price,
    };
    return id
      ? ({ id, ...base } as PortUpsertInput)
      : (base as PortUpsertInput);
  });
}

/* ======================= Station CRUD ======================= */

export async function createStation(input: CreateStationInput) {
  const { name, longitude, latitude, status, address, provider, ports } = input;

  if (!name || typeof name !== "string") {
    const e: any = new Error("name is required");
    e.status = 400;
    throw e;
  }
  if (typeof longitude !== "number" || typeof latitude !== "number") {
    const e: any = new Error("longitude and latitude are required numbers");
    e.status = 400;
    throw e;
  }
  assertCoords(longitude, latitude);

  const portsSan = sanitizePortsCreate(ports);
  const session = await mongoose.startSession();

  try {
    let stationId: string | null = null;

    await session.withTransaction(async () => {
      const created = await new ChargingStation({
        name: name.trim(),
        longitude,
        latitude,
        ...(status ? { status } : {}),
        ...(address ? { address: String(address).trim() } : {}),
        ...(provider ? { provider: String(provider).trim() } : {}),
      }).save({ session });

      stationId = String(created._id);

      if (portsSan.length > 0) {
        const portDocs = portsSan.map((p) => ({
          ...p,
          station: new Types.ObjectId(stationId!),
        }));
        await ChargingPort.insertMany(portDocs, { session });
      }
    });

    const doc = await ChargingStation.findById(stationId)
      .populate("ports")
      .exec();
    return doc!.toJSON();
  } finally {
    session.endSession();
  }
}

export async function getStationById(id: string, includePorts = true) {
  ensureValidObjectId(id, "id");

  let query = ChargingStation.findById(id);
  if (includePorts !== false) query = query.populate("ports");

  const doc = await query.exec();
  if (!doc) {
    const e: any = new Error("Charging station not found");
    e.status = 404;
    throw e;
  }
  return doc.toJSON();
}

export async function listStations(opts: ListStationsOptions = {}) {
  const {
    status,
    name,
    address,
    provider,
    page = 1,
    limit = 20,
    includePorts = true,
  } = opts;

  const filter: any = {};
  if (status) filter.status = status;
  if (name) filter.name = { $regex: new RegExp(name.trim(), "i") };
  if (address) filter.address = { $regex: new RegExp(address.trim(), "i") };
  if (provider) filter.provider = { $regex: new RegExp(provider.trim(), "i") };

  const safeLimit = Math.max(Number(limit) || 1, 1);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  let q = ChargingStation.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit);
  if (includePorts !== false) q = q.populate("ports");

  const [docs, total] = await Promise.all([
    q.exec(),
    ChargingStation.countDocuments(filter),
  ]);

  return {
    items: docs.map((d) => d.toJSON()),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    },
  };
}

export async function updateStation(input: UpdateStationInput) {
  const {
    id,
    name,
    longitude,
    latitude,
    status,
    address,
    provider,
    ports,
    removeMissingPorts = true,
  } = input;

  ensureValidObjectId(id, "id");

  if (
    name === undefined &&
    longitude === undefined &&
    latitude === undefined &&
    status === undefined &&
    address === undefined &&
    provider === undefined &&
    ports === undefined
  ) {
    const e: any = new Error("No fields to update");
    e.status = 400;
    throw e;
  }

  if (longitude !== undefined || latitude !== undefined) {
    assertCoords(longitude, latitude);
  }

  const setOps: any = {};
  if (name !== undefined) setOps.name = String(name).trim();
  if (longitude !== undefined) setOps.longitude = longitude;
  if (latitude !== undefined) setOps.latitude = latitude;
  if (status !== undefined) setOps.status = status;
  if (address !== undefined)
    setOps.address = address ? String(address).trim() : undefined;
  if (provider !== undefined)
    setOps.provider = provider ? String(provider).trim() : undefined;

  const portsSan = ports ? sanitizePortsUpsert(ports) : [];
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const exists = await ChargingStation.findById(id).session(session);
      if (!exists) {
        const e: any = new Error("Charging station not found");
        e.status = 404;
        throw e;
      }

      if (Object.keys(setOps).length > 0) {
        await ChargingStation.updateOne(
          { _id: id },
          { $set: setOps },
          { runValidators: true, session }
        );
      }

      if (ports !== undefined) {
        const existingPorts = await ChargingPort.find({ station: id }, null, {
          session,
        });
        const existingMap = new Map<string, IChargingPort>();
        existingPorts.forEach((p) => existingMap.set(String(p._id), p));

        const submittedIds = new Set<string>();

        for (const p of portsSan) {
          if ("id" in p && p.id) {
            const ex = existingMap.get(String(p.id));
            if (!ex) {
              const e: any = new Error(
                `Port ${p.id} not found in this station`
              );
              e.status = 400;
              throw e;
            }
            await ChargingPort.updateOne(
              { _id: p.id, station: id },
              {
                $set: {
                  type: p.type,
                  status: p.status ?? "available",
                  powerKw: p.powerKw,
                  speed: p.speed,
                  price: p.price,
                },
              },
              { runValidators: true, session }
            );
            submittedIds.add(String(p.id));
          } else {
            await ChargingPort.create(
              [
                {
                  station: new Types.ObjectId(id),
                  type: p.type,
                  status: p.status ?? "available",
                  powerKw: p.powerKw,
                  speed: p.speed,
                  price: p.price,
                },
              ],
              { session }
            );
          }
        }

        if (removeMissingPorts) {
          const toDelete = existingPorts
            .filter((ep) => !submittedIds.has(String(ep._id)))
            .map((ep) => ep._id);
          if (toDelete.length > 0) {
            await ChargingPort.deleteMany(
              { _id: { $in: toDelete }, station: id },
              { session }
            );
          }
        }
      }
    });

    const doc = await ChargingStation.findById(id).populate("ports").exec();
    return doc!.toJSON();
  } finally {
    session.endSession();
  }
}

export async function deleteStation(id: string) {
  ensureValidObjectId(id, "id");

  const portsCount = await ChargingPort.countDocuments({ station: id });
  if (portsCount > 0) {
    const e: any = new Error("Station has charging ports. Delete ports first.");
    e.status = 409;
    throw e;
  }

  const deleted = await ChargingStation.findByIdAndDelete(id);
  if (!deleted) {
    const e: any = new Error("Charging station not found");
    e.status = 404;
    throw e;
  }

  return deleted.toJSON();
}

/* ============== Port operations (REFAC) ============== */

function validatePortPayload(
  p: PortCreateInput | PortUpdateInput,
  path = "port"
) {
  if (
    "type" in p &&
    p.type !== undefined &&
    !["CCS", "CHAdeMO", "AC"].includes(p.type as any)
  ) {
    const e: any = new Error(`${path}.type invalid`);
    e.status = 400;
    throw e;
  }
  if (
    "status" in p &&
    p.status !== undefined &&
    !["available", "in_use"].includes(p.status as any)
  ) {
    const e: any = new Error(`${path}.status invalid`);
    e.status = 400;
    throw e;
  }
  if (
    "powerKw" in p &&
    p.powerKw !== undefined &&
    (typeof p.powerKw !== "number" || p.powerKw < 1)
  ) {
    const e: any = new Error(`${path}.powerKw must be >= 1`);
    e.status = 400;
    throw e;
  }
  if (
    "speed" in p &&
    p.speed !== undefined &&
    !["fast", "slow"].includes(p.speed as any)
  ) {
    const e: any = new Error(`${path}.speed invalid`);
    e.status = 400;
    throw e;
  }
  if (
    "price" in p &&
    p.price !== undefined &&
    (typeof p.price !== "number" || p.price < 0)
  ) {
    const e: any = new Error(`${path}.price must be >= 0`);
    e.status = 400;
    throw e;
  }

  if (
    !("type" in p) &&
    !("status" in p) &&
    !("powerKw" in p) &&
    !("speed" in p) &&
    !("price" in p)
  ) {
    const e: any = new Error(`${path}: no fields provided`);
    e.status = 400;
    throw e;
  }
}

export async function createPort(stationId: string, payload: PortCreateInput) {
  ensureValidObjectId(stationId, "stationId");
  validatePortPayload(payload, "port");

  const station = await ChargingStation.findById(stationId);
  if (!station) {
    const e: any = new Error("Charging station not found");
    e.status = 404;
    throw e;
  }

  const created = await ChargingPort.create({
    station: new Types.ObjectId(stationId),
    type: payload.type,
    status: payload.status ?? "available",
    powerKw: payload.powerKw,
    speed: payload.speed,
    price: payload.price,
  });

  return created.toJSON();
}

export async function getPortById(portId: string) {
  ensureValidObjectId(portId, "portId");
  const port = await ChargingPort.findById(portId);
  if (!port) {
    const e: any = new Error("Port not found");
    e.status = 404;
    throw e;
  }
  return port.toJSON();
}

export async function updatePort(portId: string, patch: PortUpdateInput) {
  ensureValidObjectId(portId, "portId");
  validatePortPayload(patch, "port");

  const setOps: any = {};
  if (patch.type !== undefined) setOps.type = patch.type;
  if (patch.status !== undefined) setOps.status = patch.status;
  if (patch.powerKw !== undefined) setOps.powerKw = patch.powerKw;
  if (patch.speed !== undefined) setOps.speed = patch.speed;
  if (patch.price !== undefined) setOps.price = patch.price;

  const updated = await ChargingPort.findOneAndUpdate(
    { _id: portId },
    { $set: setOps },
    { new: true, runValidators: true }
  );

  if (!updated) {
    const e: any = new Error("Port not found");
    e.status = 404;
    throw e;
  }

  return updated.toJSON();
}

export async function deletePort(portId: string) {
  ensureValidObjectId(portId, "portId");

  const deleted = await ChargingPort.findOneAndDelete({
    _id: portId,
  });
  if (!deleted) {
    const e: any = new Error("Port not found");
    e.status = 404;
    throw e;
  }

  return deleted.toJSON();
}

/* ============== Slot operations (REFAC with `order`) ============== */

function isPositiveInt(n: any) {
  return typeof n === "number" && Number.isInteger(n) && n >= 1;
}

function validateSlotPayload(
  p: SlotCreateInput | SlotUpdateInput,
  path = "slot"
) {
  if (
    "status" in p &&
    p.status !== undefined &&
    !["available", "booked", "in_use"].includes(p.status as any)
  ) {
    const e: any = new Error(`${path}.status invalid`);
    e.status = 400;
    throw e;
  }
  if ("order" in p && p.order !== undefined && !isPositiveInt(p.order)) {
    const e: any = new Error(`${path}.order must be a positive integer`);
    e.status = 400;
    throw e;
  }
  if (!("status" in p) && !("nextAvailableAt" in p) && !("order" in p)) {
    const e: any = new Error(`${path}: no fields provided`);
    e.status = 400;
    throw e;
  }
}

async function ensurePortExists(portId: string) {
  const port = await ChargingPort.findById(portId);
  if (!port) {
    const e: any = new Error("Port not found");
    e.status = 404;
    throw e;
  }
  return port;
}

// List all slots of a port
export async function listSlotsByPort(portId: string) {
  ensureValidObjectId(portId, "portId");
  await ensurePortExists(portId);

  const slots = await ChargingSlot.find({ port: portId }).sort({
    order: 1,
    createdAt: -1,
  });
  return slots.map((s) => s.toJSON());
}

// Get single slot by id
export async function getSlotById(slotId: string) {
  ensureValidObjectId(slotId, "slotId");

  const slot = await ChargingSlot.findById(slotId);
  if (!slot) {
    const e: any = new Error("Slot not found");
    e.status = 404;
    throw e;
  }
  return slot.toJSON();
}

// Create slot in a port
export async function addSlotToPort(portId: string, payload: SlotCreateInput) {
  ensureValidObjectId(portId, "portId");
  validateSlotPayload(payload, "slot");
  await ensurePortExists(portId);

  const finalStatus = payload.status ?? "available";
  const finalNextAvailableAt =
    finalStatus === "available" ? null : payload.nextAvailableAt ?? null;

  // Determine order: use provided, or auto-assign next
  let finalOrder: number;
  if (payload.order !== undefined) {
    finalOrder = payload.order;
  } else {
    const last = await ChargingSlot.findOne({ port: portId })
      .sort({ order: -1 })
      .select({ order: 1 })
      .lean();
    finalOrder = last?.order ? last.order + 1 : 1;
  }

  const data: Partial<IChargingSlot> = {
    port: new Types.ObjectId(portId),
    order: finalOrder,
    status: finalStatus,
    nextAvailableAt: finalNextAvailableAt,
  };

  try {
    const created = await ChargingSlot.create(data);
    return created.toJSON();
  } catch (err: any) {
    if (err?.code === 11000) {
      const e: any = new Error("Slot order already exists in this port");
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

// Update a slot by id
export async function updateSlot(slotId: string, patch: SlotUpdateInput) {
  ensureValidObjectId(slotId, "slotId");
  validateSlotPayload(patch, "slot");

  const current = await ChargingSlot.findById(slotId);
  if (!current) {
    const e: any = new Error("Slot not found");
    e.status = 404;
    throw e;
  }

  const targetStatus = patch.status ?? current.status;
  const setOps: any = {};

  if (patch.order !== undefined) setOps.order = patch.order;
  if (patch.status !== undefined) setOps.status = patch.status;

  if (patch.nextAvailableAt !== undefined) {
    setOps.nextAvailableAt = patch.nextAvailableAt;
  }

  if (targetStatus === "available") {
    setOps.nextAvailableAt = null;
  }

  try {
    const updated = await ChargingSlot.findOneAndUpdate(
      { _id: slotId },
      { $set: setOps },
      { new: true, runValidators: true }
    );
    if (!updated) {
      const e: any = new Error("Slot not found");
      e.status = 404;
      throw e;
    }
    return updated.toJSON();
  } catch (err: any) {
    if (err?.code === 11000) {
      const e: any = new Error("Slot order already exists in this port");
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

// Delete a slot by id
export async function deleteSlot(slotId: string) {
  ensureValidObjectId(slotId, "slotId");

  const deleted = await ChargingSlot.findOneAndDelete({ _id: slotId });
  if (!deleted) {
    const e: any = new Error("Slot not found");
    e.status = 404;
    throw e;
  }
  return deleted.toJSON();
}
