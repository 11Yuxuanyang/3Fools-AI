/**
 * useKeyboardShortcuts - 键盘快捷键 Hook
 * 处理删除、复制、粘贴、全选等快捷键
 */

import { useEffect } from 'react';
import { CanvasItem, ToolMode } from '@/types';
import { generateId } from '@/utils/id';

interface UseKeyboardShortcutsProps {
  items: CanvasItem[];
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  editingTextId: string | null;
  toolMode: ToolMode;
  setToolMode: React.Dispatch<React.SetStateAction<ToolMode>>;
  lastShapeTool: ToolMode;
  clipboard: CanvasItem[];
  copy: () => void;
  cut: () => void;
  paste: () => void;
  duplicate: () => void;
  mousePositionRef: React.MutableRefObject<{ x: number; y: number }>;
  measureTextSize: (text: string, fontSize: number, fontFamily: string, fontWeight: string) => { width: number; height: number };
}

export function useKeyboardShortcuts({
  items,
  setItems,
  selectedIds,
  setSelectedIds,
  editingTextId,
  toolMode,
  setToolMode,
  lastShapeTool,
  clipboard,
  copy,
  cut,
  paste,
  duplicate,
  mousePositionRef,
  measureTextSize,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在编辑文字或输入框，不处理
      if (editingTextId || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      // 如果有弹窗/模态框显示，不处理（让弹窗内的复制粘贴正常工作）
      const hasModal = Array.from(document.querySelectorAll('.fixed.inset-0')).some(el => {
        const style = window.getComputedStyle(el);
        return style.zIndex && parseInt(style.zIndex) >= 40;
      });
      if (hasModal) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Delete 或 Backspace 删除选中项
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
      }

      // Ctrl/Cmd + C 复制
      if (isMod && e.key === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        copy();
      }

      // Ctrl/Cmd + X 剪切
      if (isMod && e.key === 'x' && selectedIds.length > 0) {
        e.preventDefault();
        cut();
      }

      // Ctrl/Cmd + V 粘贴到鼠标位置
      if (isMod && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (text && text.trim()) {
            const mousePos = mousePositionRef.current;
            const trimmedText = text.trim();
            const { width, height } = measureTextSize(
              trimmedText,
              24,
              '"Xiaolai SC", "Virgil", cursive',
              'normal'
            );
            const newTextItem: CanvasItem = {
              id: generateId(),
              type: 'text',
              src: trimmedText,
              x: mousePos.x - width / 2,
              y: mousePos.y - height / 2,
              width,
              height,
              zIndex: items.length + 1,
              fontSize: 24,
              fontFamily: '"Xiaolai SC", "Virgil", cursive',
              fontWeight: 'normal',
              color: '#1f2937',
              textAlign: 'left',
            };
            setItems(prev => [...prev, newTextItem]);
            setSelectedIds([newTextItem.id]);
          } else if (clipboard.length > 0) {
            paste();
          }
        }).catch(() => {
          if (clipboard.length > 0) {
            paste();
          }
        });
      }

      // Ctrl/Cmd + D 快速复制（原地偏移复制）
      if (isMod && e.key === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        duplicate();
      }

      // Ctrl/Cmd + A 全选（排除连接线）
      if (isMod && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(items.filter(i => i.type !== 'connection').map(i => i.id));
      }

      // 数字键 1 切换到选择工具
      if (e.key === '1') {
        e.preventDefault();
        setToolMode(ToolMode.SELECT);
      }

      // 数字键 2 切换到形状工具
      if (e.key === '2') {
        e.preventDefault();
        const shapeTools = [ToolMode.BRUSH, ToolMode.TEXT, ToolMode.RECTANGLE, ToolMode.CIRCLE, ToolMode.LINE, ToolMode.ARROW];
        if (!shapeTools.includes(toolMode)) {
          setToolMode(lastShapeTool);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingTextId, items, clipboard, copy, cut, paste, duplicate, setToolMode, toolMode, lastShapeTool, setItems, setSelectedIds, mousePositionRef, measureTextSize]);
}
