import mongoose, { Schema, Model, Types, Document } from "mongoose";

export type ChargingSessionStatus = "active" | "completed" | "cancelled" | "success";

export interface IChargingSession extends Document {
  vehicle: Types.ObjectId; // ref Vehicle
  slot: Types.ObjectId; // ref ChargingSlot
  startedAt: Date;
  endedAt?: Date | null;
  initialPercent: number; // 0-100
  targetPercent?: number | null; // 0-100 (optional stop target)
  chargeRatePercentPerMinute: number; // ví dụ: 1.2 (%/phút)
  status: ChargingSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ChargingSessionSchema = new Schema<IChargingSession>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    slot: {
      type: Schema.Types.ObjectId,
      ref: "ChargingSlot",
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null },
    initialPercent: { type: Number, required: true, min: 0, max: 100 },
    targetPercent: { type: Number, min: 1, max: 100, default: null },
    chargeRatePercentPerMinute: { type: Number, required: true, min: 0.1 },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled", "success"],
      default: "active",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Pre-save hook: Update slot status to "in_use" when session starts
ChargingSessionSchema.pre("save", async function (next) {
  const session = this as IChargingSession;

  // Only update slot when creating a new active session or when status changes to active
  if (session.isNew && session.status === "active") {
    const ChargingSlot = mongoose.model("ChargingSlot");
    await ChargingSlot.findByIdAndUpdate(session.slot, {
      status: "in_use",
    });
  }

  // When session is completed, cancelled, or success, set slot back to available
  if (
    !session.isNew &&
    session.isModified("status") &&
    (session.status === "completed" || session.status === "cancelled" || session.status === "success")
  ) {
    const ChargingSlot = mongoose.model("ChargingSlot");
    await ChargingSlot.findByIdAndUpdate(session.slot, {
      status: "available",
    });
  }

  next();
});

ChargingSessionSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ChargingSession: Model<IChargingSession> =
  mongoose.models.ChargingSession ||
  mongoose.model<IChargingSession>("ChargingSession", ChargingSessionSchema);
