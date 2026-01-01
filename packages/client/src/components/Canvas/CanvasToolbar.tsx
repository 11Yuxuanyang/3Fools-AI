/**
 * 画布左侧工具栏
 * 包含选择、形状、颜色等工具
 */

import { useState } from 'react';
import {
  MousePointer2,
  Pencil,
  Type,
  Square,
  Circle,
  Minus,
  MoveRight,
  Shapes,
} from 'lucide-react';
import { ToolMode } from '@/types';
import { Tooltip } from '@/components/ui';

// 颜色调色板
const COLOR_PALETTE = ['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

// 形状工具列表
const SHAPE_TOOLS = [ToolMode.BRUSH, ToolMode.TEXT, ToolMode.RECTANGLE, ToolMode.CIRCLE, ToolMode.LINE, ToolMode.ARROW];

interface ToolColors {
  brush: string;
  line: string;
  arrow: string;
  rectangle: string;
  circle: string;
}

interface CanvasToolbarProps {
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  toolColors: ToolColors;
  onToolColorChange: (mode: ToolMode, color: string) => void;
}

export function CanvasToolbar({
  toolMode,
  onToolModeChange,
  toolColors,
  onToolColorChange,
}: CanvasToolbarProps) {
  const [showCreativeTools, setShowCreativeTools] = useState(false);
  const [lastShapeTool, setLastShapeTool] = useState<ToolMode>(ToolMode.RECTANGLE);

  const getToolColor = (mode: ToolMode): string => {
    if (mode === ToolMode.BRUSH) return toolColors.brush;
    if (mode === ToolMode.LINE) return toolColors.line;
    if (mode === ToolMode.ARROW) return toolColors.arrow;
    if (mode === ToolMode.RECTANGLE) return toolColors.rectangle;
    if (mode === ToolMode.CIRCLE) return toolColors.circle;
    return '#000000';
  };

  const handleShapeToolClick = (mode: ToolMode) => {
    onToolModeChange(mode);
    setLastShapeTool(mode);
  };

  const getToolIcon = () => {
    switch (toolMode) {
      case ToolMode.BRUSH: return <Pencil size={20} />;
      case ToolMode.TEXT: return <Type size={20} />;
      case ToolMode.LINE: return <Minus size={20} />;
      case ToolMode.ARROW: return <MoveRight size={20} />;
      case ToolMode.RECTANGLE: return <Square size={20} />;
      case ToolMode.CIRCLE: return <Circle size={20} />;
      default: return <Shapes size={20} />;
    }
  };

  return (
    <div
      className="fixed left-4 flex flex-col items-center gap-1 p-2 bg-gray-100/90 backdrop-blur-sm shadow-lg rounded-full z-40"
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      {/* 选择工具 */}
      <Tooltip content="选择 (1)" side="right">
        <button
          className={`relative p-3 rounded-full transition-all duration-200 ease-out ${
            toolMode === ToolMode.SELECT
              ? 'bg-gray-800 text-white shadow-md scale-105'
              : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'
          }`}
          onClick={() => {
            onToolModeChange(ToolMode.SELECT);
            setShowCreativeTools(false);
          }}
        >
          <MousePointer2 size={20} />
        </button>
      </Tooltip>

      {/* 形状工具（含画笔） */}
      <div
        className="relative"
        onMouseEnter={() => setShowCreativeTools(true)}
        onMouseLeave={() => setShowCreativeTools(false)}
      >
        <Tooltip content="形状工具 (2)" side="right">
          <button
            className={`relative p-3 rounded-full transition-all duration-200 ease-out ${
              SHAPE_TOOLS.includes(toolMode)
                ? 'bg-gray-800 text-white shadow-md scale-105'
                : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'
            }`}
            onClick={() => {
              if (!SHAPE_TOOLS.includes(toolMode)) {
                onToolModeChange(lastShapeTool);
              } else {
                setShowCreativeTools(!showCreativeTools);
              }
            }}
          >
            {getToolIcon()}
          </button>
        </Tooltip>

        {/* 形状展开菜单 */}
        {showCreativeTools && (
          <div className="absolute left-full top-0 flex items-start z-50">
            <div className="w-3" />
            <div className="flex flex-col gap-3 p-3 bg-white/98 backdrop-blur-md shadow-2xl rounded-2xl animate-in slide-in-from-left-3 fade-in duration-200 border border-gray-200/80">
              {/* 形状工具行 */}
              <div className="flex gap-1.5">
                <Tooltip content="画笔 (B)" side="top">
                  <button
                    className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      toolMode === ToolMode.BRUSH
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    onClick={() => handleShapeToolClick(ToolMode.BRUSH)}
                  >
                    <Pencil size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="文字 (T)" side="top">
                  <button
                    className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      toolMode === ToolMode.TEXT
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    onClick={() => handleShapeToolClick(ToolMode.TEXT)}
                  >
                    <Type size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="直线 (L)" side="top">
                  <button
                    className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      toolMode === ToolMode.LINE
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    onClick={() => handleShapeToolClick(ToolMode.LINE)}
                  >
                    <Minus size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="箭头 (A)" side="top">
                  <button
                    className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      toolMode === ToolMode.ARROW
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    onClick={() => handleShapeToolClick(ToolMode.ARROW)}
                  >
                    <MoveRight size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="矩形 (R)" side="top">
                  <button
                    className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      toolMode === ToolMode.RECTANGLE
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    onClick={() => handleShapeToolClick(ToolMode.RECTANGLE)}
                  >
                    <Square size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="圆形 (O)" side="top">
                  <button
                    className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${
                      toolMode === ToolMode.CIRCLE
                        ? 'bg-gray-900 text-white shadow-lg scale-105'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                    onClick={() => handleShapeToolClick(ToolMode.CIRCLE)}
                  >
                    <Circle size={18} />
                  </button>
                </Tooltip>
              </div>

              {/* 分隔线 */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              {/* 颜色选择器行 */}
              <div className="flex gap-1.5">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    className={`w-10 h-10 rounded-xl transition-all duration-200 hover:scale-110 ${
                      getToolColor(toolMode) === color
                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => onToolColorChange(toolMode, color)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
