import { Router } from "express";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";
import {
  createReservationController,
  listMyReservationsController,
  getReservationController,
  cancelReservationController,
  completeReservationController,
  qrCheckController,
  streamReservationInfoController,
} from "../controllers/reservation.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reservations
 *     description: Booking EV charging slots by time ranges (per vehicle)
 */

/**
 * @swagger
 * /reservations:
 *   post:
 *     tags: [Reservations]
 *     summary: Create a reservation for a vehicle (multiple slots, each with start/end)
 *     description: |
 *       Create a reservation **for a specific vehicle** with one or more slot/time ranges.
 *       - **vehicleId is required** and must belong to the current user (unless admin/staff).
 *       - **Generates a QR code** (base64) with hashed reservation ID for check-in verification.
 *       - The QR code contains: { reservationId, hash } where hash is HMAC-SHA256 of reservationId.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId, items]
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 description: Vehicle id (must belong to the current user unless admin/staff)
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: List of slot/time ranges to book
 *                 items:
 *                   type: object
 *                   required: [slotId, startAt, endAt]
 *                   properties:
 *                     slotId:
 *                       type: string
 *                       description: ChargingSlot id
 *                     startAt:
 *                       type: string
 *                       format: date-time
 *                       description: ISO 8601 UTC start time
 *                     endAt:
 *                       type: string
 *                       format: date-time
 *                       description: ISO 8601 UTC end time
 *               status:
 *                 type: string
 *                 description: Initial status (use "pending" unless business rules allow auto-confirm)
 *                 enum: [pending, confirmed]
 *           example:
 *             vehicleId: "66f2aaa0123456789abc0123"
 *             items:
 *               - slotId: "64f2abc0123456789abc0123"
 *                 startAt: "2025-10-01T10:00:00Z"
 *                 endAt: "2025-10-01T11:00:00Z"
 *               - slotId: "64f3def0123456789def0456"
 *                 startAt: "2025-10-02T09:00:00Z"
 *                 endAt: "2025-10-02T10:30:00Z"
 *             status: pending
 *     responses:
 *       201: 
 *         description: Reservation created with QR code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Reservation created" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     vehicle: { type: string }
 *                     items: { type: array }
 *                     status: { type: string, example: "pending" }
 *                     qrCheck: { type: boolean, example: false }
 *                     qr: { type: string, description: "Base64 QR code image (data:image/png;base64,...)" }
 *       400: { description: Invalid input }
 *       404: { description: Vehicle/Slot not found }
 *       409: { description: Time overlap conflict }
 *       500: { description: Server error }
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  createReservationController
);

/**
 * @swagger
 * /reservations:
 *   get:
 *     tags: [Reservations]
 *     summary: List my reservations (by my vehicles or a specific vehicle)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: vehicleId
 *         schema: { type: string }
 *         description: If provided, filter only this vehicle. Otherwise list all reservations for vehicles owned by the user.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, cancelled, completed] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: OK }
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  listMyReservationsController
);

/**
 * @swagger
 * /reservations/{id}:
 *   get:
 *     tags: [Reservations]
 *     summary: Get reservation by id
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Forbidden for non-owners }
 *       404: { description: NotFound }
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  getReservationController
);

/**
 * @swagger
 * /reservations/{id}/cancel:
 *   patch:
 *     tags: [Reservations]
 *     summary: Cancel a reservation (owner or admin/staff)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reservation cancelled }
 *       403: { description: Forbidden }
 *       404: { description: NotFound }
 *       400: { description: InvalidInput }
 */
router.patch(
  "/:id/cancel",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  cancelReservationController
);

/**
 * @swagger
 * /reservations/{id}/complete:
 *   patch:
 *     tags: [Reservations]
 *     summary: Complete a reservation (owner or admin/staff)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reservation completed }
 *       403: { description: Forbidden }
 *       404: { description: NotFound }
 *       400: { description: InvalidInput }
 */
router.patch(
  "/:id/complete",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  completeReservationController
);

/**
 * @swagger
 * /reservations/qr-check:
 *   post:
 *     tags: [Reservations]
 *     summary: Check-in reservation using QR code (Staff/Admin only)
 *     description: |
 *       Staff hoặc Admin scan QR code để check-in reservation.
 *       
 *       **Flow mới:**
 *       - QR code chứa { reservationId, hash } - hash được tạo bằng HMAC-SHA256 với HASH_PASSWORD_KEY
 *       - Hệ thống verify hash để đảm bảo QR code hợp lệ
 *       - Chỉ reservation có **status = "pending"** mới được check-in
 *       - Nếu qrCheck = false và status = pending → update status = "confirmed" và qrCheck = true
 *       - Nếu qrCheck = true → return "QR code đã được sử dụng"
 *       - Nếu status ≠ pending → return "Reservation có trạng thái {status}, không thể check-in"
 *       - Nếu hash không hợp lệ → return "QR code không hợp lệ"
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reservationId, hash]
 *             properties:
 *               reservationId:
 *                 type: string
 *                 description: ID của reservation cần check-in
 *                 example: "670abc123def456ghi789jkl"
 *               hash:
 *                 type: string
 *                 description: HMAC-SHA256 hash của reservationId (từ QR code)
 *                 example: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
 *     responses:
 *       200:
 *         description: Check-in thành công hoặc QR đã được sử dụng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Check-in thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservationId: { type: string }
 *                     status: { type: string, example: "confirmed" }
 *                     qrCheck: { type: boolean, example: true }
 *                     checkedAt: { type: string, format: date-time }
 *                     checkedBy:
 *                       type: object
 *                       properties:
 *                         userId: { type: string }
 *                         role: { type: string, example: "staff" }
 *       400:
 *         description: QR code không hợp lệ, reservation không phải pending, hoặc dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy reservation
 */
router.post(
  "/qr-check",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  qrCheckController
);

/**
 * @swagger
 * /reservations/{id}/stream:
 *   get:
 *     tags: [Reservations]
 *     summary: Stream reservation information in real-time (SSE)
 *     description: |
 *       Stream reservation details including:
 *       - Reservation status and QR check status
 *       - Vehicle information
 *       - All slot/time range items with port details
 *       - Total duration (minutes and hours)
 *       - Real-time status updates every 3 seconds
 *       
 *       **Events:**
 *       - `reservation_info`: Initial full reservation data
 *       - `status_update`: Status changes (status, qrCheck)
 *       - `stream_end`: Stream ended (when completed/cancelled/payment-success)
 *       
 *       Updates are sent every 1 second.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reservation ID
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400: { description: Invalid reservationId }
 *       403: { description: Forbidden - not your reservation }
 *       404: { description: Reservation not found }
 */
router.get(
  "/:id/stream",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  streamReservationInfoController
);

export default router;
