// src/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import bcrypt from 'bcryptjs';
import { connectDatabase } from './config/database';
import userRoutes from './routes/user.routes';
import stationRoutes from './routes/chargingstation.routes';
import { specs } from './config/swagger';
import { User } from './models/user.model';

// Load env
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// --- Proxy aware (Render sits behind a proxy) ---
app.set('trust proxy', 1);

// --- CORS: allow FE & same-origin Swagger ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ev-charging-management-latest.onrender.com',
  process.env.FRONTEND_URL || '',
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    // allow non-browser tools (curl/Postman) with no Origin
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,
};

// --- Security headers (relax CSP so Swagger UI works) ---
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// --- Core middleware ---
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // respond to preflights
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Swagger UI ---
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Node.js Backend API Documentation',
  }),
);

// --- Routes ---
app.use('/users', userRoutes);
// ⚡ Mount charging stations router (router dùng path tương đối '/')
app.use('/stations', stationRoutes);

/**
 * Seed default admin & staff if not exists
 * - Username/Email có thể override qua env
 * - Password mặc định: 12345678 (override qua DEFAULT_SEED_PASSWORD)
 */
async function seedDefaultUsers() {
  try {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const plain = process.env.DEFAULT_SEED_PASSWORD || '12345678';
    const hashed = await bcrypt.hash(plain, saltRounds);

    const candidates = [
      {
        username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
        email: (process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com').toLowerCase(),
        role: 'admin' as const,
        fullName: 'Default Admin',
      },
      {
        username: process.env.DEFAULT_STAFF_USERNAME || 'staff',
        email: (process.env.DEFAULT_STAFF_EMAIL || 'staff@example.com').toLowerCase(),
        role: 'staff' as const,
        fullName: 'Default Staff',
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
        console.log(`[seed] Created ${c.role} user (${c.username} / ${c.email})`);
      } else {
        console.log(`[seed] ${c.role} exists (${existing.username}) — skip`);
      }
    }
  } catch (err) {
    console.error('[seed] Failed to seed default users:', err);
  }
}

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Kiểm tra tình trạng server
 *     description: Endpoint để kiểm tra server có đang hoạt động hay không
 *     responses:
 *       200:
 *         description: Server đang hoạt động bình thường
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running successfully',
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
 *     description: Lấy thông tin về API và danh sách endpoints có sẵn
 *     responses:
 *       200:
 *         description: Thông tin API
 */
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Node.js Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      documentation: '/api-docs',
      users: {
        create: 'POST /users/create',
        login: 'POST /users/login',
        profile: 'GET /users/profile (Protected)',
        updateProfile: 'PUT /users/profile (Protected)',
        getAll: 'GET /users/get-all (Protected)',
      },
      stations: {
        create: 'POST /stations (Protected: admin, staff)',
        list: 'GET /stations (Protected: all roles)',
        getById: 'GET /stations/:id (Protected: all roles)',
        update: 'PUT /stations/:id (Protected: admin, staff)',
        delete: 'DELETE /stations/:id (Protected: admin)',
      },
    },
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err?.message || err);
  const message =
    process.env.NODE_ENV === 'development'
      ? err?.message || 'Unknown error'
      : 'Something went wrong';
  res.status(500).json({ error: 'Internal Server Error', message });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await seedDefaultUsers(); // ✅ seed mặc định
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Docs: http://localhost:${port}/api-docs`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;
