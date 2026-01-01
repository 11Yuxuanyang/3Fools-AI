/**
 * Interaction Store - 交互状态管理
 *
 * 管理拖拽、缩放、框选等画布交互状态
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// 多选缩放数据
interface MultiResizeData {
  boundingBox: { x: number; y: number; width: number; height: number };
  items: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      relX: number;
      relY: number;
      relW: number;
      relH: number;
    }
  >;
}

// 元素初始尺寸数据
interface ItemStartSize {
  width: number;
  height: number;
  x: number;
  y: number;
  points?: Array<{ x: number; y: number }>;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
}

// 线条端点拖拽状态
interface LinePointDrag {
  itemId: string;
  pointType: 'start' | 'end' | 'control';
}

interface InteractionState {
  // 拖拽状态
  isDragging: boolean;
  dragStart: { x: number; y: number };
  itemStart: { x: number; y: number };
  itemsStartPositions: Record<string, { x: number; y: number }>;

  // 缩放状态
  isResizing: boolean;
  resizeCorner: string | null;
  resizeStart: { x: number; y: number };
  itemStartSize: ItemStartSize;
  multiResizeData: MultiResizeData | null;

  // 线条端点拖拽
  linePointDrag: LinePointDrag | null;

  // 框选状态
  isSelecting: boolean;
  selectionStart: { x: number; y: number };
  selectionEnd: { x: number; y: number };
}

interface InteractionActions {
  // Drag Actions
  startDrag: (
    start: { x: number; y: number },
    itemStart: { x: number; y: number },
    itemsStartPositions?: Record<string, { x: number; y: number }>
  ) => void;
  updateDragStart: (start: { x: number; y: number }) => void;
  endDrag: () => void;

  // Resize Actions
  startResize: (
    corner: string,
    start: { x: number; y: number },
    itemStartSize: ItemStartSize,
    multiResizeData?: MultiResizeData | null
  ) => void;
  endResize: () => void;

  // Line Point Drag Actions
  startLinePointDrag: (itemId: string, pointType: 'start' | 'end' | 'control') => void;
  endLinePointDrag: () => void;

  // Selection Actions
  startSelection: (start: { x: number; y: number }) => void;
  updateSelection: (end: { x: number; y: number }) => void;
  endSelection: () => void;

  // Reset
  resetInteraction: () => void;
}

type InteractionStore = InteractionState & InteractionActions;

const initialState: InteractionState = {
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  itemStart: { x: 0, y: 0 },
  itemsStartPositions: {},
  isResizing: false,
  resizeCorner: null,
  resizeStart: { x: 0, y: 0 },
  itemStartSize: { width: 0, height: 0, x: 0, y: 0 },
  multiResizeData: null,
  linePointDrag: null,
  isSelecting: false,
  selectionStart: { x: 0, y: 0 },
  selectionEnd: { x: 0, y: 0 },
};

export const useInteractionStore = create<InteractionStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    // Drag Actions
    startDrag: (start, itemStart, itemsStartPositions = {}) =>
      set({
        isDragging: true,
        dragStart: start,
        itemStart,
        itemsStartPositions,
      }),

    updateDragStart: (start) => set({ dragStart: start }),

    endDrag: () =>
      set({
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        itemStart: { x: 0, y: 0 },
        itemsStartPositions: {},
      }),

    // Resize Actions
    startResize: (corner, start, itemStartSize, multiResizeData = null) =>
      set({
        isResizing: true,
        resizeCorner: corner,
        resizeStart: start,
        itemStartSize,
        multiResizeData,
      }),

    endResize: () =>
      set({
        isResizing: false,
        resizeCorner: null,
        resizeStart: { x: 0, y: 0 },
        itemStartSize: { width: 0, height: 0, x: 0, y: 0 },
        multiResizeData: null,
      }),

    // Line Point Drag Actions
    startLinePointDrag: (itemId, pointType) =>
      set({ linePointDrag: { itemId, pointType } }),

    endLinePointDrag: () => set({ linePointDrag: null }),

    // Selection Actions
    startSelection: (start) =>
      set({
        isSelecting: true,
        selectionStart: start,
        selectionEnd: start,
      }),

    updateSelection: (end) => set({ selectionEnd: end }),

    endSelection: () =>
      set({
        isSelecting: false,
        selectionStart: { x: 0, y: 0 },
        selectionEnd: { x: 0, y: 0 },
      }),

    // Reset
    resetInteraction: () => set(initialState),
  }))
);

// 选择器 hooks
export const useIsDragging = () => useInteractionStore((state) => state.isDragging);
export const useIsResizing = () => useInteractionStore((state) => state.isResizing);
export const useIsSelecting = () => useInteractionStore((state) => state.isSelecting);
export const useLinePointDrag = () => useInteractionStore((state) => state.linePointDrag);

// 框选区域计算工具
export function getSelectionRect(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
