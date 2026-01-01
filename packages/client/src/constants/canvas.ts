// Canvas 编辑器常量

// 尺寸相关
export const DEFAULT_IMAGE_SIZE = 240;  // 400 * 0.6，减小40%
export const DEFAULT_TEXT_WIDTH = 200;
export const DEFAULT_TEXT_HEIGHT = 40;
export const DEFAULT_FONT_SIZE = 24;
export const MIN_ITEM_SIZE = 50;
export const MIN_LINE_SIZE = 10;
export const MIN_HIT_AREA = 20;

// 缩放限制
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;
export const ZOOM_STEP = 0.15;

// 自动保存延迟（毫秒）
export const AUTO_SAVE_DELAY = 500;

// 复制粘贴偏移
export const PASTE_OFFSET = 20;

// 图片选择上限
export const MAX_SELECTED_IMAGES = 5;

// 图片最大显示尺寸
export const MAX_DISPLAY_SIZE = 512;

// 默认颜色
export const COLORS = {
  // 文字
  TEXT_DEFAULT: '#000000',

  // 矩形
  RECT_FILL: 'transparent',
  RECT_STROKE: '#000000',

  // 圆形
  CIRCLE_FILL: 'transparent',
  CIRCLE_STROKE: '#000000',

  // 画笔
  BRUSH_STROKE: '#000000',

  // 线条
  LINE_STROKE: '#000000',

  // 遮罩画笔
  MASK_BRUSH: 'rgba(59, 130, 246, 0.5)',

  // 选中边框
  SELECTION_BORDER: '#4F46E5',
} as const;

// 默认样式
export const DEFAULTS = {
  FONT_FAMILY: 'system-ui',
  FONT_WEIGHT: 'normal',
  TEXT_ALIGN: 'left' as const,
  STROKE_WIDTH: 2,
  BRUSH_STROKE_WIDTH: 3,
  BORDER_RADIUS: 8,
} as const;

// 模板定义
export const TEMPLATES = {
  cyberpunk: {
    textColor: '#0ea5e9',
    shapeColor: '#1e293b',
    strokeColor: '#0ea5e9',
  },
  mascot: {
    textColor: '#f59e0b',
    shapeColor: '#fef3c7',
    strokeColor: '#f59e0b',
  },
  surreal: {
    textColor: '#a855f7',
    strokeColor: '#a855f7',
  },
} as const;

// 宽高比选项
export const ASPECT_RATIOS = ['1:1', '4:3', '16:9', '9:16', '3:4'] as const;

// 分辨率选项
export const RESOLUTIONS = ['1K', '2K', '4K'] as const;
