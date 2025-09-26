import { Request, Response } from "express";
import {
  createStation,
  getStationById,
  listStations,
  updateStation,
  deleteStation,
  CreateStationInput,
  ListStationsOptions,
  PortCreateInput,
  PortUpsertInput,
} from "../services/chargingstation.service";

// CREATE
export async function createChargingStationController(
  req: Request,
  res: Response
) {
  try {
    const { name, longitude, latitude, status, ports } = req.body as {
      name?: string;
      longitude?: number;
      latitude?: number;
      status?: "active" | "inactive" | "maintenance";
      ports?: PortCreateInput[];
    };

    if (
      !name ||
      typeof name !== "string" ||
      typeof longitude !== "number" ||
      typeof latitude !== "number"
    ) {
      return res.status(400).json({
        error: "InvalidInput",
        message:
          "name (string), longitude (number), latitude (number) are required",
      });
    }

    const payload: CreateStationInput = {
      name,
      longitude,
      latitude,
      ...(status ? { status } : {}),
      ...(ports ? { ports } : {}),
    };

    const station = await createStation(payload);
    return res.status(201).json(station);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 400 ? "InvalidInput" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// LIST
export async function listChargingStationsController(
  req: Request,
  res: Response
) {
  try {
    const { status, name, page, limit, includePorts } = req.query as {
      status?: "active" | "inactive" | "maintenance";
      name?: string;
      page?: string;
      limit?: string;
      includePorts?: string;
    };

    const opts: ListStationsOptions = {
      ...(status ? { status } : {}),
      ...(name ? { name } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(includePorts !== undefined
        ? { includePorts: includePorts === "true" }
        : { includePorts: true }),
    };

    const result = await listStations(opts);
    return res.status(200).json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// GET BY ID
export async function getChargingStationByIdController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params as { id: string };
    const includePortsParam = req.query.includePorts as string | undefined;
    const includePorts =
      includePortsParam !== undefined ? includePortsParam === "true" : true;

    const station = await getStationById(id, includePorts);
    return res.status(200).json(station);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error:
        status === 404
          ? "NotFound"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// UPDATE
export async function updateChargingStationController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params as { id: string };
    const { name, longitude, latitude, status, ports, removeMissingPorts } =
      req.body as {
        name?: string;
        longitude?: number;
        latitude?: number;
        status?: "active" | "inactive" | "maintenance";
        ports?: PortUpsertInput[];
        removeMissingPorts?: boolean;
      };

    if (
      name === undefined &&
      longitude === undefined &&
      latitude === undefined &&
      status === undefined &&
      ports === undefined
    ) {
      return res
        .status(400)
        .json({ error: "InvalidInput", message: "No fields to update" });
    }

    const updated = await updateStation({
      id,
      ...(name !== undefined ? { name } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      ...(latitude !== undefined ? { latitude } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(ports !== undefined ? { ports } : {}),
      ...(removeMissingPorts !== undefined ? { removeMissingPorts } : {}),
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error:
        status === 404
          ? "NotFound"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

// DELETE
export async function deleteChargingStationController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params as { id: string };
    const deleted = await deleteStation(id);
    return res
      .status(200)
      .json({
        success: true,
        message: "Charging station deleted",
        data: deleted,
      });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error:
        status === 404
          ? "NotFound"
          : status === 409
          ? "Conflict"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}
