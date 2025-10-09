import { Request, Response } from "express";
import {
  createStation,
  getStationById,
  listStations,
  updateStation,
  deleteStation, // soft delete + cascade
  CreateStationInput,
  ListStationsOptions,
  // Ports
  PortCreateInput,
  PortUpsertInput,
  PortUpdateInput,
  createPort,
  updatePort,
  deletePort,
  getPortById,
  // Slots
  SlotCreateInput,
  SlotUpdateInput,
  addSlotToPort,
  updateSlot,
  deleteSlot,
  listSlotsByPort,
  getSlotById,
} from "../services/chargingstation.service";

/* =================== Station controllers =================== */

export async function createChargingStationController(
  req: Request,
  res: Response
) {
  try {
    const { name, longitude, latitude, status, address, provider, ports } =
      req.body as {
        name?: string;
        longitude?: number;
        latitude?: number;
        status?: "active" | "inactive" | "maintenance";
        address?: string;
        provider?: string;
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
      ...(address !== undefined ? { address } : {}),
      ...(provider !== undefined ? { provider } : {}),
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

export async function listChargingStationsController(
  req: Request,
  res: Response
) {
  try {
    const { status, name, address, provider, page, limit, includePorts } =
      req.query as {
        status?: "active" | "inactive" | "maintenance";
        name?: string;
        address?: string;
        provider?: string;
        page?: string;
        limit?: string;
        includePorts?: string;
      };

    const opts: ListStationsOptions = {
      ...(status ? { status } : {}),
      ...(name ? { name } : {}),
      ...(address ? { address } : {}),
      ...(provider ? { provider } : {}),
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

export async function updateChargingStationController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params as { id: string };
    const {
      name,
      longitude,
      latitude,
      status,
      address,
      provider,
      ports,
      removeMissingPorts,
    } = req.body as {
      name?: string;
      longitude?: number;
      latitude?: number;
      status?: "active" | "inactive" | "maintenance";
      address?: string;
      provider?: string;
      ports?: PortUpsertInput[];
      removeMissingPorts?: boolean;
    };

    if (
      name === undefined &&
      longitude === undefined &&
      latitude === undefined &&
      status === undefined &&
      address === undefined &&
      provider === undefined &&
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
      ...(address !== undefined ? { address } : {}),
      ...(provider !== undefined ? { provider } : {}),
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

// DELETE (soft delete → cascade inactive)
export async function deleteChargingStationController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params as { id: string };
    const updated = await deleteStation(id);
    return res.status(200).json({
      success: true,
      message:
        "Charging station and all related ports/slots marked as inactive",
      data: updated,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
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

/* =================== Port controllers =================== */

export async function createPortController(req: Request, res: Response) {
  try {
    const body = req.body as PortCreateInput & { stationId?: string };
    if (!body?.stationId) {
      return res
        .status(400)
        .json({ error: "InvalidInput", message: "stationId is required" });
    }
    const created = await createPort(body.stationId, body);
    return res.status(201).json(created);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function getPortByIdController(req: Request, res: Response) {
  try {
    const { portId } = req.params as { portId: string };
    const port = await getPortById(portId);
    return res.status(200).json(port);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function updatePortController(req: Request, res: Response) {
  try {
    const { portId } = req.params as { portId: string };
    const patch = req.body as PortUpdateInput;
    const updated = await updatePort(portId, patch);
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

export async function deletePortController(req: Request, res: Response) {
  try {
    const { portId } = req.params as { portId: string };
    const deleted = await deletePort(portId);
    return res
      .status(200)
      .json({ success: true, message: "Charging port deleted", data: deleted });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

/* =================== Slot controllers =================== */

export async function listSlotsByPortController(req: Request, res: Response) {
  try {
    const { portId } = req.params as { portId: string };
    const items = await listSlotsByPort(portId);
    return res.status(200).json({ items });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function getSlotByIdController(req: Request, res: Response) {
  try {
    const { slotId } = req.params as { slotId: string };
    const slot = await getSlotById(slotId);
    return res.status(200).json(slot);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function addSlotToPortController(req: Request, res: Response) {
  try {
    const { portId } = req.params as { portId: string };
    const body = req.body as SlotCreateInput;
    const created = await addSlotToPort(portId, body);
    return res.status(201).json(created);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error:
        status === 400
          ? "InvalidInput"
          : status === 404
          ? "NotFound"
          : status === 409
          ? "Conflict"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function updateSlotController(req: Request, res: Response) {
  try {
    const { slotId } = req.params as { slotId: string };
    const patch = req.body as SlotUpdateInput;
    const updated = await updateSlot(slotId, patch);
    return res.status(200).json(updated);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error:
        status === 400
          ? "InvalidInput"
          : status === 404
          ? "NotFound"
          : status === 409
          ? "Conflict"
          : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function deleteSlotController(req: Request, res: Response) {
  try {
    const { slotId } = req.params as { slotId: string };
    const deleted = await deleteSlot(slotId);
    return res
      .status(200)
      .json({ success: true, message: "Charging slot deleted", data: deleted });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}
