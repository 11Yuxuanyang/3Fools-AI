import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 32, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size * 1.1}
        height={size}
        viewBox="0 0 22 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
      >
        {/* === 傻一：左下橙色像素圆 === */}
        <g>
          {/* 圆形轮廓 */}
          <rect x="2" y="11" width="4" height="1" fill="#F97316" />
          <rect x="1" y="12" width="6" height="1" fill="#F97316" />
          <rect x="0" y="13" width="8" height="4" fill="#F97316" />
          <rect x="1" y="17" width="6" height="1" fill="#F97316" />
          <rect x="2" y="18" width="4" height="1" fill="#F97316" />
          {/* 翻白眼 */}
          <rect x="1" y="13" width="2" height="2" fill="#fff" />
          <rect x="5" y="13" width="2" height="2" fill="#fff" />
          <rect x="1" y="13" width="1" height="1" fill="#1a1a1a" />
          <rect x="5" y="13" width="1" height="1" fill="#1a1a1a" />
          {/* 歪嘴 */}
          <rect x="2" y="16" width="2" height="1" fill="#1a1a1a" />
          <rect x="5" y="15" width="1" height="1" fill="#1a1a1a" />
        </g>

        {/* === 傻三：右下青色像素圆 === */}
        <g>
          <rect x="16" y="11" width="4" height="1" fill="#06B6D4" />
          <rect x="15" y="12" width="6" height="1" fill="#06B6D4" />
          <rect x="14" y="13" width="8" height="4" fill="#06B6D4" />
          <rect x="15" y="17" width="6" height="1" fill="#06B6D4" />
          <rect x="16" y="18" width="4" height="1" fill="#06B6D4" />
          {/* 惊恐大眼 */}
          <rect x="14" y="13" width="3" height="3" fill="#fff" />
          <rect x="19" y="13" width="3" height="3" fill="#fff" />
          <rect x="15" y="14" width="2" height="2" fill="#1a1a1a" />
          <rect x="19" y="14" width="2" height="2" fill="#1a1a1a" />
          {/* 方嘴 */}
          <rect x="16" y="17" width="3" height="2" fill="#1a1a1a" />
        </g>

        {/* === 傻二：顶部紫色像素圆 === */}
        <g>
          <rect x="8" y="0" width="6" height="1" fill="#8B5CF6" />
          <rect x="6" y="1" width="10" height="1" fill="#8B5CF6" />
          <rect x="5" y="2" width="12" height="6" fill="#8B5CF6" />
          <rect x="6" y="8" width="10" height="1" fill="#8B5CF6" />
          <rect x="8" y="9" width="6" height="1" fill="#8B5CF6" />
          {/* 得意眯眯眼 ^ ^ */}
          <rect x="6" y="4" width="1" height="1" fill="#1a1a1a" />
          <rect x="7" y="3" width="1" height="1" fill="#1a1a1a" />
          <rect x="8" y="4" width="1" height="1" fill="#1a1a1a" />
          <rect x="13" y="4" width="1" height="1" fill="#1a1a1a" />
          <rect x="14" y="3" width="1" height="1" fill="#1a1a1a" />
          <rect x="15" y="4" width="1" height="1" fill="#1a1a1a" />
          {/* 坏笑+吐舌 */}
          <rect x="8" y="6" width="6" height="1" fill="#1a1a1a" />
          <rect x="9" y="7" width="4" height="2" fill="#F472B6" />
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
