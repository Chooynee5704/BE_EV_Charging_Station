import mongoose, { Schema, Document, Model } from "mongoose";

export type PlanType = "basic" | "standard" | "premium";
export type PlanDuration = "1_month" | "6_months" | "12_months";

export interface IPlanFeatures {
  maxReservations: number; // -1 = unlimited
  maxVehicles: number; // -1 = unlimited
  prioritySupport: boolean;
  discount: number; // %
  description?: string;
}

export interface ISubscriptionPlan extends Document {
  name: string; // Tên gói (VD: "Basic 1 Month")
  type: PlanType; // basic, standard, premium
  duration: PlanDuration; // 1_month, 6_months, 12_months
  durationDays: number; // Số ngày (30, 180, 365)
  price: number; // Giá (VND)
  originalPrice?: number; // Giá gốc trước giảm giá
  currency: string; // VND
  features: IPlanFeatures; // Tính năng
  isActive: boolean; // Có đang active không
  displayOrder: number; // Thứ tự hiển thị
  description?: string; // Mô tả gói
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema<ISubscriptionPlan> = new Schema<ISubscriptionPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["basic", "standard", "premium"],
      required: true,
      index: true,
    },
    duration: {
      type: String,
      enum: ["1_month", "6_months", "12_months"],
      required: true,
      index: true,
    },
    durationDays: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => v >= 0,
        message: "Giá phải lớn hơn hoặc bằng 0",
      },
    },
    originalPrice: {
      type: Number,
      default: undefined,
    },
    currency: {
      type: String,
      default: "VND",
      uppercase: true,
      trim: true,
    },
    features: {
      type: {
        maxReservations: { type: Number, default: -1 },
        maxVehicles: { type: Number, default: -1 },
        prioritySupport: { type: Boolean, default: false },
        discount: { type: Number, default: 0 },
        description: { type: String, default: undefined },
      },
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Compound index để đảm bảo unique combination của type + duration
SubscriptionPlanSchema.index({ type: 1, duration: 1 }, { unique: true });

// JSON transform
SubscriptionPlanSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: unknown, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const SubscriptionPlan: Model<ISubscriptionPlan> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<ISubscriptionPlan>("SubscriptionPlan", SubscriptionPlanSchema);

