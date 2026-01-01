/**
 * useConnectionLines - 连接线管理 Hook
 * 处理元素之间的溯源连接线计算和更新
 */

import { useCallback } from 'react';
import { CanvasItem } from '@/types';
import { generateId } from '@/utils/id';

interface UseConnectionLinesProps {
  items: CanvasItem[];
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
}

export function useConnectionLines({ items, setItems }: UseConnectionLinesProps) {
  // 计算连接线的起点和终点（就近原则：选择最近的边连接）
  const calcConnectionPoints = useCallback(
    (
      sourceItem: CanvasItem,
      targetItem: CanvasItem,
      fixedEnd?: { x: number; y: number }
    ) => {
      const gap = 12;
      const sCx = sourceItem.x + sourceItem.width / 2;
      const sCy = sourceItem.y + sourceItem.height / 2;

      let startX: number, startY: number, endX: number, endY: number;
      let isVertical: boolean;

      if (fixedEnd) {
        endX = fixedEnd.x;
        endY = fixedEnd.y;
        const dx = endX - sCx;
        const dy = endY - sCy;
        isVertical = Math.abs(dy) > Math.abs(dx);
        if (!isVertical) {
          startX = dx > 0 ? sourceItem.x + sourceItem.width + gap : sourceItem.x - gap;
          startY = sCy;
        } else {
          startY = dy > 0 ? sourceItem.y + sourceItem.height + gap : sourceItem.y - gap;
          startX = sCx;
        }
      } else {
        const tCx = targetItem.x + targetItem.width / 2;
        const tCy = targetItem.y + targetItem.height / 2;
        const dx = tCx - sCx;
        const dy = tCy - sCy;
        isVertical = Math.abs(dy) > Math.abs(dx);

        if (!isVertical) {
          if (dx > 0) {
            startX = sourceItem.x + sourceItem.width + gap;
            endX = targetItem.x - gap;
          } else {
            startX = sourceItem.x - gap;
            endX = targetItem.x + targetItem.width + gap;
          }
          startY = sCy;
          endY = tCy;
        } else {
          if (dy > 0) {
            startY = sourceItem.y + sourceItem.height + gap;
            endY = targetItem.y - gap;
          } else {
            startY = sourceItem.y - gap;
            endY = targetItem.y + targetItem.height + gap;
          }
          startX = sCx;
          endX = tCx;
        }
      }
      return { startX, startY, endX, endY, isVertical };
    },
    []
  );

  // 计算多源图片时的统一目标连接点
  const calcUnifiedEndPoint = useCallback(
    (sourceItems: CanvasItem[], targetItem: CanvasItem) => {
      const gap = 12;
      const avgX = sourceItems.reduce((sum, s) => sum + s.x + s.width / 2, 0) / sourceItems.length;
      const avgY = sourceItems.reduce((sum, s) => sum + s.y + s.height / 2, 0) / sourceItems.length;
      const tCx = targetItem.x + targetItem.width / 2;
      const tCy = targetItem.y + targetItem.height / 2;
      const dx = tCx - avgX;
      const dy = tCy - avgY;
      const isVertical = Math.abs(dy) > Math.abs(dx);

      let endX: number, endY: number;
      if (!isVertical) {
        endX = dx > 0 ? targetItem.x - gap : targetItem.x + targetItem.width + gap;
        endY = tCy;
      } else {
        endY = dy > 0 ? targetItem.y - gap : targetItem.y + targetItem.height + gap;
        endX = tCx;
      }
      return { x: endX, y: endY };
    },
    []
  );

  // 创建溯源连接线（贝塞尔曲线）
  const createConnectionCurve = useCallback(
    (
      sourceItem: CanvasItem,
      targetItem: CanvasItem,
      fixedEnd?: { x: number; y: number }
    ): CanvasItem => {
      const { startX, startY, endX, endY } = calcConnectionPoints(sourceItem, targetItem, fixedEnd);

      return {
        id: generateId(),
        type: 'connection',
        src: '',
        x: Math.min(startX, endX) - 20,
        y: Math.min(startY, endY) - 20,
        width: Math.abs(endX - startX) + 40,
        height: Math.abs(endY - startY) + 40,
        zIndex: 0,
        stroke: '#a78bfa',
        strokeWidth: 5,
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
        sourceItemId: sourceItem.id,
        targetItemId: targetItem.id,
      };
    },
    [calcConnectionPoints]
  );

  // 更新与指定元素关联的所有连接线（实时更新，返回新数组）
  const updateConnectionsRealtime = useCallback(
    (currentItems: CanvasItem[], movedItemIds: string[]): CanvasItem[] => {
      const movedSet = new Set(movedItemIds);

      // 找出需要更新的连接线，并按目标分组
      const connectionsByTarget = new Map<string, CanvasItem[]>();
      currentItems.forEach((item) => {
        if (item.type !== 'connection' || !item.targetItemId) return;
        if (!connectionsByTarget.has(item.targetItemId)) {
          connectionsByTarget.set(item.targetItemId, []);
        }
        connectionsByTarget.get(item.targetItemId)!.push(item);
      });

      // 预计算每个目标的统一终点（仅当有多个源时）
      const unifiedEndPoints = new Map<string, { x: number; y: number } | undefined>();
      connectionsByTarget.forEach((connections, targetId) => {
        const targetItem = currentItems.find((i) => i.id === targetId);
        if (!targetItem) return;
        if (connections.length > 1) {
          const sourceItems = connections
            .map((c) => currentItems.find((i) => i.id === c.sourceItemId))
            .filter((s): s is CanvasItem => !!s);
          if (sourceItems.length > 1) {
            unifiedEndPoints.set(targetId, calcUnifiedEndPoint(sourceItems, targetItem));
          }
        }
      });

      return currentItems.map((item) => {
        if (item.type !== 'connection') return item;
        if (!item.sourceItemId || !item.targetItemId) return item;
        if (!movedSet.has(item.sourceItemId) && !movedSet.has(item.targetItemId)) return item;

        const sourceItem = currentItems.find((i) => i.id === item.sourceItemId);
        const targetItem = currentItems.find((i) => i.id === item.targetItemId);
        if (!sourceItem || !targetItem) return item;

        const fixedEnd = unifiedEndPoints.get(item.targetItemId);
        const { startX, startY, endX, endY } = calcConnectionPoints(sourceItem, targetItem, fixedEnd);

        return {
          ...item,
          x: Math.min(startX, endX) - 20,
          y: Math.min(startY, endY) - 20,
          width: Math.abs(endX - startX) + 40,
          height: Math.abs(endY - startY) + 40,
          startPoint: { x: startX, y: startY },
          endPoint: { x: endX, y: endY },
        };
      });
    },
    [calcConnectionPoints, calcUnifiedEndPoint]
  );

  // 更新与指定元素关联的所有连接线（调用 setItems）
  const updateConnections = useCallback(
    (movedItemIds: string[]) => {
      setItems((prev) => updateConnectionsRealtime(prev, movedItemIds));
    },
    [updateConnectionsRealtime, setItems]
  );

  return {
    calcConnectionPoints,
    calcUnifiedEndPoint,
    createConnectionCurve,
    updateConnectionsRealtime,
    updateConnections,
  };
}
