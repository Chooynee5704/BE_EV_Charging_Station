import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ChargingSlotStatus = "available" | "booked" | "in_use";

export interface IChargingSlot extends Document {
  port: Types.ObjectId; // ref -> ChargingPort
  order: number; // display/physical order within a port (unique per port)
  status: ChargingSlotStatus; // available | booked | in_use
  nextAvailableAt: Date | null; // next time the slot is expected to be free
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
      enum: ["available", "booked", "in_use"],
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

// Business rule: if status is 'available', force nextAvailableAt to null
// (Note: this hook doesn't run on findOneAndUpdate; the service accounts for that case.)
ChargingSlotSchema.pre("validate", function (next) {
  const slot = this as IChargingSlot;
  if (slot.status === "available" && slot.nextAvailableAt !== null) {
    slot.nextAvailableAt = null;
  }
  next();
});

// Helpful indexes
ChargingSlotSchema.index({ port: 1, order: 1 }, { unique: true }); // unique ordering per port
ChargingSlotSchema.index({ port: 1, nextAvailableAt: 1 });
ChargingSlotSchema.index({ port: 1, status: 1 });

// Normalize JSON output (expose `id` instead of `_id`)
ChargingSlotSchema.set("toJSON", {
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
