import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type PortType = 'CCS' | 'CHAdeMO' | 'AC';
export type PortStatus = 'available' | 'in_use'; // trống / đang dùng
export type ChargeSpeed = 'fast' | 'slow';       // nhanh / chậm

export interface IChargingPort extends Document {
  station: Types.ObjectId; // trạm sạc Id (ref → ChargingStation)
  type: PortType;          // loại (CCS, CHAdeMO, AC)
  status: PortStatus;      // trống/đang dùng
  powerKw: number;         // công suất (kW)
  speed: ChargeSpeed;      // tốc độ (nhanh/chậm)
  price: number;           // Giá (ví dụ: VND/kWh)
  createdAt: Date;
  updatedAt: Date;
}

const ChargingPortSchema: Schema<IChargingPort> = new Schema<IChargingPort>(
  {
    station: {
      type: Schema.Types.ObjectId,
      ref: 'ChargingStation',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['CCS', 'CHAdeMO', 'AC'],
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'in_use'],
      default: 'available',
      required: true,
      index: true,
    },
    powerKw: {
      type: Number,
      required: true,
      min: 1,
    },
    speed: {
      type: String,
      enum: ['fast', 'slow'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// Index gợi ý: tìm theo (station, type) và (station, status)
ChargingPortSchema.index({ station: 1, type: 1 });
ChargingPortSchema.index({ station: 1, status: 1 });

// Chuẩn hóa output JSON (same pattern as user.model)
ChargingPortSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const ChargingPort: Model<IChargingPort> =
  mongoose.models.ChargingPort ||
  mongoose.model<IChargingPort>('ChargingPort', ChargingPortSchema);
