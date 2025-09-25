import { Schema, model, Document, Types } from 'mongoose';

export interface IPasswordResetToken extends Document {
  userId: Types.ObjectId;
  tokenHash?: string;     // sha256(token link)
  expiresAt?: Date;       // TTL cho token link
  otpCodeHash?: string;   // sha256(OTP 6 số)
  otpExpiresAt?: Date;    // TTL cho OTP
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, index: true, unique: true, sparse: true },
    expiresAt: { type: Date, index: true },
    otpCodeHash: { type: String, index: true, sparse: true },
    otpExpiresAt: { type: Date, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL auto-delete khi quá hạn
PasswordResetTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } }
);
PasswordResetTokenSchema.index(
  { otpExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { otpExpiresAt: { $type: 'date' } } }
);

export const PasswordResetToken = model<IPasswordResetToken>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);
