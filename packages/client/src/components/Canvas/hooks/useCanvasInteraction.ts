/**
 * 画布交互 Hook
 * 处理拖拽、缩放、框选、形状绘制等鼠标交互
 */

import { useState, useCallback, useRef } from 'react';
import { CanvasItem, ToolMode } from '@/types';
import { generateId } from '@/utils/id';

// 坐标转换：屏幕坐标 -> 画布坐标
export function screenToCanvas(
  clientX: number,
  clientY: number,
  scale: number,
  pan: { x: number; y: number }
) {
  return {
    x: (clientX - window.innerWidth / 2 - pan.x) / scale,
    y: (clientY - window.innerHeight / 2 - pan.y) / scale,
  };
}

// 坐标转换：画布坐标 -> 屏幕坐标
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  scale: number,
  pan: { x: number; y: number }
) {
  return {
    x: canvasX * scale + pan.x + window.innerWidth / 2,
    y: canvasY * scale + pan.y + window.innerHeight / 2,
  };
}

// 检测点击的元素
export function findClickedItem(
  items: CanvasItem[],
  clientX: number,
  clientY: number,
  scale: number,
  pan: { x: number; y: number }
): CanvasItem | undefined {
  // 从后往前遍历（后添加的在上层）
  return [...items].reverse().find(item => {
    // 连接线、线段、箭头不可通过矩形边界框选中
    if (item.type === 'connection' || item.type === 'line' || item.type === 'arrow') return false;

    const screen = canvasToScreen(item.x, item.y, scale, pan);
    const screenW = item.width * scale;
    const screenH = item.height * scale;

    return (
      clientX >= screen.x &&
      clientX <= screen.x + screenW &&
      clientY >= screen.y &&
      clientY <= screen.y + screenH
    );
  });
}

// 计算边界框
export function calculateBoundingBox(items: CanvasItem[]) {
  if (items.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  items.forEach(item => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  });

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

interface UseCanvasInteractionProps {
  items: CanvasItem[];
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toolMode: ToolMode;
  setToolMode: React.Dispatch<React.SetStateAction<ToolMode>>;
  scale: number;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  toolColors: {
    brush: string;
    line: string;
    arrow: string;
    rectangle: string;
    circle: string;
  };
  // 裁剪相关
  croppingImageId: string | null;
  applyCrop: () => void;
  // 文字编辑
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  // 协作
  isCollabConnected: boolean;
  sendCursorMove: (x: number, y: number) => void;
  // 连接线更新
  updateConnectionsRealtime: (items: CanvasItem[], movedIds: string[]) => CanvasItem[];
  updateConnections: (movedIds: string[]) => void;
}

export interface InteractionHandlers {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleResizeStart: (e: React.MouseEvent, corner: string) => void;
  handleLinePointDrag: (e: React.MouseEvent, itemId: string, pointType: 'start' | 'end' | 'control') => void;
  // 暴露一些内部状态
  isDragging: boolean;
  isResizing: boolean;
  isPanning: boolean;
  isSelecting: boolean;
  selectionStart: { x: number; y: number };
  selectionEnd: { x: number; y: number };
  mousePositionRef: React.MutableRefObject<{ x: number; y: number }>;
  // 供 line/arrow 元素直接使用的 setters
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setDragStart: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setItemStart: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setItemsStartPositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  setLinePointDrag: React.Dispatch<React.SetStateAction<{ itemId: string; pointType: 'start' | 'end' | 'control' } | null>>;
}

export function useCanvasInteraction({
  items,
  setItems,
  selectedIds,
  setSelectedIds,
  toolMode,
  setToolMode,
  scale,
  pan,
  setPan,
  toolColors,
  croppingImageId,
  applyCrop,
  setEditingTextId,
  isCollabConnected,
  sendCursorMove,
  updateConnectionsRealtime,
  updateConnections,
}: UseCanvasInteractionProps): InteractionHandlers {
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [itemStart, setItemStart] = useState({ x: 0, y: 0 });
  const [itemsStartPositions, setItemsStartPositions] = useState<Record<string, { x: number; y: number }>>({});

  // 平移状态
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 缩放状态
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [itemStartSize, setItemStartSize] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
    points?: Array<{ x: number; y: number }>;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
  }>({ width: 0, height: 0, x: 0, y: 0 });
  const [multiResizeData, setMultiResizeData] = useState<{
    boundingBox: { x: number; y: number; width: number; height: number };
    items: Record<string, { x: number; y: number; width: number; height: number; relX: number; relY: number; relW: number; relH: number }>;
  } | null>(null);

  // 线条端点拖拽
  const [linePointDrag, setLinePointDrag] = useState<{
    itemId: string;
    pointType: 'start' | 'end' | 'control';
  } | null>(null);

  // 框选状态
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  // 鼠标位置
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 裁剪模式处理
    if (croppingImageId) {
      const target = e.target as HTMLElement;
      const isCropInteraction = target.closest('[data-crop-handle]') || target.closest('[data-crop-box]');
      if (!isCropInteraction) {
        applyCrop();
      }
      return;
    }

    // 中键或平移模式
    if (e.button === 1 || toolMode === ToolMode.PAN) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const clickedItem = findClickedItem(items, e.clientX, e.clientY, scale, pan);
    const canvasPos = screenToCanvas(e.clientX, e.clientY, scale, pan);

    // 画笔模式
    if (toolMode === ToolMode.BRUSH) {
      setSelectedIds([]);
      const newBrushItem: CanvasItem = {
        id: generateId(),
        type: 'brush',
        src: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        zIndex: items.length + 1,
        stroke: toolColors.brush,
        strokeWidth: 3,
        points: [{ x: canvasPos.x, y: canvasPos.y }],
      };
      setItems(prev => [...prev, newBrushItem]);
      setSelectedIds([newBrushItem.id]);
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (clickedItem) {
      const isAlreadySelected = selectedIds.includes(clickedItem.id);
      if (!isAlreadySelected) {
        setSelectedIds([clickedItem.id]);
      }

      if (toolMode === ToolMode.SELECT) {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: clickedItem.x, y: clickedItem.y });

        const currentSelectedIds = isAlreadySelected ? selectedIds : [clickedItem.id];
        const positions: Record<string, { x: number; y: number }> = {};
        items.forEach(item => {
          if (currentSelectedIds.includes(item.id)) {
            positions[item.id] = { x: item.x, y: item.y };
          }
        });
        setItemsStartPositions(positions);
      }
    } else {
      // 点击空白处
      setSelectedIds([]);

      if (toolMode === ToolMode.TEXT) {
        const newTextItem: CanvasItem = {
          id: generateId(),
          type: 'text',
          src: '',
          x: canvasPos.x,
          y: canvasPos.y,
          width: 50,
          height: 40,
          zIndex: items.length + 1,
          fontSize: 24,
          fontFamily: '"Xiaolai SC", "Virgil", cursive',
          fontWeight: 'normal',
          color: '#1f2937',
          textAlign: 'left',
        };
        setItems(prev => [...prev, newTextItem]);
        setSelectedIds([newTextItem.id]);
        setEditingTextId(newTextItem.id);
        setToolMode(ToolMode.SELECT);
      } else if (toolMode === ToolMode.RECTANGLE) {
        const newRectItem: CanvasItem = {
          id: generateId(),
          type: 'rectangle',
          src: '',
          x: canvasPos.x,
          y: canvasPos.y,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          fill: toolColors.rectangle + '20',
          stroke: toolColors.rectangle,
          strokeWidth: 2,
          borderRadius: 8,
        };
        setItems(prev => [...prev, newRectItem]);
        setSelectedIds([newRectItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasPos.x, y: canvasPos.y });
      } else if (toolMode === ToolMode.CIRCLE) {
        const newCircleItem: CanvasItem = {
          id: generateId(),
          type: 'circle',
          src: '',
          x: canvasPos.x,
          y: canvasPos.y,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          fill: toolColors.circle + '20',
          stroke: toolColors.circle,
          strokeWidth: 2,
        };
        setItems(prev => [...prev, newCircleItem]);
        setSelectedIds([newCircleItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasPos.x, y: canvasPos.y });
      } else if (toolMode === ToolMode.LINE) {
        const newLineItem: CanvasItem = {
          id: generateId(),
          type: 'line',
          src: '',
          x: canvasPos.x,
          y: canvasPos.y,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          stroke: toolColors.line,
          strokeWidth: 2,
          startPoint: { x: canvasPos.x, y: canvasPos.y },
          endPoint: { x: canvasPos.x, y: canvasPos.y },
        };
        setItems(prev => [...prev, newLineItem]);
        setSelectedIds([newLineItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasPos.x, y: canvasPos.y });
      } else if (toolMode === ToolMode.ARROW) {
        const newArrowItem: CanvasItem = {
          id: generateId(),
          type: 'arrow',
          src: '',
          x: canvasPos.x,
          y: canvasPos.y,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          stroke: toolColors.arrow,
          strokeWidth: 2,
          startPoint: { x: canvasPos.x, y: canvasPos.y },
          endPoint: { x: canvasPos.x, y: canvasPos.y },
        };
        setItems(prev => [...prev, newArrowItem]);
        setSelectedIds([newArrowItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasPos.x, y: canvasPos.y });
      } else if (toolMode === ToolMode.SELECT) {
        // 框选
        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionEnd({ x: e.clientX, y: e.clientY });
      }
    }
  }, [
    items, selectedIds, toolMode, scale, pan, toolColors,
    croppingImageId, applyCrop, setItems, setSelectedIds, setToolMode, setEditingTextId
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY, scale, pan);
    mousePositionRef.current = canvasPos;

    // 同步光标给协作者
    if (isCollabConnected) {
      sendCursorMove(canvasPos.x, canvasPos.y);
    }

    // 平移
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 线条端点拖拽
    if (linePointDrag) {
      setItems(prev => prev.map(item => {
        if (item.id !== linePointDrag.itemId) return item;
        if (!item.startPoint || !item.endPoint) return item;

        if (linePointDrag.pointType === 'start') {
          const newStartPoint = { x: canvasPos.x, y: canvasPos.y };
          const minX = Math.min(newStartPoint.x, item.endPoint.x);
          const minY = Math.min(newStartPoint.y, item.endPoint.y);
          const maxX = Math.max(newStartPoint.x, item.endPoint.x);
          const maxY = Math.max(newStartPoint.y, item.endPoint.y);
          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            startPoint: newStartPoint,
          };
        } else if (linePointDrag.pointType === 'end') {
          const newEndPoint = { x: canvasPos.x, y: canvasPos.y };
          const minX = Math.min(item.startPoint.x, newEndPoint.x);
          const minY = Math.min(item.startPoint.y, newEndPoint.y);
          const maxX = Math.max(item.startPoint.x, newEndPoint.x);
          const maxY = Math.max(item.startPoint.y, newEndPoint.y);
          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            endPoint: newEndPoint,
          };
        } else if (linePointDrag.pointType === 'control') {
          const startX = item.startPoint.x;
          const startY = item.startPoint.y;
          const endX = item.endPoint.x;
          const endY = item.endPoint.y;
          const controlPointX = 2 * canvasPos.x - (startX + endX) / 2;
          const controlPointY = 2 * canvasPos.y - (startY + endY) / 2;
          return {
            ...item,
            controlPoint: { x: controlPointX, y: controlPointY },
          };
        }
        return item;
      }));
      return;
    }

    // 缩放处理
    if (isResizing && selectedIds.length > 0 && resizeCorner) {
      const dx = (e.clientX - resizeStart.x) / scale;
      const dy = (e.clientY - resizeStart.y) / scale;

      // 多选整体缩放
      if (multiResizeData && selectedIds.length > 1) {
        const bb = multiResizeData.boundingBox;
        const ratio = bb.height > 0 ? bb.width / bb.height : 1;
        let newBBWidth = bb.width;
        let newBBHeight = bb.height;
        let newBBX = bb.x;
        let newBBY = bb.y;

        if (resizeCorner === 'br') {
          newBBWidth = Math.max(50, bb.width + dx);
          newBBHeight = newBBWidth / ratio;
        } else if (resizeCorner === 'bl') {
          newBBWidth = Math.max(50, bb.width - dx);
          newBBHeight = newBBWidth / ratio;
          newBBX = bb.x + (bb.width - newBBWidth);
        } else if (resizeCorner === 'tr') {
          newBBWidth = Math.max(50, bb.width + dx);
          newBBHeight = newBBWidth / ratio;
          newBBY = bb.y + (bb.height - newBBHeight);
        } else if (resizeCorner === 'tl') {
          newBBWidth = Math.max(50, bb.width - dx);
          newBBHeight = newBBWidth / ratio;
          newBBX = bb.x + (bb.width - newBBWidth);
          newBBY = bb.y + (bb.height - newBBHeight);
        }

        setItems(prev => {
          const resizedItems = prev.map(item => {
            if (!selectedIds.includes(item.id)) return item;
            const itemData = multiResizeData.items[item.id];
            if (!itemData) return item;

            const newX = newBBX + itemData.relX * newBBWidth;
            const newY = newBBY + itemData.relY * newBBHeight;
            const newWidth = Math.max(20, itemData.relW * newBBWidth);
            const newHeight = Math.max(20, itemData.relH * newBBHeight);

            // 画笔元素缩放
            if (item.type === 'brush' && item.points) {
              const scaleX = itemData.width > 0 ? newWidth / itemData.width : 1;
              const scaleY = itemData.height > 0 ? newHeight / itemData.height : 1;
              const newPoints = item.points.map(p => ({
                x: newX + (p.x - itemData.x) * scaleX,
                y: newY + (p.y - itemData.y) * scaleY,
              }));
              return { ...item, x: newX, y: newY, width: newWidth, height: newHeight, points: newPoints };
            }

            // 线段/箭头缩放
            if ((item.type === 'line' || item.type === 'arrow') && item.startPoint && item.endPoint) {
              const scaleX = itemData.width > 0 ? newWidth / itemData.width : 1;
              const scaleY = itemData.height > 0 ? newHeight / itemData.height : 1;
              const newStartPoint = {
                x: newX + (item.startPoint.x - itemData.x) * scaleX,
                y: newY + (item.startPoint.y - itemData.y) * scaleY,
              };
              const newEndPoint = {
                x: newX + (item.endPoint.x - itemData.x) * scaleX,
                y: newY + (item.endPoint.y - itemData.y) * scaleY,
              };
              const newControlPoint = item.controlPoint ? {
                x: newX + (item.controlPoint.x - itemData.x) * scaleX,
                y: newY + (item.controlPoint.y - itemData.y) * scaleY,
              } : undefined;
              return { ...item, x: newX, y: newY, width: newWidth, height: newHeight, startPoint: newStartPoint, endPoint: newEndPoint, controlPoint: newControlPoint };
            }

            return { ...item, x: newX, y: newY, width: newWidth, height: newHeight };
          });
          return updateConnectionsRealtime(resizedItems, selectedIds);
        });
        return;
      }

      // 单选缩放（简化版本，完整逻辑见原代码）
      setItems(prev => {
        const resizedItems = prev.map(item => {
          if (item.id !== selectedIds[0]) return item;

          // 通用等比缩放
          const ratio = itemStartSize.height > 0 ? itemStartSize.width / itemStartSize.height : 1;
          let newWidth = itemStartSize.width;
          let newHeight = itemStartSize.height;
          let newX = itemStartSize.x;
          let newY = itemStartSize.y;

          if (resizeCorner === 'br') {
            newWidth = Math.max(20, itemStartSize.width + dx);
            newHeight = item.type === 'line' || item.type === 'arrow'
              ? Math.max(10, itemStartSize.height + dy)
              : newWidth / ratio;
          } else if (resizeCorner === 'bl') {
            newWidth = Math.max(20, itemStartSize.width - dx);
            newHeight = item.type === 'line' || item.type === 'arrow'
              ? Math.max(10, itemStartSize.height + dy)
              : newWidth / ratio;
            newX = itemStartSize.x + (itemStartSize.width - newWidth);
          } else if (resizeCorner === 'tr') {
            newWidth = Math.max(20, itemStartSize.width + dx);
            newHeight = item.type === 'line' || item.type === 'arrow'
              ? Math.max(10, itemStartSize.height - dy)
              : newWidth / ratio;
            newY = itemStartSize.y + (itemStartSize.height - newHeight);
          } else if (resizeCorner === 'tl') {
            newWidth = Math.max(20, itemStartSize.width - dx);
            newHeight = item.type === 'line' || item.type === 'arrow'
              ? Math.max(10, itemStartSize.height - dy)
              : newWidth / ratio;
            newX = itemStartSize.x + (itemStartSize.width - newWidth);
            newY = itemStartSize.y + (itemStartSize.height - newHeight);
          }

          // 画笔缩放
          if (item.type === 'brush' && itemStartSize.points) {
            const scaleX = itemStartSize.width > 0 ? newWidth / itemStartSize.width : 1;
            const scaleY = itemStartSize.height > 0 ? newHeight / itemStartSize.height : 1;
            const newPoints = itemStartSize.points.map(p => ({
              x: newX + (p.x - itemStartSize.x) * scaleX,
              y: newY + (p.y - itemStartSize.y) * scaleY,
            }));
            return { ...item, width: newWidth, height: newHeight, x: newX, y: newY, points: newPoints };
          }

          // 线段/箭头缩放
          if ((item.type === 'line' || item.type === 'arrow') && itemStartSize.startPoint && itemStartSize.endPoint) {
            const scaleX = itemStartSize.width > 0 ? newWidth / itemStartSize.width : 1;
            const scaleY = itemStartSize.height > 0 ? newHeight / itemStartSize.height : 1;
            const newStartPoint = {
              x: newX + (itemStartSize.startPoint.x - itemStartSize.x) * scaleX,
              y: newY + (itemStartSize.startPoint.y - itemStartSize.y) * scaleY,
            };
            const newEndPoint = {
              x: newX + (itemStartSize.endPoint.x - itemStartSize.x) * scaleX,
              y: newY + (itemStartSize.endPoint.y - itemStartSize.y) * scaleY,
            };
            return { ...item, width: newWidth, height: newHeight, x: newX, y: newY, startPoint: newStartPoint, endPoint: newEndPoint };
          }

          return { ...item, width: newWidth, height: newHeight, x: newX, y: newY };
        });
        return updateConnectionsRealtime(resizedItems, selectedIds);
      });
      return;
    }

    // 框选
    if (isSelecting) {
      setSelectionEnd({ x: e.clientX, y: e.clientY });

      // 计算框选范围内的元素
      const selRect = {
        left: Math.min(selectionStart.x, e.clientX),
        right: Math.max(selectionStart.x, e.clientX),
        top: Math.min(selectionStart.y, e.clientY),
        bottom: Math.max(selectionStart.y, e.clientY),
      };

      const selectedItemIds = items
        .filter(item => {
          if (item.type === 'connection') return false;
          const screen = canvasToScreen(item.x, item.y, scale, pan);
          const screenRight = screen.x + item.width * scale;
          const screenBottom = screen.y + item.height * scale;

          return (
            screen.x < selRect.right &&
            screenRight > selRect.left &&
            screen.y < selRect.bottom &&
            screenBottom > selRect.top
          );
        })
        .map(item => item.id);

      setSelectedIds(selectedItemIds);
      return;
    }

    // 拖拽
    if (isDragging && selectedIds.length > 0) {
      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;
      const selectedItem = items.find(i => i.id === selectedIds[0]);

      if (!selectedItem) return;

      // 画笔绘制
      if (selectedItem.type === 'brush' && toolMode === ToolMode.BRUSH) {
        setItems(prev => prev.map(item => {
          if (item.id !== selectedItem.id || !item.points) return item;
          const newPoints = [...item.points, { x: canvasPos.x, y: canvasPos.y }];

          // 计算边界框
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          newPoints.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });

          return {
            ...item,
            points: newPoints,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
          };
        }));
        return;
      }

      // 形状绘制（矩形、圆形、线段、箭头）
      if (
        (selectedItem.type === 'rectangle' || selectedItem.type === 'circle') &&
        (toolMode === ToolMode.RECTANGLE || toolMode === ToolMode.CIRCLE)
      ) {
        setItems(prev => prev.map(item => {
          if (item.id !== selectedItem.id) return item;
          const newWidth = Math.abs(dx);
          const newHeight = Math.abs(dy);
          const newX = dx >= 0 ? itemStart.x : itemStart.x + dx;
          const newY = dy >= 0 ? itemStart.y : itemStart.y + dy;
          return { ...item, x: newX, y: newY, width: newWidth, height: newHeight };
        }));
        return;
      }

      if (
        (selectedItem.type === 'line' || selectedItem.type === 'arrow') &&
        (toolMode === ToolMode.LINE || toolMode === ToolMode.ARROW)
      ) {
        setItems(prev => prev.map(item => {
          if (item.id !== selectedItem.id) return item;
          const endX = itemStart.x + dx;
          const endY = itemStart.y + dy;
          const minX = Math.min(itemStart.x, endX);
          const minY = Math.min(itemStart.y, endY);
          const maxX = Math.max(itemStart.x, endX);
          const maxY = Math.max(itemStart.y, endY);
          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            startPoint: { x: itemStart.x, y: itemStart.y },
            endPoint: { x: endX, y: endY },
          };
        }));
        return;
      }

      // 移动选中的元素
      if (toolMode === ToolMode.SELECT) {
        setItems(prev => {
          const movedItems = prev.map(item => {
            if (!selectedIds.includes(item.id)) return item;
            const startPos = itemsStartPositions[item.id];
            if (!startPos) return item;

            const newX = startPos.x + dx;
            const newY = startPos.y + dy;

            // 线段/箭头：同时移动起点终点
            if ((item.type === 'line' || item.type === 'arrow') && item.startPoint && item.endPoint) {
              const origStartPos = itemsStartPositions[item.id];
              if (!origStartPos) return item;

              return {
                ...item,
                x: newX,
                y: newY,
                startPoint: {
                  x: item.startPoint.x + dx,
                  y: item.startPoint.y + dy,
                },
                endPoint: {
                  x: item.endPoint.x + dx,
                  y: item.endPoint.y + dy,
                },
                controlPoint: item.controlPoint ? {
                  x: item.controlPoint.x + dx,
                  y: item.controlPoint.y + dy,
                } : undefined,
              };
            }

            // 画笔：同时移动所有点
            if (item.type === 'brush' && item.points) {
              const newPoints = item.points.map(p => ({
                x: p.x + dx,
                y: p.y + dy,
              }));
              return { ...item, x: newX, y: newY, points: newPoints };
            }

            return { ...item, x: newX, y: newY };
          });
          return updateConnectionsRealtime(movedItems, selectedIds);
        });
      }
    }
  }, [
    items, selectedIds, toolMode, scale, pan, isDragging, isPanning, isResizing,
    isSelecting, linePointDrag, dragStart, panStart, resizeStart, resizeCorner,
    itemStart, itemsStartPositions, itemStartSize, multiResizeData, selectionStart,
    isCollabConnected, sendCursorMove, setItems, setSelectedIds, setPan,
    updateConnectionsRealtime
  ]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      updateConnections(selectedIds);
    }
    if (isResizing) {
      updateConnections(selectedIds);
    }

    setIsDragging(false);
    setIsPanning(false);
    setIsResizing(false);
    setIsSelecting(false);
    setLinePointDrag(null);
    setResizeCorner(null);
    setMultiResizeData(null);
  }, [isDragging, isResizing, selectedIds, updateConnections]);

  const handleResizeStart = useCallback((e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeCorner(corner);
    setResizeStart({ x: e.clientX, y: e.clientY });

    if (selectedIds.length === 1) {
      const item = items.find(i => i.id === selectedIds[0]);
      if (item) {
        setItemStartSize({
          width: item.width,
          height: item.height,
          x: item.x,
          y: item.y,
          points: item.points,
          startPoint: item.startPoint,
          endPoint: item.endPoint,
        });
      }
    } else if (selectedIds.length > 1) {
      const selectedItems = items.filter(i => selectedIds.includes(i.id));
      const bb = calculateBoundingBox(selectedItems);
      if (bb) {
        const itemsData: Record<string, { x: number; y: number; width: number; height: number; relX: number; relY: number; relW: number; relH: number }> = {};
        selectedItems.forEach(item => {
          itemsData[item.id] = {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            relX: (item.x - bb.x) / bb.width,
            relY: (item.y - bb.y) / bb.height,
            relW: item.width / bb.width,
            relH: item.height / bb.height,
          };
        });
        setMultiResizeData({ boundingBox: bb, items: itemsData });
      }
    }
  }, [items, selectedIds]);

  const handleLinePointDrag = useCallback((e: React.MouseEvent, itemId: string, pointType: 'start' | 'end' | 'control') => {
    e.stopPropagation();
    setLinePointDrag({ itemId, pointType });
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleResizeStart,
    handleLinePointDrag,
    isDragging,
    isResizing,
    isPanning,
    isSelecting,
    selectionStart,
    selectionEnd,
    mousePositionRef,
    // 供 line/arrow 元素直接使用的 setters
    setIsDragging,
    setDragStart,
    setItemStart,
    setItemsStartPositions,
    setLinePointDrag,
  };
}
