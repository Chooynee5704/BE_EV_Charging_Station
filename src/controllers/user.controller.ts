import { Request, Response } from "express";
import {
  createUser,
  getAllUsers,
  loginUser,
  CreateUserInput,
  updateUserProfile,
  changePassword,
  getUserById as getUserByIdService,
} from "../services/user.service";
import { AuthenticatedRequest } from "../types";
import { User } from "../models/user.model";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUserController(req: Request, res: Response) {
  try {
    const { username, password, email, fullName, dob, address, numberphone } = req.body as {
      username?: string;
      password?: string;
      email?: string;
      fullName?: string;
      dob?: string;
      address?: any;
      numberphone?: string;
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
      ...(numberphone !== undefined ? { phone: numberphone } : {}),
    } as any;

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
        status: user.status,
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

    const {
      userId: targetUserIdFromBody,
      username,
      email,
      phone,
      fullName,
      dob,
      address,
      status,
    } = req.body as {
      userId?: string;
      username?: string;
      email?: string;
      phone?: string | null;
      fullName?: string;
      dob?: string | null;
      address?: any | null;
      status?: string;
    };

    const requesterRole = req.user.role;
    let targetUserId = req.user.userId;

    if (requesterRole === "admin" && targetUserIdFromBody) {
      if (typeof targetUserIdFromBody !== "string") {
        return res.status(400).json({
          success: false,
          error: "InvalidInput",
          message: "userId must be a string",
        });
      }
      const trimmedTargetId = targetUserIdFromBody.trim();
      if (!trimmedTargetId) {
        return res.status(400).json({
          success: false,
          error: "InvalidInput",
          message: "userId must not be empty",
        });
      }
      targetUserId = trimmedTargetId;
    } else if (requesterRole !== "admin" && targetUserIdFromBody !== undefined) {
      if (typeof targetUserIdFromBody !== "string") {
        return res.status(400).json({
          success: false,
          error: "InvalidInput",
          message: "userId must be a string",
        });
      }

      const trimmedTargetId = targetUserIdFromBody.trim();
      if (trimmedTargetId && trimmedTargetId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You do not have permission to update this user",
        });
      }
    }

    if (status !== undefined && requesterRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Only admins can update user status",
      });
    }

    const input: any = {
      userId: targetUserId,
      requesterRole,
    };
    if (username !== undefined) input.username = username;
    if (email !== undefined) input.email = email;
    if (phone !== undefined) input.phone = phone;
    if (fullName !== undefined) input.fullName = fullName;
    if (dob !== undefined) input.dob = dob;
    if (address !== undefined) input.address = address;
    if (status !== undefined) {
      if (typeof status !== "string") {
        return res.status(400).json({
          success: false,
          error: "InvalidInput",
          message: "status must be a string",
        });
      }

      const normalizedStatus = status.trim().toLowerCase();
      if (normalizedStatus !== "active" && normalizedStatus !== "disabled") {
        return res.status(400).json({
          success: false,
          error: "InvalidInput",
          message: "status must be either 'active' or 'disabled'",
        });
      }

      input.status = normalizedStatus;
    }

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

export async function getUserByIdController(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "userId parameter is required",
      });
    }

    const user = await getUserByIdService(userId);
    return res.status(200).json({
      success: true,
      message: "User retrieved",
      data: user,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || "Internal Server Error";
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : status === 400 ? "InvalidInput" : "ServerError",
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
