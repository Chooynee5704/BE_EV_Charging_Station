import Report, { IReport } from "../models/report.model";

export const createReport = async (reportData: Partial<IReport>): Promise<IReport> => {
    const report = new Report(reportData);
    return await report.save();
};

export const getAllReports = async (): Promise<IReport[]> => {
    return await Report.find()
        .populate("stationId", "name address location")
        .populate("reporterId", "fullName email")
        .sort({ createdAt: -1 });
};

export const updateReportStatus = async (
    reportId: string,
    status: "pending" | "in_progress" | "resolved" | "rejected"
): Promise<IReport | null> => {
    return await Report.findByIdAndUpdate(
        reportId,
        { status },
        { new: true }
    ).populate("stationId", "name address location")
        .populate("reporterId", "fullName email");
};

export const deleteReport = async (reportId: string): Promise<IReport | null> => {
    return await Report.findByIdAndDelete(reportId);
};
