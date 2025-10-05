import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "user" | "admin" | "staff";

export interface IAddress {
  line1?: string;
  line2?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
}

export interface IUser extends Document {
  email: string;
  phone?: string;
  username: string;
  password: string;
  role: UserRole;
  profile?: {
    fullName?: string;
    dob?: Date;
    address?: IAddress;
  };
  // reset password
  resetPasswordToken?: string | null; // sha256(token)
  resetPasswordExpires?: Date | null; // expiry time
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    ward: { type: String, trim: true },
    district: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false }
);

const UserSchema: Schema<IUser> = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Email không hợp lệ",
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) =>
          !v || /^(\+?[0-9]{1,3})?0?[1-9][0-9]{7,10}$/.test(v),
        message: "Số điện thoại không hợp lệ",
      },
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["user", "admin", "staff"],
      default: "user",
    },
    profile: {
      fullName: { type: String, trim: true },
      dob: { type: Date },
      address: { type: AddressSchema, default: undefined },
    },
    // reset password
    resetPasswordToken: { type: String, default: null, index: true },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });

// 👇 virtual: 1 user -> many vehicles
UserSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "owner",
  justOne: false,
});

UserSchema.set("toJSON", {
  virtuals: true, // 👈 include virtuals
  transform: (_doc: any, ret: any) => {
    (ret as any).id = ret._id;
    Reflect.deleteProperty(ret, "_id");
    Reflect.deleteProperty(ret, "__v");
    Reflect.deleteProperty(ret, "password");
    Reflect.deleteProperty(ret, "resetPasswordToken");
    Reflect.deleteProperty(ret, "resetPasswordExpires");
    return ret;
  },
});

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
