/**
 * SelectionRect - 框选矩形
 */

interface SelectionRectProps {
  isSelecting: boolean;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export function SelectionRect({ isSelecting, start, end }: SelectionRectProps) {
  if (!isSelecting) return null;

  return (
    <div
      className="fixed border-2 border-violet-400 bg-violet-400/10 rounded pointer-events-none z-50"
      style={{
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      }}
    />
  );
}
