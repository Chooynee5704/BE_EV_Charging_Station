import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TransactionStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "vnpay" | "cash" | "other";

export interface IVnpayDetails {
  vnp_TxnRef?: string; // Mã đơn hàng
  vnp_TransactionNo?: string; // Mã giao dịch VNPay
  vnp_BankCode?: string; // Mã ngân hàng
  vnp_CardType?: string; // Loại thẻ
  vnp_ResponseCode?: string; // Mã phản hồi
  vnp_TransactionStatus?: string; // Trạng thái giao dịch
  vnp_Amount?: number; // Số tiền (đơn vị: VND * 100)
  vnp_PayDate?: string; // Thời gian thanh toán
  vnp_OrderInfo?: string; // Thông tin đơn hàng
}

export interface ITransaction extends Document {
  user: Types.ObjectId; // ref -> User
  reservation?: Types.ObjectId; // ref -> Reservation (optional)
  amount: number; // Số tiền giao dịch (VND)
  currency: string; // Loại tiền tệ (mặc định: VND)
  status: TransactionStatus; // Trạng thái giao dịch
  paymentMethod: PaymentMethod; // Phương thức thanh toán
  description?: string; // Mô tả giao dịch
  vnpayDetails?: IVnpayDetails; // Chi tiết từ VNPay
  metadata?: Record<string, any>; // Thông tin bổ sung
  createdAt: Date;
  updatedAt: Date;
}

const VnpayDetailsSchema = new Schema<IVnpayDetails>(
  {
    vnp_TxnRef: { type: String, index: true },
    vnp_TransactionNo: { type: String, index: true },
    vnp_BankCode: { type: String },
    vnp_CardType: { type: String },
    vnp_ResponseCode: { type: String },
    vnp_TransactionStatus: { type: String },
    vnp_Amount: { type: Number },
    vnp_PayDate: { type: String },
    vnp_OrderInfo: { type: String },
  },
  { _id: false }
);

const TransactionSchema: Schema<ITransaction> = new Schema<ITransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reservation: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number) => v > 0,
        message: "Số tiền phải lớn hơn 0",
      },
    },
    currency: {
      type: String,
      default: "VND",
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "success",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["vnpay", "cash", "other"],
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    vnpayDetails: {
      type: VnpayDetailsSchema,
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Indexes cho query hiệu quả
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ user: 1, status: 1, createdAt: -1 });
TransactionSchema.index({ "vnpayDetails.vnp_TxnRef": 1 });
TransactionSchema.index({ "vnpayDetails.vnp_TransactionNo": 1 });

// JSON transform
TransactionSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc: unknown, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
