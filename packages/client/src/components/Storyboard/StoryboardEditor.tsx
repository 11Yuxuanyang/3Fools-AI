import React, { useState, useRef, useEffect } from 'react';
import { Scene, CanvasItem } from '../../types';
import {
  X, Plus, Image, Trash2, FileText, ZoomIn, ZoomOut,
  Hand, MousePointer2, Upload
} from 'lucide-react';

interface StoryboardEditorProps {
  scenes: Scene[];
  totalDuration: number;
  onClose: () => void;
  onSceneClick: (scene: Scene) => void;
  onSceneUpdate: (scene: Scene) => void;
  onSceneDelete: (sceneId: string) => void;
  onAddScene: () => void;
  onOpenImagePicker: (sceneId: string) => void;
  onImportScript: () => void;
  canvasItems: CanvasItem[];
}

export function StoryboardEditor({
  scenes,
  totalDuration,
  onClose,
  onSceneClick,
  onSceneUpdate,
  onSceneDelete,
  onAddScene,
  onOpenImagePicker,
  onImportScript,
  canvasItems,
}: StoryboardEditorProps) {
  // 视口状态
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'select' | 'pan'>('select');

  // 拖拽场景状态
  const [draggingSceneId, setDraggingSceneId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // 时间轴配置
  const PIXELS_PER_SECOND = 80; // 每秒对应的像素数
  const TIMELINE_Y = 0; // 时间轴在画布坐标系中的Y位置
  const CARD_WIDTH = 120;
  const CARD_HEIGHT = 100;

  // 获取场景图片
  const getSceneImage = (scene: Scene): string | undefined => {
    if (scene.imageSource === 'generated' && scene.generatedImageSrc) {
      return scene.generatedImageSrc;
    }
    if (scene.imageSource === 'canvas' && scene.canvasItemId) {
      const item = canvasItems.find(i => i.id === scene.canvasItemId);
      return item?.src;
    }
    return undefined;
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 生成时间刻度
  const generateTicks = () => {
    const ticks: { time: number; major: boolean }[] = [];
    const maxTime = Math.max(totalDuration + 30, 60);

    const majorInterval = scale < 0.5 ? 10 : scale > 1.5 ? 2 : 5;
    const minorInterval = scale < 0.5 ? 5 : 1;

    for (let t = 0; t <= maxTime; t += minorInterval) {
      ticks.push({ time: t, major: t % majorInterval === 0 });
    }
    return ticks;
  };

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('.timeline-area')) {
      if (tool === 'pan' || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }

    if (draggingSceneId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // 计算画布坐标
      const canvasX = (e.clientX - rect.left - rect.width / 2 - pan.x) / scale - dragOffset.x;
      const canvasY = (e.clientY - rect.top - rect.height / 2 - pan.y) / scale - dragOffset.y;

      // 更新场景位置（这里我们用 startTime 来表示 X 位置）
      const scene = scenes.find(s => s.id === draggingSceneId);
      if (scene) {
        const newStartTime = Math.max(0, canvasX / PIXELS_PER_SECOND);
        // 决定卡片在上方还是下方
        const isAbove = canvasY < TIMELINE_Y;

        onSceneUpdate({
          ...scene,
          startTime: newStartTime,
          // 用一个自定义字段记录位置（上/下）
          visualPrompt: isAbove ? 'above' : 'below', // 临时用这个字段
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingSceneId(null);
  };

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.min(Math.max(0.2, prev + delta), 3));
    } else {
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // 开始拖拽场景
  const handleSceneMouseDown = (e: React.MouseEvent, scene: Scene) => {
    if (tool === 'select') {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDraggingSceneId(scene.id);
      setDragOffset({
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2,
      });
    }
  };

  const ticks = generateTicks();
  const timelineWidth = Math.max((totalDuration + 30) * PIXELS_PER_SECOND, 1000);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* 弹窗面板 */}
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '85vw', height: '75vh', maxWidth: 1200, maxHeight: 700 }}
      >
        {/* 顶部工具栏 */}
        <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50 rounded-t-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">分镜编辑器</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* 工具切换 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTool('select')}
              className={`p-2 rounded-md transition-colors ${
                tool === 'select' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setTool('pan')}
              className={`p-2 rounded-md transition-colors ${
                tool === 'pan' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              <Hand size={18} />
            </button>
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setScale(prev => Math.max(0.2, prev - 0.2))}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-sm text-gray-600 w-14 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(prev => Math.min(3, prev + 0.2))}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>

        {/* 剧本导入按钮 */}
        <button
          onClick={onImportScript}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
        >
          <Upload size={18} />
          剧本导入
        </button>
      </div>

      {/* 画布区域 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative bg-gray-50"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: tool === 'pan' ? 'grab' : 'default' }}
      >
        {/* 背景网格 */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${40 * scale}px ${40 * scale}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* 画布内容 - 以中心为原点 */}
        <div
          className="absolute top-1/2 left-1/2 timeline-area"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* 时间轴主线 */}
          <div
            className="absolute h-0.5 bg-gray-400"
            style={{
              left: 0,
              top: TIMELINE_Y,
              width: timelineWidth,
            }}
          />

          {/* 时间刻度 */}
          {ticks.map(({ time, major }, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: time * PIXELS_PER_SECOND,
                top: TIMELINE_Y,
              }}
            >
              <div
                className={`w-px bg-gray-400 ${major ? 'h-4' : 'h-2'}`}
                style={{ transform: 'translateY(-50%)' }}
              />
              {major && (
                <span
                  className="absolute text-xs text-gray-500 whitespace-nowrap select-none"
                  style={{
                    left: '50%',
                    top: 12,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {formatTime(time)}
                </span>
              )}
            </div>
          ))}

          {/* 场景卡片 */}
          {scenes.map((scene, index) => {
            const imageSrc = getSceneImage(scene);
            const isAbove = scene.visualPrompt === 'above' || index % 2 === 0;
            const cardX = scene.startTime * PIXELS_PER_SECOND;
            const cardY = isAbove
              ? TIMELINE_Y - CARD_HEIGHT - 30
              : TIMELINE_Y + 30;

            return (
              <div
                key={scene.id}
                className={`absolute bg-white rounded-xl border-2 shadow-lg overflow-hidden cursor-pointer transition-shadow hover:shadow-xl group ${
                  draggingSceneId === scene.id ? 'border-violet-500 shadow-xl' : 'border-gray-200'
                }`}
                style={{
                  left: cardX - CARD_WIDTH / 2,
                  top: cardY,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                }}
                onMouseDown={(e) => handleSceneMouseDown(e, scene)}
                onDoubleClick={() => onSceneClick(scene)}
              >
                {/* 连接线到时间轴 */}
                <div
                  className="absolute w-0.5 bg-gray-300 left-1/2 -translate-x-1/2"
                  style={{
                    top: isAbove ? CARD_HEIGHT : -30,
                    height: 30,
                  }}
                />
                {/* 时间轴上的圆点 */}
                <div
                  className="absolute w-3 h-3 rounded-full bg-violet-500 border-2 border-white shadow left-1/2 -translate-x-1/2"
                  style={{
                    top: isAbove ? CARD_HEIGHT + 26 : -33,
                  }}
                />

                {/* 图片区域 */}
                <div className="h-[60%] bg-gray-100 relative">
                  {imageSrc ? (
                    <img src={imageSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={24} className="text-gray-300" />
                    </div>
                  )}

                  {/* 悬停操作 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenImagePicker(scene.id); }}
                      className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-violet-600"
                    >
                      <Image size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSceneDelete(scene.id); }}
                      className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 信息区域 */}
                <div className="p-2 h-[40%]">
                  <div className="text-xs font-medium text-gray-800 truncate">
                    {scene.title}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {scene.duration}s
                  </div>
                </div>
              </div>
            );
          })}

          {/* 添加场景按钮 */}
          <button
            onClick={onAddScene}
            className="absolute bg-white border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center hover:border-violet-400 hover:bg-violet-50 transition-colors"
            style={{
              left: totalDuration * PIXELS_PER_SECOND + 40,
              top: TIMELINE_Y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
            }}
          >
            <Plus size={24} className="text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">添加镜头</span>
          </button>
        </div>

        {/* 信息提示 */}
        <div className="absolute bottom-4 left-4 text-sm text-gray-500">
          {scenes.length} 个镜头 · 总时长 {formatTime(totalDuration)}
        </div>
      </div>
      </div>
    </div>
  );
}
