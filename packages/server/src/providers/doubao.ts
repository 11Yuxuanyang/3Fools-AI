/**
 * 豆包 (Doubao) 图像生成提供商
 * 基于火山引擎 (VolcEngine) Ark API - Seedream 4.0
 * 文档: https://www.volcengine.com/docs/82379
 */

import { AIProvider, GenerateImageParams, EditImageParams, InpaintImageParams, UpscaleImageParams } from './base.js';
import { config } from '../config.js';
import { uploadImages } from '../services/imageUpload.js';

// 安全日志：生产环境不输出敏感详情
const isDev = config.nodeEnv === 'development';
const debugLog = (message: string, data?: unknown) => {
  if (isDev && data !== undefined) {
    console.log(message, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  } else {
    console.log(message);
  }
};

export class DoubaoProvider implements AIProvider {
  name = 'doubao';

  private get cfg() {
    return config.providers.doubao;
  }

  /**
   * 生成图片（文生图）
   * 使用 Seedream 4.0 模型
   */
  async generateImage(params: GenerateImageParams): Promise<string> {
    const model = params.model || this.cfg.imageModel || 'doubao-seedream-4-0-250828';

    if (!this.cfg.apiKey) {
      throw new Error('未配置豆包 API Key，请在 .env 中设置 DOUBAO_API_KEY');
    }

    // 豆包 API 的 size 参数支持: 'WIDTHxHEIGHT', '1k', '2k', '4k'
    // 需要将宽高比 + 分辨率转换为具体像素尺寸
    const resolution = (params.size || '2k').toLowerCase(); // 1k, 2k, 4k
    const aspectRatio = params.aspectRatio || '1:1';

    // 根据分辨率获取基础像素
    const basePixels: Record<string, number> = {
      '720': 720,
      '1k': 1024,
      '1080': 1080,
      '2k': 2048,
      '4k': 4096,
    };
    const base = basePixels[resolution] || 2048;

    // 根据宽高比计算具体尺寸
    const [w, h] = aspectRatio.split(':').map(Number);
    const ratio = w / h;
    let width: number, height: number;

    if (ratio >= 1) {
      // 横向或正方形
      width = base;
      height = Math.round(base / ratio);
    } else {
      // 纵向
      height = base;
      width = Math.round(base * ratio);
    }

    // 确保尺寸在有效范围内 [720, 4096]
    width = Math.max(720, Math.min(4096, width));
    height = Math.max(720, Math.min(4096, height));

    const sizeValue = `${width}x${height}`;

    console.log(`[Doubao] 文生图: model=${model}, size=${sizeValue}, prompt="${params.prompt.slice(0, 50)}..."`);

    const requestBody: Record<string, any> = {
      model: model,
      prompt: params.prompt,
      sequential_image_generation: 'disabled',  // 禁用组图生成，只生成单张
      response_format: 'url',                   // 返回 URL
      size: sizeValue,                          // 支持宽高比或分辨率
      stream: false,
      watermark: false,                         // 不添加水印
    };

    debugLog('[Doubao] 请求体:', requestBody);

    const response = await fetch(`${this.cfg.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      console.error('[Doubao] API 错误:', error);
      throw new Error(error.error?.message || `豆包 API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    debugLog('[Doubao] 响应:', data);

    // 尝试获取 base64 数据
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }

    // 如果返回的是 URL，需要下载并转换
    const url = data.data?.[0]?.url;
    if (url) {
      console.log('[Doubao] 返回 URL，正在下载转换为 base64...');
      return await this.urlToBase64(url);
    }

    throw new Error('豆包未返回图片数据');
  }

  /**
   * 编辑图片（图生图）
   * 支持单张或多张参考图
   * 注意：豆包 API 要求图片为 URL 格式，base64 图片需要先上传到图床
   */
  async editImage(params: EditImageParams): Promise<string> {
    const model = params.model || this.cfg.imageModel || 'doubao-seedream-4-0-250828';

    if (!this.cfg.apiKey) {
      throw new Error('未配置豆包 API Key，请在 .env 中设置 DOUBAO_API_KEY');
    }

    // 处理图片：支持单张或多张
    const images = Array.isArray(params.image) ? params.image : [params.image];

    if (images.length === 0) {
      throw new Error('图生图需要至少一张参考图');
    }

    if (images.length > 5) {
      throw new Error('参考图数量超过限制（最多5张）');
    }

    console.log(`[Doubao] 图生图: model=${model}, 参考图数量=${images.length}, prompt="${params.prompt.slice(0, 50)}..."`);

    // 豆包 API 要求图片为 URL 格式，需要先上传 base64 图片
    let imageUrls: string[];
    try {
      console.log('[Doubao] 上传参考图到图床...');
      imageUrls = await uploadImages(images);
      console.log(`[Doubao] 上传完成，获取到 ${imageUrls.length} 个 URL`);

      // 验证所有 URL 都是有效的
      for (const url of imageUrls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          throw new Error(`图片上传返回了无效的 URL: ${url}`);
        }
      }
    } catch (uploadError: any) {
      console.error('[Doubao] 参考图上传失败:', uploadError.message);
      throw new Error(`参考图上传失败: ${uploadError.message}。请检查 TOS 配置是否正确。`);
    }

    // 构建请求体
    const requestBody: Record<string, any> = {
      model: model,
      prompt: params.prompt,
      // 单张图传字符串，多张图传数组
      image: imageUrls.length === 1 ? imageUrls[0] : imageUrls,
      sequential_image_generation: 'disabled',  // 禁用组图生成，只生成单张
      response_format: 'url',
      stream: false,
      watermark: false,                         // 不添加水印
    };

    debugLog('[Doubao] 图生图请求体:', {
      ...requestBody,
      image: Array.isArray(requestBody.image)
        ? `[${requestBody.image.length} 张图片]`
        : '[1 张图片]'
    });

    const response = await fetch(`${this.cfg.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.cfg.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      if (isDev) {
        console.error('[Doubao] 图生图 API 错误:', JSON.stringify(error, null, 2));
      } else {
        console.error('[Doubao] 图生图 API 错误:', error.error?.code || response.status);
      }

      // 提供更详细的错误信息
      const errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;
      const errorCode = error.error?.code || '';

      if (response.status === 401) {
        throw new Error('豆包 API Key 无效或已过期，请检查 DOUBAO_API_KEY 配置');
      } else if (response.status === 400) {
        throw new Error(`豆包 API 请求参数错误: ${errorMessage}`);
      } else if (response.status === 429) {
        throw new Error('豆包 API 请求频率过高，请稍后重试');
      }

      throw new Error(`豆包图生图失败 [${errorCode}]: ${errorMessage}`);
    }

    const data = await response.json();
    debugLog('[Doubao] 图生图响应:', data);

    // 尝试获取 base64 数据
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      console.log('[Doubao] 图生图成功，返回 base64 格式');
      return `data:image/png;base64,${b64}`;
    }

    // 如果返回的是 URL，需要下载并转换
    const url = data.data?.[0]?.url;
    if (url) {
      console.log('[Doubao] 图生图成功，返回 URL，正在下载转换为 base64...');
      try {
        return await this.urlToBase64(url);
      } catch (downloadError: any) {
        console.error('[Doubao] 下载生成的图片失败:', downloadError.message);
        throw new Error(`生成成功但下载图片失败: ${downloadError.message}`);
      }
    }

    if (isDev) {
      console.error('[Doubao] 响应中未找到图片数据:', data);
    } else {
      console.error('[Doubao] 响应中未找到图片数据');
    }
    throw new Error('豆包 API 响应格式异常，未返回图片数据');
  }

  /**
   * 图片修复/擦除
   * 使用遮罩指定要擦除的区域
   * 豆包 Seedream 不直接支持 mask-based inpainting
   * 这里通过将 mask 叠加到原图上，让 AI 识别并擦除
   */
  async inpaintImage(params: InpaintImageParams): Promise<string> {
    const { image, mask, prompt, model } = params;

    if (!this.cfg.apiKey) {
      throw new Error('未配置豆包 API Key，请在 .env 中设置 DOUBAO_API_KEY');
    }

    console.log(`[Doubao] 图片擦除: 合成遮罩后进行擦除`);

    // 将原图和 mask 合成（用于让 AI 识别要擦除的区域）
    const compositeImage = await this.compositeImageWithMask(image, mask);

    // 构建擦除提示词
    const inpaintPrompt = prompt
      ? `请擦除图片中被蓝色半透明区域覆盖的部分，${prompt}，保持整体风格和背景的一致性`
      : '请擦除图片中被蓝色半透明区域覆盖的部分，用周围的背景自然填充，保持整体风格一致';

    // 使用 editImage 进行擦除
    return this.editImage({
      image: compositeImage,
      prompt: inpaintPrompt,
      model,
    });
  }

  /**
   * 将原图和遮罩合成
   * 遮罩区域显示为半透明蓝色，便于 AI 识别
   */
  private async compositeImageWithMask(image: string, mask: string): Promise<string> {
    // 由于服务端没有 Canvas API，我们使用 sharp 库进行图片处理
    // 如果没有安装 sharp，我们直接返回原图并在 prompt 中描述
    try {
      const sharp = await import('sharp').then(m => m.default);

      // 解析 base64 图片
      const imageBuffer = Buffer.from(
        image.includes(',') ? image.split(',')[1] : image,
        'base64'
      );
      const maskBuffer = Buffer.from(
        mask.includes(',') ? mask.split(',')[1] : mask,
        'base64'
      );

      // 获取原图信息
      const imageMetadata = await sharp(imageBuffer).metadata();
      const width = imageMetadata.width || 1024;
      const height = imageMetadata.height || 1024;

      // 将 mask 调整为与原图相同尺寸
      const resizedMask = await sharp(maskBuffer)
        .resize(width, height)
        .toBuffer();

      // 创建半透明蓝色遮罩（将白色区域变为半透明蓝色）
      const blueOverlay = await sharp(resizedMask)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 处理像素：白色变蓝色半透明，黑色变完全透明
      const pixels = blueOverlay.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (brightness > 128) {
          // 白色区域 -> 半透明蓝色
          pixels[i] = 59;      // R (蓝色)
          pixels[i + 1] = 130; // G
          pixels[i + 2] = 246; // B
          pixels[i + 3] = 150; // A (半透明)
        } else {
          // 黑色区域 -> 完全透明
          pixels[i + 3] = 0;
        }
      }

      // 将处理后的 overlay 转回 buffer
      const overlayBuffer = await sharp(pixels, {
        raw: { width, height, channels: 4 }
      }).png().toBuffer();

      // 合成图片
      const composite = await sharp(imageBuffer)
        .composite([{ input: overlayBuffer, blend: 'over' }])
        .png()
        .toBuffer();

      return `data:image/png;base64,${composite.toString('base64')}`;
    } catch (_error) {
      console.warn('[Doubao] sharp 库不可用，直接使用原图进行擦除');
      // 如果 sharp 不可用，直接返回原图
      return image;
    }
  }

  /**
   * 放大图片
   * 豆包 Seedream 暂不支持
   */
  async upscaleImage(_params: UpscaleImageParams): Promise<string> {
    throw new Error('豆包 Seedream 暂不支持图片放大功能');
  }

  /**
   * 将 URL 图片转换为 base64
   */
  private async urlToBase64(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // 尝试从 Content-Type 获取格式
    const contentType = response.headers.get('content-type') || 'image/png';

    return `data:${contentType};base64,${base64}`;
  }
}
