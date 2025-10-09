// src/routes/vnpay.routes.ts
import { Router } from "express";
import {
  createVnpayCheckoutUrlController,
  vnpayReturnController,
  vnpayIpnController,
} from "../controllers/vnpay.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: VNPay
 *     description: Tích hợp cổng thanh toán VNPay
 */

/**
 * @swagger
 * /vnpay/checkout-url:
 *   post:
 *     tags: [VNPay]
 *     summary: Tạo URL thanh toán VNPay (signed)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, orderInfo]
 *             properties:
 *               amount: { type: number, example: 27716, description: "Số tiền VND (sẽ *100 khi gửi lên VNPay)" }
 *               orderInfo: { type: string, example: "Thanh toan dat lich/hoa don #123" }
 *               orderId: { type: string, example: "ORDER-123" }
 *               bankCode: { type: string, example: "VNBANK" }
 *               locale: { type: string, enum: [vn, en], example: vn }
 *               orderType: { type: string, example: other }
 *     responses:
 *       200: { description: OK }
 *       400: { description: InvalidInput }
 */
router.post(
  "/checkout-url",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  createVnpayCheckoutUrlController
);

/**
 * @swagger
 * /vnpay/return:
 *   get:
 *     tags: [VNPay]
 *     summary: Return URL (client redirect) từ VNPay
 *     description: VNPay sẽ redirect người dùng về URL này, kèm tham số ký số. Server xác minh chữ ký và trả JSON demo.
 *     responses:
 *       200: { description: OK }
 */
router.get("/return", vnpayReturnController);

/**
 * @swagger
 * /vnpay/ipn:
 *   get:
 *     tags: [VNPay]
 *     summary: IPN (server-to-server) từ VNPay
 *     description: VNPay sẽ gọi URL này (không cần auth). Server xác minh chữ ký và phản hồi JSON với RspCode/Message.
 *     responses:
 *       200: { description: OK }
 */
router.get("/ipn", vnpayIpnController);

export default router;
