/**
 * GenerationBar - AI 生成输入栏
 */

import { useRef, useCallback } from 'react';
import { Plus, ImagePlus, Camera, Settings2, ArrowRight, X } from 'lucide-react';
import { CanvasItem } from '../../types';

interface GenerationBarProps {
  // 输入状态
  prompt: string;
  onPromptChange: (prompt: string) => void;

  // 设置
  aspectRatio: string;
  resolution: string;
  showSettings: boolean;
  onAspectRatioChange: (ratio: string) => void;
  onResolutionChange: (resolution: string) => void;
  onToggleSettings: () => void;

  // 选中的图片
  selectedItems: CanvasItem[];
  onRemoveSelectedItem: (id: string) => void;

  // 菜单
  showAddMenu: boolean;
  onToggleAddMenu: () => void;

  // 操作
  onGenerate: () => void;
  onFileSelect: (file: File) => void;
  onOpenCamera: () => void;

  // 费用计算
  getGenerateCreditCost: (resolution: string) => number;

  // 隐藏状态（带动画）
  hidden?: boolean;
}

// 傻币图标 SVG
function ShabiCoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="11" fill="#FCD34D" />
      <circle cx="12" cy="12" r="9" fill="#FBBF24" />
      <circle cx="12" cy="12" r="7.5" fill="#F59E0B" />
      <g transform="translate(6, 5) scale(0.5)">
        <path
          d="M12 0C9 0 7 2 7 4.5V8C7 8 7.4 7.4 8 8C8.6 8.6 9 8 9.5 8C10 8 10.3 8.6 12 8C13.7 8.6 14 8 14.5 8C15 8 15.4 8.6 16 8C16.6 7.4 17 8 17 8V4.5C17 2 15 0 12 0Z"
          fill="white"
          opacity="0.95"
        />
        <path
          d="M6.5 7C3.5 7 1.5 9 1.5 11.5V15C1.5 15 1.9 14.4 2.5 15C3.1 15.6 3.5 15 4 15C4.5 15 4.8 15.6 6.5 15C8.2 15.6 8.5 15 9 15C9.5 15 9.9 15.6 10.5 15C11.1 14.4 11.5 15 11.5 15V11.5C11.5 9 9.5 7 6.5 7Z"
          fill="white"
          opacity="0.9"
        />
        <path
          d="M17.5 7C14.5 7 12.5 9 12.5 11.5V15C12.5 15 12.9 14.4 13.5 15C14.1 15.6 14.5 15 15 15C15.5 15 15.8 15.6 17.5 15C19.2 15.6 19.5 15 20 15C20.5 15 20.9 15.6 21.5 15C22.1 14.4 22.5 15 22.5 15V11.5C22.5 9 20.5 7 17.5 7Z"
          fill="white"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

// 设置面板组件
function SettingsPopover({
  aspectRatio,
  resolution,
  onAspectRatioChange,
  onResolutionChange,
}: {
  aspectRatio: string;
  resolution: string;
  onAspectRatioChange: (ratio: string) => void;
  onResolutionChange: (resolution: string) => void;
}) {
  const aspectRatios = [
    { value: '1:1', icon: 'aspect-square' },
    { value: '4:3', icon: 'aspect-4-3' },
    { value: '3:4', icon: 'aspect-3-4' },
    { value: '16:9', icon: 'aspect-wide' },
    { value: '9:16', icon: 'aspect-tall' },
    { value: '3:2', icon: 'aspect-3-2' },
    { value: '2:3', icon: 'aspect-2-3' },
    { value: '21:9', icon: 'aspect-ultra' },
  ];

  const resolutions = [
    { value: '720', label: '720p', sub: '极速' },
    { value: '1K', label: '1K', sub: '快速' },
    { value: '1080', label: '1080p', sub: '标准' },
    { value: '2K', label: '2K', sub: '高清' },
    { value: '4K', label: '4K', sub: '超清' },
  ];

  return (
    <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-100 w-full mb-2 animate-in fade-in slide-in-from-bottom-2">
      <div className="space-y-4">
        {/* 宽高比 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded border-2 border-gray-400" />
            <span className="text-xs font-semibold text-gray-700">宽高比</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {aspectRatios.map((r) => {
              const [w, h] = r.value.split(':').map(Number);
              const ratio = w / h;
              const boxW = ratio >= 1 ? 20 : 20 * ratio;
              const boxH = ratio >= 1 ? 20 / ratio : 20;
              return (
                <button
                  key={r.value}
                  onClick={() => onAspectRatioChange(r.value)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
                    aspectRatio === r.value
                      ? 'bg-primary/10 ring-2 ring-primary/30'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`rounded-sm ${aspectRatio === r.value ? 'bg-primary' : 'bg-gray-400'}`}
                    style={{ width: boxW, height: boxH }}
                  />
                  <span
                    className={`text-[10px] font-medium ${
                      aspectRatio === r.value ? 'text-primary' : 'text-gray-500'
                    }`}
                  >
                    {r.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-gray-100" />

        {/* 分辨率 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full border-2 border-gray-400 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            </div>
            <span className="text-xs font-semibold text-gray-700">分辨率</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {resolutions.map((r) => (
              <button
                key={r.value}
                onClick={() => onResolutionChange(r.value)}
                className={`flex flex-col items-center p-1.5 rounded-lg transition-all ${
                  resolution === r.value
                    ? 'bg-primary/10 ring-2 ring-primary/30'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span
                  className={`text-[10px] font-semibold ${
                    resolution === r.value ? 'text-primary' : 'text-gray-700'
                  }`}
                >
                  {r.label}
                </span>
                <span
                  className={`text-[8px] ${
                    resolution === r.value ? 'text-primary/70' : 'text-gray-400'
                  }`}
                >
                  {r.sub}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GenerationBar({
  prompt,
  onPromptChange,
  aspectRatio,
  resolution,
  showSettings,
  onAspectRatioChange,
  onResolutionChange,
  onToggleSettings,
  selectedItems,
  onRemoveSelectedItem,
  showAddMenu,
  onToggleAddMenu,
  onGenerate,
  onFileSelect,
  onOpenCamera,
  getGenerateCreditCost,
  hidden = false,
}: GenerationBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click();
    onToggleAddMenu();
  }, [onToggleAddMenu]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      e.target.value = '';
    },
    [onFileSelect]
  );

  const handleCameraClick = useCallback(() => {
    onOpenCamera();
    onToggleAddMenu();
  }, [onOpenCamera, onToggleAddMenu]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onGenerate();
      }
    },
    [onGenerate]
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onPromptChange(e.target.value);
      // 自动调整高度
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    },
    [onPromptChange]
  );

  const selectedImages = selectedItems.filter((item) => item.type === 'image');

  return (
    <div className={`fixed bottom-8 left-0 right-0 px-8 flex items-center justify-center z-50 pointer-events-none transition-all duration-300 ${hidden ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
      <div className={`flex flex-col items-center gap-1.5 max-w-md w-full ${hidden ? 'pointer-events-none' : 'pointer-events-auto'}`}>
        {/* Settings Popover */}
        {showSettings && (
          <SettingsPopover
            aspectRatio={aspectRatio}
            resolution={resolution}
            onAspectRatioChange={onAspectRatioChange}
            onResolutionChange={onResolutionChange}
          />
        )}

        <div className="flex items-center gap-2 w-full">
          {/* 加号按钮和弹出菜单 */}
          <div className="relative">
            <button
              onClick={onToggleAddMenu}
              className={`p-2.5 rounded-full transition-all bg-white shadow-float border border-gray-200 ${
                showAddMenu
                  ? 'bg-violet-50 text-violet-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Plus
                size={18}
                className={`transition-transform ${showAddMenu ? 'rotate-45' : ''}`}
              />
            </button>
            {/* 弹出菜单 */}
            {showAddMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex gap-2 bg-white rounded-full shadow-lg p-1.5">
                <button
                  onClick={handleFileUpload}
                  className="p-2.5 rounded-full hover:bg-violet-50 text-gray-600 hover:text-violet-600 transition-colors"
                  title="上传图片"
                >
                  <ImagePlus size={18} />
                </button>
                <button
                  onClick={handleCameraClick}
                  className="p-2.5 rounded-full hover:bg-violet-50 text-gray-600 hover:text-violet-600 transition-colors"
                  title="打开摄像头"
                >
                  <Camera size={18} />
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept="image/*"
            />
          </div>

          {/* 输入框 */}
          <div className="flex-1 bg-white px-3 py-2 rounded-3xl shadow-float border border-gray-200 transition-all duration-300 ease-out hover:shadow-lg ring-1 ring-transparent focus-within:ring-violet-200">
            {/* 选中图片预览 */}
            {selectedImages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-2 px-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {selectedImages.map((img, index) => (
                  <div
                    key={img.id}
                    className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm border-2 border-violet-300 animate-in zoom-in-75 fade-in duration-200 cursor-pointer group hover:border-violet-400 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => onRemoveSelectedItem(img.id)}
                    title="点击移除"
                  >
                    <img src={img.src} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-0.5 left-0.5 bg-violet-500 text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center shadow">
                      {index + 1}
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ))}
                <span className="text-xs text-gray-500 ml-1">
                  已选 {selectedImages.length}/5 张参考图
                </span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent border-none focus:outline-none text-gray-800 placeholder-gray-400 text-sm px-2 resize-none overflow-y-auto"
                placeholder={selectedImages.length > 0 ? '你想怎么修改？' : '你想创作什么？'}
                value={prompt}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{ minHeight: '24px', maxHeight: '120px' }}
              />

              {/* Settings Toggle */}
              <button
                onClick={onToggleSettings}
                className={`p-1.5 rounded-full transition-colors ${
                  showSettings
                    ? 'bg-violet-100 text-violet-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Settings2 size={16} />
              </button>

              {/* Generate Button */}
              <button
                onClick={onGenerate}
                disabled={!prompt.trim()}
                className={`flex items-center gap-1 rounded-full transition-all duration-300 ${
                  !prompt.trim()
                    ? 'p-2 bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'px-2.5 py-1.5 bg-violet-500 hover:bg-violet-600 text-white shadow-md'
                }`}
                title={
                  prompt.trim()
                    ? `生成消耗 ${getGenerateCreditCost(resolution)} 傻币`
                    : '请输入提示词'
                }
              >
                {prompt.trim() ? (
                  <>
                    <ShabiCoinIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {getGenerateCreditCost(resolution)}
                    </span>
                  </>
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
