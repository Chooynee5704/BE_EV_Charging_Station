import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { startChargingController, streamChargingProgressController, stopChargingController, listMyChargingSessionsController, listChargingSessionsByVehicleController } from "../controllers/charging.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Charging
 *     description: Start/stop charging and stream progress
 */

/**
 * @swagger
 * /charging/sessions:
 *   get:
 *     tags: [Charging]
 *     summary: Get all charging sessions for logged-in user
 *     description: |
 *       Returns all charging sessions for vehicles owned by the logged-in user.
 *       Supports pagination and filtering by status.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter by session status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "OK" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           vehicle: { type: object }
 *                           slot: { type: object }
 *                           startedAt: { type: string, format: date-time }
 *                           endedAt: { type: string, format: date-time, nullable: true }
 *                           initialPercent: { type: number }
 *                           targetPercent: { type: number, nullable: true }
 *                           chargeRatePercentPerMinute: { type: number }
 *                           status: { type: string, enum: [active, completed, cancelled] }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         total: { type: integer }
 *                         pages: { type: integer }
 *       401: { description: Unauthorized }
 *       400: { description: InvalidInput }
 */
router.get(
  "/sessions",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  listMyChargingSessionsController
);

/**
 * @swagger
 * /charging/sessions/{vehicleId}:
 *   get:
 *     tags: [Charging]
 *     summary: Get all charging sessions for a specific vehicle
 *     description: |
 *       Returns all charging sessions for a specific vehicle by vehicle ID.
 *       Supports pagination and filtering by status.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Vehicle ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter by session status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "OK" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           vehicle: { type: object }
 *                           slot: { type: object }
 *                           startedAt: { type: string, format: date-time }
 *                           endedAt: { type: string, format: date-time, nullable: true }
 *                           initialPercent: { type: number }
 *                           targetPercent: { type: number, nullable: true }
 *                           chargeRatePercentPerMinute: { type: number }
 *                           status: { type: string, enum: [active, completed, cancelled] }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         total: { type: integer }
 *                         pages: { type: integer }
 *       400: { description: InvalidInput }
 *       401: { description: Unauthorized }
 *       404: { description: Vehicle not found }
 */
router.get(
  "/sessions/:vehicleId",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  listChargingSessionsByVehicleController
);

/**
 * @swagger
 * /charging/start:
 *   post:
 *     tags: [Charging]
 *     summary: Start a new charging session
 *     description: |
 *       Starts charging for a vehicle. The initial battery percentage is taken from the vehicle's current pin.
 *       The vehicle's pin will be updated in real-time during charging and saved when the session stops.
 *       
 *       **Slot Status:**
 *       - Allows slots with status "available", "booked", or "in_use"
 *       - Only rejects "inactive" slots
 *       - "in_use" status is typically set when a reservation is created
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId, slotId]
 *             properties:
 *               vehicleId: 
 *                 type: string
 *                 description: ID of the vehicle to charge
 *               slotId: 
 *                 type: string
 *                 description: ID of the charging slot
 *               targetPercent: 
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Target battery percentage (optional, defaults to 100%)
 *               chargeRatePercentPerMinute: 
 *                 type: number
 *                 example: 1.0
 *                 description: Charging rate in percent per minute (optional, defaults to 1.0)
 *     responses:
 *       201: { description: Created }
 *       400: { description: InvalidInput or Slot is inactive }
 *       401: { description: Unauthorized }
 *       404: { description: NotFound }
 */
router.post(
  "/start",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  startChargingController
);

/**
 * @swagger
 * /charging/sessions/{id}/stream:
 *   get:
 *     tags: [Charging]
 *     summary: Stream charging percent progress via SSE
 *     description: |
 *       Streams real-time charging progress using Server-Sent Events (SSE).
 *       Updates the vehicle's pin in real-time as charging progresses.
 *       Returns current battery percentage, target, and charging status every 2 seconds.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Charging session ID
 *     responses:
 *       200: 
 *         description: OK (SSE stream)
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId: { type: string }
 *                 vehicleId: { type: string }
 *                 percent: { type: number, description: "Current battery percentage (0-100)" }
 *                 finished: { type: boolean }
 *                 target: { type: number }
 *                 ratePercentPerMinute: { type: number }
 *                 startedAt: { type: string, format: date-time }
 *                 endedAt: { type: string, format: date-time, nullable: true }
 *                 status: { type: string, enum: [active, completed, cancelled] }
 *       401: { description: Unauthorized }
 *       404: { description: NotFound }
 */
router.get(
  "/sessions/:id/stream",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  streamChargingProgressController
);

/**
 * @swagger
 * /charging/sessions/{id}/stop:
 *   post:
 *     tags: [Charging]
 *     summary: Stop a charging session (completed or cancelled)
 *     description: |
 *       Stops an active charging session and updates the vehicle's pin to the final battery percentage.
 *       Can mark the session as either completed or cancelled.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Charging session ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: 
 *                 type: string
 *                 enum: [completed, cancelled]
 *                 description: Session end status (defaults to 'completed')
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       404: { description: NotFound }
 */
router.post(
  "/sessions/:id/stop",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  stopChargingController
);

export default router;


