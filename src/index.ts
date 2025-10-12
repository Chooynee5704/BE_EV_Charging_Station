import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import bcrypt from "bcryptjs";
import { connectDatabase } from "./config/database";
import userRoutes from "./routes/user.routes";
import stationRoutes from "./routes/chargingstation.routes";
import { specs } from "./config/swagger";
import { User } from "./models/user.model";
import { seedDefaultSubscriptionPlans } from "./services/subscriptionPlan.service";
import reservationRoutes from "./routes/reservation.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import pricingRoutes from "./routes/pricing.routes";
import vnpayRoutes from "./routes/vnpay.routes";
import transactionRoutes from "./routes/transaction.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import subscriptionPlanRoutes from "./routes/subscriptionPlan.routes";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Koyeb / proxies
app.set("trust proxy", 1);

// -------- CORS SETUP (đã fix trailing slash & preflight) ----------
const normalizeOrigin = (o?: string | null) =>
  (o || "").trim().replace(/\/+$/, ""); // bỏ dấu '/' cuối nếu có

// NOTE: KHÔNG để dấu '/' cuối trong allowedOrigins
const allowedOriginsRaw = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://private-eve-evchargingstation-7d82d2a9.koyeb.app",
  "https://fe-ev-charging-station.vercel.app",
  process.env.FRONTEND_URL || "",
].filter(Boolean);

const allowedOrigins = allowedOriginsRaw.map(normalizeOrigin);

// Cho phép thêm wildcard cùng domain nếu cần (VD: preview.vercel.app)
// Ví dụ: const extraOk = [/^https:\/\/.*\.vercel\.app$/];

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    const nOrigin = normalizeOrigin(origin);
    // Cho phép khi:
    // - Request server-to-server (no origin)
    // - Origin nằm trong danh sách cho phép
    const okList = !nOrigin || allowedOrigins.includes(nOrigin); /* ||
      extraOk.some((re) => re.test(nOrigin)) */

    if (okList) return cb(null, true);

    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true, // nếu FE dùng cookie/Authorization
  maxAge: 600,
};

// Đảm bảo Vary: Origin để CDN/proxy cache đúng theo Origin
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

// Helmet: tắt CSP nếu bạn render Swagger/FE khác origin
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// Middleware CORS (chính)
app.use(cors(corsOptions));

// Đảm bảo trả preflight OPTIONS sớm, tránh lọt xuống routes
app.options("*", cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- SWAGGER ----------------
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Node.js Backend API Documentation",
  })
);

// ---------------- ROUTES ----------------
app.use("/users", userRoutes);
app.use("/stations", stationRoutes);
app.use("/reservations", reservationRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/pricing", pricingRoutes);
app.use("/vnpay", vnpayRoutes);
app.use("/transactions", transactionRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/subscription-plans", subscriptionPlanRoutes);

// ---------------- SEED DEFAULT USERS ----------------
async function seedDefaultUsers() {
  try {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const plain = process.env.DEFAULT_SEED_PASSWORD || "12345678";
    const hashed = await bcrypt.hash(plain, saltRounds);

    const candidates = [
      {
        username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
        email: (
          process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com"
        ).toLowerCase(),
        role: "admin" as const,
        fullName: "Default Admin",
      },
      {
        username: process.env.DEFAULT_STAFF_USERNAME || "staff",
        email: (
          process.env.DEFAULT_STAFF_EMAIL || "staff@example.com"
        ).toLowerCase(),
        role: "staff" as const,
        fullName: "Default Staff",
      },
    ];

    for (const c of candidates) {
      const existing = await User.findOne({
        $or: [{ username: c.username }, { email: c.email }],
      });
      if (!existing) {
        await User.create({
          username: c.username,
          email: c.email,
          password: hashed,
          role: c.role,
          profile: { fullName: c.fullName },
        });
        console.log(
          `[seed] Created ${c.role} user (${c.username} / ${c.email})`
        );
      } else {
        console.log(`[seed] ${c.role} exists (${existing.username}) — skip`);
      }
    }
  } catch (err) {
    console.error("[seed] Failed to seed default users:", err);
  }
}

// ---------------- SYSTEM ENDPOINTS ----------------
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Kiểm tra tình trạng server
 */
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running successfully",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * @swagger
 * /:
 *   get:
 *     tags: [System]
 *     summary: API Information
 */
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to Node.js Backend API",
    version: "1.0.0",
    frontend_allowed: allowedOrigins,
    endpoints: {
      health: "/health",
      documentation: "/api-docs",
      users: {
        create: "POST /users/create",
        login: "POST /users/login",
        profile: "GET /users/profile (Protected)",
        updateProfile: "PUT /users/profile (Protected)",
        getAll: "GET /users/get-all (Protected)",
      },
      stations: {
        create: "POST /stations (admin, staff)",
        list: "GET /stations (admin, staff, user)",
        getById: "GET /stations/:id (admin, staff, user)",
        update: "PUT /stations/:id (admin, staff)",
        delete: "DELETE /stations/:id (admin)",
      },
      ports: {
        create: "POST /stations/ports (admin, staff) — body requires stationId",
        getById: "GET /stations/ports/:portId (admin, staff, user)",
        update: "PUT /stations/ports/:portId (admin, staff)",
        delete: "DELETE /stations/ports/:portId (admin)",
      },
      slots: {
        listByPort: "GET /stations/ports/:portId/slots (admin, staff, user)",
        createInPort: "POST /stations/ports/:portId/slots (admin, staff)",
        getById: "GET /stations/slots/:slotId (admin, staff, user)",
        updateById: "PUT /stations/slots/:slotId (admin, staff)",
        deleteById: "DELETE /stations/slots/:slotId (admin)",
      },
      transactions: {
        myHistory: "GET /transactions/my-history (Protected - user)",
        myStats: "GET /transactions/my-stats (Protected - user)",
        list: "GET /transactions (Protected - admin/staff xem tất cả, user xem của mình)",
        getById: "GET /transactions/:id (Protected)",
        create: "POST /transactions (admin, staff)",
        stats: "GET /transactions/stats/:userId (admin, staff)",
      },
      vnpay: {
        checkoutUrl: "POST /vnpay/checkout-url (Protected - tạo URL thanh toán)",
        return: "GET /vnpay/return (callback từ VNPay)",
        ipn: "GET /vnpay/ipn (webhook từ VNPay)",
        checkPaymentStatus: "POST /vnpay/check-payment-status (kiểm tra trạng thái thanh toán)",
      },
      subscriptionPlans: {
        list: "GET /subscription-plans (danh sách gói: basic, standard, premium)",
        getById: "GET /subscription-plans/:id (chi tiết gói)",
        create: "POST /subscription-plans (admin - tạo gói mới)",
        update: "PUT /subscription-plans/:id (admin - cập nhật gói)",
        delete: "DELETE /subscription-plans/:id (admin - xóa gói)",
      },
      subscriptions: {
        create: "POST /subscriptions (admin - tạo subscription bằng planId)",
        payment: "POST /subscriptions/payment (Protected - tạo subscription + payment URL bằng planId)",
        checkPayment: "POST /subscriptions/check-payment-status (Protected - kiểm tra trạng thái thanh toán)",
        list: "GET /subscriptions (Protected - tất cả user có thể xem)",
        mySubscriptions: "GET /subscriptions/my-subscriptions (Protected - xem subscriptions của mình)",
        currentActive: "GET /subscriptions/current-active (Protected - xem subscription đang hoạt động)",
        getById: "GET /subscriptions/:id (Protected)",
        update: "PUT /subscriptions/:id (admin - cập nhật subscription)",
        delete: "DELETE /subscriptions/:id (admin - xóa subscription)",
        upgrade: "POST /subscriptions/upgrade (Protected - nâng cấp bằng planId)",
        cancel: "POST /subscriptions/:id/cancel (Protected - hủy subscription)",
        activate: "POST /subscriptions/:id/activate (admin - kích hoạt subscription)",
      },
    },
  });
});

// ---------------- 404 HANDLER ----------------
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ---------------- ERROR HANDLER ----------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err?.message || err);
  const message =
    process.env.NODE_ENV === "development"
      ? err?.message || "Unknown error"
      : "Something went wrong";
  res.status(500).json({ error: "Internal Server Error", message });
});

// ---------------- START SERVER ----------------
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await seedDefaultUsers();
    await seedDefaultSubscriptionPlans();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Docs: http://localhost:${port}/api-docs`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`[CORS allowlist]`, allowedOrigins);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

startServer();

export default app;
