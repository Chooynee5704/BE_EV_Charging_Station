import { Types } from "mongoose";
import {
  Vehicle,
  IVehicle,
  VehicleStatus,
  VehicleType,
} from "../models/vehicle.model";

export interface CreateVehicleInput {
  owner: string; // userId
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plateNumber: string;
  vin?: string;
  type?: VehicleType;
  batteryCapacityKwh?: number;
  connectorType?: string;
  status?: VehicleStatus;
}

export interface UpdateVehicleInput {
  id: string;
  make?: string;
  model?: string;
  year?: number | null;
  color?: string | null;
  plateNumber?: string; // changing plate allowed if unique
  vin?: string | null;
  type?: VehicleType;
  batteryCapacityKwh?: number | null;
  connectorType?: string | null;
  status?: VehicleStatus;
}

export interface ListVehicleOptions {
  owner?: string;
  plateNumber?: string;
  status?: VehicleStatus;
  type?: VehicleType;
  page?: number;
  limit?: number;
}

function ensureObjectId(id: string, field = "id") {
  if (!id || !Types.ObjectId.isValid(id)) {
    const e: any = new Error(`${field} is invalid`);
    e.status = 400;
    throw e;
  }
}

function buildLike(v?: string) {
  return v ? { $regex: new RegExp(v.trim(), "i") } : undefined;
}

export async function createVehicle(input: CreateVehicleInput) {
  ensureObjectId(input.owner, "owner");
  if (!input.plateNumber || typeof input.plateNumber !== "string") {
    const e: any = new Error("plateNumber is required");
    e.status = 400;
    throw e;
  }

  const exists = await Vehicle.findOne({
    plateNumber: input.plateNumber.trim().toUpperCase(),
  }).lean();
  if (exists) {
    const e: any = new Error("plateNumber already exists");
    e.status = 409;
    throw e;
  }

  const created = await Vehicle.create({
    owner: new Types.ObjectId(input.owner),
    make: input.make?.trim(),
    model: input.model?.trim(),
    year: input.year,
    color: input.color?.trim(),
    plateNumber: input.plateNumber.trim().toUpperCase(),
    vin: input.vin?.trim(),
    type: input.type ?? "car",
    batteryCapacityKwh: input.batteryCapacityKwh,
    connectorType: input.connectorType?.trim(),
    status: input.status ?? "active",
  });

  return created.toJSON();
}

export async function getVehicleById(id: string) {
  ensureObjectId(id, "id");
  const v = await Vehicle.findById(id);
  if (!v) {
    const e: any = new Error("Vehicle not found");
    e.status = 404;
    throw e;
  }
  return v.toJSON();
}

export async function listVehicles(opts: ListVehicleOptions = {}) {
  const { owner, plateNumber, status, type, page = 1, limit = 20 } = opts;

  const filter: any = {};
  if (owner) {
    ensureObjectId(owner, "owner");
    filter.owner = owner;
  }
  if (plateNumber) filter.plateNumber = buildLike(plateNumber);
  if (status) filter.status = status;
  if (type) filter.type = type;

  const p = Math.max(Number(page) || 1, 1);
  const l = Math.max(Number(limit) || 1, 1);
  const skip = (p - 1) * l;

  const [items, total] = await Promise.all([
    Vehicle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l),
    Vehicle.countDocuments(filter),
  ]);

  return {
    items: items.map((i) => i.toJSON()),
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    },
  };
}

export async function updateVehicle(input: UpdateVehicleInput) {
  const {
    id,
    make,
    model,
    year,
    color,
    plateNumber,
    vin,
    type,
    batteryCapacityKwh,
    connectorType,
    status,
  } = input;

  ensureObjectId(id, "id");

  const setOps: any = {};
  const unsetOps: any = {};

  if (make !== undefined) setOps.make = make?.trim() || undefined;
  if (model !== undefined) setOps.model = model?.trim() || undefined;
  if (year !== undefined) {
    if (year === null) unsetOps.year = "";
    else setOps.year = year;
  }
  if (color !== undefined) setOps.color = color?.trim() || undefined;
  if (plateNumber !== undefined) {
    const newPlate = plateNumber.trim().toUpperCase();
    const exists = await Vehicle.exists({
      _id: { $ne: id },
      plateNumber: newPlate,
    });
    if (exists) {
      const e: any = new Error("plateNumber already exists");
      e.status = 409;
      throw e;
    }
    setOps.plateNumber = newPlate;
  }
  if (vin !== undefined) {
    if (vin === null) unsetOps.vin = "";
    else setOps.vin = vin?.trim();
  }
  if (type !== undefined) setOps.type = type;
  if (batteryCapacityKwh !== undefined) {
    if (batteryCapacityKwh === null) unsetOps.batteryCapacityKwh = "";
    else setOps.batteryCapacityKwh = batteryCapacityKwh;
  }
  if (connectorType !== undefined)
    setOps.connectorType = connectorType?.trim() || undefined;
  if (status !== undefined) setOps.status = status;

  const updateDoc: any = {};
  if (Object.keys(setOps).length) updateDoc.$set = setOps;
  if (Object.keys(unsetOps).length) updateDoc.$unset = unsetOps;
  if (!Object.keys(updateDoc).length) {
    const e: any = new Error("No fields to update");
    e.status = 400;
    throw e;
  }

  const updated = await Vehicle.findByIdAndUpdate(id, updateDoc, {
    new: true,
    runValidators: true,
  });
  if (!updated) {
    const e: any = new Error("Vehicle not found");
    e.status = 404;
    throw e;
  }
  return updated.toJSON();
}

export async function deleteVehicle(id: string) {
  ensureObjectId(id, "id");
  const deleted = await Vehicle.findByIdAndDelete(id);
  if (!deleted) {
    const e: any = new Error("Vehicle not found");
    e.status = 404;
    throw e;
  }
  return deleted.toJSON();
}
