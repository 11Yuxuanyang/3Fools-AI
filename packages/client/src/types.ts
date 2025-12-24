export interface CanvasItem {
  id: string;
  type: 'image' | 'text' | 'rectangle' | 'circle' | 'brush' | 'line' | 'arrow';
  src: string; // Base64 data URL for images, text content for text, empty for shapes
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  prompt?: string; // The prompt used to generate it
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
}

// ============ Storyboard Types ============

// 场景图片来源
export type SceneImageSource = 'none' | 'canvas' | 'generated';

// 场景状态
export type SceneStatus = 'draft' | 'generating' | 'ready' | 'error';

// 场景/镜头 - 剧本的基本单元
export interface Scene {
  id: string;
  order: number;                    // 排序序号
  title: string;                    // 镜头标题
  description: string;              // 场景描述
  dialogue: string;                 // 对白内容
  visualPrompt: string;             // AI视觉提示词
  duration: number;                 // 时长（秒）
  startTime: number;                // 开始时间（秒）
  imageSource: SceneImageSource;    // 图片来源
  canvasItemId?: string;            // 关联的画布图片ID
  generatedImageSrc?: string;       // 生成的图片base64
  status: SceneStatus;              // 状态
}

// 剧本分镜集合
export interface Storyboard {
  id: string;
  projectId: string;                // 关联的项目ID
  title: string;                    // 剧本标题
  rawScript: string;                // 原始剧本文本
  scenes: Scene[];                  // 场景列表
  totalDuration: number;            // 总时长（秒）
  createdAt: number;
  updatedAt: number;
  timelineZoom: number;             // 时间轴缩放（px/秒）
  timelineScrollPosition: number;   // 时间轴滚动位置
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
  storyboard?: Storyboard; // 关联的剧本数据
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
