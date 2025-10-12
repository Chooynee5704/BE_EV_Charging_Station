import { SubscriptionPlan, ISubscriptionPlan } from "../models/subscriptionPlan.model";

/**
 * Seed default subscription plans vào database
 */
export async function seedDefaultSubscriptionPlans() {
  try {
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans > 0) {
      console.log(`✓ ${existingPlans} subscription plans already exist`);
      return;
    }

    const defaultPlans = [
      // BASIC PLANS
      {
        name: "Basic - 1 Tháng",
        type: "basic",
        duration: "1_month",
        durationDays: 30,
        price: 99000,
        originalPrice: 99000,
        currency: "VND",
        features: {
          maxReservations: 5,
          maxVehicles: 1,
          prioritySupport: false,
          discount: 0,
          description: "Tối đa 5 đặt chỗ/tháng, 1 xe",
        },
        isActive: true,
        displayOrder: 1,
        description: "Gói cơ bản cho người dùng mới",
      },
      {
        name: "Basic - 6 Tháng",
        type: "basic",
        duration: "6_months",
        durationDays: 180,
        price: 549000,
        originalPrice: 594000,
        currency: "VND",
        features: {
          maxReservations: 5,
          maxVehicles: 1,
          prioritySupport: false,
          discount: 0,
          description: "Tối đa 5 đặt chỗ/tháng, 1 xe (Tiết kiệm 45k)",
        },
        isActive: true,
        displayOrder: 2,
        description: "Gói cơ bản 6 tháng - Tiết kiệm ~8%",
      },
      {
        name: "Basic - 12 Tháng",
        type: "basic",
        duration: "12_months",
        durationDays: 365,
        price: 999000,
        originalPrice: 1188000,
        currency: "VND",
        features: {
          maxReservations: 5,
          maxVehicles: 1,
          prioritySupport: false,
          discount: 0,
          description: "Tối đa 5 đặt chỗ/tháng, 1 xe (Tiết kiệm 189k)",
        },
        isActive: true,
        displayOrder: 3,
        description: "Gói cơ bản 12 tháng - Tiết kiệm ~16%",
      },

      // STANDARD PLANS
      {
        name: "Standard - 1 Tháng",
        type: "standard",
        duration: "1_month",
        durationDays: 30,
        price: 199000,
        originalPrice: 199000,
        currency: "VND",
        features: {
          maxReservations: 20,
          maxVehicles: 3,
          prioritySupport: true,
          discount: 5,
          description: "Tối đa 20 đặt chỗ/tháng, 3 xe, giảm 5%",
        },
        isActive: true,
        displayOrder: 4,
        description: "Gói tiêu chuẩn phổ biến nhất",
      },
      {
        name: "Standard - 6 Tháng",
        type: "standard",
        duration: "6_months",
        durationDays: 180,
        price: 1099000,
        originalPrice: 1194000,
        currency: "VND",
        features: {
          maxReservations: 20,
          maxVehicles: 3,
          prioritySupport: true,
          discount: 5,
          description: "Tối đa 20 đặt chỗ/tháng, 3 xe, giảm 5% (Tiết kiệm 95k)",
        },
        isActive: true,
        displayOrder: 5,
        description: "Gói tiêu chuẩn 6 tháng - Tiết kiệm ~8%",
      },
      {
        name: "Standard - 12 Tháng",
        type: "standard",
        duration: "12_months",
        durationDays: 365,
        price: 1999000,
        originalPrice: 2388000,
        currency: "VND",
        features: {
          maxReservations: 20,
          maxVehicles: 3,
          prioritySupport: true,
          discount: 5,
          description: "Tối đa 20 đặt chỗ/tháng, 3 xe, giảm 5% (Tiết kiệm 389k)",
        },
        isActive: true,
        displayOrder: 6,
        description: "Gói tiêu chuẩn 12 tháng - Tiết kiệm ~16%",
      },

      // PREMIUM PLANS
      {
        name: "Premium - 1 Tháng",
        type: "premium",
        duration: "1_month",
        durationDays: 30,
        price: 299000,
        originalPrice: 299000,
        currency: "VND",
        features: {
          maxReservations: -1,
          maxVehicles: -1,
          prioritySupport: true,
          discount: 10,
          description: "Không giới hạn đặt chỗ & xe, giảm 10%",
        },
        isActive: true,
        displayOrder: 7,
        description: "Gói cao cấp không giới hạn",
      },
      {
        name: "Premium - 6 Tháng",
        type: "premium",
        duration: "6_months",
        durationDays: 180,
        price: 1649000,
        originalPrice: 1794000,
        currency: "VND",
        features: {
          maxReservations: -1,
          maxVehicles: -1,
          prioritySupport: true,
          discount: 10,
          description: "Không giới hạn đặt chỗ & xe, giảm 10% (Tiết kiệm 145k)",
        },
        isActive: true,
        displayOrder: 8,
        description: "Gói cao cấp 6 tháng - Tiết kiệm ~8%",
      },
      {
        name: "Premium - 12 Tháng",
        type: "premium",
        duration: "12_months",
        durationDays: 365,
        price: 2999000,
        originalPrice: 3588000,
        currency: "VND",
        features: {
          maxReservations: -1,
          maxVehicles: -1,
          prioritySupport: true,
          discount: 10,
          description: "Không giới hạn đặt chỗ & xe, giảm 10% (Tiết kiệm 589k)",
        },
        isActive: true,
        displayOrder: 9,
        description: "Gói cao cấp 12 tháng - Tiết kiệm ~16%",
      },
    ];

    await SubscriptionPlan.insertMany(defaultPlans);
    console.log(`✓ Seeded ${defaultPlans.length} default subscription plans`);
  } catch (error: any) {
    console.error("Error seeding subscription plans:", error?.message);
  }
}

/**
 * Lấy tất cả subscription plans
 */
export async function getAllSubscriptionPlans(filter?: {
  type?: string;
  duration?: string;
  isActive?: boolean;
}) {
  const query: any = {};
  
  if (filter?.type) query.type = filter.type;
  if (filter?.duration) query.duration = filter.duration;
  if (filter?.isActive !== undefined) query.isActive = filter.isActive;

  const plans = await SubscriptionPlan.find(query)
    .sort({ displayOrder: 1, price: 1 })
    .lean();

  return plans;
}

/**
 * Lấy subscription plan by ID
 */
export async function getSubscriptionPlanById(planId: string): Promise<ISubscriptionPlan> {
  const plan = await SubscriptionPlan.findById(planId).lean();
  
  if (!plan) {
    throw Object.assign(new Error("Subscription plan không tồn tại"), {
      status: 404,
    });
  }

  return plan as ISubscriptionPlan;
}

/**
 * Lấy subscription plan by type và duration
 */
export async function getSubscriptionPlanByTypeAndDuration(
  type: string,
  duration: string
): Promise<ISubscriptionPlan> {
  const plan = await SubscriptionPlan.findOne({ type, duration, isActive: true }).lean();
  
  if (!plan) {
    throw Object.assign(
      new Error(`Subscription plan ${type} - ${duration} không tồn tại`),
      { status: 404 }
    );
  }

  return plan as ISubscriptionPlan;
}

/**
 * Tạo subscription plan (admin only)
 */
export async function createSubscriptionPlan(data: {
  name: string;
  type: string;
  duration: string;
  durationDays: number;
  price: number;
  originalPrice?: number;
  features: any;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}): Promise<ISubscriptionPlan> {
  const plan = await SubscriptionPlan.create({
    ...data,
    currency: "VND",
    isActive: data.isActive !== undefined ? data.isActive : true,
    displayOrder: data.displayOrder || 0,
  });

  return plan;
}

/**
 * Cập nhật subscription plan (admin only)
 */
export async function updateSubscriptionPlan(
  planId: string,
  data: Partial<ISubscriptionPlan>
): Promise<ISubscriptionPlan> {
  const plan = await SubscriptionPlan.findByIdAndUpdate(
    planId,
    { $set: data },
    { new: true, runValidators: true }
  );

  if (!plan) {
    throw Object.assign(new Error("Subscription plan không tồn tại"), {
      status: 404,
    });
  }

  return plan;
}

/**
 * Xóa subscription plan (admin only)
 */
export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  const plan = await SubscriptionPlan.findByIdAndDelete(planId);

  if (!plan) {
    throw Object.assign(new Error("Subscription plan không tồn tại"), {
      status: 404,
    });
  }
}

