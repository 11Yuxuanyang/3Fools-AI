import { useState, useCallback, useReducer } from 'react';
import { CanvasItem, ToolMode, Storyboard } from '@/types';
import { generateId } from '@/utils/id';

// Types
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ViewportState {
  scale: number;
  pan: Point;
}

export interface CanvasState {
  items: CanvasItem[];
  selectedIds: string[];
  toolMode: ToolMode;
  viewport: ViewportState;
}

// Action types
type CanvasAction =
  | { type: 'SET_ITEMS'; payload: CanvasItem[] }
  | { type: 'ADD_ITEM'; payload: CanvasItem }
  | { type: 'ADD_ITEMS'; payload: CanvasItem[] }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<CanvasItem> } }
  | { type: 'DELETE_ITEMS'; payload: string[] }
  | { type: 'SET_SELECTED'; payload: string[] }
  | { type: 'ADD_SELECTED'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_TOOL_MODE'; payload: ToolMode }
  | { type: 'SET_VIEWPORT'; payload: Partial<ViewportState> }
  | { type: 'MOVE_ITEM'; payload: { id: string; x: number; y: number } }
  | { type: 'RESIZE_ITEM'; payload: { id: string; width: number; height: number; x?: number; y?: number } };

// Reducer
function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload };

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };

    case 'ADD_ITEMS':
      return { ...state, items: [...state.items, ...action.payload] };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
        ),
      };

    case 'DELETE_ITEMS':
      return {
        ...state,
        items: state.items.filter((item) => !action.payload.includes(item.id)),
        selectedIds: state.selectedIds.filter((id) => !action.payload.includes(id)),
      };

    case 'SET_SELECTED':
      return { ...state, selectedIds: action.payload };

    case 'ADD_SELECTED':
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.payload)
          ? state.selectedIds
          : [...state.selectedIds, action.payload],
      };

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [] };

    case 'SET_TOOL_MODE':
      return { ...state, toolMode: action.payload };

    case 'SET_VIEWPORT':
      return { ...state, viewport: { ...state.viewport, ...action.payload } };

    case 'MOVE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, x: action.payload.x, y: action.payload.y }
            : item
        ),
      };

    case 'RESIZE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? {
                ...item,
                width: action.payload.width,
                height: action.payload.height,
                ...(action.payload.x !== undefined && { x: action.payload.x }),
                ...(action.payload.y !== undefined && { y: action.payload.y }),
              }
            : item
        ),
      };

    default:
      return state;
  }
}

// Hook
export interface UseCanvasStateProps {
  initialItems: CanvasItem[];
  initialViewport?: ViewportState;
}

export function useCanvasState({ initialItems, initialViewport }: UseCanvasStateProps) {
  const [state, dispatch] = useReducer(canvasReducer, {
    items: initialItems,
    selectedIds: [],
    toolMode: ToolMode.SELECT,
    viewport: initialViewport || { scale: 1, pan: { x: 0, y: 0 } },
  });

  // Actions
  const setItems = useCallback((items: CanvasItem[]) => {
    dispatch({ type: 'SET_ITEMS', payload: items });
  }, []);

  const addItem = useCallback((item: CanvasItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const addItems = useCallback((items: CanvasItem[]) => {
    dispatch({ type: 'ADD_ITEMS', payload: items });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<CanvasItem>) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } });
  }, []);

  const deleteItems = useCallback((ids: string[]) => {
    dispatch({ type: 'DELETE_ITEMS', payload: ids });
  }, []);

  const deleteSelected = useCallback(() => {
    dispatch({ type: 'DELETE_ITEMS', payload: state.selectedIds });
  }, [state.selectedIds]);

  const setSelectedIds = useCallback((ids: string[]) => {
    dispatch({ type: 'SET_SELECTED', payload: ids });
  }, []);

  const addToSelection = useCallback((id: string) => {
    dispatch({ type: 'ADD_SELECTED', payload: id });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const setToolMode = useCallback((mode: ToolMode) => {
    dispatch({ type: 'SET_TOOL_MODE', payload: mode });
  }, []);

  const setScale = useCallback((scale: number) => {
    dispatch({ type: 'SET_VIEWPORT', payload: { scale } });
  }, []);

  const setPan = useCallback((pan: Point) => {
    dispatch({ type: 'SET_VIEWPORT', payload: { pan } });
  }, []);

  const moveItem = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'MOVE_ITEM', payload: { id, x, y } });
  }, []);

  const resizeItem = useCallback(
    (id: string, width: number, height: number, x?: number, y?: number) => {
      dispatch({ type: 'RESIZE_ITEM', payload: { id, width, height, x, y } });
    },
    []
  );

  // Computed values
  const selectedItems = state.items.filter((item) => state.selectedIds.includes(item.id));
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  // Helper to create new items at canvas center
  const createItemAtCenter = useCallback(
    (type: CanvasItem['type'], props: Partial<CanvasItem> = {}): CanvasItem => {
      const { scale, pan } = state.viewport;
      const centerX = -pan.x / scale + window.innerWidth / 2 / scale;
      const centerY = -pan.y / scale + window.innerHeight / 2 / scale;

      const baseItem: CanvasItem = {
        id: generateId(),
        type,
        src: '',
        x: centerX - 50,
        y: centerY - 50,
        width: 100,
        height: 100,
        zIndex: state.items.length,
        ...props,
      };

      return baseItem;
    },
    [state.viewport, state.items.length]
  );

  return {
    // State
    items: state.items,
    selectedIds: state.selectedIds,
    toolMode: state.toolMode,
    scale: state.viewport.scale,
    pan: state.viewport.pan,

    // Computed
    selectedItems,
    selectedItem,

    // Actions
    setItems,
    addItem,
    addItems,
    updateItem,
    deleteItems,
    deleteSelected,
    setSelectedIds,
    addToSelection,
    clearSelection,
    setToolMode,
    setScale,
    setPan,
    moveItem,
    resizeItem,
    createItemAtCenter,
  };
}

export type CanvasStateReturn = ReturnType<typeof useCanvasState>;
