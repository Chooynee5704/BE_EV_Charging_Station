import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import {
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from "../services/subscriptionPlan.service";

/**
 * Lấy tất cả subscription plans
 * GET /subscription-plans
 */
export async function getAllSubscriptionPlansController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { type, duration, isActive } = req.query;

    const filter: any = {};
    if (type) filter.type = type as string;
    if (duration) filter.duration = duration as string;
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" ? true : false;
    }

    const plans = await getAllSubscriptionPlans(filter);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách subscription plans thành công",
      data: plans,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy danh sách subscription plans",
    });
  }
}

/**
 * Lấy subscription plan by ID
 * GET /subscription-plans/:id
 */
export async function getSubscriptionPlanByIdController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Plan ID là bắt buộc",
      });
    }

    const plan = await getSubscriptionPlanById(id);

    return res.status(200).json({
      success: true,
      message: "Lấy subscription plan thành công",
      data: plan,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi lấy subscription plan",
    });
  }
}

/**
 * Tạo subscription plan mới (admin only)
 * POST /subscription-plans
 */
export async function createSubscriptionPlanController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      name,
      type,
      duration,
      durationDays,
      price,
      originalPrice,
      features,
      description,
      isActive,
      displayOrder,
    } = req.body;

    if (!name || !type || !duration || !durationDays || price === undefined || !features) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "name, type, duration, durationDays, price, và features là bắt buộc",
      });
    }

    const plan = await createSubscriptionPlan({
      name,
      type,
      duration,
      durationDays,
      price,
      originalPrice,
      features,
      description,
      isActive,
      displayOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo subscription plan thành công",
      data: plan,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi tạo subscription plan",
    });
  }
}

/**
 * Cập nhật subscription plan (admin only)
 * PUT /subscription-plans/:id
 */
export async function updateSubscriptionPlanController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Plan ID là bắt buộc",
      });
    }

    const plan = await updateSubscriptionPlan(id, req.body);

    return res.status(200).json({
      success: true,
      message: "Cập nhật subscription plan thành công",
      data: plan,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi cập nhật subscription plan",
    });
  }
}

/**
 * Xóa subscription plan (admin only)
 * DELETE /subscription-plans/:id
 */
export async function deleteSubscriptionPlanController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Plan ID là bắt buộc",
      });
    }

    await deleteSubscriptionPlan(id);

    return res.status(200).json({
      success: true,
      message: "Xóa subscription plan thành công",
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi xóa subscription plan",
    });
  }
}

