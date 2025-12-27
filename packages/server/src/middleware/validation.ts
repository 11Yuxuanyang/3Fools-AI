import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { HttpError } from './errorHandler.js';

/**
 * 安全限制常量
 */
export const LIMITS = {
  // 图片数据最大大小（10MB Base64 编码约 13.3MB 字符）
  MAX_IMAGE_SIZE: 15 * 1024 * 1024, // 15MB 字符
  // 提示词最大长度
  MAX_PROMPT_LENGTH: 2000,
  // 单条消息最大长度
  MAX_MESSAGE_LENGTH: 10000,
  // 最大消息数量
  MAX_MESSAGES: 50,
  // 支持的提供商列表
  SUPPORTED_PROVIDERS: ['openai', 'doubao', 'qwen', 'custom'] as const,
  // 支持的宽高比
  SUPPORTED_ASPECT_RATIOS: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'] as const,
};

/**
 * 自定义验证：Base64 图片数据
 * 验证格式和大小
 */
const base64ImageSchema = z.string()
  .min(1, '图片数据不能为空')
  .max(LIMITS.MAX_IMAGE_SIZE, `图片数据过大（最大 ${Math.floor(LIMITS.MAX_IMAGE_SIZE / 1024 / 1024)}MB）`)
  .refine(
    (val) => {
      // 允许 data URL 格式或纯 base64
      if (val.startsWith('data:image/')) {
        return /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(val);
      }
      // 纯 base64 检查（简单验证）
      return /^[A-Za-z0-9+/]+=*$/.test(val.slice(0, 100));
    },
    { message: '无效的图片数据格式' }
  );

/**
 * 提供商验证 Schema
 */
const providerSchema = z.enum(LIMITS.SUPPORTED_PROVIDERS).optional();

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
        const message = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
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
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(HttpError.badRequest(`查询参数验证失败: ${message}`));
      } else {
        next(error);
      }
    }
  };
};

/**
 * 通用验证 schemas
 * 所有 AI API 请求验证规则
 */
export const schemas = {
  /**
   * AI 图像生成请求
   * POST /api/ai/generate
   * 支持可选的参考图进行 AI 融合生成
   */
  generateImage: z.object({
    prompt: z.string()
      .min(1, '提示词不能为空')
      .max(LIMITS.MAX_PROMPT_LENGTH, '提示词过长'),
    model: z.string().optional(),
    aspectRatio: z.enum(LIMITS.SUPPORTED_ASPECT_RATIOS).optional().default('1:1'),
    size: z.string().optional(),  // 图片尺寸（1K/2K/4K 等）
    watermark: z.boolean().optional(),             // 是否添加水印
    referenceImage: base64ImageSchema.optional(), // 参考图（用于 AI 融合）
    provider: providerSchema,
  }),

  /**
   * AI 图像编辑请求
   * POST /api/ai/edit
   * 支持单张或多张参考图
   */
  editImage: z.object({
    prompt: z.string()
      .min(1, '提示词不能为空')
      .max(LIMITS.MAX_PROMPT_LENGTH, '提示词过长'),
    image: z.union([
      base64ImageSchema,                          // 单张图片
      z.array(base64ImageSchema).min(1).max(5),   // 多张参考图（最多5张）
    ]),
    model: z.string().optional(),
    provider: providerSchema,
  }),

  /**
   * AI 图像修复/擦除请求
   * POST /api/ai/inpaint
   */
  inpaintImage: z.object({
    image: base64ImageSchema,  // 原始图片
    mask: base64ImageSchema,   // 遮罩图片（白色区域表示要擦除的区域）
    prompt: z.string().max(LIMITS.MAX_PROMPT_LENGTH).optional(), // 可选提示词
    model: z.string().optional(),
    provider: providerSchema,
  }),

  /**
   * AI 图像放大请求
   * POST /api/ai/upscale
   */
  upscaleImage: z.object({
    image: base64ImageSchema, // 使用增强的图片验证
    model: z.string().optional(),
    resolution: z.enum(['2K', '4K']).optional(),
    provider: providerSchema,
  }),

  /**
   * 聊天请求
   * POST /api/chat
   */
  chatMessage: z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          // 支持字符串或多模态数组
          content: z.union([
            z.string().max(LIMITS.MAX_MESSAGE_LENGTH, '消息内容过长'),
            z.array(
              z.union([
                z.object({ type: z.literal('text'), text: z.string() }),
                z.object({
                  type: z.literal('image_url'),
                  image_url: z.object({ url: z.string() }),
                }),
              ])
            ),
          ]),
          attachments: z
            .array(
              z.object({
                name: z.string().optional(), // 文件名（用于 RAG 文档处理）
                type: z.string(),
                content: z.string().max(LIMITS.MAX_IMAGE_SIZE, '附件内容过大'),
              })
            )
            .optional(),
        })
      )
      .min(1, '消息列表不能为空')
      .max(LIMITS.MAX_MESSAGES, '消息数量过多'),
    webSearchEnabled: z.boolean().optional().default(false),
    stream: z.boolean().optional().default(true),
    provider: providerSchema,
    // 画布上下文
    canvasContext: z
      .object({
        items: z.array(
          z.object({
            id: z.string(),
            type: z.enum(['image', 'text', 'rectangle', 'circle', 'brush', 'line', 'arrow', 'connection']),
            position: z.object({ x: z.number(), y: z.number() }),
            size: z.object({ width: z.number(), height: z.number() }),
            imageData: z.string().optional(),
            prompt: z.string().optional(),
            textContent: z.string().optional(),
            fill: z.string().optional(),
            stroke: z.string().optional(),
          })
        ),
        selectedIds: z.array(z.string()),
      })
      .optional(),
  }),
};

/**
 * 导出类型（供其他模块使用）
 */
export type GenerateImageInput = z.infer<typeof schemas.generateImage>;
export type EditImageInput = z.infer<typeof schemas.editImage>;
export type InpaintImageInput = z.infer<typeof schemas.inpaintImage>;
export type UpscaleImageInput = z.infer<typeof schemas.upscaleImage>;
export type ChatMessageInput = z.infer<typeof schemas.chatMessage>;
