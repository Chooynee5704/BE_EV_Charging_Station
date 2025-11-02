import { Router } from "express";
import {
  // Stations
  createChargingStationController,
  listChargingStationsController,
  getChargingStationByIdController,
  updateChargingStationController,
  deleteChargingStationController, // soft delete
  // Ports (refactored)
  createPortController,
  getPortByIdController,
  updatePortController,
  deletePortController,
  // Slots (refactored)
  listSlotsByPortController,
  getSlotByIdController,
  addSlotToPortController,
  updateSlotController,
  deleteSlotController,
} from "../controllers/chargingstation.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router(); // mounted at app.use("/stations", router)

/**
 * @swagger
 * tags:
 *   - name: ChargingStations
 *     description: CRUD for EV charging stations
 *   - name: ChargingPorts
 *     description: CRUD for EV charging ports (stationId only needed on create)
 *   - name: ChargingSlots
 *     description: CRUD for slots (portId for collection, slotId for item ops)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ChargingPortCreate:
 *       type: object
 *       required: [type, powerKw, speed, price]
 *       properties:
 *         type: { type: string, enum: [DC, Ultra, AC] }
 *         status: { type: string, enum: [available, in_use], default: available }
 *         powerKw: { type: number, example: 60 }
 *         speed: { type: string, enum: [fast, slow, super_fast] }
 *         price: { type: number, example: 3500 }
 *     ChargingPortCreateWithStation:
 *       allOf:
 *         - $ref: '#/components/schemas/ChargingPortCreate'
 *         - type: object
 *           required: [stationId]
 *           properties:
 *             stationId:
 *               type: string
 *               description: Station to attach this port to.
 *     ChargingPortUpdate:
 *       type: object
 *       properties:
 *         type: { type: string, enum: [DC, Ultra, AC] }
 *         status: { type: string, enum: [available, in_use] }
 *         powerKw: { type: number }
 *         speed: { type: string, enum: [fast, slow, super_fast] }
 *         price: { type: number }
 *     ChargingSlotCreate:
 *       type: object
 *       properties:
 *         order:
 *           type: integer
 *           minimum: 1
 *           description: Slot order within the port (unique per port). If omitted, next order is auto-assigned.
 *           example: 1
 *         status:
 *           type: string
 *           enum: [available, booked, in_use]
 *           default: available
 *         nextAvailableAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: If status is 'available', this is forced to null.
 *     ChargingSlotUpdate:
 *       type: object
 *       properties:
 *         order: { type: integer, minimum: 1 }
 *         status: { type: string, enum: [available, booked, in_use] }
 *         nextAvailableAt: { type: string, format: date-time, nullable: true }
 */

/* ======================== Station routes (RELATIVE) ======================== */

/**
 * @swagger
 * /stations:
 *   post:
 *     tags: [ChargingStations]
 *     summary: Create charging station (with optional ports)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, longitude, latitude]
 *             properties:
 *               name: { type: string, example: "Station A" }
 *               longitude: { type: number, example: 106.700981 }
 *               latitude: { type: number, example: 10.776889 }
 *               status: { type: string, enum: [active, inactive, maintenance], example: active }
 *               address: { type: string, example: "01 Nguyễn Huệ, Q1, TP.HCM" }
 *               provider: { type: string, example: "VinFast" }
 *               ports:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ChargingPortCreate'
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  createChargingStationController
);

/**
 * @swagger
 * /stations:
 *   get:
 *     tags: [ChargingStations]
 *     summary: List charging stations (filter/pagination, ports populated by default) - Public access
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, maintenance] }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: address
 *         schema: { type: string }
 *       - in: query
 *         name: provider
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 120 }
 *       - in: query
 *         name: includePorts
 *         schema: { type: boolean, example: true }
 *     responses:
 *       200: { description: OK }
 */
router.get(
  "/",
  listChargingStationsController
);

/**
 * @swagger
 * /stations/{id}:
 *   get:
 *     tags: [ChargingStations]
 *     summary: Get charging station by id (ports populated by default) - Public access
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includePorts
 *         schema: { type: boolean, example: true }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.get(
  "/:id",
  getChargingStationByIdController
);

/**
 * @swagger
 * /stations/{id}:
 *   put:
 *     tags: [ChargingStations]
 *     summary: Update charging station + sync ports
 *     description: |
 *       - Send `ports` with items that include `id` to update existing ports, and items without `id` to create new.
 *       - By default, ports not included will be **deleted** (`removeMissingPorts=true`). Set `removeMissingPorts=false` to keep them.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               longitude: { type: number }
 *               latitude: { type: number }
 *               status: { type: string, enum: [active, inactive, maintenance] }
 *               address: { type: string }
 *               provider: { type: string }
 *               ports:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ChargingPortCreate'
 *               removeMissingPorts: { type: boolean, default: true }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  updateChargingStationController
);

/**
 * @swagger
 * /stations/{id}:
 *   delete:
 *     tags: [ChargingStations]
 *     summary: Soft delete a charging station (mark as inactive)
 *     description: Set `status = inactive`. Data is kept; ports remain unchanged.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Marked as inactive }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteChargingStationController
);

/* ======================== Port routes (RELATIVE) ======================== */

/**
 * @swagger
 * /stations/ports:
 *   post:
 *     tags: [ChargingPorts]
 *     summary: Create a charging port (attach to station)
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChargingPortCreateWithStation'
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Station not found }
 */
router.post(
  "/ports",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  createPortController
);

/**
 * @swagger
 * /stations/ports/{portId}:
 *   get:
 *     tags: [ChargingPorts]
 *     summary: Get a specific charging port - Public access
 *     parameters:
 *       - in: path
 *         name: portId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.get(
  "/ports/:portId",
  getPortByIdController
);

/**
 * @swagger
 * /stations/ports/{portId}:
 *   put:
 *     tags: [ChargingPorts]
 *     summary: Update a specific charging port
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: portId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChargingPortUpdate'
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Port not found }
 */
router.put(
  "/ports/:portId",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  updatePortController
);

/**
 * @swagger
 * /stations/ports/{portId}:
 *   delete:
 *     tags: [ChargingPorts]
 *     summary: Delete a specific charging port
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: portId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       404: { description: Port not found }
 */
router.delete(
  "/ports/:portId",
  authenticateToken,
  authorizeRoles("admin"),
  deletePortController
);

/* ======================== Slot routes (RELATIVE) ======================== */

/**
 * @swagger
 * /stations/ports/{portId}/slots:
 *   get:
 *     tags: [ChargingSlots]
 *     summary: List charging slots for a specific port
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: portId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       404: { description: Port not found }
 */
router.get(
  "/ports/:portId/slots",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  listSlotsByPortController
);

/**
 * @swagger
 * /stations/slots/{slotId}:
 *   get:
 *     tags: [ChargingSlots]
 *     summary: Get a specific charging slot by id
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       404: { description: Slot not found }
 */
router.get(
  "/slots/:slotId",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  getSlotByIdController
);

/**
 * @swagger
 * /stations/ports/{portId}/slots:
 *   post:
 *     tags: [ChargingSlots]
 *     summary: Create a charging slot in a port
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: portId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChargingSlotCreate'
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Port not found }
 *       409: { description: Conflict — slot order already exists }
 */
router.post(
  "/ports/:portId/slots",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  addSlotToPortController
);

/**
 * @swagger
 * /stations/slots/{slotId}:
 *   put:
 *     tags: [ChargingSlots]
 *     summary: Update a specific charging slot
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChargingSlotUpdate'
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Slot not found }
 *       409: { description: Conflict — slot order already exists }
 */
router.put(
  "/slots/:slotId",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  updateSlotController
);

/**
 * @swagger
 * /stations/slots/{slotId}:
 *   delete:
 *     tags: [ChargingSlots]
 *     summary: Delete a specific charging slot
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       404: { description: Slot not found }
 */
router.delete(
  "/slots/:slotId",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  deleteSlotController
);

// 👉 Fix: export cả default lẫn named để mọi cấu hình TS đều ok
export { router as stationRoutes };
export default router;
