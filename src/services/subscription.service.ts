import { Types } from "mongoose";
import {
  Subscription,
  ISubscription,
  SubscriptionType,
  SubscriptionStatus,
  SubscriptionDuration,
} from "../models/subscription.model";
import { User } from "../models/user.model";
import { getSubscriptionPlanById } from "./subscriptionPlan.service";

// Cấu hình giá và tính năng cho từng loại gói theo thời hạn
export const SUBSCRIPTION_PLANS = {
  basic: {
    name: "Basic",
    "1_month": { price: 99000, days: 30 },
    "6_months": { price: 549000, days: 180 }, // ~10% discount
    "12_months": { price: 999000, days: 365 }, // ~17% discount
    features: {
      maxReservations: 5, // Tối đa 5 đặt chỗ/tháng
      maxVehicles: 1, // Tối đa 1 xe
      prioritySupport: false,
      discount: 0, // Không giảm giá
    },
  },
  standard: {
    name: "Standard",
    "1_month": { price: 199000, days: 30 },
    "6_months": { price: 1099000, days: 180 }, // ~8% discount
    "12_months": { price: 1999000, days: 365 }, // ~17% discount
    features: {
      maxReservations: 20, // Tối đa 20 đặt chỗ/tháng
      maxVehicles: 3, // Tối đa 3 xe
      prioritySupport: true,
      discount: 5, // Giảm 5%
    },
  },
  premium: {
    name: "Premium",
    "1_month": { price: 299000, days: 30 },
    "6_months": { price: 1649000, days: 180 }, // ~8% discount
    "12_months": { price: 2999000, days: 365 }, // ~17% discount
    features: {
      maxReservations: -1, // Không giới hạn
      maxVehicles: -1, // Không giới hạn
      prioritySupport: true,
      discount: 10, // Giảm 10%
    },
  },
};

export interface CreateSubscriptionInput {
  userId: string;
  planId: string; // ID của SubscriptionPlan
  autoRenew?: boolean;
  customPrice?: number; // Cho phép custom giá (admin)
  transactionId?: string | undefined; // ID transaction thanh toán
}

export interface UpgradeSubscriptionInput {
  userId: string;
  newPlanId: string; // ID của SubscriptionPlan mới
  transactionId?: string;
}

export interface UpdateSubscriptionInput {
  subscriptionId: string;
  status?: SubscriptionStatus;
  autoRenew?: boolean;
  endDate?: Date;
  transactionId?: string;
}

/**
 * Tạo subscription mới từ planId
 */
export async function createSubscription(
  input: CreateSubscriptionInput
): Promise<ISubscription> {
  // Validate user exists
  if (!Types.ObjectId.isValid(input.userId)) {
    throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
  }

  const userExists = await User.findById(input.userId);
  if (!userExists) {
    throw Object.assign(new Error("Người dùng không tồn tại"), { status: 404 });
  }

  // Validate planId
  if (!Types.ObjectId.isValid(input.planId)) {
    throw Object.assign(new Error("Plan ID không hợp lệ"), { status: 400 });
  }

  // Lấy thông tin plan từ database
  const plan = await getSubscriptionPlanById(input.planId);
  
  if (!plan.isActive) {
    throw Object.assign(new Error("Gói subscription này không còn hoạt động"), {
      status: 400,
    });
  }

  // Tính toán ngày bắt đầu và kết thúc
  const startDate = new Date();
  const endDate = new Date(
    startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
  );

  // Tạo subscription
  const subscription = await Subscription.create({
    user: new Types.ObjectId(input.userId),
    plan: new Types.ObjectId(input.planId),
    type: plan.type,
    duration: plan.duration,
    status: "pending", // Pending cho đến khi thanh toán
    startDate,
    endDate,
    price: input.customPrice || plan.price,
    currency: "VND",
    autoRenew: input.autoRenew || false,
    features: plan.features,
    transaction: input.transactionId
      ? new Types.ObjectId(input.transactionId)
      : undefined,
    metadata: {
      planId: input.planId,
      planName: plan.name,
      originalPrice: plan.price,
      durationDays: plan.durationDays,
    },
  });

  return subscription;
}

/**
 * Cập nhật subscription
 */
export async function updateSubscription(
  input: UpdateSubscriptionInput
): Promise<ISubscription> {
  if (!Types.ObjectId.isValid(input.subscriptionId)) {
    throw Object.assign(new Error("Subscription ID không hợp lệ"), {
      status: 400,
    });
  }

  const subscription = await Subscription.findById(input.subscriptionId);
  if (!subscription) {
    throw Object.assign(new Error("Subscription không tồn tại"), {
      status: 404,
    });
  }

  // Update fields
  if (input.status !== undefined) {
    subscription.status = input.status;
  }
  if (input.autoRenew !== undefined) {
    subscription.autoRenew = input.autoRenew;
  }
  if (input.endDate !== undefined) {
    subscription.endDate = input.endDate;
  }
  if (input.transactionId !== undefined) {
    subscription.transaction = new Types.ObjectId(input.transactionId);
  }

  await subscription.save();
  return subscription;
}

/**
 * Lấy tất cả subscriptions của user
 */
export async function getUserSubscriptions(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
  }

  const subscriptions = await Subscription.find({
    user: new Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .populate("transaction", "status amount createdAt")
    .populate("upgradedFrom", "type duration status")
    .lean();

  return subscriptions;
}

/**
 * Lấy subscription current active của user
 */
export async function getCurrentActiveSubscription(
  userId: string
): Promise<ISubscription | null> {
  if (!Types.ObjectId.isValid(userId)) {
    throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
  }

  const now = new Date();

  const subscription = await Subscription.findOne({
    user: new Types.ObjectId(userId),
    status: "current_active",
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ endDate: -1 })
    .lean();

  return subscription;
}

/**
 * Kiểm tra user có subscription current active không
 */
export async function hasCurrentActiveSubscription(
  userId: string
): Promise<boolean> {
  const subscription = await getCurrentActiveSubscription(userId);
  return subscription !== null;
}

/**
 * Activate subscription (sau khi thanh toán thành công)
 * Nếu user chưa có subscription nào -> current_active
 * Nếu user đã có subscription -> current_active
 */
export async function activateSubscription(
  subscriptionId: string
): Promise<ISubscription> {
  if (!Types.ObjectId.isValid(subscriptionId)) {
    throw Object.assign(new Error("Subscription ID không hợp lệ"), {
      status: 400,
    });
  }

  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw Object.assign(new Error("Subscription không tồn tại"), {
      status: 404,
    });
  }

  const userId = subscription.user;

  // Kiểm tra xem user có subscription current_active nào không
  const existingCurrentActive = await Subscription.findOne({
    user: userId,
    status: "current_active",
    _id: { $ne: subscription._id },
  });

  if (existingCurrentActive) {
    // Nếu có: chuyển sang "active"
    existingCurrentActive.status = "active";
    await existingCurrentActive.save();
  }

  // Activate subscription mới thành current_active
  subscription.status = "current_active";
  await subscription.save();

  return subscription;
}

/**
 * Upgrade subscription
 * - Tạo subscription mới với plan cao hơn
 * - Chuyển subscription cũ từ current_active -> active
 * - Subscription mới thành pending (chờ thanh toán)
 */
export async function upgradeSubscription(
  input: UpgradeSubscriptionInput
): Promise<ISubscription> {
  if (!Types.ObjectId.isValid(input.userId)) {
    throw Object.assign(new Error("User ID không hợp lệ"), { status: 400 });
  }

  // Lấy subscription current active hiện tại
  const currentSubscription = await getCurrentActiveSubscription(input.userId);
  if (!currentSubscription) {
    throw Object.assign(
      new Error("Không có subscription đang hoạt động để nâng cấp"),
      { status: 400 }
    );
  }

  // Lấy plan mới
  const newPlan = await getSubscriptionPlanById(input.newPlanId);
  
  if (!newPlan.isActive) {
    throw Object.assign(new Error("Gói subscription này không còn hoạt động"), {
      status: 400,
    });
  }

  // Kiểm tra xem có thực sự là upgrade không
  const isUpgrade = isSubscriptionUpgrade(
    currentSubscription.type,
    currentSubscription.duration,
    newPlan.type as SubscriptionType,
    newPlan.duration as SubscriptionDuration
  );

  if (!isUpgrade) {
    throw Object.assign(
      new Error(
        "Gói mới phải cao hơn gói hiện tại (type hoặc duration phải lớn hơn)"
      ),
      { status: 400 }
    );
  }

  // Tạo subscription mới
  const newSubscription = await createSubscription({
    userId: input.userId,
    planId: input.newPlanId,
    transactionId: input.transactionId,
  });

  // Lưu thông tin upgrade
  newSubscription.upgradedFrom = currentSubscription._id as Types.ObjectId;
  await newSubscription.save();

  return newSubscription;
}

/**
 * Kiểm tra xem có phải upgrade không
 */
function isSubscriptionUpgrade(
  currentType: SubscriptionType,
  currentDuration: SubscriptionDuration,
  newType: SubscriptionType,
  newDuration: SubscriptionDuration
): boolean {
  const typeOrder = { basic: 1, standard: 2, premium: 3 };
  const durationOrder = { "1_month": 1, "6_months": 6, "12_months": 12 };

  const currentTypeLevel = typeOrder[currentType];
  const newTypeLevel = typeOrder[newType];
  const currentDurationLevel = durationOrder[currentDuration];
  const newDurationLevel = durationOrder[newDuration];

  // Upgrade nếu type cao hơn HOẶC duration dài hơn (hoặc cả hai)
  return (
    newTypeLevel > currentTypeLevel || newDurationLevel > currentDurationLevel
  );
}

/**
 * Cancel subscription
 * User vẫn sử dụng được đến hết endDate
 * Sau endDate mới chuyển sang "cancelled"
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<ISubscription> {
  if (!Types.ObjectId.isValid(subscriptionId)) {
    throw Object.assign(new Error("Subscription ID không hợp lệ"), {
      status: 400,
    });
  }

  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw Object.assign(new Error("Subscription không tồn tại"), {
      status: 404,
    });
  }

  // Chỉ cho phép cancel subscription đang active hoặc current_active
  if (subscription.status !== "active" && subscription.status !== "current_active") {
    throw Object.assign(
      new Error(`Chỉ có thể cancel subscription ở trạng thái active hoặc current_active. Trạng thái hiện tại: ${subscription.status}`),
      { status: 400 }
    );
  }

  // Đánh dấu là đã cancel, nhưng vẫn giữ nguyên status
  // User vẫn sử dụng được cho đến endDate
  subscription.cancelledAt = new Date();
  subscription.autoRenew = false;
  
  // Lưu metadata để tracking
  if (!subscription.metadata) {
    subscription.metadata = {};
  }
  subscription.metadata.willExpireAt = subscription.endDate;
  subscription.metadata.cancelledReason = "User cancelled subscription";

  await subscription.save();

  return subscription;
}

/**
 * Lấy subscription by ID
 */
export async function getSubscriptionById(
  subscriptionId: string
): Promise<ISubscription> {
  if (!Types.ObjectId.isValid(subscriptionId)) {
    throw Object.assign(new Error("Subscription ID không hợp lệ"), {
      status: 400,
    });
  }

  const subscription = await Subscription.findById(subscriptionId)
    .populate("user", "username email profile.fullName")
    .populate("transaction", "status amount createdAt")
    .populate("upgradedFrom", "type duration status")
    .lean();

  if (!subscription) {
    throw Object.assign(new Error("Subscription không tồn tại"), {
      status: 404,
    });
  }

  return subscription as ISubscription;
}

/**
 * Lấy danh sách subscriptions (admin)
 */
export async function getAllSubscriptions(filter: {
  type?: SubscriptionType;
  duration?: SubscriptionDuration;
  status?: SubscriptionStatus;
  userId?: string;
  page?: number;
  limit?: number;
}) {
  const { type, duration, status, userId, page = 1, limit = 20 } = filter;

  const query: any = {};
  if (type) query.type = type;
  if (duration) query.duration = duration;
  if (status) query.status = status;
  if (userId && Types.ObjectId.isValid(userId)) {
    query.user = new Types.ObjectId(userId);
  }

  const skip = (page - 1) * limit;

  const [subscriptions, total] = await Promise.all([
    Subscription.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username email profile.fullName")
      .populate("transaction", "status amount createdAt")
      .populate("upgradedFrom", "type duration status")
      .lean(),
    Subscription.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Kiểm tra và cập nhật subscriptions hết hạn
 */
export async function checkAndExpireSubscriptions() {
  const now = new Date();

  // Cập nhật những subscription đã hết hạn
  const expiredResult = await Subscription.updateMany(
    {
      status: { $in: ["current_active", "active"] },
      endDate: { $lt: now },
      autoRenew: false,
      cancelledAt: { $exists: false }, // Chưa bị cancel
    },
    {
      $set: { status: "expired" },
    }
  );

  // Cập nhật những subscription đã bị cancel và hết hạn
  const cancelledResult = await Subscription.updateMany(
    {
      status: { $in: ["current_active", "active"] },
      endDate: { $lt: now },
      cancelledAt: { $exists: true }, // Đã bị cancel
    },
    {
      $set: { status: "cancelled" },
    }
  );

  return {
    expired: expiredResult.modifiedCount,
    cancelled: cancelledResult.modifiedCount,
  };
}
