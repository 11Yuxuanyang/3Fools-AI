/**
 * 马赛克/模糊遮挡编辑覆盖层
 */

import React, { useRef, useCallback } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { EffectType } from '../utils/imageEffects';

interface ObscureEditOverlayProps {
  width: number;
  height: number;
  scale: number;
  effectType: EffectType;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  intensity: number;
  onIntensityChange: (intensity: number) => void;
  hasContent: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  effectCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  onDraw: (x: number, y: number, isStart: boolean) => void;
  onResetLastPoint: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onClear: () => void;
}

export const ObscureEditOverlay: React.FC<ObscureEditOverlayProps> = ({
  width,
  height,
  scale,
  effectType,
  brushSize,
  onBrushSizeChange,
  intensity,
  onIntensityChange,
  hasContent,
  canvasRef,
  effectCanvasRef,
  isDrawing,
  setIsDrawing,
  onDraw,
  onResetLastPoint,
  onConfirm,
  onCancel,
  onClear,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const drawEffectPreview = useCallback((x: number, y: number, isStart: boolean) => {
    const previewCanvas = previewCanvasRef.current;
    const effectCanvas = effectCanvasRef.current;
    if (!previewCanvas || !effectCanvas) return;

    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    const scaleX = effectCanvas.width / width;
    const scaleY = effectCanvas.height / height;

    const drawCircle = (cx: number, cy: number) => {
      const radius = brushSize / 2;
      const ex = cx * scaleX;
      const ey = cy * scaleY;
      const er = radius * Math.max(scaleX, scaleY);

      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      previewCtx.clip();
      previewCtx.drawImage(
        effectCanvas,
        ex - er, ey - er, er * 2, er * 2,
        cx - radius, cy - radius, radius * 2, radius * 2
      );
      previewCtx.restore();
    };

    if (isStart || !lastPointRef.current) {
      drawCircle(x, y);
    } else {
      const dx = x - lastPointRef.current.x;
      const dy = y - lastPointRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(dist / (brushSize / 4)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        drawCircle(lastPointRef.current.x + dx * t, lastPointRef.current.y + dy * t);
      }
    }
    lastPointRef.current = { x, y };
  }, [brushSize, effectCanvasRef, width, height]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    setIsDrawing(true);
    onResetLastPoint();
    lastPointRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (width / rect.width);
    const y = (e.clientY - rect.top) * (height / rect.height);
    onDraw(x, y, true);
    drawEffectPreview(x, y, true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (width / rect.width);
    const y = (e.clientY - rect.top) * (height / rect.height);
    onDraw(x, y, false);
    drawEffectPreview(x, y, false);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    onResetLastPoint();
    lastPointRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -5 : 5;
    onBrushSizeChange(Math.min(80, Math.max(10, brushSize + delta)));
  };

  const handleClear = () => {
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    lastPointRef.current = null;
    onClear();
  };

  const cursorSize = Math.min(Math.max(brushSize, 16), 64);

  return (
    <>
      <canvas ref={canvasRef} width={width} height={height} style={{ display: 'none' }} />
      <canvas ref={effectCanvasRef} style={{ display: 'none' }} />

      <canvas
        ref={previewCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0 rounded-lg pointer-events-auto"
        style={{
          width,
          height,
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}'%3E%3Ccircle cx='${cursorSize/2}' cy='${cursorSize/2}' r='${cursorSize/2-1}' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${cursorSize/2} ${cursorSize/2}, crosshair`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* 工具栏 */}
      <div
        className="absolute left-1/2 z-10"
        style={{
          top: -44 / scale,
          transform: `translateX(-50%) scale(${1 / scale})`,
          transformOrigin: 'bottom center',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md">
          <span className="text-xs text-gray-500">
            {effectType === 'mosaic' ? '马赛克' : '模糊'}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">画笔</span>
            <input
              type="range"
              min="10"
              max="80"
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="w-16 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:bg-violet-500
                [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <button
            onClick={handleClear}
            disabled={!hasContent}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="清除"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="取消"
          >
            <X size={14} />
          </button>

          <button
            onClick={onConfirm}
            disabled={!hasContent}
            className="flex items-center gap-1 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs px-2 py-1 rounded"
          >
            <Check size={12} />
            确定
          </button>
        </div>
      </div>
    </>
  );
};
