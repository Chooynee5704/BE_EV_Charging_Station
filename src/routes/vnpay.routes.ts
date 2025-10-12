// src/routes/vnpay.routes.ts
import { Router } from "express";
import {
  createVnpayCheckoutUrlController,
  vnpayReturnController,
  vnpayIpnController,
  checkPaymentStatusController,
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
 *     summary: Tạo URL thanh toán VNPay (User chọn ngân hàng trên VNPay)
 *     description: |
 *       Tạo URL thanh toán VNPay. User sẽ được redirect đến trang VNPay 
 *       để chọn ngân hàng và phương thức thanh toán.
 *       
 *       **Các ngân hàng/phương thức có sẵn trên VNPay:**
 *       - ATM Card (Thẻ nội địa)
 *       - Internet Banking
 *       - Ví điện tử VNPay
 *       - QR Code
 *       - Visa/Mastercard/JCB
 *       
 *       User sẽ tự chọn trên trang VNPay, không cần chọn trước.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, orderInfo]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 27716
 *                 description: "Số tiền VND (sẽ *100 khi gửi lên VNPay)"
 *               orderInfo:
 *                 type: string
 *                 example: "Thanh toan dat lich/hoa don #123"
 *                 description: "Thông tin đơn hàng hiển thị trên VNPay"
 *               reservationId:
 *                 type: string
 *                 example: "60d5ec49f1b2c72b8c8e4f1a"
 *                 description: "ID của reservation - sẽ được dùng làm vnp_TxnRef"
 *               locale:
 *                 type: string
 *                 enum: [vn, en]
 *                 example: vn
 *                 description: "Ngôn ngữ hiển thị trên VNPay (mặc định: vn)"
 *     responses:
 *       200:
 *         description: Tạo URL thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentUrl:
 *                       type: string
 *                       description: URL để redirect user đến trang thanh toán VNPay
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
router.post(
  "/checkout-url",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  createVnpayCheckoutUrlController
);

/**
 * @swagger
 * /vnpay/check-payment-status:
 *   post:
 *     tags: [VNPay]
 *     summary: Kiểm tra trạng thái thanh toán từ VNPay return URL
 *     description: |
 *       API để kiểm tra trạng thái thanh toán dựa trên thông tin từ VNPay return URL.
 *       Trả về trạng thái rõ ràng: success, failed, cancelled.
 *       Tự động cập nhật transaction và reservation status.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reservationId:
 *                 type: string
 *                 description: ID của reservation cần cập nhật (optional)
 *                 example: "60d5ec49f1b2c72b8c8e4f1a"
 *               vnp_Amount:
 *                 type: string
 *                 example: "2771600"
 *               vnp_BankCode:
 *                 type: string
 *                 example: "NCB"
 *               vnp_BankTranNo:
 *                 type: string
 *               vnp_CardType:
 *                 type: string
 *                 example: "ATM"
 *               vnp_OrderInfo:
 *                 type: string
 *               vnp_PayDate:
 *                 type: string
 *                 example: "20251011172942"
 *               vnp_ResponseCode:
 *                 type: string
 *                 example: "00"
 *               vnp_TmnCode:
 *                 type: string
 *               vnp_TransactionNo:
 *                 type: string
 *                 example: "15199015"
 *               vnp_TransactionStatus:
 *                 type: string
 *                 example: "00"
 *               vnp_TxnRef:
 *                 type: string
 *                 example: "ORDER-121"
 *               vnp_SecureHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kiểm tra thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Giao dịch thành công"
 *                 paymentStatus:
 *                   type: string
 *                   enum: [success, failed, cancelled]
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     isSuccess:
 *                       type: boolean
 *                     vnpayInfo:
 *                       type: object
 *                     transaction:
 *                       type: object
 *                     reason:
 *                       type: string
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc chữ ký sai
 */
router.post("/check-payment-status", checkPaymentStatusController);

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
