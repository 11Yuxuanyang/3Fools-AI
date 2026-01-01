/**
 * ZoomControls - 缩放控制组件
 */

import { ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="fixed bottom-4 left-4 flex items-center gap-1 bg-white border border-gray-200 shadow-float rounded-lg p-1 z-50">
      <button
        onClick={onZoomOut}
        className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        title="缩小"
      >
        <ZoomOut size={18} />
      </button>
      <span className="px-2 py-1 min-w-[50px] text-center text-sm font-medium text-gray-600">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        title="放大"
      >
        <ZoomIn size={18} />
      </button>
    </div>
  );
}
