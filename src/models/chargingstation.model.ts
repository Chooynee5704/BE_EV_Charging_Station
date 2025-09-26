import mongoose, { Schema, Document, Model } from "mongoose";

export type ChargingStationStatus = "active" | "inactive" | "maintenance";

export interface IChargingStation extends Document {
  name: string;
  longitude: number;
  latitude: number;
  status: ChargingStationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ChargingStationSchema: Schema<IChargingStation> =
  new Schema<IChargingStation>(
    {
      name: { type: String, required: true, trim: true },
      longitude: { type: Number, required: true, min: -180, max: 180 },
      latitude: { type: Number, required: true, min: -90, max: 90 },
      status: {
        type: String,
        enum: ["active", "inactive", "maintenance"],
        default: "active",
        required: true,
      },
    },
    { timestamps: true }
  );

ChargingStationSchema.index({ name: 1 });
ChargingStationSchema.index({ longitude: 1, latitude: 1 });

ChargingStationSchema.virtual("ports", {
  ref: "ChargingPort",
  localField: "_id",
  foreignField: "station",
  justOne: false,
});

ChargingStationSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ChargingStation: Model<IChargingStation> =
  mongoose.models.ChargingStation ||
  mongoose.model<IChargingStation>("ChargingStation", ChargingStationSchema);
