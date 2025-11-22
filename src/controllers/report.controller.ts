import { Request, Response } from "express";
import { createReport, getAllReports, updateReportStatus, deleteReport } from "../services/report.service";

export const createReportController = async (req: Request, res: Response) => {
    try {
        console.log("Create Report Request Body:", req.body);
        // @ts-ignore
        console.log("Create Report User:", req.user);
        const { type, stationId, portId, title, description, priority, images } = req.body;

        // Extract user ID correctly based on logs (req.user has userId, not id)
        // @ts-ignore
        const reporterId = req.user.userId || req.user.id;

        if (!reporterId) {
            throw new Error("User ID not found in request. Cannot create report.");
        }

        // Validate and sanitize IDs
        console.log("Raw stationId:", stationId, "Type:", typeof stationId);
        console.log("Raw portId:", portId, "Type:", typeof portId);

        // Sanitize portId - convert empty strings, null, or undefined to undefined
        const sanitizedPortId = portId && portId.toString().trim() !== '' ? portId : undefined;

        console.log("Sanitized portId:", sanitizedPortId);

        const reportData: any = {
            type,
            stationId,
            title,
            description,
            priority,
            reporterId,
            images,
        };

        // Only add portId if it has a valid value
        if (sanitizedPortId) {
            reportData.portId = sanitizedPortId;
        }

        console.log("Final report data being saved:", reportData);

        const report = await createReport(reportData);

        res.status(201).json({
            status: "success",
            data: report,
        });
    } catch (error: any) {
        console.error("Create Report Error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

export const getAllReportsController = async (req: Request, res: Response) => {
    try {
        const reports = await getAllReports();

        res.status(200).json({
            status: "success",
            data: reports,
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

export const updateReportStatusController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["pending", "in_progress", "resolved", "rejected"].includes(status)) {
            res.status(400).json({
                status: "error",
                message: "Invalid status",
            });
            return;
        }

        // @ts-ignore
        const report = await updateReportStatus(id, status);

        if (!report) {
            res.status(404).json({
                status: "error",
                message: "Report not found",
            });
            return;
        }

        res.status(200).json({
            status: "success",
            data: report,
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};

export const deleteReportController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // @ts-ignore
        const report = await deleteReport(id);

        if (!report) {
            res.status(404).json({
                status: "error",
                message: "Report not found",
            });
            return;
        }

        res.status(200).json({
            status: "success",
            message: "Report deleted successfully",
        });
    } catch (error: any) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
};
