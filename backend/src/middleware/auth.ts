import { Request, Response, NextFunction } from 'express';

// Extended request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Simple authentication middleware
 * In production, this would validate JWT tokens or session cookies
 */
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // For development, we'll use a simple header-based auth
  const userId = req.headers['x-user-id'] as string;
  const userEmail = req.headers['x-user-email'] as string;

  if (!userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide x-user-id header.'
    });
    return;
  }

  // Attach user info to request
  req.user = {
    id: userId,
    email: userEmail || 'user@example.com'
  };

  next();
};

/**
 * Optional authentication middleware that doesn't require auth
 */
export const optionalAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const userId = req.headers['x-user-id'] as string;
  const userEmail = req.headers['x-user-email'] as string;

  if (userId) {
    req.user = {
      id: userId,
      email: userEmail || 'user@example.com'
    };
  }

  next();
};
