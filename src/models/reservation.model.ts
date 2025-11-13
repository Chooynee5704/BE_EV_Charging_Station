import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "payment-success";

export interface IReservationItem {
  slot: Types.ObjectId; // ref -> ChargingSlot
  startAt: Date; // UTC
  endAt: Date;   // UTC
}

export interface IReservation extends Document {
  vehicle: Types.ObjectId; // ref -> Vehicle
  items: IReservationItem[];
  status: ReservationStatus;
  qrCheck: boolean; // Đã check-in bằng QR chưa
  qr?: string; // Base64 của QR code
  createdAt: Date;
  updatedAt: Date;
}

const ReservationItemSchema = new Schema<IReservationItem>(
  {
    slot: {
      type: Schema.Types.ObjectId,
      ref: "ChargingSlot",
      required: true,
      index: true,
    },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
  },
  { _id: false }
);

const ReservationSchema: Schema<IReservation> = new Schema<IReservation>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    items: {
      type: [ReservationItemSchema],
      required: true,
      validate: {
        validator: (v: IReservationItem[]) => Array.isArray(v) && v.length > 0,
        message: "items must contain at least one slot/time range",
      },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "payment-success"],
      default: "pending",
      required: true,
      index: true,
    },
    qrCheck: {
      type: Boolean,
      default: false,
      index: true,
    },
    qr: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Business rules
ReservationSchema.pre("validate", function (next) {
  const doc = this as IReservation;

  if (!doc.items || doc.items.length === 0) {
    return next(new Error("items must contain at least one slot/time range"));
  }

  for (const it of doc.items) {
    if (it.startAt >= it.endAt) {
      return next(
        new Error("startAt must be earlier than endAt for each item")
      );
    }
  }

  const bySlot: Record<string, { startAt: Date; endAt: Date }[]> = {};
  for (const it of doc.items) {
    const key = String(it.slot);
    bySlot[key] ??= [];
    for (const existed of bySlot[key]) {
      if (it.startAt < existed.endAt && it.endAt > existed.startAt) {
        return next(
          new Error(
            "Duplicate/overlapping time ranges for the same slot in one reservation"
          )
        );
      }
    }
    bySlot[key].push({ startAt: it.startAt, endAt: it.endAt });
  }

  next();
});

// Indexes
ReservationSchema.index({ vehicle: 1, "items.startAt": 1 });
ReservationSchema.index({ "items.slot": 1, "items.startAt": 1 });
ReservationSchema.index({ status: 1, "items.slot": 1, "items.startAt": 1 });

// JSON transform
ReservationSchema.set("toJSON", {
  transform: (_doc: unknown, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation ||
  mongoose.model<IReservation>("Reservation", ReservationSchema);
