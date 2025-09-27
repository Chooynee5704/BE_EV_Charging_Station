import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export interface IReservation extends Document {
  // RESERVATIONSId: dùng _id của Mongo; khi toJSON sẽ map thành `id`
  slot: Types.ObjectId; // ref -> ChargingSlot
  user: Types.ObjectId; // ref -> User
  startAt: Date; // start date time
  endAt: Date; // end date time
  status: ReservationStatus; // trạng thái: pending|confirmed|cancelled|completed
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema: Schema<IReservation> = new Schema<IReservation>(
  {
    slot: {
      type: Schema.Types.ObjectId,
      ref: "ChargingSlot",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      required: true,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Business rules:
// - startAt must be before endAt
ReservationSchema.pre("validate", function (next) {
  const doc = this as IReservation;
  if (doc.startAt && doc.endAt && doc.startAt >= doc.endAt) {
    return next(new Error("startAt must be earlier than endAt"));
  }
  next();
});

// Helpful compound indexes for common queries
ReservationSchema.index({ slot: 1, startAt: 1 });
ReservationSchema.index({ user: 1, startAt: 1 });
ReservationSchema.index({ slot: 1, status: 1, startAt: 1 });

// Chuẩn hóa JSON giống các model khác: expose `id` thay vì `_id`
ReservationSchema.set("toJSON", {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id; // đây chính là RESERVATIONSId
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation ||
  mongoose.model<IReservation>("Reservation", ReservationSchema);
