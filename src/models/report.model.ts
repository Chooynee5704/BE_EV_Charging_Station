import mongoose, { Schema, Document } from "mongoose";

export interface IReport extends Document {
    type: "hardware" | "connection" | "power" | "software" | "safety" | "other";
    stationId: mongoose.Types.ObjectId;
    portId: mongoose.Types.ObjectId;
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    status: "pending" | "in_progress" | "resolved";
    reporterId: mongoose.Types.ObjectId;
    images: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ReportSchema: Schema = new Schema(
    {
        type: {
            type: String,
            enum: ["hardware", "connection", "power", "software", "safety", "other"],
            required: true,
        },
        stationId: {
            type: Schema.Types.ObjectId,
            ref: "ChargingStation",
            required: true,
        },
        portId: {
            type: Schema.Types.ObjectId,
            ref: "ChargingPort",
            required: false,
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium",
        },
        status: {
            type: String,
            enum: ["pending", "in_progress", "resolved"],
            default: "pending",
        },
        reporterId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        images: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IReport>("Report", ReportSchema);
