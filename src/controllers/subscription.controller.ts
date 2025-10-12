import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import {
  createSubscription,
  updateSubscription,
  getUserSubscriptions,
  getCurrentActiveSubscription,
  activateSubscription,
  cancelSubscription,
  getSubscriptionById,
  getAllSubscriptions,
  upgradeSubscription,
} from "../services/subscription.service";

/**
 * Tạo subscription mới cho user bằng planId (Admin only)
 * POST /subscriptions
 */
export async function createSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { userId, planId, autoRenew, customPrice } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "userId là bắt buộc",
      });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "planId là bắt buộc",
      });
    }

    const subscription = await createSubscription({
      userId,
      planId,
      autoRenew: autoRenew || false,
      customPrice,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo subscription thành công",
      data: subscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi tạo subscription",
    });
  }
}

/**
 * Upgrade subscription bằng planId
 * POST /subscriptions/upgrade
 */
export async function upgradeSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "planId là bắt buộc",
      });
    }

    const userId = req.user!.userId;

    const newSubscription = await upgradeSubscription({
      userId,
      newPlanId: planId,
    });

    return res.status(201).json({
      success: true,
      message: "Nâng cấp subscription thành công",
      data: newSubscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi nâng cấp subscription",
    });
  }
}

/**
 * Lấy danh sách subscriptions của user hiện tại
 * GET /subscriptions/my-subscriptions
 */
export async function getMySubscriptionsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.userId;
    const subscriptions = await getUserSubscriptions(userId);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách subscription thành công",
      data: subscriptions,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy danh sách subscription",
    });
  }
}

/**
 * Lấy subscription current active hiện tại
 * GET /subscriptions/current-active
 */
export async function getCurrentActiveSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.userId;
    const subscription = await getCurrentActiveSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Không có subscription đang hoạt động",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy subscription current active thành công",
      data: subscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy subscription",
    });
  }
}

/**
 * Cancel subscription
 * POST /subscriptions/:id/cancel
 * User có thể cancel subscription active của họ
 * Vẫn sử dụng được cho đến hết endDate
 */
export async function cancelSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Subscription ID là bắt buộc",
      });
    }

    // Kiểm tra quyền - chỉ owner hoặc admin mới có thể cancel
    const subscription = await getSubscriptionById(id);
    
    // Convert ObjectId to string để so sánh
    const subscriptionUserId = subscription.user._id 
      ? String(subscription.user._id) 
      : String(subscription.user);
    const currentUserId = req.user?.userId;
    
    console.log('Cancel check:', {
      subscriptionUserId,
      currentUserId,
      userRole: req.user?.role,
      isMatch: subscriptionUserId === currentUserId
    });
    
    if (
      req.user?.role !== "admin" &&
      subscriptionUserId !== currentUserId
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Bạn không có quyền hủy subscription này",
        debug: {
          subscriptionUserId: subscriptionUserId,
          yourUserId: currentUserId,
          hint: "Subscription này thuộc về user khác. Chỉ owner hoặc admin mới có thể cancel."
        }
      });
    }

    const cancelled = await cancelSubscription(id);

    return res.status(200).json({
      success: true,
      message: "Hủy subscription thành công. Bạn vẫn có thể sử dụng đến hết thời hạn.",
      data: {
        id: cancelled._id,
        status: cancelled.status,
        type: cancelled.type,
        duration: cancelled.duration,
        startDate: cancelled.startDate,
        endDate: cancelled.endDate,
        cancelledAt: cancelled.cancelledAt,
        autoRenew: cancelled.autoRenew,
        message: `Subscription sẽ hết hiệu lực vào ${new Date(cancelled.endDate).toLocaleString('vi-VN')}`,
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi hủy subscription",
    });
  }
}

/**
 * Lấy chi tiết subscription
 * GET /subscriptions/:id
 */
export async function getSubscriptionByIdController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Subscription ID là bắt buộc",
      });
    }

    const subscription = await getSubscriptionById(id);

    // Kiểm tra quyền - chỉ owner hoặc admin/staff mới xem được
    if (
      req.user?.role !== "admin" &&
      req.user?.role !== "staff" &&
      String(subscription.user) !== req.user?.userId
    ) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Bạn không có quyền xem subscription này",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy subscription thành công",
      data: subscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi lấy subscription",
    });
  }
}

/**
 * Lấy tất cả subscriptions (admin/staff only)
 * GET /subscriptions
 */
export async function getAllSubscriptionsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { type, status, userId, page, limit } = req.query;

    const result = await getAllSubscriptions({
      type: type as any,
      status: status as any,
      userId: userId as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách subscription thành công",
      data: result.subscriptions,
      pagination: result.pagination,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: "ServerError",
      message: error?.message || "Lỗi khi lấy danh sách subscription",
    });
  }
}

/**
 * Activate subscription (admin only - sau khi xác nhận thanh toán)
 * POST /subscriptions/:id/activate
 */
export async function activateSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Subscription ID là bắt buộc",
      });
    }

    const subscription = await activateSubscription(id);

    return res.status(200).json({
      success: true,
      message: "Kích hoạt subscription thành công",
      data: subscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi kích hoạt subscription",
    });
  }
}

/**
 * Cập nhật subscription (admin only)
 * PUT /subscriptions/:id
 */
export async function updateSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;
    const { status, autoRenew, endDate } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Subscription ID là bắt buộc",
      });
    }

    const updateData: any = {
      subscriptionId: id,
    };

    if (status !== undefined) {
      if (!["current_active", "active", "expired", "cancelled", "pending"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "InvalidInput",
          message: "status không hợp lệ",
        });
      }
      updateData.status = status;
    }

    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (endDate !== undefined) updateData.endDate = new Date(endDate);

    const subscription = await updateSubscription(updateData);

    return res.status(200).json({
      success: true,
      message: "Cập nhật subscription thành công",
      data: subscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi cập nhật subscription",
    });
  }
}

/**
 * Xóa subscription (admin only - soft delete)
 * DELETE /subscriptions/:id
 */
export async function deleteSubscriptionController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "InvalidInput",
        message: "Subscription ID là bắt buộc",
      });
    }

    // Soft delete - chuyển về cancelled
    const subscription = await cancelSubscription(id);

    return res.status(200).json({
      success: true,
      message: "Xóa subscription thành công",
      data: subscription,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "NotFound" : "ServerError",
      message: error?.message || "Lỗi khi xóa subscription",
    });
  }
}

