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

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://ev-charging-management-latest.onrender.com",
  process.env.FRONTEND_URL || "",
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 600,
};

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Node.js Backend API Documentation",
  })
);

// Routes
app.use("/users", userRoutes);
app.use("/stations", stationRoutes);

/**
 * Seed default admin & staff if not exists
 */
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
    },
  });
});

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err?.message || err);
  const message =
    process.env.NODE_ENV === "development"
      ? err?.message || "Unknown error"
      : "Something went wrong";
  res.status(500).json({ error: "Internal Server Error", message });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await seedDefaultUsers();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Docs: http://localhost:${port}/api-docs`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
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
