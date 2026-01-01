/**
 * Canvas Store - 画布核心状态管理
 *
 * 管理画布元素、选中状态、工具模式等
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CanvasItem, ToolMode } from '../types';
import { generateId } from '../utils/id';

// 工具颜色类型
interface ToolColors {
  brush: string;
  line: string;
  arrow: string;
  rectangle: string;
  circle: string;
}

interface CanvasState {
  // 画布元素
  items: CanvasItem[];
  // 选中的元素 ID
  selectedIds: string[];
  // 当前工具模式
  toolMode: ToolMode;
  // 上一次使用的形状工具（用于快速切换）
  lastShapeTool: ToolMode;
  // 各工具的颜色设置
  toolColors: ToolColors;
}

interface CanvasActions {
  // Items CRUD
  setItems: (items: CanvasItem[]) => void;
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  updateItems: (updates: { id: string; changes: Partial<CanvasItem> }[]) => void;
  deleteItem: (id: string) => void;
  deleteItems: (ids: string[]) => void;
  duplicateItems: (ids: string[]) => string[];

  // Selection
  setSelectedIds: (ids: string[]) => void;
  selectItem: (id: string, addToSelection?: boolean) => void;
  deselectAll: () => void;
  selectAll: () => void;

  // Tool Mode
  setToolMode: (mode: ToolMode) => void;
  setLastShapeTool: (mode: ToolMode) => void;

  // Tool Colors
  setToolColor: (tool: keyof ToolColors, color: string) => void;

  // Utilities
  getSelectedItems: () => CanvasItem[];
  getItemById: (id: string) => CanvasItem | undefined;
  getMaxZIndex: () => number;
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
}

type CanvasStore = CanvasState & CanvasActions;

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
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

    // Items CRUD
    setItems: (items) => set({ items }),

    addItem: (item) =>
      set((state) => ({
        items: [...state.items, item],
      })),

    updateItem: (id, updates) =>
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      })),

    updateItems: (updates) =>
      set((state) => {
        const updateMap = new Map(updates.map((u) => [u.id, u.changes]));
        return {
          items: state.items.map((item) => {
            const changes = updateMap.get(item.id);
            return changes ? { ...item, ...changes } : item;
          }),
        };
      }),

    deleteItem: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        selectedIds: state.selectedIds.filter((sid) => sid !== id),
      })),

    deleteItems: (ids) =>
      set((state) => {
        const idSet = new Set(ids);
        return {
          items: state.items.filter((item) => !idSet.has(item.id)),
          selectedIds: state.selectedIds.filter((sid) => !idSet.has(sid)),
        };
      }),

    duplicateItems: (ids) => {
      const state = get();
      const idSet = new Set(ids);
      const itemsToDuplicate = state.items.filter((item) => idSet.has(item.id));
      const offset = 20;
      const maxZ = state.items.reduce((max, item) => Math.max(max, item.zIndex), 0);

      const newItems: CanvasItem[] = itemsToDuplicate.map((item, index) => ({
        ...item,
        id: generateId(),
        x: item.x + offset,
        y: item.y + offset,
        zIndex: maxZ + index + 1,
      }));

      const newIds = newItems.map((item) => item.id);

      set((state) => ({
        items: [...state.items, ...newItems],
        selectedIds: newIds,
      }));

      return newIds;
    },

    // Selection
    setSelectedIds: (ids) => set({ selectedIds: ids }),

    selectItem: (id, addToSelection = false) =>
      set((state) => ({
        selectedIds: addToSelection
          ? state.selectedIds.includes(id)
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id]
          : [id],
      })),

    deselectAll: () => set({ selectedIds: [] }),

    selectAll: () =>
      set((state) => ({
        selectedIds: state.items.map((item) => item.id),
      })),

    // Tool Mode
    setToolMode: (mode) => set({ toolMode: mode }),

    setLastShapeTool: (mode) => set({ lastShapeTool: mode }),

    // Tool Colors
    setToolColor: (tool, color) =>
      set((state) => ({
        toolColors: { ...state.toolColors, [tool]: color },
      })),

    // Utilities
    getSelectedItems: () => {
      const state = get();
      const idSet = new Set(state.selectedIds);
      return state.items.filter((item) => idSet.has(item.id));
    },

    getItemById: (id) => get().items.find((item) => item.id === id),

    getMaxZIndex: () =>
      get().items.reduce((max, item) => Math.max(max, item.zIndex), 0),

    bringToFront: (ids) =>
      set((state) => {
        const idSet = new Set(ids);
        const maxZ = state.items.reduce((max, item) => Math.max(max, item.zIndex), 0);
        let zOffset = 1;
        return {
          items: state.items.map((item) =>
            idSet.has(item.id)
              ? { ...item, zIndex: maxZ + zOffset++ }
              : item
          ),
        };
      }),

    sendToBack: (ids) =>
      set((state) => {
        const idSet = new Set(ids);
        const minZ = state.items.reduce((min, item) => Math.min(min, item.zIndex), 0);
        let zOffset = ids.length;
        return {
          items: state.items.map((item) =>
            idSet.has(item.id)
              ? { ...item, zIndex: minZ - zOffset-- }
              : item
          ),
        };
      }),
  }))
);

// 选择器 hooks（性能优化）
export const useItems = () => useCanvasStore((state) => state.items);
export const useSelectedIds = () => useCanvasStore((state) => state.selectedIds);
export const useToolMode = () => useCanvasStore((state) => state.toolMode);
export const useToolColors = () => useCanvasStore((state) => state.toolColors);
