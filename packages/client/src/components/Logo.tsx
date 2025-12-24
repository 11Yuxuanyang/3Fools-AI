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
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 渐变定义 */}
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
          {/* 阴影 */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15"/>
          </filter>
        </defs>

        {/* 左边 - 橙色圆 */}
        <g filter="url(#shadow)">
          <circle cx="10" cy="24" r="9" fill="url(#grad1)" />
          {/* 高光 */}
          <ellipse cx="7" cy="21" rx="3" ry="2" fill="white" fillOpacity="0.3" />
          {/* 眼睛 */}
          <circle cx="7.5" cy="23" r="1.8" fill="white" />
          <circle cx="12.5" cy="23" r="1.8" fill="white" />
          <circle cx="8" cy="23.5" r="1" fill="#1F2937" />
          <circle cx="13" cy="23.5" r="1" fill="#1F2937" />
          {/* 微笑 */}
          <path d="M7 27.5C8.5 29 11.5 29 13 27.5" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>

        {/* 中间 - 紫色圆（稍大，靠上） */}
        <g filter="url(#shadow)">
          <circle cx="20" cy="16" r="11" fill="url(#grad2)" />
          {/* 高光 */}
          <ellipse cx="16" cy="12" rx="4" ry="2.5" fill="white" fillOpacity="0.25" />
          {/* 眼睛 */}
          <circle cx="16" cy="15" r="2.2" fill="white" />
          <circle cx="24" cy="15" r="2.2" fill="white" />
          <circle cx="16.5" cy="15.5" r="1.3" fill="#1F2937" />
          <circle cx="24.5" cy="15.5" r="1.3" fill="#1F2937" />
          {/* 张嘴笑 */}
          <ellipse cx="20" cy="21" rx="3.5" ry="2.5" fill="#1F2937" />
          <ellipse cx="20" cy="20" rx="2" ry="1" fill="#F9A8D4" />
        </g>

        {/* 右边 - 青色圆 */}
        <g filter="url(#shadow)">
          <circle cx="30" cy="24" r="9" fill="url(#grad3)" />
          {/* 高光 */}
          <ellipse cx="27" cy="21" rx="3" ry="2" fill="white" fillOpacity="0.3" />
          {/* 眯眯眼 */}
          <path d="M26 23C26.8 22 28.2 22 29 23" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M31 23C31.8 22 33.2 22 34 23" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* 微笑 */}
          <path d="M27 27.5C28.5 29 31.5 29 33 27.5" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>

        {/* AI 星星装饰 */}
        <path d="M20 3L21 6L24 7L21 8L20 11L19 8L16 7L19 6Z" fill="#FBBF24" />
      </svg>

      {showText && (
        <span className="font-semibold text-gray-900 whitespace-nowrap text-lg tracking-tight">
          三傻大闹AI圈
        </span>
      )}
    </div>
  );
}
