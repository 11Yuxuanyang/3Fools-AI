export interface CanvasItem {
  id: string;
  type: 'image' | 'text' | 'rectangle' | 'circle' | 'brush' | 'line' | 'arrow' | 'connection';
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
  originalX?: number;  // 裁剪前原始位置
  originalY?: number;
  cropX?: number;  // 裁剪位置
  cropY?: number;
  // 图片调整属性 - 基础
  brightness?: number;    // 亮度 0-200, 默认 100
  contrast?: number;      // 对比度 0-200, 默认 100
  saturation?: number;    // 饱和度 0-200, 默认 100
  rotation?: number;      // 旋转角度 0-360
  flipH?: boolean;        // 水平翻转
  flipV?: boolean;        // 垂直翻转
  filter?: string;        // 滤镜预设名称
  // 图片调整属性 - 进阶
  exposure?: number;      // 曝光 0-200, 默认 100
  sharpness?: number;     // 锐化 0-200, 默认 100
  highlights?: number;    // 高光 0-200, 默认 100
  shadows?: number;       // 阴影 0-200, 默认 100
  temperature?: number;   // 色温 0-200, 默认 100 (冷-暖)
  tint?: number;          // 色调 0-200, 默认 100 (绿-品红)
  hue?: number;           // 色相 0-360, 默认 0 (色相旋转)
  texture?: number;       // 纹理/清晰度 0-200, 默认 100
  luminanceNoise?: number; // 亮度降噪 0-100, 默认 0
  colorNoise?: number;     // 颜色降噪 0-100, 默认 0
  vignette?: number;      // 晕影 0-100, 默认 0
  grain?: number;         // 颗粒/噪点 0-100, 默认 0
  // 边框
  imgBorderWidth?: number;    // 边框宽度
  imgBorderColor?: string;    // 边框颜色
  imgBorderStyle?: 'solid' | 'dashed' | 'dotted';
  // 阴影
  imgShadowEnabled?: boolean;
  imgShadowX?: number;
  imgShadowY?: number;
  imgShadowBlur?: number;
  imgShadowColor?: string;
  // 水印
  watermarkText?: string;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  watermarkSize?: number;
  watermarkColor?: string;
  watermarkOpacity?: number;
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
  controlPoint?: { x: number; y: number };  // 贝塞尔曲线控制点
  // Connection-specific properties (溯源连接线)
  sourceItemId?: string;  // 起点元素 ID
  targetItemId?: string;  // 终点元素 ID
}

// ============ Project & App Types ============

export interface Project {
  id: string;
  name: string;
  thumbnail?: string; // Base64 data URL of first image or generated preview
  items: CanvasItem[];
  createdAt: number;
  updatedAt: number;
  viewport?: {
    scale: number;
    pan: { x: number; y: number };
  };
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

// ============ Canvas Context Types ============

// 画布元素上下文（用于 AI 对话）
export interface CanvasItemContext {
  id: string;
  type: 'image' | 'text' | 'rectangle' | 'circle' | 'brush' | 'line' | 'arrow' | 'connection';
  position: { x: number; y: number };
  size: { width: number; height: number };
  // 图片专属
  imageData?: string;  // base64
  prompt?: string;     // 生成提示词
  // 文字专属
  textContent?: string;
  // 形状专属
  fill?: string;
  stroke?: string;
}

// 画布上下文
export interface CanvasContext {
  items: CanvasItemContext[];
  selectedIds: string[];
}

// ============ Chatbot Types ============

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // base64
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  timestamp: number;
  isStreaming?: boolean;
}

// ============ Generation Types ============

export type GenerationModel = 'default' | 'fast' | 'quality';
