/**
 * Canvas Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../canvasStore';
import { ToolMode } from '../../types';

describe('canvasStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useCanvasStore.setState({
      items: [],
      selectedIds: [],
      toolMode: ToolMode.SELECT,
      lastShapeTool: ToolMode.RECTANGLE,
      toolColors: {
        brush: '#000000',
        line: '#000000',
        arrow: '#000000',
        rectangle: '#000000',
        circle: '#000000',
      },
    });
  });

  describe('items', () => {
    it('should add an item', () => {
      const { addItem } = useCanvasStore.getState();

      addItem({
        id: 'item-1',
        type: 'image',
        src: 'test.png',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
      });

      const { items } = useCanvasStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('item-1');
    });

    it('should update an item', () => {
      const { setItems, updateItem } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
      ]);

      updateItem('item-1', { x: 50, y: 50 });

      const { items } = useCanvasStore.getState();
      expect(items[0].x).toBe(50);
      expect(items[0].y).toBe(50);
    });

    it('should delete an item', () => {
      const { setItems, deleteItem } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
        {
          id: 'item-2',
          type: 'text',
          src: 'Hello',
          x: 100,
          y: 100,
          width: 200,
          height: 40,
          zIndex: 2,
        },
      ]);

      deleteItem('item-1');

      const { items } = useCanvasStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('item-2');
    });

    it('should duplicate items with offset', () => {
      const { setItems, duplicateItems } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
      ]);

      const newIds = duplicateItems(['item-1']);

      const { items, selectedIds } = useCanvasStore.getState();
      expect(items).toHaveLength(2);
      expect(newIds).toHaveLength(1);
      expect(items[1].x).toBe(20); // 偏移 20
      expect(items[1].y).toBe(20);
      expect(selectedIds).toEqual(newIds);
    });
  });

  describe('selection', () => {
    it('should select an item', () => {
      const { setItems, selectItem } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
      ]);

      selectItem('item-1');

      const { selectedIds } = useCanvasStore.getState();
      expect(selectedIds).toEqual(['item-1']);
    });

    it('should add to selection', () => {
      const { setItems, selectItem } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
        {
          id: 'item-2',
          type: 'text',
          src: 'Hello',
          x: 100,
          y: 100,
          width: 200,
          height: 40,
          zIndex: 2,
        },
      ]);

      selectItem('item-1');
      selectItem('item-2', true);

      const { selectedIds } = useCanvasStore.getState();
      expect(selectedIds).toEqual(['item-1', 'item-2']);
    });

    it('should deselect all', () => {
      const { setSelectedIds, deselectAll } = useCanvasStore.getState();

      setSelectedIds(['item-1', 'item-2']);
      deselectAll();

      const { selectedIds } = useCanvasStore.getState();
      expect(selectedIds).toEqual([]);
    });

    it('should select all items', () => {
      const { setItems, selectAll } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
        {
          id: 'item-2',
          type: 'text',
          src: 'Hello',
          x: 100,
          y: 100,
          width: 200,
          height: 40,
          zIndex: 2,
        },
      ]);

      selectAll();

      const { selectedIds } = useCanvasStore.getState();
      expect(selectedIds).toEqual(['item-1', 'item-2']);
    });
  });

  describe('toolMode', () => {
    it('should change tool mode', () => {
      const { setToolMode } = useCanvasStore.getState();

      setToolMode(ToolMode.BRUSH);

      const { toolMode } = useCanvasStore.getState();
      expect(toolMode).toBe(ToolMode.BRUSH);
    });

    it('should remember last shape tool', () => {
      const { setLastShapeTool } = useCanvasStore.getState();

      setLastShapeTool(ToolMode.CIRCLE);

      const { lastShapeTool } = useCanvasStore.getState();
      expect(lastShapeTool).toBe(ToolMode.CIRCLE);
    });
  });

  describe('toolColors', () => {
    it('should change tool color', () => {
      const { setToolColor } = useCanvasStore.getState();

      setToolColor('brush', '#FF0000');

      const { toolColors } = useCanvasStore.getState();
      expect(toolColors.brush).toBe('#FF0000');
    });
  });

  describe('zIndex operations', () => {
    it('should bring items to front', () => {
      const { setItems, bringToFront } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 1,
        },
        {
          id: 'item-2',
          type: 'text',
          src: 'Hello',
          x: 100,
          y: 100,
          width: 200,
          height: 40,
          zIndex: 5,
        },
      ]);

      bringToFront(['item-1']);

      const { items } = useCanvasStore.getState();
      const item1 = items.find((i) => i.id === 'item-1');
      expect(item1?.zIndex).toBeGreaterThan(5);
    });

    it('should send items to back', () => {
      const { setItems, sendToBack } = useCanvasStore.getState();

      setItems([
        {
          id: 'item-1',
          type: 'image',
          src: 'test.png',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          zIndex: 5,
        },
        {
          id: 'item-2',
          type: 'text',
          src: 'Hello',
          x: 100,
          y: 100,
          width: 200,
          height: 40,
          zIndex: 1,
        },
      ]);

      sendToBack(['item-1']);

      const { items } = useCanvasStore.getState();
      const item1 = items.find((i) => i.id === 'item-1');
      expect(item1?.zIndex).toBeLessThan(1);
    });
  });
});
