import { Request, Response } from "express";
import {
  createUser,
  getAllUsers,
  loginUser,
  CreateUserInput,
  updateUserProfile,
  changePassword,
} from "../services/user.service";
import { AuthenticatedRequest } from "../types";
import { User } from "../models/user.model";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUserController(req: Request, res: Response) {
  try {
    const { username, password, email, fullName, dob, address } = req.body as {
      username?: string;
      password?: string;
      email?: string;
      fullName?: string;
      dob?: string;
      address?: any;
    };

    if (
      !username ||
      !password ||
      !email ||
      !fullName ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof email !== "string" ||
      typeof fullName !== "string"
    ) {
      return res.status(400).json({
        error: "InvalidInput",
        message:
          "username, password, email, fullName are required and must be strings",
      });
    }

    if (!emailRegex.test(email.trim().toLowerCase())) {
      return res
        .status(400)
        .json({ error: "InvalidInput", message: "Invalid email format" });
    }

    const payload: CreateUserInput = {
      username,
      password,
      email,
      fullName,
      ...(dob ? { dob } : {}),
      ...(address !== undefined ? { address } : {}),
    };

    const user = await createUser(payload);
    return res.status(201).json(user);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Internal Server Error";
    return res
      .status(status)
      .json({ error: status === 409 ? "Conflict" : "ServerError", message });
  }
}

export async function getAllUsersController(_req: Request, res: Response) {
  try {
    const users = await getAllUsers();
    return res.status(200).json(users);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Internal Server Error";
    return res.status(status).json({ error: "ServerError", message });
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res
        .status(400)
        .json({
          error: "InvalidInput",
          message: "username and password are required",
        });
    }

    if (username.trim().length === 0 || password.length === 0) {
      return res.status(400).json({
        error: "InvalidInput",
        message: "username and password must not be empty",
      });
    }

    const result = await loginUser({ username: username.trim(), password });
    return res
      .status(200)
      .json({ success: true, message: "Login successful", data: result });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Server error";
    return res.status(status).json({
      success: false,
      error: status === 401 ? "Unauthorized" : "ServerError",
      message,
    });
  }
}

export async function getUserProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res
        .status(401)
        .json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
    }

    const user = await User.findById(req.user.userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "NotFound", message: "User not found" });
    }

    const profile = user.profile ?? {};
    return res.status(200).json({
      success: true,
      message: "Profile retrieved",
      data: {
        userId: user._id.toString(),
        username: user.username,
        role: user.role,
        email: user.email ?? null,
        fullName: profile.fullName ?? null,
        dob: profile.dob ? new Date(profile.dob).toISOString() : null,
        address: profile.address ?? null,
        phone: user.phone ?? null,
      },
    });
  } catch (error: any) {
    console.error("Get profile error:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: "ServerError",
        message: "Unexpected server error",
      });
  }
}

export async function updateUserProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res
        .status(401)
        .json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
    }

    const { username, email, phone, fullName, dob, address } = req.body as {
      username?: string;
      email?: string;
      phone?: string | null;
      fullName?: string;
      dob?: string | null;
      address?: any | null;
    };

    const input: any = { userId: req.user.userId };
    if (username !== undefined) input.username = username;
    if (email !== undefined) input.email = email;
    if (phone !== undefined) input.phone = phone;
    if (fullName !== undefined) input.fullName = fullName;
    if (dob !== undefined) input.dob = dob;
    if (address !== undefined) input.address = address;

    const updated = await updateUserProfile(input);

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: updated,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 409
          ? "Conflict"
          : status === 404
          ? "NotFound"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message,
    });
  }
}

export async function changePasswordController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.userId) {
      return res
        .status(401)
        .json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
    }

    const { oldPassword, newPassword, confirmNewPassword } = req.body as {
      oldPassword?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    };

    if (
      !oldPassword ||
      !newPassword ||
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "InvalidInput",
          message: "oldPassword and newPassword are required",
        });
    }

    if (
      confirmNewPassword !== undefined &&
      confirmNewPassword !== newPassword
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error: "InvalidInput",
          message: "confirmNewPassword does not match",
        });
    }

    const updated = await changePassword({
      userId: req.user.userId,
      oldPassword,
      newPassword,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed",
      data: updated, // user.toJSON() (không chứa password)
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    const status = error?.status || 500;
    const message = error?.message || "Unexpected server error";
    return res.status(status).json({
      success: false,
      error:
        status === 401
          ? "Unauthorized"
          : status === 404
          ? "NotFound"
          : status === 400
          ? "InvalidInput"
          : "ServerError",
      message,
    });
  }
}
