// src/config/openapi.ts
import path from 'path';
import { SwaggerDefinition } from 'swagger-jsdoc';

const PORT = process.env.PORT ?? '3000';
const PROTOCOL =
  process.env.SWAGGER_PROTOCOL ??
  (process.env.NODE_ENV === 'production' ? 'https' : 'http');
const HOST = process.env.SWAGGER_HOST ?? 'localhost';
const BASE_PATH = process.env.SWAGGER_BASE_PATH ?? '';
const ROOT = process.cwd();

/**
 * Helper: chuẩn hoá URL server
 * - Cho phép truyền relative path: "/" hoặc "/api"
 * - Cho phép truyền absolute: "https://example.com"
 */
function normalizeServerUrl(url: string): string {
  if (!url) return '/';
  // Cho phép relative path trong prod (safest sau reverse proxy)
  if (url.startsWith('/')) return url;
  // Absolute http/https
  if (/^https?:\/\//i.test(url)) return url;
  // Trường hợp dev đưa "host:port" -> thêm protocol
  return `${PROTOCOL}://${url}`;
}

/**
 * Bạn có thể set 1 trong các ENV sau:
 * - SWAGGER_SERVER_URL: khuyến nghị "/" (hoặc "/api") cho prod
 * - SWAGGER_PUBLIC_URL: absolute URL, ví dụ "https://ev-charging-management-latest.onrender.com"
 * - RENDER_EXTERNAL_URL: Render có thể set biến này (nếu có)
 * - PUBLIC_BACKEND_URL / BACKEND_URL: tuỳ hạ tầng bạn
 *
 * Nếu không set, code sẽ fallback:
 * - Prod: dùng DEFAULT_PUBLIC_URL hoặc "/"
 * - Dev: http://localhost:PORT
 */
const DEFAULT_PUBLIC_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://ev-charging-management-latest.onrender.com' // <- fallback của bạn
    : `${PROTOCOL}://${HOST}:${PORT}${BASE_PATH}`;

const explicitUrlRaw =
  process.env.SWAGGER_SERVER_URL ||
  process.env.SWAGGER_PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  process.env.PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_PUBLIC_URL : '');

const resolvedProdUrl =
  process.env.NODE_ENV === 'production'
    ? normalizeServerUrl(explicitUrlRaw || BASE_PATH || '/')
    : '';

const servers: Array<{ url: string; description?: string }> = [];

if (process.env.NODE_ENV === 'production') {
  // Prod: luôn set đúng 1 server duy nhất
  servers.push({
    url: resolvedProdUrl,
    description: 'Production server',
  });
} else {
  // Dev: nếu có SWAGGER_SERVER_URL → dùng nó
  if (explicitUrlRaw) {
    servers.push({
      url: normalizeServerUrl(explicitUrlRaw),
      description: 'Development (overridden by env)',
    });
  } else {
    servers.push({
      url: `${PROTOCOL}://${HOST}:${PORT}${BASE_PATH}`,
      description: 'Development server',
    });
  }
}

export const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Node.js Backend API',
    version: '1.0.0',
    description: 'API documentation cho Node.js Backend với TypeScript, Express và MongoDB',
    contact: { name: 'API Support', email: 'support@example.com' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          role: { type: 'string', enum: ['user', 'staff', 'admin'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'user123' },
          password: { type: 'string', example: 'password123' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'user123' },
          password: { type: 'string', example: 'password123' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Đăng nhập thành công' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            },
          },
        },
      },
      UpdateProfileRequest: {
        type: 'object',
        required: ['newUsername'],
        properties: { newUsername: { type: 'string', example: 'newuser123' } },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'BadRequest' },
          message: { type: 'string', example: 'Thông báo lỗi chi tiết' },
        },
      },
    },
  },
  tags: [
    { name: 'Authentication', description: 'API liên quan đến xác thực người dùng' },
    { name: 'Users', description: 'API quản lý người dùng' },
    { name: 'System', description: 'API hệ thống' },
  ],
};

export const API_GLOBS = [
  path.resolve(ROOT, 'src/routes/**/*.ts'),
  path.resolve(ROOT, 'src/controllers/**/*.ts'),
  path.resolve(ROOT, 'src/index.ts'),
  path.resolve(ROOT, 'src/**/*.yml'),
  path.resolve(ROOT, 'src/**/*.yaml'),
];
