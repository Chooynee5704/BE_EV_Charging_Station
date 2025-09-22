import { Request, Response } from 'express';
import { createUser, getAllUsers, loginUser } from '../services/user.service';
import { AuthenticatedRequest } from '../types';

export async function createUserController(req: Request, res: Response) {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'InvalidInput', message: 'username and password are required' });
    }

    const user = await createUser({ username, password });
    return res.status(201).json(user);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Internal Server Error';
    return res.status(status).json({ error: status === 409 ? 'Conflict' : 'ServerError', message });
  }
}

export async function getAllUsersController(_req: Request, res: Response) {
  try {
    const users = await getAllUsers();
    return res.status(200).json(users);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Internal Server Error';
    return res.status(status).json({ error: 'ServerError', message });
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'InvalidInput',
        message: 'username and password are required'
      });
    }

    if (username.trim().length === 0 || password.length === 0) {
      return res.status(400).json({
        error: 'InvalidInput',
        message: 'username and password must not be empty'
      });
    }

    const result = await loginUser({ username: username.trim(), password });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Server error';

    return res.status(status).json({
      success: false,
      error: status === 401 ? 'Unauthorized' : 'ServerError',
      message
    });
  }
}

export async function getUserProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved',
      data: {
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role
      }
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Unexpected server error'
    });
  }
}

export async function updateUserProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const { newUsername } = req.body as { newUsername?: string };

    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'InvalidInput',
        message: 'newUsername is required'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated',
      data: {
        userId: req.user.userId,
        username: newUsername.trim(),
        role: req.user.role,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Unexpected server error'
    });
  }
}
