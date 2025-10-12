import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type SubscriptionType = "basic" | "standard" | "premium";
export type SubscriptionDuration = "1_month" | "6_months" | "12_months";
export type SubscriptionStatus = "current_active" | "active" | "expired" | "cancelled" | "pending";

export interface ISubscription extends Document {
  user: Types.ObjectId; // ref -> User
  plan: Types.ObjectId; // ref -> SubscriptionPlan
  type: SubscriptionType;
  duration: SubscriptionDuration; // Thời hạn gói
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  price: number; // Giá gói (VND)
  currency: string; // Loại tiền tệ (mặc định: VND)
  autoRenew: boolean; // Tự động gia hạn
  cancelledAt?: Date; // Thời điểm user cancel (vẫn dùng được đến endDate)
  features?: Record<string, any>; // Các tính năng của gói
  metadata?: Record<string, any>; // Thông tin bổ sung
  transaction?: Types.ObjectId; // ref -> Transaction (giao dịch thanh toán)
  upgradedFrom?: Types.ObjectId; // ref -> Subscription (nâng cấp từ gói nào)
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema<ISubscription> = new Schema<ISubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
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
    status: {
      type: String,
      enum: ["current_active", "active", "expired", "cancelled", "pending"],
      default: "pending",
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => v >= 0,
        message: "Giá phải lớn hơn hoặc bằng 0",
      },
    },
    currency: {
      type: String,
      default: "VND",
      uppercase: true,
      trim: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: undefined,
    },
    features: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    transaction: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      default: undefined,
    },
    upgradedFrom: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: undefined,
    },
  },
  { timestamps: true }
);

// Indexes cho query hiệu quả
SubscriptionSchema.index({ user: 1, status: 1 });
SubscriptionSchema.index({ user: 1, type: 1 });
SubscriptionSchema.index({ user: 1, duration: 1 });
SubscriptionSchema.index({ endDate: 1, status: 1 });
SubscriptionSchema.index({ user: 1, status: 1, endDate: -1 });

// Method kiểm tra subscription có current active không
SubscriptionSchema.methods.isCurrentActive = function (): boolean {
  const now = new Date();
  return (
    this.status === "current_active" &&
    this.startDate <= now &&
    this.endDate >= now
  );
};

// Method kiểm tra subscription có active (bao gồm current_active) không
SubscriptionSchema.methods.isActive = function (): boolean {
  const now = new Date();
  return (
    (this.status === "active" || this.status === "current_active") &&
    this.startDate <= now &&
    this.endDate >= now
  );
};

// JSON transform
SubscriptionSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: unknown, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);

