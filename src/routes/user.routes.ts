import { Router } from 'express';
import {
  createUserController,
  getAllUsersController,
  loginController,
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
} from '../controllers/user.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /users/create:
 *   post:
 *     tags: [Authentication]
 *     summary: Create a new user account
 *     description: |
 *       Registers a new user with **username, password, email, fullName** (required).
 *       Optional: **dob** (YYYY-MM-DD) and **address** (string or structured object).
 *       Role is always set to `user`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, email, fullName]
 *             properties:
 *               username: { type: string, example: "bill" }
 *               password: { type: string, format: password, example: "Sup3r$ecret!" }
 *               email:    { type: string, format: email, example: "bill@example.com" }
 *               fullName: { type: string, example: "Bill Bill" }
 *               dob:      { type: string, format: date, example: "2000-01-31" }
 *               address:
 *                 oneOf:
 *                   - type: string
 *                     example: "A12, Vinhomes Grand Park, TP. Thủ Đức"
 *                   - type: object
 *                     properties:
 *                       line1:      { type: string, example: "A12, Vinhomes Grand Park" }
 *                       line2:      { type: string, example: "Block S5.02, Apt 15.08" }
 *                       ward:       { type: string, example: "Long Thạnh Mỹ" }
 *                       district:   { type: string, example: "TP. Thủ Đức" }
 *                       city:       { type: string, example: "Hồ Chí Minh" }
 *                       province:   { type: string, example: "Hồ Chí Minh" }
 *                       country:    { type: string, example: "VN" }
 *                       postalCode: { type: string, example: "700000" }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 *       409: { description: Username or Email already exists }
 *       500: { description: Server error }
 */
router.post('/create', createUserController);

/**
 * @swagger
 * /users/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login
 *     description: |
 *       Authenticates a user with **username** and **password** and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: "bill" }
 *               password: { type: string, format: password, example: "Sup3r$ecret!" }
 *     responses:
 *       200: { description: Login successful }
 *       400: { description: Validation error }
 *       401: { description: Invalid credentials }
 *       500: { description: Server error }
 */
router.post('/login', loginController);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get the authenticated user profile
 *     description: 'Requires JWT token. Roles allowed: admin, staff, user.'
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Profile retrieved
 *       401: { description: Unauthorized }
 *       500: { description: Server error }
 */
router.get('/profile', authenticateToken, authorizeRoles('admin', 'staff', 'user'), getUserProfileController);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update authenticated user profile
 *     description: |
 *       Requires JWT token. Roles allowed: admin, staff, user.
 *       Các field **đều tùy chọn**; chỉ field gửi lên mới được cập nhật.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: "meomeo.new" }
 *               email:    { type: string, format: email, example: "meomeo.new@example.com" }
 *               phone:    { type: string, example: "+84901234567" }
 *               fullName: { type: string, example: "Meo Meo" }
 *               dob:
 *                 oneOf:
 *                   - { type: string, format: date, example: "2001-02-01" }
 *                   - { type: "null" }
 *               address:
 *                 oneOf:
 *                   - { type: string, example: "A12, Vinhomes Grand Park" }
 *                   - { type: "null" }
 *                   - type: object
 *                     properties:
 *                       line1: { type: string }
 *                       line2: { type: string }
 *                       ward: { type: string }
 *                       district: { type: string }
 *                       city: { type: string }
 *                       province: { type: string }
 *                       country: { type: string }
 *                       postalCode: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       409: { description: Conflict (username/email already exists) }
 *       500: { description: Server error }
 */
router.put('/profile', authenticateToken, authorizeRoles('admin', 'staff', 'user'), updateUserProfileController);

/**
 * @swagger
 * /users/password:
 *   put:
 *     tags: [Users]
 *     summary: Change password (self)
 *     description: |
 *       Requires JWT token. Roles allowed: admin, staff, user.
 *       - Yêu cầu `oldPassword` và `newPassword`.
 *       - `newPassword` tối thiểu 8 ký tự và phải khác mật khẩu cũ.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string, format: password, example: "OldP@ssw0rd" }
 *               newPassword: { type: string, format: password, example: "N3wP@ssw0rd!" }
 *               confirmNewPassword: { type: string, format: password, example: "N3wP@ssw0rd!" }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Validation error }
 *       401: { description: Old password incorrect / Unauthorized }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */
router.put('/password', authenticateToken, authorizeRoles('admin', 'staff', 'user'), changePasswordController);

/**
 * @swagger
 * /users/get-all:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     description: Requires JWT token with admin role.
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not admin) }
 *       500: { description: Server error }
 */
router.get('/get-all', authenticateToken, authorizeRoles('admin'), getAllUsersController);

export default router;
