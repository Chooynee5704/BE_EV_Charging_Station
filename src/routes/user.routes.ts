import { Router } from "express";
import {
  createUserController,
  getAllUsersController,
  loginController,
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
  getUserByIdController,
  updateUserDetailController,
} from "../controllers/user.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";
import {
  forgotPasswordController,
  resetPasswordController,
  verifyResetTokenController,
  verifyResetOtpController,
} from "../controllers/passwordReset.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *   - name: Users
 */

router.post("/create", createUserController);
/**
 * @swagger
 * /users/create:
 *   post:
 *     tags: [Authentication]
 *     summary: Create a new user account
 *     description: |
 *       Registers a new user with **username, password, email, fullName** (required).
 *       Optional: **dob** (YYYY-MM-DD), **address** (string or structured object), and **numberphone** (phone number).
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
 *               email: { type: string, format: email, example: "bill@example.com" }
 *               fullName: { type: string, example: "Bill Bill" }
 *               dob: { type: string, format: date, example: "2000-01-31" }
 *               address:
 *                 oneOf:
 *                   - type: string
 *                     example: "A12, Vinhomes Grand Park, TP. Thủ Đức"
 *                   - type: object
 *                     properties:
 *                       line1: { type: string, example: "A12, Vinhomes Grand Park" }
 *                       line2: { type: string, example: "Block S5.02, Apt 15.08" }
 *                       ward: { type: string, example: "Long Thạnh Mỹ" }
 *                       district: { type: string, example: "TP. Thủ Đức" }
 *                       city: { type: string, example: "Hồ Chí Minh" }
 *                       province: { type: string, example: "Hồ Chí Minh" }
 *                       country: { type: string, example: "VN" }
 *                       postalCode: { type: string, example: "700000" }
 *               numberphone: { type: string, example: "+84901234567" }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 *       409: { description: Username or Email already exists }
 *       500: { description: Server error }
 */

router.post("/login", loginController);
/**
 * @swagger
 * /users/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login
 *     description: Authenticates a user with **username** and **password** and returns a JWT token.
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

router.get(
  "/profile",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  getUserProfileController
);
/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get the authenticated user profile
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Profile retrieved }
 *       401: { description: Unauthorized }
 *       500: { description: Server error }
 */

router.put(
  "/profile",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  updateUserProfileController
);
/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update authenticated user profile
 *     description: |
 *       Requires JWT token. Roles allowed: admin, staff, user.
 *       Admins may supply `userId` to update another user's status or profile.
 *       Staff/User can only update their own profile details.
 *       All input fields are optional; only provided values are updated.
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Admin only. Target another user when provided.
 *                 example: "66f8b2ab1f4c3f6e9f123456"
 *               username: { type: string, example: "meomeo.new" }
 *               email: { type: string, format: email, example: "meomeo.new@example.com" }
 *               phone: { type: string, example: "+84901234567" }
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
 *               status:
 *                 type: string
 *                 enum: [active, disabled]
 *                 description: Admin only. Set "disabled" to block login or "active" to re-enable.
 *     responses:
 *       200: { description: Profile updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       409: { description: Conflict (username/email already exists) }
 *       500: { description: Server error }
 */

router.put(
  "/password",
  authenticateToken,
  authorizeRoles("admin", "staff", "user"),
  changePasswordController
);
/**
 * @swagger
 * /users/password:
 *   put:
 *     tags: [Users]
 *     summary: Change password (self)
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

router.get(
  "/get-all",
  authenticateToken,
  authorizeRoles("admin"),
  getAllUsersController
);
/**
 * @swagger
 * /users/get-all:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not admin) }
 *       500: { description: Server error }
 */

router.get(
  "/detail/:userId",
  authenticateToken,
  authorizeRoles("admin"),
  getUserByIdController
);
/**
 * @swagger
 * /users/detail/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by ID (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, example: "66f8b2ab1f4c3f6e9f123456" }
 *     responses:
 *       200: { description: User retrieved }
 *       400: { description: Invalid userId }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not admin) }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */

router.put(
  "/detail/:userId",
  authenticateToken,
  authorizeRoles("admin"),
  updateUserDetailController
);
/**
 * @swagger
 * /users/detail/{userId}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user by ID (admin only)
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, example: "66f8b2ab1f4c3f6e9f123456" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               fullName: { type: string }
 *               dob: { type: string, format: date }
 *               address:
 *                 oneOf:
 *                   - { type: string }
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
 *               status:
 *                 type: string
 *                 enum: [active, disabled]
 *                 description: Admin only
 *     responses:
 *       200: { description: User updated }
 *       400: { description: Invalid input }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (not admin) }
 *       404: { description: User not found }
 *       500: { description: Server error }
 */

router.post("/password/forgot", forgotPasswordController);
/**
 * @swagger
 * /users/password/forgot:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset (send OTP + link)
 *     description: Gửi email chứa OTP 6 số và liên kết đặt lại mật khẩu. Luôn trả 200 để tránh user enumeration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *     responses:
 *       200: { description: If the email exists, an OTP and reset link have been sent }
 *       400: { description: Invalid email }
 *       500: { description: Server error }
 */

router.get("/password/verify", verifyResetTokenController);
/**
 * @swagger
 * /users/password/verify:
 *   get:
 *     tags: [Authentication]
 *     summary: "Verify reset token (legacy: requires uid)"
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: uid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Token is valid }
 *       400: { description: Invalid/expired token }
 */

router.get("/password/otp/verify", verifyResetOtpController);
/**
 * @swagger
 * /users/password/otp/verify:
 *   get:
 *     tags: [Authentication]
 *     summary: "Verify reset OTP (legacy: requires uid)"
 *     parameters:
 *       - in: query
 *         name: otp
 *         required: true
 *         schema: { type: string, example: "123456" }
 *       - in: query
 *         name: uid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OTP is valid }
 *       400: { description: Invalid/expired otp }
 */

router.post("/password/reset", resetPasswordController);
/**
 * @swagger
 * /users/password/reset:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with token or OTP (no uid)
 *     description: Đặt lại mật khẩu bằng **email + token** hoặc **email + otp**.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               token: { type: string, description: "Reset token từ link (trong email)" }
 *               otp: { type: string, description: "OTP 6 số từ email", example: "123456" }
 *               newPassword: { type: string, format: password, example: "N3wP@ssw0rd!" }
 *               confirmNewPassword: { type: string, format: password }
 *             oneOf:
 *               - required: [email, token, newPassword]
 *               - required: [email, otp, newPassword]
 *     responses:
 *       200: { description: Password has been reset }
 *       400: { description: Invalid input or token/otp }
 *       404: { description: User not found }
 */

export default router;
