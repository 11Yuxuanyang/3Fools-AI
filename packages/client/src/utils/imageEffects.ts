/**
 * 图片效果处理工具
 * 包含马赛克、模糊等效果
 */

/**
 * 马赛克/模糊效果类型
 */
export type EffectType = 'mosaic' | 'blur';

/**
 * 应用遮挡效果（马赛克或模糊）
 * @param imageElement - 页面上的图片元素
 * @param maskCanvas - 遮罩 canvas 元素
 * @param effectType - 效果类型
 * @param intensity - 效果强度
 */
export async function applyObscureEffect(
  imageElement: HTMLImageElement,
  maskCanvas: HTMLCanvasElement,
  effectType: EffectType,
  intensity: number = 10
): Promise<string> {
  const img = imageElement;

  // 创建结果 canvas
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas context');

  // 绘制原图
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 缩放遮罩到图片尺寸
  const maskScaledCanvas = document.createElement('canvas');
  maskScaledCanvas.width = canvas.width;
  maskScaledCanvas.height = canvas.height;
  const maskCtx = maskScaledCanvas.getContext('2d');
  if (!maskCtx) throw new Error('无法创建 mask context');
  maskCtx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  const maskPixels = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

  // 检查遮罩是否有内容
  let maskPixelCount = 0;
  for (let i = 3; i < maskPixels.data.length; i += 4) {
    if (maskPixels.data[i] > 50) maskPixelCount++;
  }
  console.log('[Effect] Mask pixels with alpha > 50:', maskPixelCount);

  if (effectType === 'mosaic') {
    // 马赛克效果
    const imagePixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blockSize = intensity;

    for (let y = 0; y < canvas.height; y += blockSize) {
      for (let x = 0; x < canvas.width; x += blockSize) {
        // 检查块是否在遮罩区域
        let inMask = false;
        for (let dy = 0; dy < blockSize && y + dy < canvas.height && !inMask; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < canvas.width && !inMask; dx++) {
            const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
            if (maskPixels.data[idx + 3] > 50) inMask = true;
          }
        }
        if (!inMask) continue;

        // 计算平均颜色
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = 0; dy < blockSize && y + dy < canvas.height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < canvas.width; dx++) {
            const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
            r += imagePixels.data[idx];
            g += imagePixels.data[idx + 1];
            b += imagePixels.data[idx + 2];
            count++;
          }
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // 填充块
        for (let dy = 0; dy < blockSize && y + dy < canvas.height; dy++) {
          for (let dx = 0; dx < blockSize && x + dx < canvas.width; dx++) {
            const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
            imagePixels.data[idx] = r;
            imagePixels.data[idx + 1] = g;
            imagePixels.data[idx + 2] = b;
          }
        }
      }
    }
    ctx.putImageData(imagePixels, 0, 0);
  } else {
    // 模糊效果
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const blurCtx = blurCanvas.getContext('2d');
    if (!blurCtx) throw new Error('无法创建 blur context');

    blurCtx.filter = `blur(${intensity}px)`;
    blurCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const originalPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blurredPixels = blurCtx.getImageData(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < originalPixels.data.length; i += 4) {
      const blend = maskPixels.data[i + 3] / 255;
      if (blend > 0.1) {
        originalPixels.data[i] = originalPixels.data[i] * (1 - blend) + blurredPixels.data[i] * blend;
        originalPixels.data[i + 1] = originalPixels.data[i + 1] * (1 - blend) + blurredPixels.data[i + 1] * blend;
        originalPixels.data[i + 2] = originalPixels.data[i + 2] * (1 - blend) + blurredPixels.data[i + 2] * blend;
      }
    }
    ctx.putImageData(originalPixels, 0, 0);
  }

  return canvas.toDataURL('image/png');
}
