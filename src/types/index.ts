import { Request } from "express";
import type { UserRole } from "../models/user.model";

// Extended Express request populated by auth middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: UserRole;
  };
}

// JWT payload structure we expect
export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Standard API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Dedicated error response contract
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
}
