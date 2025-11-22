import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { createReportController, getAllReportsController, updateReportStatusController, deleteReportController } from "../controllers/report.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Report management
 */

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Create a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - stationId
 *               - title
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [hardware, connection, power, software, safety, other]
 *               stationId:
 *                 type: string
 *               portId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Report created successfully
 *       500:
 *         description: Internal server error
 */
router.post(
    "/",
    authenticateToken,
    authorizeRoles("staff", "admin"),
    createReportController
);

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Get all reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reports
 *       500:
 *         description: Internal server error
 */
router.get(
    "/",
    authenticateToken,
    authorizeRoles("staff", "admin"),
    getAllReportsController
);

/**
 * @swagger
 * /reports/{id}/status:
 *   patch:
 *     summary: Update report status
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, resolved, rejected]
 *     responses:
 *       200:
 *         description: Report status updated successfully
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.patch(
    "/:id/status",
    authenticateToken,
    authorizeRoles("admin", "staff"),
    updateReportStatusController
);

/**
 * @swagger
 * /reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     tags: [Reports]
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
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("admin", "staff"),
    deleteReportController
);

export default router;
