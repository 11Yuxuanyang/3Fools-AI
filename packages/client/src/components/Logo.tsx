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
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 圆角矩形背景 */}
        <rect width="32" height="32" rx="8" fill="#8B5CF6" />

        {/* 三个小幽灵三角排列 */}

        {/* 顶部幽灵 - 眨眼 */}
        <g>
          <path d="M16 5C13 5 11 7 11 10V14C11 14 11.5 13 12.5 14C13.5 15 14 14 14.5 14C15 14 15.5 15 16 14C16.5 15 17 14 17.5 14C18 14 18.5 15 19.5 14C20.5 13 21 14 21 14V10C21 7 19 5 16 5Z" fill="white"/>
          <circle cx="14" cy="9" r="1" fill="#8B5CF6"/>
          <path d="M17 8.5Q18 8 19 9" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
        </g>

        {/* 左下幽灵 - 吐舌 */}
        <g>
          <path d="M8 15C5.5 15 4 17 4 19.5V23C4 23 4.5 22 5.5 23C6.5 24 7 23 7.5 23C8 23 8.5 24 9 23C9.5 24 10 23 10.5 23C11 23 11.5 24 12 23V19.5C12 17 10.5 15 8 15Z" fill="white"/>
          <circle cx="6.5" cy="19" r="1" fill="#8B5CF6"/>
          <circle cx="9.5" cy="19" r="1" fill="#8B5CF6"/>
          <ellipse cx="8" cy="22" rx="1.5" ry="1" fill="#F472B6"/>
        </g>

        {/* 右下幽灵 - 惊讶 */}
        <g>
          <path d="M24 15C21.5 15 20 17 20 19.5V23C20 23 20.5 22 21.5 23C22.5 24 23 23 23.5 23C24 23 24.5 24 25 23C25.5 24 26 23 26.5 23C27 23 27.5 24 28 23V19.5C28 17 26.5 15 24 15Z" fill="white"/>
          <circle cx="22.5" cy="19" r="1.2" fill="#8B5CF6"/>
          <circle cx="25.5" cy="19" r="1.2" fill="#8B5CF6"/>
          <ellipse cx="24" cy="22" rx="1" ry="1.2" fill="#8B5CF6"/>
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
