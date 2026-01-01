/**
 * CanvasContext - 画布状态上下文
 * 用于在画布组件树中共享状态，避免 prop drilling
 */

import { createContext, useContext, ReactNode } from 'react';
import { CanvasItem } from '../../types';

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasContextValue {
  // 基础状态
  items: CanvasItem[];
  selectedIds: string[];
  scale: number;

  // 裁剪
  croppingImageId: string | null;
  cropBox: CropBox;
  setCropBox: React.Dispatch<React.SetStateAction<CropBox>>;
  startCropping: (id: string) => void;
  applyCrop: () => void;

  // 遮罩编辑
  maskEditingId: string | null;
  maskEditMode: 'erase' | 'repaint';
  maskBrushSize: number;
  setMaskBrushSize: (size: number) => void;
  maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isMaskDrawing: boolean;
  setIsMaskDrawing: (v: boolean) => void;
  drawMaskBrush: (x: number, y: number, isStart: boolean) => void;
  resetLastPoint: () => void;
  repaintPrompt: string;
  setRepaintPrompt: (v: string) => void;
  startMaskEdit: (id: string, mode: 'erase' | 'repaint') => void;
  startMaskRepaint: () => void;
  cancelMaskEdit: () => void;
  processingIds: string[];

  // 文字编辑
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;

  // 交互回调
  handleResizeStart: (e: React.MouseEvent, corner: string) => void;
  handleLinePointDrag: (
    e: React.MouseEvent,
    itemId: string,
    pointType: 'start' | 'end'
  ) => void;
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;

  // 生成任务
  generatingTasks: Array<{
    id: string;
    position: { x: number; y: number; width: number; height: number };
    prompt: string;
  }>;
  setGeneratingTasks: React.Dispatch<React.SetStateAction<Array<{
    id: string;
    position: { x: number; y: number; width: number; height: number };
    prompt: string;
  }>>>;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvasContext() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within CanvasProvider');
  }
  return context;
}

interface CanvasProviderProps {
  value: CanvasContextValue;
  children: ReactNode;
}

export function CanvasProvider({ value, children }: CanvasProviderProps) {
  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}
