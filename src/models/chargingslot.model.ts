import mongoose, { Schema, Document, Model, Types } from "mongoose";

// thêm "inactive" để có thể cascade soft delete
export type ChargingSlotStatus = "available" | "booked" | "in_use" | "inactive";

export interface IChargingSlot extends Document {
  port: Types.ObjectId; // ref -> ChargingPort
  order: number; // unique per port
  status: ChargingSlotStatus;
  nextAvailableAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChargingSlotSchema: Schema<IChargingSlot> = new Schema<IChargingSlot>(
  {
    port: {
      type: Schema.Types.ObjectId,
      ref: "ChargingPort",
      required: true,
      index: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "order must be an integer",
      },
    },
    status: {
      type: String,
      enum: ["available", "booked", "in_use", "inactive"],
      required: true,
      default: "available",
      index: true,
    },
    nextAvailableAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Rule: nếu status là 'available' hoặc 'inactive' thì nextAvailableAt = null
ChargingSlotSchema.pre("validate", function (next) {
  const slot = this as IChargingSlot;
  if (
    (slot.status === "available" || slot.status === "inactive") &&
    slot.nextAvailableAt !== null
  ) {
    slot.nextAvailableAt = null;
  }
  next();
});

ChargingSlotSchema.index({ port: 1, order: 1 }, { unique: true });
ChargingSlotSchema.index({ port: 1, nextAvailableAt: 1 });

ChargingSlotSchema.set("toJSON", {
  virtuals: false,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ChargingSlot: Model<IChargingSlot> =
  mongoose.models.ChargingSlot ||
  mongoose.model<IChargingSlot>("ChargingSlot", ChargingSlotSchema);
