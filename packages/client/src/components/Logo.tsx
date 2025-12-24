import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 32, showText = true, className = '' }: LogoProps) {
  const scale = size / 28;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={32 * scale}
        height={28 * scale}
        viewBox="0 0 32 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
      >
        {/* === 傻一：左下橙色 === */}
        <g>
          {/* 脸 */}
          <rect x="1" y="16" width="10" height="2" fill="#F97316" />
          <rect x="0" y="18" width="12" height="6" fill="#F97316" />
          <rect x="1" y="24" width="10" height="2" fill="#F97316" />
          {/* 深色边 */}
          <rect x="0" y="24" width="1" height="2" fill="#EA580C" />
          <rect x="11" y="24" width="1" height="2" fill="#EA580C" />
          <rect x="1" y="26" width="10" height="1" fill="#EA580C" />
          {/* 眼睛 */}
          <rect x="2" y="19" width="3" height="3" fill="#fff" />
          <rect x="7" y="19" width="3" height="3" fill="#fff" />
          <rect x="3" y="20" width="2" height="2" fill="#1a1a1a" />
          <rect x="8" y="20" width="2" height="2" fill="#1a1a1a" />
          {/* 高光 */}
          <rect x="3" y="20" width="1" height="1" fill="#fff" />
          <rect x="8" y="20" width="1" height="1" fill="#fff" />
          {/* 嘴 - 开心 */}
          <rect x="4" y="23" width="4" height="1" fill="#1a1a1a" />
          <rect x="3" y="22" width="1" height="1" fill="#1a1a1a" />
          <rect x="8" y="22" width="1" height="1" fill="#1a1a1a" />
        </g>

        {/* === 傻三：右下青色 === */}
        <g>
          {/* 脸 */}
          <rect x="21" y="16" width="10" height="2" fill="#06B6D4" />
          <rect x="20" y="18" width="12" height="6" fill="#06B6D4" />
          <rect x="21" y="24" width="10" height="2" fill="#06B6D4" />
          {/* 深色边 */}
          <rect x="20" y="24" width="1" height="2" fill="#0891B2" />
          <rect x="31" y="24" width="1" height="2" fill="#0891B2" />
          <rect x="21" y="26" width="10" height="1" fill="#0891B2" />
          {/* 眼睛 - 大圆眼 */}
          <rect x="21" y="19" width="4" height="3" fill="#fff" />
          <rect x="27" y="19" width="4" height="3" fill="#fff" />
          <rect x="23" y="20" width="2" height="2" fill="#1a1a1a" />
          <rect x="28" y="20" width="2" height="2" fill="#1a1a1a" />
          {/* 高光 */}
          <rect x="22" y="19" width="1" height="1" fill="#fff" />
          <rect x="28" y="19" width="1" height="1" fill="#fff" />
          {/* 嘴 - 小o */}
          <rect x="25" y="23" width="2" height="2" fill="#1a1a1a" />
        </g>

        {/* === 傻二：中上紫色（C位最大） === */}
        <g>
          {/* 脸 */}
          <rect x="8" y="1" width="16" height="2" fill="#8B5CF6" />
          <rect x="6" y="3" width="20" height="10" fill="#8B5CF6" />
          <rect x="8" y="13" width="16" height="2" fill="#8B5CF6" />
          {/* 深色边 */}
          <rect x="6" y="13" width="2" height="2" fill="#7C3AED" />
          <rect x="24" y="13" width="2" height="2" fill="#7C3AED" />
          <rect x="8" y="15" width="16" height="1" fill="#7C3AED" />
          {/* 大圆眼 - 开心 */}
          <rect x="8" y="5" width="5" height="4" fill="#fff" />
          <rect x="19" y="5" width="5" height="4" fill="#fff" />
          <rect x="10" y="6" width="3" height="3" fill="#1a1a1a" />
          <rect x="20" y="6" width="3" height="3" fill="#1a1a1a" />
          {/* 高光 */}
          <rect x="9" y="5" width="2" height="2" fill="#fff" />
          <rect x="20" y="5" width="2" height="2" fill="#fff" />
          {/* 腮红 */}
          <rect x="7" y="9" width="2" height="1" fill="#F9A8D4" />
          <rect x="23" y="9" width="2" height="1" fill="#F9A8D4" />
          {/* 嘴 - 大笑 */}
          <rect x="12" y="11" width="8" height="2" fill="#1a1a1a" />
          <rect x="13" y="10" width="6" height="1" fill="#1a1a1a" />
        </g>
      </svg>

      {showText && (
        <span className="font-semibold text-gray-900 whitespace-nowrap">
          三傻大闹AI圈
        </span>
      )}
    </div>
  );
}
