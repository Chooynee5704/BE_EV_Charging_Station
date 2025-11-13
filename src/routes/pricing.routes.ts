import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { estimateCostController, streamPricingEstimationController } from "../controllers/pricing.controller";

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
 *           description: (Không còn sử dụng - công suất cố định 1 kW)
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
 *             bookingBasePrice: { type: number, example: 10000, description: "Giá cơ bản đặt lịch (fixed)" }
 *             energyPricePerKwh: { type: number, example: 3858 }
 *             energyKwh: { type: number, example: 2 }
 *             bookingCost: { type: number, example: 10000, description: "Chi phí đặt lịch (= bookingBasePrice)" }
 *             energyCost: { type: number, example: 7716, description: "Chi phí điện năng" }
 *             total: { type: number, example: 17716, description: "Tổng = bookingCost + energyCost" }
 *             currency: { type: string, example: "VND" }
 */

/**
 * @swagger
 * /pricing/estimate:
 *   post:
 *     tags: [Pricing]
 *     summary: Tính chi phí đặt lịch + tiền điện theo cổng sạc
 *     description: |
 *       - **Giá cơ bản đặt lịch (fixed)**: **AC=10.000 VND**, **DC=15.000 VND**, **DC Ultra=20.000 VND**  
 *       - **Đơn giá điện**: **3.858 VND/kWh**  
 *       - **Công suất**: Sử dụng công suất thực tế của cổng sạc (powerKw)
 *       - **Năng lượng**: `powerKw × số giờ`
 *       - **Chi phí đặt lịch**: Giá cơ bản (fixed, không nhân với số giờ)
 *       - **Chi phí điện năng**: `3.858 VND/kWh × (powerKw × số giờ)`
 *       - **Tổng chi phí**: `Giá cơ bản + Chi phí điện năng`
 *       
 *       **Tính giá giống với VNPay payment API**
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

/**
 * @swagger
 * /pricing/estimate-vehicle-stream:
 *   post:
 *     tags: [Pricing]
 *     summary: Stream tính giá cho tất cả phiên sạc đã hoàn thành của xe (SSE)
 *     description: |
 *       Tính giá **giống VNPay payment API** cho tất cả phiên sạc status="completed" của xe.
 *       
 *       **Công thức:**
 *       - **Giá cơ bản (1 lần)**: AC=10k, DC=15k, DC Ultra=20k
 *       - **Công suất**: Sử dụng powerKw thực tế của cổng sạc
 *       - **Tổng năng lượng**: `powerKw × tổng số giờ`
 *       - **Chi phí điện**: `3.858 VND/kWh × tổng năng lượng`
 *       - **Tổng**: `Giá cơ bản + Chi phí điện`
 *       
 *       **Events:**
 *       - `pricing_data`: Dữ liệu tính giá đầy đủ
 *       - `session_count_changed`: Phát hiện phiên sạc mới hoàn thành
 *       - `stream_end`: Kết thúc stream
 *       
 *       Updates are polled every 1 second.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId]
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 description: ID của xe cần tính giá
 *                 example: "6912be56c99fd251ccb17f84"
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400: { description: Không có phiên sạc completed hoặc input không hợp lệ }
 *       401: { description: Unauthorized }
 *       403: { description: Xe không thuộc sở hữu }
 *       404: { description: Không tìm thấy xe }
 */
router.post(
  "/estimate-vehicle-stream",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  streamPricingEstimationController
);

export default router;
