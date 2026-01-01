/**
 * CanvasHeader - 画布顶部栏
 */

import { useRef, useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Logo } from '../Logo';
import { CreditDisplay } from '../credits';
import { SharePanel } from '../Collaboration';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
}

type EditorMode = 'creative' | 'clip';

interface CanvasHeaderProps {
  projectId: string;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onBack: () => void;
  collaborators: Collaborator[];
  isConnected: boolean;
  myColor: string;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
}

export function CanvasHeader({
  projectId,
  projectName,
  onProjectNameChange,
  onBack,
  collaborators,
  isConnected,
  myColor,
  editorMode,
  onEditorModeChange,
}: CanvasHeaderProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(projectName);
  const [showCommunityQR, setShowCommunityQR] = useState(false);

  useEffect(() => {
    setLocalName(projectName);
  }, [projectName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    const finalName = localName.trim() || '未命名画布';
    setLocalName(finalName);
    onProjectNameChange(finalName);
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 px-4 flex items-center z-40 pointer-events-none">
      {/* 左侧：Logo + 项目名 */}
      <div className="flex items-center gap-3 pointer-events-auto flex-1">
        {/* Logo - 点击返回首页 */}
        <button
          onClick={onBack}
          className="hover:opacity-80 transition-opacity"
          title="返回首页"
        >
          <Logo size={28} showText={false} />
        </button>

        {/* 分隔线 */}
        <div className="w-px h-6 bg-gray-200" />

        {/* 项目名称 */}
        <div className="flex flex-col">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="text-sm font-semibold text-gray-900 bg-white border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <h1
              onClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-primary transition-colors"
            >
              {localName}
            </h1>
          )}
          <span className="text-[10px] text-gray-500">已自动保存</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        {/* 傻币 */}
        <CreditDisplay />

        {/* 社群按钮 */}
        <div className="relative">
          <button
            onClick={() => setShowCommunityQR(!showCommunityQR)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-sm transition-colors"
            style={{ backgroundColor: '#A855F7' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#9333EA')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#A855F7')}
          >
            <Users size={18} className="text-white" />
            <span className="text-sm font-semibold text-white">社群</span>
          </button>

          {/* 社群下拉面板 */}
          {showCommunityQR && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="text-center mb-3">
                <h3 className="text-base font-semibold text-gray-900">加入三傻社群</h3>
                <p className="text-xs text-gray-500 mt-1">
                  分享更多AI的有趣玩法，一起探索创意可能
                </p>
              </div>
              <div className="w-40 h-40 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-gray-400 text-sm">群二维码</span>
              </div>
              <p className="text-center text-xs text-gray-400">微信扫码加入</p>
            </div>
          )}
        </div>

        {/* 分享与协作 */}
        <SharePanel
          collaborators={collaborators}
          isConnected={isConnected}
          myColor={myColor}
          projectId={projectId}
          projectName={localName}
        />
      </div>
    </div>
  );
}
