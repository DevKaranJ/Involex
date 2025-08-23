import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError | string | null,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Convert string or null errors to proper Error objects
  let error: AppError;
  
  if (typeof err === 'string') {
    error = new Error(err) as AppError;
  } else if (!err) {
    error = new Error('Unknown error occurred') as AppError;
  } else {
    error = err;
  }

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      status: error.status,
      error: error,
      message: error.message,
      stack: error.stack
    });
  } else {
    // Production error response
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: error.status,
        message: error.message
      });
    } else {
      // Programming or unknown error
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
      });
    }
  }
};
