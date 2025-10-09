import { Response } from "express";
import { estimateCost, EstimateCostInput } from "../services/pricing.sevice";
import { AuthenticatedRequest } from "../types";

export async function estimateCostController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { portId, startAt, endAt, assumePowerKw } =
      req.body as Partial<EstimateCostInput>;

    if (!portId || !startAt || !endAt) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "portId, startAt, endAt are required",
      });
    }

    const result = await estimateCost({
      portId: String(portId),
      startAt,
      endAt,
      ...(assumePowerKw !== undefined
        ? { assumePowerKw: Number(assumePowerKw) }
        : {}),
    });

    return res.status(200).json({
      success: true,
      message: "OK",
      data: result,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 400
          ? "InvalidInput"
          : status === 404
          ? "NotFound"
          : "ServerError",
      message,
    });
  }
}
