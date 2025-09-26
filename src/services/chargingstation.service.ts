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

export interface CreateStationInput {
  name: string;
  longitude: number;
  latitude: number;
  status?: ChargingStationStatus;
  ports?: PortCreateInput[];
}

export interface UpdateStationInput {
  id: string;
  name?: string;
  longitude?: number;
  latitude?: number;
  status?: ChargingStationStatus;
  ports?: PortUpsertInput[];
  removeMissingPorts?: boolean; // default true
}

export interface ListStationsOptions {
  status?: ChargingStationStatus;
  name?: string;
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

export type PortUpsertInput = PortCreateInput & {
  id?: string; // only present when updating an existing port
};

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
    if (!speed || !["fast", "slow"].includes(speed)) {
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
    if (!speed || !["fast", "slow"].includes(speed)) {
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
    // CHỈ thêm id khi có – tránh { id: undefined } với exactOptionalPropertyTypes
    return id
      ? ({ id, ...base } as PortUpsertInput)
      : (base as PortUpsertInput);
  });
}

export async function createStation(input: CreateStationInput) {
  const { name, longitude, latitude, status, ports } = input;

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
    let stationId: string | null = null; // <<< fix: dùng string thay vì ObjectId

    await session.withTransaction(async () => {
      const created = await new ChargingStation({
        name: name.trim(),
        longitude,
        latitude,
        ...(status ? { status } : {}),
      }).save({ session });

      stationId = String(created._id); // <<< convert sang string an toàn

      if (portsSan.length > 0) {
        const portDocs = portsSan.map((p) => ({
          ...p,
          station: new Types.ObjectId(stationId!), // <<< tạo ObjectId khi cần
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
  if (!id) {
    const e: any = new Error("id is required");
    e.status = 400;
    throw e;
  }

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
  const { status, name, page = 1, limit = 20, includePorts = true } = opts;

  const filter: any = {};
  if (status) filter.status = status;
  if (name) filter.name = { $regex: new RegExp(name.trim(), "i") };

  const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);

  let q = ChargingStation.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.max(limit, 1));
  if (includePorts !== false) q = q.populate("ports");

  const [docs, total] = await Promise.all([
    q.exec(),
    ChargingStation.countDocuments(filter),
  ]);

  return {
    items: docs.map((d) => d.toJSON()),
    pagination: {
      page: Math.max(page, 1),
      limit: Math.max(limit, 1),
      total,
      pages: Math.ceil(total / Math.max(limit, 1)),
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
    ports,
    removeMissingPorts = true,
  } = input;

  if (!id) {
    const e: any = new Error("id is required");
    e.status = 400;
    throw e;
  }

  if (
    name === undefined &&
    longitude === undefined &&
    latitude === undefined &&
    status === undefined &&
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
  if (!id) {
    const e: any = new Error("id is required");
    e.status = 400;
    throw e;
  }

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
