import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

type PartialAddress =
  | {
      line1?: string;
      line2?: string;
      ward?: string;
      district?: string;
      city?: string;
      province?: string;
      country?: string;
      postalCode?: string;
    }
  | string
  | undefined;

export interface CreateUserInput {
  username: string;
  password: string;
  email: string;
  fullName: string;
  dob?: string | Date | null;
  address?: PartialAddress;
}

export interface LoginUserInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: any;
  token: string;
}

export interface UpdateProfileInput {
  userId: string;
  username?: string;
  email?: string;
  phone?: string | null;
  fullName?: string;
  dob?: string | Date | null;
  address?: PartialAddress | null;
}

export interface ChangePasswordInput {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+?[0-9]{1,3})?0?[1-9][0-9]{7,10}$/;

function parseDob(dob?: string | Date | null): Date | undefined | null {
  if (dob === null) return null;
  if (dob === undefined || dob === "") return undefined;
  const d = new Date(dob as any);
  if (Number.isNaN(d.getTime())) {
    const err = new Error("Invalid dob format. Use ISO `YYYY-MM-DD`");
    (err as any).status = 400;
    throw err;
  }
  return d;
}

function normalizeAddress(addr: PartialAddress | null) {
  if (addr === null) return null;
  if (!addr) return undefined;
  if (typeof addr === "string") {
    const v = addr.trim();
    return v ? { line1: v } : undefined;
  }
  const { line1, line2, ward, district, city, province, country, postalCode } =
    addr;
  const cleaned: any = {};
  if (line1) cleaned.line1 = String(line1).trim();
  if (line2) cleaned.line2 = String(line2).trim();
  if (ward) cleaned.ward = String(ward).trim();
  if (district) cleaned.district = String(district).trim();
  if (city) cleaned.city = String(city).trim();
  if (province) cleaned.province = String(province).trim();
  if (country) cleaned.country = String(country).trim();
  if (postalCode) cleaned.postalCode = String(postalCode).trim();
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function validateNewPassword(newPassword: string): void {
  if (newPassword.length < 8) {
    const err = new Error("newPassword must be at least 8 characters");
    (err as any).status = 400;
    throw err;
  }
}

export async function createUser(input: CreateUserInput) {
  const username = input.username?.trim();
  const password = input.password;
  const email = input.email?.trim().toLowerCase();
  const fullName = input.fullName?.trim();

  const dob = parseDob(input.dob);
  const address = normalizeAddress(input.address ?? undefined);

  if (!username || !password || !email || !fullName) {
    const err = new Error("username, password, email, fullName are required");
    (err as any).status = 400;
    throw err;
  }

  const existing = await User.findOne({
    $or: [{ username }, { email }],
  }).lean();
  if (existing) {
    const err = new Error(
      existing.username === username
        ? "Username already exists"
        : "Email already exists"
    );
    (err as any).status = 409;
    throw err;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const hashed = await bcrypt.hash(password, saltRounds);

  const created = await User.create({
    username,
    email,
    password: hashed,
    role: "user",
    profile: {
      fullName,
      ...(dob !== undefined ? { dob } : {}),
      ...(address !== undefined ? { address } : {}),
    },
  });

  return created.toJSON();
}

export async function updateUserProfile(input: UpdateProfileInput) {
  const { userId } = input;
  const setOps: any = {};
  const unsetOps: any = {};

  if (input.username !== undefined) {
    const username = input.username.trim();
    if (username.length < 3 || username.length > 50) {
      const err = new Error("username must be 3-50 characters");
      (err as any).status = 400;
      throw err;
    }
    const exists = await User.exists({ _id: { $ne: userId }, username });
    if (exists) {
      const err = new Error("Username already exists");
      (err as any).status = 409;
      throw err;
    }
    setOps.username = username;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      const err = new Error("Invalid email format");
      (err as any).status = 400;
      throw err;
    }
    const exists = await User.exists({ _id: { $ne: userId }, email });
    if (exists) {
      const err = new Error("Email already exists");
      (err as any).status = 409;
      throw err;
    }
    setOps.email = email;
  }

  if (input.phone !== undefined) {
    if (input.phone === null) {
      unsetOps.phone = "";
    } else {
      const phone = input.phone.trim();
      if (phone && !phoneRegex.test(phone)) {
        const err = new Error("Invalid phone format");
        (err as any).status = 400;
        throw err;
      }
      if (phone) setOps.phone = phone;
      else unsetOps.phone = "";
    }
  }

  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim();
    setOps["profile.fullName"] = fullName;
  }

  if (input.dob !== undefined) {
    const dob = parseDob(input.dob);
    if (dob === null) {
      unsetOps["profile.dob"] = "";
    } else if (dob !== undefined) {
      setOps["profile.dob"] = dob;
    }
  }

  if (input.address !== undefined) {
    const address = normalizeAddress(input.address);
    if (address === null) {
      unsetOps["profile.address"] = "";
    } else if (address !== undefined) {
      setOps["profile.address"] = address;
    } else {
      unsetOps["profile.address"] = "";
    }
  }

  const updateDoc: any = {};
  if (Object.keys(setOps).length) updateDoc.$set = setOps;
  if (Object.keys(unsetOps).length) updateDoc.$unset = unsetOps;
  if (!Object.keys(updateDoc).length) {
    const err = new Error("No fields to update");
    (err as any).status = 400;
    throw err;
  }

  const updated = await User.findByIdAndUpdate(userId, updateDoc, {
    new: true,
    runValidators: true,
  });

  if (!updated) {
    const err = new Error("User not found");
    (err as any).status = 404;
    throw err;
  }

  return updated.toJSON();
}

export async function changePassword(input: ChangePasswordInput) {
  const { userId, oldPassword, newPassword } = input;

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as any).status = 404;
    throw err;
  }

  if (!user.password) {
    const err = new Error("Password not set");
    (err as any).status = 400;
    throw err;
  }

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) {
    const err = new Error("Old password is incorrect");
    (err as any).status = 401;
    throw err;
  }

  validateNewPassword(newPassword);

  // Block same-as-old
  const sameAsOld = await bcrypt.compare(newPassword, user.password);
  if (sameAsOld) {
    const err = new Error("New password must be different from old password");
    (err as any).status = 400;
    throw err;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const newHash = await bcrypt.hash(newPassword, saltRounds);

  user.password = newHash;
  await user.save();

  return user.toJSON(); // toJSON strips password
}

export async function getAllUsers() {
  const users = await User.find();
  return users.map((u) => u.toJSON());
}

export async function loginUser(input: LoginUserInput): Promise<LoginResponse> {
  const { username, password } = input;

  const user = await User.findOne({ username });
  if (!user) {
    const err = new Error("Invalid username or password");
    (err as any).status = 401;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const err = new Error("Invalid username or password");
    (err as any).status = 401;
    throw err;
  }

  const jwtSecret = process.env.JWT_SECRET || "your-secret-key";

  let role = user.role;
  if (!role) {
    user.role = "user";
    await user.save();
    role = user.role;
  }

  const token = jwt.sign(
    { userId: (user._id as any).toString(), username: user.username, role },
    jwtSecret,
    { expiresIn: "24h" }
  );

  return { user: user.toJSON(), token };
}
