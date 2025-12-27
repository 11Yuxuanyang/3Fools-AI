/**
 * Yjs 同步 Hook - 使用 CRDT 实现画布状态的实时同步
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { CanvasItem } from '../types';
import { collaborationClient } from '../services/collaboration';

interface UseYjsSyncOptions {
  projectId: string;
  initialItems: CanvasItem[];
  enabled?: boolean;
  onItemsChange?: (items: CanvasItem[]) => void;
}

export function useYjsSync(options: UseYjsSyncOptions) {
  const { projectId, initialItems, enabled = true, onItemsChange } = options;

  const [isReady, setIsReady] = useState(false);
  const docRef = useRef<Y.Doc | null>(null);
  const itemsMapRef = useRef<Y.Map<CanvasItem> | null>(null);
  const isLocalChangeRef = useRef(false);
  const initializedRef = useRef(false);

  // 初始化 Yjs 文档
  useEffect(() => {
    if (!enabled || !projectId || initializedRef.current) return;

    const doc = new Y.Doc();
    docRef.current = doc;

    // 创建共享的 items Map
    const itemsMap = doc.getMap<CanvasItem>('items');
    itemsMapRef.current = itemsMap;

    // 初始化数据（只在首次时）
    if (itemsMap.size === 0 && initialItems.length > 0) {
      doc.transact(() => {
        initialItems.forEach(item => {
          itemsMap.set(item.id, item);
        });
      });
    }

    // 监听 Yjs 变化
    itemsMap.observe((_event) => {
      // 忽略本地变化
      if (isLocalChangeRef.current) return;

      // 转换为数组
      const items: CanvasItem[] = [];
      itemsMap.forEach((item, id) => {
        if (item) {
          items.push({ ...item, id });
        }
      });

      // 按 zIndex 排序
      items.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

      onItemsChange?.(items);
    });

    // 监听来自服务器的 Yjs 更新
    collaborationClient.setCallbacks({
      ...collaborationClient['callbacks'],
      onYjsUpdate: (update) => {
        Y.applyUpdate(doc, update);
      },
    });

    // 监听本地文档更新，发送到服务器
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      // 只发送本地产生的更新
      if (origin !== 'remote') {
        collaborationClient.sendYjsUpdate(update);
      }
    });

    setIsReady(true);
    initializedRef.current = true;

    return () => {
      doc.destroy();
      docRef.current = null;
      itemsMapRef.current = null;
      initializedRef.current = false;
    };
  }, [enabled, projectId]);

  // 添加元素
  const addItem = useCallback((item: CanvasItem) => {
    const itemsMap = itemsMapRef.current;
    const doc = docRef.current;
    if (!itemsMap || !doc) return;

    isLocalChangeRef.current = true;
    doc.transact(() => {
      itemsMap.set(item.id, item);
    });
    isLocalChangeRef.current = false;
  }, []);

  // 更新元素
  const updateItem = useCallback((id: string, updates: Partial<CanvasItem>) => {
    const itemsMap = itemsMapRef.current;
    const doc = docRef.current;
    if (!itemsMap || !doc) return;

    const existing = itemsMap.get(id);
    if (!existing) return;

    isLocalChangeRef.current = true;
    doc.transact(() => {
      itemsMap.set(id, { ...existing, ...updates });
    });
    isLocalChangeRef.current = false;
  }, []);

  // 删除元素
  const deleteItems = useCallback((ids: string[]) => {
    const itemsMap = itemsMapRef.current;
    const doc = docRef.current;
    if (!itemsMap || !doc) return;

    isLocalChangeRef.current = true;
    doc.transact(() => {
      ids.forEach(id => {
        itemsMap.delete(id);
      });
    });
    isLocalChangeRef.current = false;
  }, []);

  // 批量更新元素
  const updateItems = useCallback((updates: Array<{ id: string; updates: Partial<CanvasItem> }>) => {
    const itemsMap = itemsMapRef.current;
    const doc = docRef.current;
    if (!itemsMap || !doc) return;

    isLocalChangeRef.current = true;
    doc.transact(() => {
      updates.forEach(({ id, updates: itemUpdates }) => {
        const existing = itemsMap.get(id);
        if (existing) {
          itemsMap.set(id, { ...existing, ...itemUpdates });
        }
      });
    });
    isLocalChangeRef.current = false;
  }, []);

  // 设置所有元素（完全替换）
  const setItems = useCallback((items: CanvasItem[]) => {
    const itemsMap = itemsMapRef.current;
    const doc = docRef.current;
    if (!itemsMap || !doc) return;

    isLocalChangeRef.current = true;
    doc.transact(() => {
      // 清除旧的
      itemsMap.forEach((_, key) => {
        itemsMap.delete(key);
      });
      // 添加新的
      items.forEach(item => {
        itemsMap.set(item.id, item);
      });
    });
    isLocalChangeRef.current = false;
  }, []);

  // 获取当前 items
  const getItems = useCallback((): CanvasItem[] => {
    const itemsMap = itemsMapRef.current;
    if (!itemsMap) return [];

    const items: CanvasItem[] = [];
    itemsMap.forEach((item, id) => {
      if (item) {
        items.push({ ...item, id });
      }
    });
    return items.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, []);

  return {
    isReady,
    addItem,
    updateItem,
    updateItems,
    deleteItems,
    setItems,
    getItems,
  };
}
