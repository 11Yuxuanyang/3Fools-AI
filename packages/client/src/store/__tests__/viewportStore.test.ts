/**
 * Viewport Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useViewportStore } from '../viewportStore';

describe('viewportStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useViewportStore.setState({
      scale: 1,
      pan: { x: 0, y: 0 },
      isPanning: false,
      panStart: { x: 0, y: 0 },
    });
  });

  describe('scale', () => {
    it('should set scale within limits', () => {
      const { setScale } = useViewportStore.getState();

      setScale(2);
      expect(useViewportStore.getState().scale).toBe(2);

      // 不能超过 MAX_SCALE (5)
      setScale(10);
      expect(useViewportStore.getState().scale).toBe(5);

      // 不能低于 MIN_SCALE (0.1)
      setScale(0.01);
      expect(useViewportStore.getState().scale).toBe(0.1);
    });

    it('should zoom in', () => {
      const { zoomIn } = useViewportStore.getState();

      zoomIn();

      const { scale } = useViewportStore.getState();
      expect(scale).toBeGreaterThan(1);
    });

    it('should zoom out', () => {
      const { zoomOut } = useViewportStore.getState();

      zoomOut();

      const { scale } = useViewportStore.getState();
      expect(scale).toBeLessThan(1);
    });

    it('should reset zoom', () => {
      const { setScale, setPan, resetZoom } = useViewportStore.getState();

      setScale(2);
      setPan({ x: 100, y: 100 });

      resetZoom();

      const { scale, pan } = useViewportStore.getState();
      expect(scale).toBe(1);
      expect(pan).toEqual({ x: 0, y: 0 });
    });
  });

  describe('pan', () => {
    it('should set pan', () => {
      const { setPan } = useViewportStore.getState();

      setPan({ x: 100, y: 200 });

      const { pan } = useViewportStore.getState();
      expect(pan).toEqual({ x: 100, y: 200 });
    });

    it('should start and update pan', () => {
      const { startPan, updatePan } = useViewportStore.getState();

      startPan(100, 100);
      expect(useViewportStore.getState().isPanning).toBe(true);

      updatePan(150, 120);
      const { pan, panStart } = useViewportStore.getState();
      expect(pan.x).toBe(50); // 150 - 100
      expect(pan.y).toBe(20); // 120 - 100
      expect(panStart).toEqual({ x: 150, y: 120 });
    });

    it('should end pan', () => {
      const { startPan, endPan } = useViewportStore.getState();

      startPan(100, 100);
      endPan();

      const { isPanning } = useViewportStore.getState();
      expect(isPanning).toBe(false);
    });
  });

  describe('coordinate transform', () => {
    it('should convert screen to canvas coordinates', () => {
      const { setScale, setPan, screenToCanvas } = useViewportStore.getState();

      // 设置视口状态
      setScale(2);
      setPan({ x: 50, y: 50 });

      // 模拟容器 rect
      const containerRect = {
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };

      // 屏幕中心点 (400, 300) 加上 pan (50, 50)，除以 scale (2)
      const canvasPos = screenToCanvas(400, 300, containerRect);

      // 屏幕坐标转换: (screenX - left - centerX - pan.x) / scale
      // = (400 - 0 - 400 - 50) / 2 = -25
      expect(canvasPos.x).toBe(-25);
      expect(canvasPos.y).toBe(-25);
    });

    it('should set viewport', () => {
      const { setViewport } = useViewportStore.getState();

      setViewport({ scale: 1.5, pan: { x: 100, y: 200 } });

      const { scale, pan } = useViewportStore.getState();
      expect(scale).toBe(1.5);
      expect(pan).toEqual({ x: 100, y: 200 });
    });
  });
});
