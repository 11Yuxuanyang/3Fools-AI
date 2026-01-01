import React, { useState } from 'react';
import {
  Maximize2,
  Scissors,
  Eraser,
  Paintbrush,
  Download,
  Trash2,
  Expand,
  X,
  Send,
  SlidersHorizontal,
} from 'lucide-react';

interface FloatingToolbarProps {
  onUpscale: () => void;
  onRemoveBg: () => void;
  onEdit: (prompt: string) => void;
  onInpaint: () => void;   // 涂抹擦除
  onRepaint: () => void;   // 局部重绘
  onExpand: () => void;
  onAdjust: () => void;    // 图片调整
  onDelete: () => void;
  onDownload: () => void;
  isProcessing: boolean;
  showAdjustPanel?: boolean;
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  highlight?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  label,
  onClick,
  disabled,
  className = "",
  highlight = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
      transition-all duration-200 whitespace-nowrap
      ${disabled
        ? 'opacity-50 cursor-not-allowed'
        : highlight
          ? 'text-violet-600 hover:bg-violet-50 hover:text-violet-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }
      ${className}
    `}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span>{label}</span>
  </button>
);

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onUpscale,
  onRemoveBg,
  onEdit,
  onInpaint,
  onRepaint,
  onExpand,
  onAdjust,
  onDelete,
  onDownload,
  isProcessing,
  showAdjustPanel = false,
}) => {
  const [showEditInput, setShowEditInput] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPrompt.trim()) {
      onEdit(editPrompt);
      setShowEditInput(false);
      setEditPrompt("");
    }
  };

  return (
    <div
      className="absolute top-[-64px] left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl px-2 py-1.5 flex items-center gap-0.5">

        {/* Magic Edit Input Overlay */}
        {showEditInput ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-2 px-1">
            <input
              type="text"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="描述你想要的修改..."
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 w-64"
              autoFocus
            />
            <button
              type="submit"
              className="flex items-center gap-1 bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Send size={14} />
              确定
            </button>
            <button
              type="button"
              onClick={() => setShowEditInput(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <>
            {/* AI 增强功能 */}
            <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200">
              <ToolButton
                icon={<Maximize2 size={14} />}
                label="高清"
                onClick={onUpscale}
                disabled={isProcessing}
              />
              <ToolButton
                icon={<Expand size={14} />}
                label="扩展"
                onClick={onExpand}
                disabled={isProcessing}
              />
            </div>

            {/* AI 编辑功能 */}
            <div className="flex items-center gap-0.5 px-1 border-r border-gray-200">
              <ToolButton
                icon={<Scissors size={14} />}
                label="去背景"
                onClick={onRemoveBg}
                disabled={isProcessing}
              />
              <ToolButton
                icon={<Eraser size={14} />}
                label="擦除"
                onClick={onInpaint}
                disabled={isProcessing}
              />
              <ToolButton
                icon={<Paintbrush size={14} />}
                label="局部重绘"
                onClick={onRepaint}
                disabled={isProcessing}
              />
            </div>

            {/* 修图 */}
            <div className="flex items-center gap-0.5 px-1 border-r border-gray-200">
              <ToolButton
                icon={<SlidersHorizontal size={14} />}
                label="修图"
                onClick={onAdjust}
                disabled={isProcessing}
                highlight={showAdjustPanel}
              />
            </div>

            {/* 基础操作 */}
            <div className="flex items-center gap-1 pl-1">
              <button
                onClick={onDownload}
                disabled={isProcessing}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
                title="下载"
              >
                <Download size={16} />
              </button>
              <button
                onClick={onDelete}
                disabled={isProcessing}
                className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {isProcessing && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full border border-violet-200 text-xs text-violet-600 font-medium animate-pulse whitespace-nowrap shadow-sm flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          AI 正在处理...
        </div>
      )}
    </div>
  );
};
