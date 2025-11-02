import mongoose, { Schema, Model, Types } from "mongoose";

export type VehicleType = "car" | "motorbike" | "scooter" | "truck" | "other";
export type VehicleStatus = "active" | "inactive";

export interface IVehicle {
  owner: Types.ObjectId; // ref User
  make?: string; // Hãng xe (Tesla, VinFast...)
  model?: string; // Dòng xe (Model 3, VF8...)
  year?: number; // Năm SX
  color?: string;
  plateNumber: string; // Biển số (unique)
  vin?: string; // Số VIN (optional)
  type?: VehicleType; // Loại xe
  batteryCapacityKwh?: number; // (optional)
  connectorType?: string; // ví dụ: DC, Ultra, Type2,...
  status: VehicleStatus; // active/inactive
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    year: { type: Number, min: 1900, max: 2100 },
    color: { type: String, trim: true },
    plateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    vin: { type: String, trim: true, sparse: true },
    type: {
      type: String,
      enum: ["car", "motorbike", "scooter", "truck", "other"],
      default: "car",
    },
    batteryCapacityKwh: { type: Number, min: 0 },
    connectorType: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

VehicleSchema.index({ owner: 1, plateNumber: 1 });
VehicleSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Vehicle: Model<IVehicle> =
  mongoose.models.Vehicle || mongoose.model<IVehicle>("Vehicle", VehicleSchema);
