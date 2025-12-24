import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 32, showText = true, className = '' }: LogoProps) {
  // 保持宽高比
  const width = size * 1.1;
  const height = size;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 44 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 渐变 */}
          <linearGradient id="logoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <linearGradient id="logoGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="logoGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>

        {/* 左 - 橙色圆 */}
        <circle cx="12" cy="26" r="12" fill="url(#logoGrad1)" />
        {/* 左圆高光 */}
        <ellipse cx="8" cy="22" rx="4" ry="3" fill="white" fillOpacity="0.3" />

        {/* 右 - 青色圆 */}
        <circle cx="32" cy="26" r="12" fill="url(#logoGrad3)" />
        {/* 右圆高光 */}
        <ellipse cx="28" cy="22" rx="4" ry="3" fill="white" fillOpacity="0.3" />

        {/* 中 - 紫色圆（最上层） */}
        <circle cx="22" cy="14" r="13" fill="url(#logoGrad2)" />
        {/* 中圆高光 */}
        <ellipse cx="17" cy="9" rx="5" ry="3.5" fill="white" fillOpacity="0.25" />
      </svg>

      {showText && (
        <span className="font-semibold text-gray-900 whitespace-nowrap">
          三傻大闹AI圈
        </span>
      )}
    </div>
  );
}
