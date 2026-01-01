/**
 * DragOverlay - 文件拖放提示覆盖层
 */

interface DragOverlayProps {
  isDragOver: boolean;
}

export function DragOverlay({ isDragOver }: DragOverlayProps) {
  if (!isDragOver) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
      <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border-2 border-dashed border-violet-400">
        <p className="text-violet-600 font-medium">松开鼠标放置图片</p>
      </div>
    </div>
  );
}
