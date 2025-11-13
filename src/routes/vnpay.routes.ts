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
 *     summary: Tạo URL thanh toán VNPay cho phiên sạc xe
 *     description: |
 *       Tạo URL thanh toán VNPay cho các phiên sạc đã hoàn thành. 
 *       
 *       **Quy trình:**
 *       1. Nhập vehicleId
 *       2. Hệ thống tìm tất cả phiên sạc status="completed" của xe
 *       3. Tính tổng thời gian (phút) và giá dựa trên loại cổng sạc
 *       4. Tạo URL thanh toán VNPay
 *       
 *       **Cách tính giá:**
 *       - Base price: AC=10.000đ, DC=15.000đ, DC Ultra=20.000đ (fixed)
 *       - Energy cost: durationHours × energyKwh × 3.858 VND/kWh
 *       - Energy kWh: powerKw × durationHours (using actual port power)
 *       - Total = Base price + Energy cost
 *       
 *       User sẽ được redirect đến trang VNPay để chọn phương thức thanh toán.
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
 *                 example: "60d5ec49f1b2c72b8c8e4f1a"
 *                 description: "ID của xe cần thanh toán phiên sạc"
 *               locale:
 *                 type: string
 *                 enum: [vn, en]
 *                 example: vn
 *                 description: "Ngôn ngữ hiển thị trên VNPay (mặc định: vn)"
 *               orderType:
 *                 type: string
 *                 example: "other"
 *                 description: "Loại đơn hàng (optional)"
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
 *                     params:
 *                       type: object
 *                       description: Các tham số VNPay
 *                     pricingDetails:
 *                       type: object
 *                       properties:
 *                         totalSessions:
 *                           type: number
 *                           description: Số phiên sạc cần thanh toán
 *                         totalMinutes:
 *                           type: number
 *                           description: Tổng thời gian (phút)
 *                         durationHours:
 *                           type: number
 *                           description: Tổng thời gian (giờ)
 *                         portType:
 *                           type: string
 *                           enum: [ac, dc, dc_ultra]
 *                         powerKw:
 *                           type: number
 *                           description: Công suất thực tế của cổng sạc (kW)
 *                         bookingBasePrice:
 *                           type: number
 *                           description: Giá cố định theo loại cổng
 *                         energyKwh:
 *                           type: number
 *                           description: Năng lượng tiêu thụ (kWh)
 *                         bookingCost:
 *                           type: number
 *                           description: Chi phí đặt lịch (fixed)
 *                         energyCost:
 *                           type: number
 *                           description: Chi phí năng lượng
 *                         total:
 *                           type: number
 *                           description: Tổng cộng (VND)
 *                         currency:
 *                           type: string
 *                           example: VND
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc không có phiên sạc completed
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Xe không thuộc sở hữu của bạn
 *       404:
 *         description: Không tìm thấy xe
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
 *     summary: Kiểm tra và cập nhật trạng thái thanh toán phiên sạc
 *     description: |
 *       API để kiểm tra trạng thái thanh toán cho xe và cập nhật phiên sạc.
 *       
 *       **Quy trình:**
 *       1. Kiểm tra giao dịch thanh toán mới nhất của vehicleId
 *       2. Xác thực chữ ký VNPay từ các tham số callback
 *       3. Nếu status = "success":
 *          - Tìm tất cả phiên sạc status="completed" của xe
 *          - Cập nhật status thành "success"
 *          - Cập nhật slot status về "available"
 *       4. Trả về kết quả chi tiết
 *       
 *       **Sử dụng:** Gọi API này với vehicleId và các tham số VNPay callback sau khi user quay lại từ VNPay.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId, vnp_TxnRef, vnp_SecureHash]
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 description: ID của xe cần kiểm tra thanh toán
 *                 example: "60d5ec49f1b2c72b8c8e4f1a"
 *               reservationId:
 *                 type: string
 *                 description: ID của reservation (optional) - nếu có sẽ cập nhật status thành "payment-success"
 *                 example: "60d5ec49f1b2c72b8c8e4f1b"
 *               vnp_Amount:
 *                 type: string
 *                 description: Số tiền thanh toán (VNĐ × 100)
 *                 example: "1816800"
 *               vnp_BankCode:
 *                 type: string
 *                 description: Mã ngân hàng
 *                 example: "NCB"
 *               vnp_BankTranNo:
 *                 type: string
 *                 description: Mã giao dịch ngân hàng
 *                 example: "VNP15252785"
 *               vnp_CardType:
 *                 type: string
 *                 description: Loại thẻ
 *                 example: "ATM"
 *               vnp_OrderInfo:
 *                 type: string
 *                 description: Thông tin đơn hàng
 *                 example: "Thanh toan 28 phien sac - Xe 25H-HG154"
 *               vnp_PayDate:
 *                 type: string
 *                 description: Thời gian thanh toán (yyyyMMddHHmmss)
 *                 example: "20251111141447"
 *               vnp_ResponseCode:
 *                 type: string
 *                 description: Mã phản hồi (00 = thành công)
 *                 example: "00"
 *               vnp_TmnCode:
 *                 type: string
 *                 description: Mã website của merchant
 *                 example: "KNEEJVLV"
 *               vnp_TransactionNo:
 *                 type: string
 *                 description: Mã giao dịch VNPay
 *                 example: "15252785"
 *               vnp_TransactionStatus:
 *                 type: string
 *                 description: Trạng thái giao dịch (00 = thành công)
 *                 example: "00"
 *               vnp_TxnRef:
 *                 type: string
 *                 description: Mã tham chiếu giao dịch
 *                 example: "CHARGE-6912c50319693ba338c1fd14-1762845266362"
 *               vnp_SecureHash:
 *                 type: string
 *                 description: Chữ ký bảo mật (SHA512)
 *                 example: "91c0869aa912916ef3941c8eec428893068f05f93396c21f13896bf9d3bd429239d9efbf4e433c5f555ed63841a6d54cffb88dd50d7639c24b9f6f0a38ab2548"
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
 *                   example: "Thanh toán thành công và đã cập nhật trạng thái"
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentStatus:
 *                       type: string
 *                       example: "success"
 *                     transactionId:
 *                       type: string
 *                       description: ID giao dịch
 *                     amount:
 *                       type: number
 *                       description: Số tiền đã thanh toán
 *                     currency:
 *                       type: string
 *                       example: "VND"
 *                     updatedSessions:
 *                       type: number
 *                       description: Số phiên sạc đã cập nhật
 *                     updatedSlots:
 *                       type: number
 *                       description: Số slot đã cập nhật
 *                     sessionIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Danh sách ID phiên sạc đã cập nhật
 *                     slotIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Danh sách ID slot đã cập nhật
 *                     reservationUpdated:
 *                       type: boolean
 *                       description: Có cập nhật reservation hay không
 *                     reservationId:
 *                       type: string
 *                       description: ID của reservation đã cập nhật (nếu có)
 *                     vnpayInfo:
 *                       type: object
 *                       properties:
 *                         responseCode:
 *                           type: string
 *                           description: Mã phản hồi VNPay
 *                         transactionNo:
 *                           type: string
 *                           description: Mã giao dịch VNPay
 *                         bankCode:
 *                           type: string
 *                           description: Mã ngân hàng
 *                         cardType:
 *                           type: string
 *                           description: Loại thẻ
 *                         payDate:
 *                           type: string
 *                           description: Ngày thanh toán
 *       400:
 *         description: vehicleId không hợp lệ hoặc thiếu tham số VNPay hoặc chữ ký không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Xe không thuộc sở hữu của bạn
 *       404:
 *         description: Không tìm thấy xe hoặc giao dịch
 */
router.post("/check-payment-status", authenticateToken, authorizeRoles("admin", "staff", "user"), checkPaymentStatusController);

/**
 * @swagger
 * /vnpay/return:
 *   get:
 *     tags: [VNPay]
 *     summary: Return URL (client redirect) từ VNPay
 *     description: |
 *       VNPay sẽ redirect người dùng về URL này, kèm tham số ký số. 
 *       Server xác minh chữ ký và redirect về frontend:
 *       - Thành công: http://localhost:5173/payment-success
 *       - Hủy: http://localhost:5173/payment-cancelled  
 *       - Thất bại: http://localhost:5173/payment-failed
 *     responses:
 *       302: 
 *         description: Redirect về frontend tương ứng với trạng thái thanh toán
 *         headers:
 *           Location:
 *             description: URL redirect
 *             schema:
 *               type: string
 *               example: "http://localhost:5173/payment-success"
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
