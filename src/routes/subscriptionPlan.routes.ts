import { Router } from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";
import {
  getAllSubscriptionPlansController,
  getSubscriptionPlanByIdController,
  createSubscriptionPlanController,
  updateSubscriptionPlanController,
  deleteSubscriptionPlanController,
} from "../controllers/subscriptionPlan.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: SubscriptionPlans
 *   description: Quản lý các gói subscription (Basic, Standard, Premium)
 */

/**
 * @swagger
 * /subscription-plans:
 *   get:
 *     tags: [SubscriptionPlans]
 *     summary: Lấy danh sách tất cả subscription plans
 *     description: Lấy danh sách các gói subscription có sẵn (Basic, Standard, Premium với các thời hạn khác nhau)
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 */
router.get("/", getAllSubscriptionPlansController);

/**
 * @swagger
 * /subscription-plans/{id}:
 *   get:
 *     tags: [SubscriptionPlans]
 *     summary: Lấy chi tiết subscription plan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy plan thành công
 *       404:
 *         description: Không tìm thấy
 */
router.get("/:id", getSubscriptionPlanByIdController);

/**
 * @swagger
 * /subscription-plans:
 *   post:
 *     tags: [SubscriptionPlans]
 *     summary: Tạo subscription plan mới (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - duration
 *               - durationDays
 *               - price
 *               - features
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Premium - 12 Tháng"
 *               type:
 *                 type: string
 *                 enum: [basic, standard, premium]
 *               duration:
 *                 type: string
 *                 enum: [1_month, 6_months, 12_months]
 *               durationDays:
 *                 type: number
 *                 example: 365
 *               price:
 *                 type: number
 *                 example: 2999000
 *               originalPrice:
 *                 type: number
 *                 example: 3588000
 *               features:
 *                 type: object
 *                 properties:
 *                   maxReservations:
 *                     type: number
 *                     example: -1
 *                   maxVehicles:
 *                     type: number
 *                     example: -1
 *                   prioritySupport:
 *                     type: boolean
 *                     example: true
 *                   discount:
 *                     type: number
 *                     example: 10
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               displayOrder:
 *                 type: number
 *     responses:
 *       201:
 *         description: Tạo plan thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  createSubscriptionPlanController
);

/**
 * @swagger
 * /subscription-plans/{id}:
 *   put:
 *     tags: [SubscriptionPlans]
 *     summary: Cập nhật subscription plan (admin only)
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
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               originalPrice:
 *                 type: number
 *               features:
 *                 type: object
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               displayOrder:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  updateSubscriptionPlanController
);

/**
 * @swagger
 * /subscription-plans/{id}:
 *   delete:
 *     tags: [SubscriptionPlans]
 *     summary: Xóa subscription plan (admin only)
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
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteSubscriptionPlanController
);

export default router;

