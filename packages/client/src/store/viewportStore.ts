/**
 * Viewport Store - 视口状态管理
 *
 * 管理画布缩放、平移等视口相关状态
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_STEP,
} from '../constants/canvas';

interface ViewportState {
  // 缩放比例
  scale: number;
  // 平移偏移
  pan: { x: number; y: number };
  // 是否正在平移
  isPanning: boolean;
  // 平移起始点
  panStart: { x: number; y: number };
}

interface ViewportActions {
  // Scale
  setScale: (scale: number) => void;
  zoomIn: (center?: { x: number; y: number }) => void;
  zoomOut: (center?: { x: number; y: number }) => void;
  zoomToFit: () => void;
  resetZoom: () => void;

  // Pan
  setPan: (pan: { x: number; y: number }) => void;
  setIsPanning: (isPanning: boolean) => void;
  setPanStart: (start: { x: number; y: number }) => void;
  startPan: (screenX: number, screenY: number) => void;
  updatePan: (screenX: number, screenY: number) => void;
  endPan: () => void;

  // Utilities
  screenToCanvas: (screenX: number, screenY: number, containerRect: DOMRect) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number, containerRect: DOMRect) => { x: number; y: number };
  setViewport: (viewport: { scale: number; pan: { x: number; y: number } }) => void;
}

type ViewportStore = ViewportState & ViewportActions;

export const useViewportStore = create<ViewportStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    scale: 1,
    pan: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },

    // Scale Actions
    setScale: (scale) =>
      set({ scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) }),

    zoomIn: (center) => {
      const state = get();
      const newScale = Math.min(MAX_SCALE, state.scale * (1 + ZOOM_STEP));

      if (center) {
        // 以指定点为中心缩放
        const scaleRatio = newScale / state.scale;
        set({
          scale: newScale,
          pan: {
            x: center.x - (center.x - state.pan.x) * scaleRatio,
            y: center.y - (center.y - state.pan.y) * scaleRatio,
          },
        });
      } else {
        set({ scale: newScale });
      }
    },

    zoomOut: (center) => {
      const state = get();
      const newScale = Math.max(MIN_SCALE, state.scale * (1 - ZOOM_STEP));

      if (center) {
        const scaleRatio = newScale / state.scale;
        set({
          scale: newScale,
          pan: {
            x: center.x - (center.x - state.pan.x) * scaleRatio,
            y: center.y - (center.y - state.pan.y) * scaleRatio,
          },
        });
      } else {
        set({ scale: newScale });
      }
    },

    zoomToFit: () => {
      // TODO: 根据所有元素计算最佳缩放和平移
      set({ scale: 1, pan: { x: 0, y: 0 } });
    },

    resetZoom: () => set({ scale: 1, pan: { x: 0, y: 0 } }),

    // Pan Actions
    setPan: (pan) => set({ pan }),

    setIsPanning: (isPanning) => set({ isPanning }),

    setPanStart: (start) => set({ panStart: start }),

    startPan: (screenX, screenY) =>
      set({
        isPanning: true,
        panStart: { x: screenX, y: screenY },
      }),

    updatePan: (screenX, screenY) => {
      const state = get();
      if (!state.isPanning) return;

      const dx = screenX - state.panStart.x;
      const dy = screenY - state.panStart.y;

      set({
        pan: {
          x: state.pan.x + dx,
          y: state.pan.y + dy,
        },
        panStart: { x: screenX, y: screenY },
      });
    },

    endPan: () => set({ isPanning: false }),

    // Coordinate Transform
    screenToCanvas: (screenX, screenY, containerRect) => {
      const state = get();
      // 画布中心点（屏幕坐标）
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      // 转换到画布坐标
      return {
        x: (screenX - containerRect.left - centerX - state.pan.x) / state.scale,
        y: (screenY - containerRect.top - centerY - state.pan.y) / state.scale,
      };
    },

    canvasToScreen: (canvasX, canvasY, containerRect) => {
      const state = get();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      return {
        x: canvasX * state.scale + state.pan.x + centerX + containerRect.left,
        y: canvasY * state.scale + state.pan.y + centerY + containerRect.top,
      };
    },

    setViewport: (viewport) =>
      set({
        scale: viewport.scale,
        pan: viewport.pan,
      }),
  }))
);

// 选择器 hooks
export const useScale = () => useViewportStore((state) => state.scale);
export const usePan = () => useViewportStore((state) => state.pan);
export const useIsPanning = () => useViewportStore((state) => state.isPanning);
