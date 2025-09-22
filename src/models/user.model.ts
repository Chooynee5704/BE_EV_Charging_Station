import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'user' | 'admin' | 'staff';

export interface IUser extends Document {
  username: string;
  password: string; // hashed password
  role: UserRole;
}

const UserSchema: Schema<IUser> = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['user', 'admin', 'staff'], default: 'user' }
  },
  { timestamps: true }
);

UserSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    (ret as any).id = ret._id;
    Reflect.deleteProperty(ret, '_id');
    Reflect.deleteProperty(ret, '__v');
    Reflect.deleteProperty(ret, 'password');
    return ret;
  }
});

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
