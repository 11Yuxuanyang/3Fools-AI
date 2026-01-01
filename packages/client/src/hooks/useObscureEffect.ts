/**
 * 马赛克/模糊遮挡效果 Hook
 * 处理涂抹遮罩和应用效果的逻辑
 */

import { useState, useRef, useCallback } from 'react';
import { CanvasItem } from '../types';
import { applyObscureEffect, EffectType } from '../utils/imageEffects';

interface UseObscureEffectProps {
  items: CanvasItem[];
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setProcessingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface UseObscureEffectReturn {
  // 状态
  obscureEditingId: string | null;
  obscureEffectType: EffectType | null;
  obscureBrushSize: number;
  isObscureDrawing: boolean;
  hasObscureContent: boolean;
  obscureIntensity: number;

  // 状态设置器
  setObscureBrushSize: (size: number) => void;
  setIsObscureDrawing: (drawing: boolean) => void;
  setObscureIntensity: (intensity: number) => void;

  // Canvas ref
  obscureCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  effectCanvasRef: React.RefObject<HTMLCanvasElement | null>;

  // 方法
  openObscureEdit: (itemId: string, effectType: EffectType) => void;
  cancelObscureEdit: () => void;
  clearObscure: () => void;
  confirmObscureEdit: () => Promise<void>;
  drawObscureBrush: (x: number, y: number, isStart: boolean) => void;
  resetLastPoint: () => void;
}

export function useObscureEffect({
  items,
  setItems,
  setProcessingIds,
}: UseObscureEffectProps): UseObscureEffectReturn {
  // 当前正在编辑的图片 ID
  const [obscureEditingId, setObscureEditingId] = useState<string | null>(null);
  // 当前效果类型
  const [obscureEffectType, setObscureEffectType] = useState<EffectType | null>(null);
  // 画笔大小
  const [obscureBrushSize, setObscureBrushSize] = useState(30);
  // 效果强度（马赛克块大小 / 模糊半径）
  const [obscureIntensity, setObscureIntensity] = useState(15);
  // 是否正在绘制
  const [isObscureDrawing, setIsObscureDrawing] = useState(false);
  // 是否有绘制内容
  const [hasObscureContent, setHasObscureContent] = useState(false);

  // Canvas ref - 遮罩层
  const obscureCanvasRef = useRef<HTMLCanvasElement>(null);
  // 效果预览层
  const effectCanvasRef = useRef<HTMLCanvasElement>(null);
  // 上一个绘制点（用于平滑绘制）
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // 检查是否有绘制内容
  const checkHasContent = useCallback(() => {
    const canvas = obscureCanvasRef.current;
    if (!canvas) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) return true;
    }
    return false;
  }, []);

  // 生成效果预览图
  const generateEffectPreview = useCallback(async (itemId: string, effectType: EffectType) => {
    const imgElement = document.querySelector(`img[data-item-id="${itemId}"]`) as HTMLImageElement;
    if (!imgElement) return;

    const effectCanvas = effectCanvasRef.current;
    if (!effectCanvas) return;

    const ctx = effectCanvas.getContext('2d');
    if (!ctx) return;

    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;

    effectCanvas.width = width;
    effectCanvas.height = height;

    // 绘制原图
    ctx.drawImage(imgElement, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    if (effectType === 'mosaic') {
      // 应用马赛克效果到整张图
      const blockSize = obscureIntensity;
      for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
            for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
              const idx = ((y + dy) * width + (x + dx)) * 4;
              r += imageData.data[idx];
              g += imageData.data[idx + 1];
              b += imageData.data[idx + 2];
              count++;
            }
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
            for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
              const idx = ((y + dy) * width + (x + dx)) * 4;
              imageData.data[idx] = r;
              imageData.data[idx + 1] = g;
              imageData.data[idx + 2] = b;
            }
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } else {
      // 应用模糊效果
      ctx.filter = `blur(${obscureIntensity}px)`;
      ctx.drawImage(imgElement, 0, 0, width, height);
      ctx.filter = 'none';
    }
  }, [obscureIntensity]);

  // 开始遮挡编辑
  const openObscureEdit = useCallback((itemId: string, effectType: EffectType) => {
    setObscureEditingId(itemId);
    setObscureEffectType(effectType);
    setHasObscureContent(false);

    // 初始化 canvas
    requestAnimationFrame(() => {
      const canvas = obscureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      // 生成效果预览
      generateEffectPreview(itemId, effectType);
    });
  }, [generateEffectPreview]);

  // 取消遮挡编辑
  const cancelObscureEdit = useCallback(() => {
    setObscureEditingId(null);
    setObscureEffectType(null);
    setHasObscureContent(false);
    lastPointRef.current = null;
  }, []);

  // 清除绘制内容
  const clearObscure = useCallback(() => {
    const canvas = obscureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasObscureContent(false);
  }, []);

  // 确认并应用效果
  const confirmObscureEdit = useCallback(async () => {
    if (!obscureEditingId || !obscureEffectType) return;

    const item = items.find(i => i.id === obscureEditingId);
    if (!item?.src) return;

    const maskCanvas = obscureCanvasRef.current;
    if (!maskCanvas) return;

    // 从页面上找到对应的图片元素
    const imgElement = document.querySelector(`img[data-item-id="${obscureEditingId}"]`) as HTMLImageElement;
    if (!imgElement) {
      console.error('[Obscure] 找不到图片元素');
      return;
    }

    // 设置处理状态
    setProcessingIds(prev => new Set(prev).add(obscureEditingId));

    try {
      const resultData = await applyObscureEffect(
        imgElement,
        maskCanvas,
        obscureEffectType,
        obscureIntensity
      );

      // 更新图片
      setItems(prev => prev.map(i =>
        i.id === obscureEditingId ? { ...i, src: resultData } : i
      ));

      // 关闭编辑模式
      cancelObscureEdit();
    } catch (error) {
      console.error('[Obscure] 应用效果失败:', error);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(obscureEditingId);
        return next;
      });
    }
  }, [obscureEditingId, obscureEffectType, obscureIntensity, items, setItems, setProcessingIds, cancelObscureEdit]);

  // 绘制遮罩画笔
  const drawObscureBrush = useCallback((x: number, y: number, isStart: boolean) => {
    const canvas = obscureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = obscureBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isStart || !lastPointRef.current) {
      // 起始点：画一个圆
      ctx.beginPath();
      ctx.arc(x, y, obscureBrushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 连续绘制：画线段
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastPointRef.current = { x, y };
    setHasObscureContent(true);
  }, [obscureBrushSize]);

  // 重置最后一个点
  const resetLastPoint = useCallback(() => {
    lastPointRef.current = null;
  }, []);

  return {
    obscureEditingId,
    obscureEffectType,
    obscureBrushSize,
    isObscureDrawing,
    hasObscureContent,
    obscureIntensity,
    setObscureBrushSize,
    setIsObscureDrawing,
    setObscureIntensity,
    obscureCanvasRef,
    effectCanvasRef,
    openObscureEdit,
    cancelObscureEdit,
    clearObscure,
    confirmObscureEdit,
    drawObscureBrush,
    resetLastPoint,
  };
}
