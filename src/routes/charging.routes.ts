import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { startChargingController, streamChargingProgressController, stopChargingController } from "../controllers/charging.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Charging
 *     description: Start/stop charging and stream progress
 */

/**
 * @swagger
 * /charging/start:
 *   post:
 *     tags: [Charging]
 *     summary: Start a new charging session
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId, slotId, initialPercent]
 *             properties:
 *               vehicleId: { type: string }
 *               slotId: { type: string }
 *               initialPercent: { type: number, minimum: 0, maximum: 100 }
 *               targetPercent: { type: number, minimum: 1, maximum: 100 }
 *               chargeRatePercentPerMinute: { type: number, example: 1.0 }
 *     responses:
 *       201: { description: Created }
 *       400: { description: InvalidInput }
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
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK (SSE stream) }
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
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [completed, cancelled] }
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


