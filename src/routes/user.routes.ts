import { Router } from 'express';
import {
  createUserController,
  getAllUsersController,
  loginController,
  getUserProfileController,
  updateUserProfileController
} from '../controllers/user.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /users/create:
 *   post:
 *     tags: [Authentication]
 *     summary: Create a new user account
 *     description: Registers a new user with username and password. Role is always set to `user`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       default:
 *         description: ''
 */
router.post('/create', createUserController);

/**
 * @swagger
 * /users/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login
 *     description: Authenticates a user with username and password and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       default:
 *         description: ''
 */
router.post('/login', loginController);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get the authenticated user profile
 *     description: 'Requires JWT token. Roles allowed: admin, staff, user.'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       default:
 *         description: ''
 */
router.get('/profile', authenticateToken, authorizeRoles('admin', 'staff', 'user'), getUserProfileController);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update authenticated user profile
 *     description: 'Requires JWT token. Roles allowed: admin, staff, user.'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       default:
 *         description: ''
 */
router.put('/profile', authenticateToken, authorizeRoles('admin', 'staff', 'user'), updateUserProfileController);

/**
 * @swagger
 * /users/get-all:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     description: Requires JWT token with admin role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       default:
 *         description: ''
 */
router.get('/get-all', authenticateToken, authorizeRoles('admin'), getAllUsersController);

export default router;
