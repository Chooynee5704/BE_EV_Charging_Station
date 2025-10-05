import { Router } from "express";
import {
  createVehicleController,
  listVehiclesController,
  listAllVehiclesController,
  getVehicleByIdController,
  updateVehicleController,
  deleteVehicleController,
} from "../controllers/vehicle.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Vehicles
 *     description: CRUD for user vehicles
 *
 * components:
 *   schemas:
 *     VehicleCreate:
 *       type: object
 *       required: [plateNumber]
 *       properties:
 *         owner:
 *           type: string
 *           description: User ID (ignored for role=user; server uses your userId)
 *         plateNumber: { type: string, example: "51H-123.45" }
 *         make: { type: string, example: "VinFast" }
 *         model: { type: string, example: "VF8" }
 *         year: { type: integer, example: 2023 }
 *         color: { type: string, example: "White" }
 *         vin: { type: string, example: "WVWAA71K08W201030" }
 *         type: { type: string, enum: [car, motorbike, scooter, truck, other], example: car }
 *         batteryCapacityKwh: { type: number, example: 82 }
 *         connectorType: { type: string, example: "CCS" }
 *         status: { type: string, enum: [active, inactive], example: active }
 *     VehicleUpdate:
 *       type: object
 *       properties:
 *         plateNumber: { type: string }
 *         make: { type: string }
 *         model: { type: string }
 *         year: { type: integer }
 *         color: { type: string }
 *         vin: { type: string, nullable: true }
 *         type: { type: string, enum: [car, motorbike, scooter, truck, other] }
 *         batteryCapacityKwh: { type: number, nullable: true }
 *         connectorType: { type: string }
 *         status: { type: string, enum: [active, inactive] }
 */

/**
 * @swagger
 * /vehicles:
 *   post:
 *     tags: [Vehicles]
 *     summary: Create a vehicle
 *     security: [ { bearerAuth: [] } ]
 *     description: |
 *       - **User** role: owner will be forced to your own userId.
 *       - **Admin/Staff**: can specify `owner` or default to self.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VehicleCreate' }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       409: { description: plateNumber already exists }
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  createVehicleController
);

/**
 * @swagger
 * /vehicles:
 *   get:
 *     tags: [Vehicles]
 *     summary: List vehicles (self for normal users; filterable for admin/staff)
 *     security: [ { bearerAuth: [] } ]
 *     description: |
 *       - **User** role: only your vehicles are returned.
 *       - **Admin/Staff**: can filter by any fields; omit `owner` to list across all users.
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema: { type: string }
 *       - in: query
 *         name: plateNumber
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [car, motorbike, scooter, truck, other] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 20 }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  listVehiclesController
);

/**
 * @swagger
 * /vehicles/all:
 *   get:
 *     tags: [Vehicles]
 *     summary: (Admin/Staff) List ALL vehicles of ALL users
 *     description: |
 *       Chỉ admin/staff. Hỗ trợ filter `owner`, `plateNumber`, `status`, `type`, `page`, `limit`.
 *       Nếu **không** truyền `owner` → trả về toàn bộ xe của mọi user.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: owner
 *         schema: { type: string }
 *         description: Optional owner id to filter
 *       - in: query
 *         name: plateNumber
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [car, motorbike, scooter, truck, other] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 20 }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Forbidden }
 */
router.get(
  "/all",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  listAllVehiclesController
);

/**
 * @swagger
 * /vehicles/{id}:
 *   get:
 *     tags: [Vehicles]
 *     summary: Get vehicle by id
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not owner) }
 *       404: { description: Not found }
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  getVehicleByIdController
);

/**
 * @swagger
 * /vehicles/{id}:
 *   put:
 *     tags: [Vehicles]
 *     summary: Update vehicle
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
 *           schema: { $ref: '#/components/schemas/VehicleUpdate' }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error / No fields }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not owner) }
 *       404: { description: Not found }
 *       409: { description: plateNumber exists }
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  updateVehicleController
);

/**
 * @swagger
 * /vehicles/{id}:
 *   delete:
 *     tags: [Vehicles]
 *     summary: Delete vehicle
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not owner) }
 *       404: { description: Not found }
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  deleteVehicleController
);

export default router;
