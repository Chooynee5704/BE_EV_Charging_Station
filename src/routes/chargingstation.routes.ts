import { Router } from 'express';
import {
  createChargingStationController,
  listChargingStationsController,
  getChargingStationByIdController,
  updateChargingStationController,
  deleteChargingStationController
} from '../controllers/chargingstation.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: ChargingStations
 *     description: CRUD for EV charging stations
 */

/**
 * @swagger
 * /stations:
 *   post:
 *     tags: [ChargingStations]
 *     summary: Create charging station
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
 *               status:
 *                 type: string
 *                 enum: [active, inactive, maintenance]
 *                 example: active
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.post('/', authenticateToken, authorizeRoles('admin', 'staff'), createChargingStationController);

/**
 * @swagger
 * /stations:
 *   get:
 *     tags: [ChargingStations]
 *     summary: List charging stations (filter/pagination)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, maintenance] }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 20 }
 *       - in: query
 *         name: includePorts
 *         schema: { type: boolean, example: false }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 */
router.get('/', authenticateToken, authorizeRoles('admin', 'staff', 'user'), listChargingStationsController);

/**
 * @swagger
 * /stations/{id}:
 *   get:
 *     tags: [ChargingStations]
 *     summary: Get charging station by id
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includePorts
 *         schema: { type: boolean, example: false }
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router.get('/:id', authenticateToken, authorizeRoles('admin', 'staff', 'user'), getChargingStationByIdController);

/**
 * @swagger
 * /stations/{id}:
 *   put:
 *     tags: [ChargingStations]
 *     summary: Update charging station
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
 *               status:
 *                 type: string
 *                 enum: [active, inactive, maintenance]
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router.put('/:id', authenticateToken, authorizeRoles('admin', 'staff'), updateChargingStationController);

/**
 * @swagger
 * /stations/{id}:
 *   delete:
 *     tags: [ChargingStations]
 *     summary: Delete charging station (blocked if station still has ports)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 *       409: { description: Conflict — station has charging ports }
 */
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteChargingStationController);

export default router;
