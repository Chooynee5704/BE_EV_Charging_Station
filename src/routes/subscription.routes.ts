import { Router } from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";
import {
  createSubscriptionController,
  upgradeSubscriptionController,
  getMySubscriptionsController,
  getCurrentActiveSubscriptionController,
  cancelSubscriptionController,
  getSubscriptionByIdController,
  getAllSubscriptionsController,
  activateSubscriptionController,
  updateSubscriptionController,
  deleteSubscriptionController,
} from "../controllers/subscription.controller";
import { 
  createSubscriptionPaymentController,
  checkSubscriptionPaymentStatusController 
} from "../controllers/subscriptionPayment.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Quản lý gói đăng ký (Basic, Standard, Premium)
 */

/**
 * @swagger
 * /subscriptions/my-subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Lấy danh sách subscriptions của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/my-subscriptions", authenticateToken, getMySubscriptionsController);

/**
 * @swagger
 * /subscriptions/current-active:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Lấy subscription đang hoạt động (current_active) của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy subscription thành công
 *       404:
 *         description: Không có subscription đang hoạt động
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/current-active", authenticateToken, getCurrentActiveSubscriptionController);

/**
 * @swagger
 * /subscriptions:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Tạo subscription mới cho user bằng planId (Admin only)
 *     description: |
 *       Admin tạo subscription mới cho user bằng cách chọn planId. 
 *       Status sẽ là "pending" cho đến khi thanh toán thành công.
 *       
 *       **Lấy danh sách plans:** GET /subscription-plans
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
 *               - planId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "60d5ec49f1b2c72b8c8e4f1a"
 *                 description: "ID của user cần tạo subscription"
 *               planId:
 *                 type: string
 *                 example: "670abc123def456"
 *                 description: "ID của subscription plan (lấy từ GET /subscription-plans)"
 *               autoRenew:
 *                 type: boolean
 *                 example: false
 *                 description: "Tự động gia hạn khi hết hạn"
 *               customPrice:
 *                 type: number
 *                 example: 150000
 *                 description: "Giá custom (optional)"
 *     responses:
 *       201:
 *         description: Tạo subscription thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền
 */
router.post("/", authenticateToken, authorizeRoles("admin"), createSubscriptionController);

/**
 * @swagger
 * /subscriptions/upgrade:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Nâng cấp subscription bằng planId (từ gói thấp lên gói cao hơn)
 *     description: |
 *       User nâng cấp subscription hiện tại bằng cách chọn planId mới.
 *       - Subscription cũ chuyển từ "current_active" -> "active"
 *       - Subscription mới tạo với status "pending"
 *       - Sau khi thanh toán thành công, subscription mới -> "current_active"
 *       
 *       **Lấy danh sách plans:** GET /subscription-plans
 *       
 *       **Điều kiện nâng cấp:**
 *       - Type cao hơn (basic -> standard -> premium)
 *       - Duration dài hơn (1_month -> 6_months -> 12_months)
 *       - Hoặc cả hai
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 example: "670abc123def456"
 *                 description: "ID của subscription plan mới (lấy từ GET /subscription-plans)"
 *     responses:
 *       201:
 *         description: Nâng cấp subscription thành công
 *       400:
 *         description: Gói mới không cao hơn gói hiện tại
 *       401:
 *         description: Chưa đăng nhập
 */
router.post("/upgrade", authenticateToken, upgradeSubscriptionController);

/**
 * @swagger
 * /subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Lấy tất cả subscriptions (Tất cả user đều có thể xem)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [basic, standard, premium]
 *       - in: query
 *         name: duration
 *         schema:
 *           type: string
 *           enum: [1_month, 6_months, 12_months]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [current_active, active, expired, cancelled, pending]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/", authenticateToken, getAllSubscriptionsController);

/**
 * @swagger
 * /subscriptions/{id}:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Lấy chi tiết subscription
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
 *         description: Lấy subscription thành công
 *       403:
 *         description: Không có quyền xem
 *       404:
 *         description: Không tìm thấy
 *   put:
 *     tags: [Subscriptions]
 *     summary: Cập nhật subscription (admin only)
 *     description: Admin cập nhật thông tin subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [current_active, active, expired, cancelled, pending]
 *               autoRenew:
 *                 type: boolean
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 *   delete:
 *     tags: [Subscriptions]
 *     summary: Xóa subscription (admin only)
 *     description: Admin xóa subscription (soft delete - chuyển về cancelled)
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
 *         description: Xóa thành công
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:id", authenticateToken, getSubscriptionByIdController);

/**
 * @swagger
 * /subscriptions/payment:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Tạo URL thanh toán VNPay cho subscription bằng planId
 *     description: |
 *       User chọn subscription plan và tạo payment URL.
 *       API sẽ tự động tạo subscription (status: pending) cho user và trả về payment URL + subscriptionId.
 *       
 *       **Flow:**
 *       1. User xem danh sách plans (GET /subscription-plans)
 *       2. User chọn plan và gọi API này với planId
 *       3. API tự động tạo subscription pending cho user
 *       4. API trả về URL thanh toán VNPay + subscriptionId
 *       5. User redirect đến VNPay để thanh toán
 *       6. Sau khi VNPay return, gọi check-payment-status với subscriptionId
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 example: "670abc123def456"
 *                 description: "ID của subscription plan (lấy từ GET /subscription-plans)"
 *               locale:
 *                 type: string
 *                 enum: [vn, en]
 *                 example: vn
 *     responses:
 *       200:
 *         description: Tạo URL thanh toán thành công
 *       400:
 *         description: Plan không hợp lệ hoặc không active
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy plan
 */
router.post("/payment", authenticateToken, createSubscriptionPaymentController);

/**
 * @swagger
 * /subscriptions/check-payment-status:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Kiểm tra trạng thái thanh toán subscription từ VNPay (Tất cả user)
 *     description: |
 *       Sau khi VNPay return, gọi API này với subscriptionId và VNPay return data
 *       để kiểm tra trạng thái thanh toán và activate subscription.
 *       
 *       **Bất kỳ authenticated user nào cũng có thể check payment nếu có subscriptionId.**
 *       
 *       **Flow:**
 *       1. User thanh toán xong, VNPay redirect về với query params
 *       2. Frontend gọi API này với subscriptionId + VNPay query params
 *       3. API verify signature, cập nhật transaction, activate subscription
 *       4. Trả về trạng thái chi tiết
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscriptionId
 *             properties:
 *               subscriptionId:
 *                 type: string
 *                 example: "670def789abc123"
 *                 description: "ID của subscription (lấy từ response payment API)"
 *               vnp_Amount:
 *                 type: string
 *                 example: "299900000"
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
 *                 example: "20251012100000"
 *               vnp_ResponseCode:
 *                 type: string
 *                 example: "00"
 *               vnp_TmnCode:
 *                 type: string
 *               vnp_TransactionNo:
 *                 type: string
 *               vnp_TransactionStatus:
 *                 type: string
 *                 example: "00"
 *               vnp_TxnRef:
 *                 type: string
 *               vnp_SecureHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kiểm tra thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc signature sai
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy subscription
 */
router.post("/check-payment-status", authenticateToken, checkSubscriptionPaymentStatusController);

/**
 * @swagger
 * /subscriptions/{id}/cancel:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Hủy subscription (vẫn dùng được đến hết thời hạn)
 *     description: |
 *       User có thể hủy subscription active của mình.
 *       
 *       **Sau khi cancel:**
 *       - Subscription vẫn giữ nguyên status (current_active/active)
 *       - User vẫn sử dụng được TẤT CẢ tính năng đến hết endDate
 *       - autoRenew tự động set thành false
 *       - Sau endDate, subscription sẽ chuyển sang "cancelled"
 *       
 *       **Chỉ cancel được subscription có status: active hoặc current_active**
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của subscription cần cancel
 *     responses:
 *       200:
 *         description: Hủy subscription thành công
 *       400:
 *         description: Subscription không ở trạng thái cho phép cancel
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.post("/:id/cancel", authenticateToken, cancelSubscriptionController);

/**
 * @swagger
 * /subscriptions/{id}/activate:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Kích hoạt subscription (admin only)
 *     description: Admin kích hoạt subscription sau khi xác nhận thanh toán
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
 *         description: Kích hoạt thành công
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.post(
  "/:id/activate",
  authenticateToken,
  authorizeRoles("admin"),
  activateSubscriptionController
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  updateSubscriptionController
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteSubscriptionController
);

export default router;

