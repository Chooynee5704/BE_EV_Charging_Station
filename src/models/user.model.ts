import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'user' | 'admin' | 'staff';

export interface IAddress {
  line1?: string;          // số nhà + đường
  line2?: string;          // căn hộ / block (nếu có)
  ward?: string;           // phường/xã
  district?: string;       // quận/huyện
  city?: string;           // thành phố
  province?: string;       // tỉnh/thành
  country?: string;        // quốc gia
  postalCode?: string;     // mã bưu chính
}

export interface IUser extends Document {
  email: string;
  phone?: string;          // sđt
  username: string;
  password: string;        // hashed password
  role: UserRole;
  profile?: {
    fullName?: string;     // họ tên
    dob?: Date;            // ngày tháng năm sinh (UTC)
    address?: IAddress;    // địa chỉ
  };
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
    postalCode: { type: String, trim: true }
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
        validator: (v: string) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Email không hợp lệ'
      }
    },
    phone: {
      type: String,
      trim: true,
      // ví dụ regex VN (+84|0) + 9~10 số; nới lỏng nếu multi-country
      validate: {
        validator: (v: string) =>
          !v || /^(\+?[0-9]{1,3})?0?[1-9][0-9]{7,10}$/.test(v),
        message: 'Số điện thoại không hợp lệ'
      }
      // Nếu muốn duy nhất: bật dòng dưới
      // , unique: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50
    },
    password: {
      type: String,
      required: true,
      // gợi ý: nếu dùng select: false, nhớ .select('+password') khi login
      // select: false
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'admin', 'staff'],
      default: 'user'
    },
    profile: {
      fullName: { type: String, trim: true },
      dob: { type: Date },
      address: { type: AddressSchema, default: undefined }
    }
  },
  { timestamps: true }
);

// Index gộp (tùy chiến lược tìm kiếm)
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
// Nếu bật unique cho phone phía trên, index tự tạo; nếu không muốn unique thì có thể vẫn tạo index thường:
// UserSchema.index({ phone: 1 });

// Chuẩn hóa output JSON
UserSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    (ret as any).id = ret._id;
    Reflect.deleteProperty(ret, '_id');
    Reflect.deleteProperty(ret, '__v');
    Reflect.deleteProperty(ret, 'password'); // ẩn password
    return ret;
  }
});

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
