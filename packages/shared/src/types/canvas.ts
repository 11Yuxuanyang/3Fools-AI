/**
 * Canvas Types
 * Core types for canvas elements, projects, and tools
 */

export type CanvasItemType =
  | 'image'
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'brush'
  | 'line'
  | 'arrow'
  | 'connection';

export interface CanvasItem {
  id: string;
  type: CanvasItemType;
  src: string; // Base64 data URL for images, text content for text, empty for shapes
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  prompt?: string; // The prompt used to generate it
  // 裁剪相关 - 保存原始图片信息用于还原
  originalSrc?: string;
  originalWidth?: number;
  originalHeight?: number;
  originalX?: number;
  originalY?: number;
  cropX?: number;
  cropY?: number;
  // Text-specific properties
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  // Shape-specific properties
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  // Brush-specific properties
  points?: { x: number; y: number }[];
  // Line/Arrow-specific properties
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  controlPoint?: { x: number; y: number };
  // Connection-specific properties (溯源连接线)
  sourceItemId?: string;
  targetItemId?: string;
}

export interface Viewport {
  scale: number;
  pan: { x: number; y: number };
}

export interface Project {
  id: string;
  name: string;
  thumbnail?: string;
  items: CanvasItem[];
  createdAt: number;
  updatedAt: number;
  viewport?: Viewport;
}

export enum ToolMode {
  SELECT = 'SELECT',
  PAN = 'PAN',
  TEXT = 'TEXT',
  BRUSH = 'BRUSH',
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE',
  LINE = 'LINE',
  ARROW = 'ARROW',
  GENERATE = 'GENERATE',
}

export interface AppState {
  items: CanvasItem[];
  selectedId: string | null;
  toolMode: ToolMode;
  scale: number;
  pan: { x: number; y: number };
  isGenerating: boolean;
  generatingMessage: string;
}

// 画布元素上下文（用于 AI 对话）
export interface CanvasItemContext {
  id: string;
  type: CanvasItemType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  imageData?: string;
  prompt?: string;
  textContent?: string;
  fill?: string;
  stroke?: string;
}

// 画布上下文
export interface CanvasContext {
  items: CanvasItemContext[];
  selectedIds: string[];
}
