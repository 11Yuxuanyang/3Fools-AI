import { Router, Request, Response } from 'express';
import { getProvider } from '../providers/index.js';
import { asyncHandler, validateBody, schemas, HttpError } from '../middleware/index.js';

export const aiRouter = Router();

/**
 * POST /api/ai/generate
 * 生成图片
 */
aiRouter.post(
  '/generate',
  validateBody(schemas.generateImage),
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, model, aspectRatio } = req.body;

    const provider = getProvider();
    const image = await provider.generateImage({
      prompt,
      model,
      aspectRatio,
    });

    res.json({
      success: true,
      data: { image },
    });
  })
);

/**
 * POST /api/ai/edit
 * 编辑图片
 */
aiRouter.post(
  '/edit',
  validateBody(schemas.editImage),
  asyncHandler(async (req: Request, res: Response) => {
    const { image, prompt, model } = req.body;

    const provider = getProvider();
    const resultImage = await provider.editImage({
      image,
      prompt,
      model,
    });

    res.json({
      success: true,
      data: { image: resultImage },
    });
  })
);

/**
 * POST /api/ai/upscale
 * 放大图片
 */
aiRouter.post(
  '/upscale',
  validateBody(schemas.upscaleImage),
  asyncHandler(async (req: Request, res: Response) => {
    const { image } = req.body;

    const provider = getProvider();

    if (!provider.upscaleImage) {
      throw HttpError.badRequest('当前提供商不支持图片放大功能', 'UNSUPPORTED_OPERATION');
    }

    const resultImage = await provider.upscaleImage({
      image,
    });

    res.json({
      success: true,
      data: { image: resultImage },
    });
  })
);
