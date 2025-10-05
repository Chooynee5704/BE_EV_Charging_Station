import { Response } from "express";
import {
  createVehicle,
  listVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  CreateVehicleInput,
  ListVehicleOptions,
  UpdateVehicleInput,
} from "../services/vehicle.service";
import { AuthenticatedRequest } from "../types";
import { Vehicle } from "../models/vehicle.model";

function isAdminOrStaff(req: AuthenticatedRequest) {
  return req.user?.role === "admin" || req.user?.role === "staff";
}

// POST /vehicles
export async function createVehicleController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const body = req.body as Partial<CreateVehicleInput>;
    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized", message: "Missing auth" });
    }

    // user chỉ được tạo xe cho chính mình
    const owner: string = isAdminOrStaff(req)
      ? (body.owner || req.user.userId)!
      : req.user.userId;

    const payload: CreateVehicleInput = {
      owner,
      plateNumber: String(body.plateNumber ?? ""),
      ...(body.make !== undefined ? { make: body.make } : {}),
      ...(body.model !== undefined ? { model: body.model } : {}),
      ...(body.year !== undefined ? { year: body.year } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.vin !== undefined ? { vin: body.vin } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.batteryCapacityKwh !== undefined
        ? { batteryCapacityKwh: body.batteryCapacityKwh }
        : {}),
      ...(body.connectorType !== undefined
        ? { connectorType: body.connectorType }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    };

    const created = await createVehicle(payload);
    return res.status(201).json(created);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error:
        status === 409
          ? "Conflict"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// GET /vehicles
export async function listVehiclesController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: "Unauthorized", message: "Missing auth" });

    const { owner, plateNumber, status, type, page, limit } = req.query as any;

    const opts: ListVehicleOptions = {
      ...(owner ? { owner: String(owner) } : {}),
      ...(plateNumber ? { plateNumber: String(plateNumber) } : {}),
      ...(status ? { status: String(status) as any } : {}),
      ...(type ? { type: String(type) as any } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    };

    // user thường: chỉ thấy xe của mình (override owner)
    if (!isAdminOrStaff(req)) {
      opts.owner = req.user.userId;
    }

    const result = await listVehicles(opts);
    return res.status(200).json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

/**
 * NEW: GET /vehicles/all
 * Admin/Staff: liệt kê toàn bộ xe của tất cả user (hỗ trợ filter & phân trang)
 */
export async function listAllVehiclesController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user || !isAdminOrStaff(req)) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: "Admins/Staff only" });
    }

    const { plateNumber, status, type, page, limit, owner } = req.query as any;

    // KHÔNG ép owner — nếu có owner trong query thì filter theo, nếu không có thì lấy tất cả
    const opts: ListVehicleOptions = {
      ...(owner ? { owner: String(owner) } : {}),
      ...(plateNumber ? { plateNumber: String(plateNumber) } : {}),
      ...(status ? { status: String(status) as any } : {}),
      ...(type ? { type: String(type) as any } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    };

    const result = await listVehicles(opts);
    return res.status(200).json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// GET /vehicles/:id (check ownership nếu user)
export async function getVehicleByIdController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: "Unauthorized", message: "Missing auth" });

    const { id } = req.params as { id: string };
    const v = await Vehicle.findById(id);
    if (!v)
      return res
        .status(404)
        .json({ error: "NotFound", message: "Vehicle not found" });

    if (!isAdminOrStaff(req) && String(v.owner) !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: "Not allowed" });
    }
    return res.status(200).json(v.toJSON());
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// PUT /vehicles/:id
export async function updateVehicleController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: "Unauthorized", message: "Missing auth" });

    const { id } = req.params as { id: string };
    const exists = await Vehicle.findById(id);
    if (!exists)
      return res
        .status(404)
        .json({ error: "NotFound", message: "Vehicle not found" });

    if (!isAdminOrStaff(req) && String(exists.owner) !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: "Not allowed" });
    }

    const patch = req.body as Omit<UpdateVehicleInput, "id">;
    const updated = await updateVehicle({ id, ...patch });
    return res.status(200).json(updated);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error:
        status === 409
          ? "Conflict"
          : status === 400
          ? "InvalidInput"
          : status === 404
          ? "NotFound"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// DELETE /vehicles/:id
export async function deleteVehicleController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: "Unauthorized", message: "Missing auth" });

    const { id } = req.params as { id: string };
    const exists = await Vehicle.findById(id);
    if (!exists)
      return res
        .status(404)
        .json({ error: "NotFound", message: "Vehicle not found" });

    if (!isAdminOrStaff(req) && String(exists.owner) !== req.user.userId) {
      return res
        .status(403)
        .json({ error: "Forbidden", message: "Not allowed" });
    }

    const deleted = await deleteVehicle(id);
    return res
      .status(200)
      .json({ success: true, message: "Vehicle deleted", data: deleted });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}
