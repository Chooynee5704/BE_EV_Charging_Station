import { Types } from "mongoose";
import { ChargingPort } from "../models/chargingport.model"; // chỉnh lại nếu tên model khác

export type PortKind = "ac" | "dc" | "dc_ultra";

export interface EstimateCostInput {
  portId: string;
  startAt: string | Date;
  endAt: string | Date;
  assumePowerKw?: number; // fallback nếu port chưa có công suất
}

export interface EstimateCostResult {
  portId: string;
  portType: "AC" | "DC" | "DC Ultra";
  durationHours: number;
  powerKwUsed: number; // công suất thực dùng trong tính toán
  bookingRatePerHour: number; // VND/h
  energyPricePerKwh: number; // VND/kWh
  energyKwh: number;
  bookingCost: number; // VND
  energyCost: number; // VND
  total: number; // VND
  currency: "VND";
}

// Bảng giá đặt lịch theo giờ
const BOOKING_RATE: Record<PortKind, number> = {
  ac: 10000,
  dc: 15000,
  dc_ultra: 20000,
};

// Giá điện (VND/kWh)
const ENERGY_PRICE_VND_PER_KWH = 3858;

function normalizePortKind(raw: any): PortKind {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("ultra") || s.includes("hpc") || s.includes("ultrafast"))
    return "dc_ultra";
  if (s.includes("dc") || s.includes("csc") || s.includes("Ultra")) return "dc";
  return "ac";
}

function extractPortInfo(port: any, assumePowerKw?: number) {
  const typeSource =
    port?.type ??
    port?.connectorType ??
    port?.category ??
    port?.chargingType ??
    "ac";

  const kind = normalizePortKind(typeSource);

  // Cố gắng lấy công suất từ các field hay gặp; nếu không có => assumePowerKw => mặc định 1kW (khớp ví dụ)
  const rated =
    Number(port?.powerKw) ||
    Number(port?.ratedPowerKw) ||
    Number(port?.maxPowerKw) ||
    undefined;

  const powerKwUsed =
    typeof rated === "number" && !Number.isNaN(rated) && rated > 0
      ? rated
      : typeof assumePowerKw === "number" && assumePowerKw > 0
      ? assumePowerKw
      : 1;

  return { kind, powerKwUsed };
}

export async function estimateCost(
  input: EstimateCostInput
): Promise<EstimateCostResult> {
  const { portId, startAt, endAt, assumePowerKw } = input;

  if (!Types.ObjectId.isValid(portId)) {
    const e: any = new Error("portId is not a valid ObjectId");
    e.status = 400;
    throw e;
  }

  const start = new Date(startAt as any);
  const end = new Date(endAt as any);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const e: any = new Error("startAt or endAt is invalid datetime");
    e.status = 400;
    throw e;
  }
  if (end <= start) {
    const e: any = new Error("endAt must be later than startAt");
    e.status = 400;
    throw e;
  }

  const port = await ChargingPort.findById(portId).lean();
  if (!port) {
    const e: any = new Error("Charging port not found");
    e.status = 404;
    throw e;
  }

  const { kind, powerKwUsed } = extractPortInfo(port, assumePowerKw);
  const durationHours = (end.getTime() - start.getTime()) / 3600000; // ms -> h

  const bookingRatePerHour = BOOKING_RATE[kind];
  const energyPricePerKwh = ENERGY_PRICE_VND_PER_KWH;

  const energyKwh = powerKwUsed * durationHours;
  const bookingCost = bookingRatePerHour * durationHours;
  const energyCost = energyPricePerKwh * energyKwh;

  const bookingCostVnd = Math.round(bookingCost);
  const energyCostVnd = Math.round(energyCost);
  const totalVnd = bookingCostVnd + energyCostVnd;

  return {
    portId,
    portType: kind === "ac" ? "AC" : kind === "dc" ? "DC" : "DC Ultra",
    durationHours: Number(durationHours.toFixed(4)),
    powerKwUsed: Number(powerKwUsed.toFixed(4)),
    bookingRatePerHour,
    energyPricePerKwh,
    energyKwh: Number(energyKwh.toFixed(4)),
    bookingCost: bookingCostVnd,
    energyCost: energyCostVnd,
    total: totalVnd,
    currency: "VND",
  };
}
