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
 *       201: { description: Reservation created }
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

export default router;
