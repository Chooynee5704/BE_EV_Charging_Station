import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PortType = "CCS" | "CHAdeMO" | "AC";
export type PortStatus = "available" | "in_use";
export type ChargeSpeed = "fast" | "slow";

export interface IChargingPort extends Document {
  station: Types.ObjectId;
  type: PortType;
  status: PortStatus;
  powerKw: number;
  speed: ChargeSpeed;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

const ChargingPortSchema: Schema<IChargingPort> = new Schema<IChargingPort>(
  {
    station: {
      type: Schema.Types.ObjectId,
      ref: "ChargingStation",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["CCS", "CHAdeMO", "AC"], required: true },
    status: {
      type: String,
      enum: ["available", "in_use"],
      default: "available",
      required: true,
      index: true,
    },
    powerKw: { type: Number, required: true, min: 1 },
    speed: { type: String, enum: ["fast", "slow"], required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

ChargingPortSchema.index({ station: 1, type: 1 });
ChargingPortSchema.index({ station: 1, status: 1 });

ChargingPortSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ChargingPort: Model<IChargingPort> =
  mongoose.models.ChargingPort ||
  mongoose.model<IChargingPort>("ChargingPort", ChargingPortSchema);
