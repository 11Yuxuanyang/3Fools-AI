import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler';

/**
 * Creates a validation middleware for request body
 */
export const validateBody = <T extends z.ZodType>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(HttpError.badRequest(`验证失败: ${message}`));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Creates a validation middleware for query params
 */
export const validateQuery = <T extends z.ZodType>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(HttpError.badRequest(`查询参数验证失败: ${message}`));
      } else {
        next(error);
      }
    }
  };
};

// Common validation schemas
export const schemas = {
  // AI Generate request
  generateImage: z.object({
    prompt: z.string().min(1, '提示词不能为空').max(2000, '提示词过长'),
    model: z.string().optional(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().default('1:1'),
    resolution: z.string().optional(),
  }),

  // AI Edit request
  editImage: z.object({
    prompt: z.string().min(1, '提示词不能为空').max(2000, '提示词过长'),
    image: z.string().min(1, '图片数据不能为空'),
    model: z.string().optional(),
  }),

  // AI Upscale request
  upscaleImage: z.object({
    image: z.string().min(1, '图片数据不能为空'),
    model: z.string().optional(),
  }),

  // Chat request
  chatMessage: z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string().max(10000, '消息内容过长'),
          attachments: z
            .array(
              z.object({
                type: z.string(),
                content: z.string(),
              })
            )
            .optional(),
        })
      )
      .min(1, '消息列表不能为空')
      .max(50, '消息数量过多'),
    webSearchEnabled: z.boolean().optional().default(false),
    stream: z.boolean().optional().default(true),
  }),
};
