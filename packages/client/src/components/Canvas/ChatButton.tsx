/**
 * ChatButton - 问三傻按钮
 */

import { Logo } from '../Logo';

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatButton({ isOpen, onClick }: ChatButtonProps) {
  return (
    <button
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl shadow-sm transition-colors"
      style={{ backgroundColor: isOpen ? '#111827' : '#1F2937' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#111827')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = isOpen ? '#111827' : '#1F2937')
      }
      onClick={onClick}
    >
      <div className="w-5 h-5 rounded-lg bg-white/90 flex items-center justify-center">
        <Logo size={14} showText={false} />
      </div>
      <span className="text-sm font-semibold text-white">问三傻</span>
    </button>
  );
}
