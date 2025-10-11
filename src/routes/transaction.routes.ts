import { Router } from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";
import {
  createTransactionController,
  getTransactionByIdController,
  getTransactionsController,
  getMyTransactionHistoryController,
  getMyTransactionStatsController,
  getUserStatsController,
  getTransactionReportController,
  getMyTransactionReportController,
} from "../controllers/transaction.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Quản lý giao dịch
 */

/**
 * @swagger
 * /transactions/my-history:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy lịch sử giao dịch của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, success, failed, cancelled, refunded]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [vnpay, cash, other]
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lấy lịch sử giao dịch thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/my-history", authenticateToken, getMyTransactionHistoryController);

/**
 * @swagger
 * /transactions/my-stats:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy thống kê giao dịch của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/my-stats", authenticateToken, getMyTransactionStatsController);

/**
 * @swagger
 * /transactions/my-report:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy báo cáo giao dịch chi tiết của user hiện tại (dạng bảng)
 *     description: |
 *       Trả về bảng giao dịch với đầy đủ thông tin:
 *       - Ngày giao dịch
 *       - Tên người dùng
 *       - Số tiền
 *       - Phương thức thanh toán
 *       - Trạng thái
 *       - Lý do thất bại (nếu có)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, success, failed, cancelled, refunded]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [vnpay, cash, other]
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lấy báo cáo thành công
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       transactionId:
 *                         type: string
 *                       transactionDate:
 *                         type: string
 *                         format: date-time
 *                       userName:
 *                         type: string
 *                       userEmail:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       currency:
 *                         type: string
 *                       paymentMethod:
 *                         type: string
 *                       status:
 *                         type: string
 *                       description:
 *                         type: string
 *                       failureReason:
 *                         type: string
 *                       vnpayTransactionNo:
 *                         type: string
 *                       bankCode:
 *                         type: string
 *                       cardType:
 *                         type: string
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/my-report", authenticateToken, getMyTransactionReportController);

/**
 * @swagger
 * /transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy danh sách giao dịch (admin/staff xem tất cả, user xem của mình)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Chỉ admin/staff mới có thể lọc theo userId
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 */
router.get("/", authenticateToken, getTransactionsController);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy chi tiết giao dịch theo ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *       404:
 *         description: Không tìm thấy giao dịch
 */
router.get("/:id", authenticateToken, getTransactionByIdController);

/**
 * @swagger
 * /transactions:
 *   post:
 *     tags: [Transactions]
 *     summary: Tạo giao dịch mới (admin/staff only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *               - paymentMethod
 *             properties:
 *               userId:
 *                 type: string
 *               reservationId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: VND
 *               status:
 *                 type: string
 *                 enum: [pending, processing, success, failed, cancelled, refunded]
 *               paymentMethod:
 *                 type: string
 *                 enum: [vnpay, cash, other]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo giao dịch thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  createTransactionController
);

/**
 * @swagger
 * /transactions/stats/{userId}:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy thống kê giao dịch của user bất kỳ (admin/staff only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *       404:
 *         description: Không tìm thấy user
 */
router.get(
  "/stats/:userId",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  getUserStatsController
);

/**
 * @swagger
 * /transactions/report:
 *   get:
 *     tags: [Transactions]
 *     summary: Lấy báo cáo giao dịch chi tiết dạng bảng (admin/staff only)
 *     description: |
 *       Trả về bảng giao dịch với đầy đủ thông tin:
 *       - Ngày giao dịch
 *       - Tên người dùng + Email
 *       - Số tiền
 *       - Phương thức thanh toán
 *       - Trạng thái (success/failed/cancelled/pending)
 *       - Lý do thất bại (nếu có)
 *       - Mã giao dịch VNPay, ngân hàng, loại thẻ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo user ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái (có thể dùng dấu phẩy để lọc nhiều, vd success,failed)
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [vnpay, cash, other]
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lấy báo cáo thành công
 *       403:
 *         description: Không có quyền truy cập
 */
router.get(
  "/report",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  getTransactionReportController
);

export default router;
