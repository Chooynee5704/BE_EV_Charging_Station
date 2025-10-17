import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { startCharging, getChargingProgress, stopCharging } from "../services/charging.service";

export async function startChargingController(req: AuthenticatedRequest, res: Response) {
  try {
    const { vehicleId, slotId, initialPercent, targetPercent, chargeRatePercentPerMinute } = req.body as {
      vehicleId?: string;
      slotId?: string;
      initialPercent?: number;
      targetPercent?: number | null;
      chargeRatePercentPerMinute?: number;
    };

    if (!vehicleId || !slotId || initialPercent === undefined) {
      return res.status(400).json({ error: "InvalidInput", message: "vehicleId, slotId, initialPercent are required" });
    }

    const session = await startCharging({
      vehicleId,
      slotId,
      initialPercent,
      ...(targetPercent !== undefined ? { targetPercent } : {}),
      ...(chargeRatePercentPerMinute !== undefined ? { chargeRatePercentPerMinute } : {}),
    });
    return res.status(201).json(session);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: status === 400 ? "InvalidInput" : status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Internal Server Error",
    });
  }
}

export async function stopChargingController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: "completed" | "cancelled" };
    const result = await stopCharging(id, status ?? "completed");
    return res.status(200).json(result);
  } catch (error: any) {
    const s = error?.status || 500;
    return res.status(s).json({ error: s === 404 ? "NotFound" : s === 400 ? "InvalidInput" : "ServerError", message: error?.message || "Internal Server Error" });
  }
}

// Server-Sent Events stream progress
export async function streamChargingProgressController(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params as { id: string };

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const interval = setInterval(async () => {
      if (closed) {
        clearInterval(interval);
        return;
      }
      try {
        const progress = await getChargingProgress(id);
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
        if (progress.finished) {
          clearInterval(interval);
          res.end();
        }
      } catch (err: any) {
        clearInterval(interval);
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: err?.message || "Failed to fetch progress" })}\n\n`);
        res.end();
      }
    }, 2000); // 2s update
  } catch (error: any) {
    const s = error?.status || 500;
    res.status(s).json({ error: s === 404 ? "NotFound" : s === 400 ? "InvalidInput" : "ServerError", message: error?.message || "Internal Server Error" });
  }
}


