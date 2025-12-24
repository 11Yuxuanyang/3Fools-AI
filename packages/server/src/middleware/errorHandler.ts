import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export class HttpError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  static badRequest(message: string, code?: string) {
    return new HttpError(message, 400, code);
  }

  static unauthorized(message: string = '未授权', code?: string) {
    return new HttpError(message, 401, code);
  }

  static forbidden(message: string = '禁止访问', code?: string) {
    return new HttpError(message, 403, code);
  }

  static notFound(message: string = '资源未找到', code?: string) {
    return new HttpError(message, 404, code);
  }

  static tooManyRequests(message: string = '请求过于频繁', code?: string) {
    return new HttpError(message, 429, code);
  }

  static internal(message: string = '服务器内部错误', code?: string) {
    return new HttpError(message, 500, code);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // Log error
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    ...(isDev && { stack: err.stack }),
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    error: isDev || err.isOperational ? err.message : '服务器内部错误',
    ...(err.code && { code: err.code }),
    ...(isDev && { stack: err.stack }),
  });
};

/**
 * 404 handler for unknown routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `路由 ${req.method} ${req.path} 不存在`,
  });
};
