/**
 * 分享面板 - 简洁风格
 */

import React, { memo, useState } from 'react';
import { Share2, Copy, Check, Users } from 'lucide-react';
import { Collaborator } from '../../services/collaboration';

interface SharePanelProps {
  collaborators: Collaborator[];
  isConnected: boolean;
  myColor: string;
  projectId: string;
  projectName: string;
}

export const SharePanel: React.FC<SharePanelProps> = memo(({
  collaborators,
  isConnected: _isConnected,
  myColor,
  projectId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/#/project/${projectId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <div className="relative">
      {/* 分享按钮 - 紫色 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-sm transition-colors"
        style={{ backgroundColor: '#60A5FA' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#60A5FA'}
      >
        <Share2 size={16} className="text-white/90" />
        <span className="text-sm font-semibold text-white">分享</span>
      </button>

      {/* 下拉面板 - 极简设计 */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
            {/* 复制链接区域 */}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Share2 size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">复制链接邀请协作</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    copied
                      ? 'bg-green-50 text-green-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* 在线用户列表 */}
            {collaborators.length > 0 && (
              <div className="border-t border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{collaborators.length} 人在线</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {collaborators.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                      style={{ backgroundColor: `${user.color}15` }}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <span style={{ color: user.color }}>
                        {user.name}
                        {user.color === myColor && ' (你)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});

SharePanel.displayName = 'SharePanel';
