import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';

export interface CreateUserInput {
  username: string;
  password: string;
}

export interface LoginUserInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: any; // relies on mongoose toJSON output
  token: string;
}

export async function createUser(input: CreateUserInput) {
  const { username, password } = input;

  const existing = await User.findOne({ username }).lean();
  if (existing) {
    const err = new Error('Username already exists');
    (err as any).status = 409;
    throw err;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const hashed = await bcrypt.hash(password, saltRounds);

  const created = await User.create({ username, password: hashed, role: 'user' });
  return created.toJSON();
}

export async function getAllUsers() {
  const users = await User.find();
  return users.map((u) => u.toJSON());
}

export async function loginUser(input: LoginUserInput): Promise<LoginResponse> {
  const { username, password } = input;

  const user = await User.findOne({ username });
  if (!user) {
    const err = new Error('Invalid username or password');
    (err as any).status = 401;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    const err = new Error('Invalid username or password');
    (err as any).status = 401;
    throw err;
  }

  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

  let role = user.role;
  if (!role) {
    user.role = 'user';
    await user.save();
    role = user.role;
  }

  const token = jwt.sign(
    {
      userId: (user._id as any).toString(),
      username: user.username,
      role
    },
    jwtSecret,
    { expiresIn: '24h' }
  );

  const userJson = user.toJSON();
  return {
    user: userJson,
    token
  };
}
