import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { estimateCostController } from "../controllers/pricing.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Pricing
 *     description: Tính chi phí đặt lịch và tiền điện sạc theo cổng sạc
 *
 * components:
 *   schemas:
 *     PricingEstimateRequest:
 *       type: object
 *       required: [portId, startAt, endAt]
 *       properties:
 *         portId:
 *           type: string
 *           description: ID của cổng sạc
 *           example: "6701f5b1a7e5e7c8f0a12345"
 *         startAt:
 *           type: string
 *           format: date-time
 *           description: Thời điểm bắt đầu (ISO 8601, UTC)
 *           example: "2025-10-01T10:00:00Z"
 *         endAt:
 *           type: string
 *           format: date-time
 *           description: Thời điểm kết thúc (ISO 8601, UTC)
 *           example: "2025-10-01T12:00:00Z"
 *         assumePowerKw:
 *           type: number
 *           description: Công suất giả định (kW) nếu cổng sạc chưa có dữ liệu công suất. Mặc định 1 kW (để khớp ví dụ).
 *           example: 1
 *     PricingEstimateResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: "OK" }
 *         data:
 *           type: object
 *           properties:
 *             portId: { type: string }
 *             portType: { type: string, enum: [AC, DC, "DC Ultra"] }
 *             durationHours: { type: number, example: 2 }
 *             powerKwUsed: { type: number, example: 1 }
 *             bookingRatePerHour: { type: number, example: 10000 }
 *             energyPricePerKwh: { type: number, example: 3858 }
 *             energyKwh: { type: number, example: 2 }
 *             bookingCost: { type: number, example: 20000 }
 *             energyCost: { type: number, example: 7716 }
 *             total: { type: number, example: 27716 }
 *             currency: { type: string, example: "VND" }
 */

/**
 * @swagger
 * /pricing/estimate:
 *   post:
 *     tags: [Pricing]
 *     summary: Tính chi phí đặt lịch + tiền điện theo cổng sạc
 *     description: |
 *       - Đặt lịch (VND/h): **AC=10.000**, **DC=15.000**, **DC Ultra=20.000**  
 *       - Đơn giá điện: **3.858 VND/kWh**  
 *       - Năng lượng = `công suất (kW)` × `số giờ`. Nếu không có công suất trên cổng sạc và bạn không truyền `assumePowerKw`, hệ thống mặc định **1 kW** (để khớp ví dụ).
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PricingEstimateRequest' }
 *           example:
 *             portId: "6701f5b1a7e5e7c8f0a12345"
 *             startAt: "2025-10-01T10:00:00Z"
 *             endAt: "2025-10-01T12:00:00Z"
 *             assumePowerKw: 1
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PricingEstimateResponse' }
 *       400: { description: InvalidInput }
 *       401: { description: Unauthorized }
 *       404: { description: NotFound }
 */
router.post(
  "/estimate",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  estimateCostController
);

export default router;
