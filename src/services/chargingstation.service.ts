import { ChargingStation, IChargingStation, ChargingStationStatus } from '../models/chargingstation.model';
import { ChargingPort } from '../models/chargingport.model';

export interface CreateStationInput {
  name: string;
  longitude: number;
  latitude: number;
  status?: ChargingStationStatus;
}

export interface UpdateStationInput {
  id: string;
  name?: string;
  longitude?: number;
  latitude?: number;
  status?: ChargingStationStatus;
}

export interface ListStationsOptions {
  status?: ChargingStationStatus;
  name?: string;            // fuzzy search by name
  page?: number;            // default 1
  limit?: number;           // default 20
  includePorts?: boolean;   // populate ports
}

function assertCoords(longitude?: number, latitude?: number) {
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    const e: any = new Error('longitude must be between -180 and 180');
    e.status = 400;
    throw e;
  }
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    const e: any = new Error('latitude must be between -90 and 90');
    e.status = 400;
    throw e;
  }
}

export async function createStation(input: CreateStationInput) {
  const { name, longitude, latitude, status } = input;

  if (!name || typeof name !== 'string') {
    const e: any = new Error('name is required');
    e.status = 400;
    throw e;
  }
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    const e: any = new Error('longitude and latitude are required numbers');
    e.status = 400;
    throw e;
  }
  assertCoords(longitude, latitude);

  const created = await ChargingStation.create({
    name: name.trim(),
    longitude,
    latitude,
    ...(status ? { status } : {}),
  });

  return created.toJSON();
}

export async function getStationById(id: string, includePorts = false) {
  if (!id) {
    const e: any = new Error('id is required');
    e.status = 400;
    throw e;
  }

  let query = ChargingStation.findById(id);
  if (includePorts) query = query.populate('ports');

  const doc = await query.exec();
  if (!doc) {
    const e: any = new Error('Charging station not found');
    e.status = 404;
    throw e;
  }

  return doc.toJSON();
}

export async function listStations(opts: ListStationsOptions = {}) {
  const { status, name, page = 1, limit = 20, includePorts = false } = opts;

  const filter: any = {};
  if (status) filter.status = status;
  if (name) filter.name = { $regex: new RegExp(name.trim(), 'i') };

  const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);

  let q = ChargingStation.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.max(limit, 1));
  if (includePorts) q = q.populate('ports');

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
  const { id, name, longitude, latitude, status } = input;

  if (!id) {
    const e: any = new Error('id is required');
    e.status = 400;
    throw e;
  }

  if (
    name === undefined &&
    longitude === undefined &&
    latitude === undefined &&
    status === undefined
  ) {
    const e: any = new Error('No fields to update');
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

  const updated = await ChargingStation.findByIdAndUpdate(
    id,
    { $set: setOps },
    { new: true, runValidators: true }
  );

  if (!updated) {
    const e: any = new Error('Charging station not found');
    e.status = 404;
    throw e;
  }

  return updated.toJSON();
}

export async function deleteStation(id: string) {
  if (!id) {
    const e: any = new Error('id is required');
    e.status = 400;
    throw e;
  }

  // Chặn xóa nếu còn cổng sạc thuộc trạm
  const portsCount = await ChargingPort.countDocuments({ station: id });
  if (portsCount > 0) {
    const e: any = new Error('Station has charging ports. Delete ports first.');
    e.status = 409;
    throw e;
  }

  const deleted = await ChargingStation.findByIdAndDelete(id);
  if (!deleted) {
    const e: any = new Error('Charging station not found');
    e.status = 404;
    throw e;
  }

  return deleted.toJSON();
}
