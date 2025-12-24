import React, { useRef, useState, useEffect } from 'react';
import { Scene, CanvasItem } from '../../types';
import {
  Plus, Image, Trash2, Clock, ChevronUp, ChevronDown,
  ZoomIn, ZoomOut, Play, SkipBack, SkipForward
} from 'lucide-react';

interface CanvasTimelineProps {
  scenes: Scene[];
  totalDuration: number;
  onSceneClick: (scene: Scene) => void;
  onSceneUpdate: (scene: Scene) => void;
  onSceneDelete: (sceneId: string) => void;
  onAddScene: () => void;
  onOpenImagePicker: (sceneId: string) => void;
  onLocateScene: (scene: Scene) => void; // 定位到场景对应的画布图片
  canvasItems: CanvasItem[];
}

export function CanvasTimeline({
  scenes,
  totalDuration,
  onSceneClick,
  onSceneDelete,
  onAddScene,
  onOpenImagePicker,
  onLocateScene,
  canvasItems,
}: CanvasTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [zoom, setZoom] = useState(80); // px per second
  const [scrollLeft, setScrollLeft] = useState(0);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 时间轴配置
  const CARD_HEIGHT = 80;
  const CARD_GAP = 4;
  const MIN_CARD_WIDTH = 60;
  const RULER_HEIGHT = 28;
  const COLLAPSED_HEIGHT = 48;
  const EXPANDED_HEIGHT = 180;

  // 时间轴总宽度
  const timelineWidth = Math.max((totalDuration + 10) * zoom, 600);

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 假设30fps
    return `${mins}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const formatTimeShort = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 生成刻度
  const generateTicks = () => {
    const ticks: { time: number; major: boolean }[] = [];
    const maxTime = Math.max(totalDuration + 10, 30);

    let majorInterval = 5;
    let minorInterval = 1;

    if (zoom < 40) {
      majorInterval = 10;
      minorInterval = 5;
    } else if (zoom > 100) {
      majorInterval = 2;
      minorInterval = 0.5;
    }

    for (let t = 0; t <= maxTime; t += minorInterval) {
      const isMajor = Math.abs(t % majorInterval) < 0.01;
      ticks.push({ time: t, major: isMajor });
    }
    return ticks;
  };

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

  // 处理滚动
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  // 处理缩放
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(20, prev + delta), 200));
  };

  // 点击时间轴设置播放头
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const time = x / zoom;
    setPlayheadTime(Math.max(0, Math.min(time, totalDuration)));
  };

  // 选中场景
  const handleSceneSelect = (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSceneId(scene.id);
    setPlayheadTime(scene.startTime);
  };

  const ticks = generateTicks();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-gray-900 border-t border-gray-700 shadow-2xl transition-all duration-300"
      style={{ height: isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT }}
    >
      {/* 顶部控制栏 */}
      <div className="h-12 flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700">
        {/* 左侧：展开/收起 + 信息 */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">
              <span className="text-white font-medium">{scenes.length}</span> 镜头
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              总时长 <span className="text-white font-medium">{formatTimeShort(totalDuration)}</span>
            </span>
          </div>
        </div>

        {/* 中间：播放控制 + 时间码 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <SkipBack size={16} />
            </button>
            <button className="p-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white transition-colors">
              <Play size={16} fill="currentColor" />
            </button>
            <button className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <SkipForward size={16} />
            </button>
          </div>

          <div className="px-3 py-1 bg-gray-900 rounded font-mono text-sm text-green-400">
            {formatTime(playheadTime)}
          </div>
        </div>

        {/* 右侧：缩放控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(-20)}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <div className="w-20 h-1 bg-gray-700 rounded-full relative">
            <div
              className="absolute top-0 left-0 h-full bg-violet-500 rounded-full"
              style={{ width: `${((zoom - 20) / 180) * 100}%` }}
            />
          </div>
          <button
            onClick={() => handleZoom(20)}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* 时间轴内容区（可展开） */}
      {isExpanded && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 时间刻度尺 */}
          <div
            ref={scrollContainerRef}
            className="relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
            onScroll={handleScroll}
            onClick={handleTimelineClick}
            style={{ height: RULER_HEIGHT }}
          >
            <div
              className="relative bg-gray-850"
              style={{ width: timelineWidth, height: RULER_HEIGHT }}
            >
              {/* 刻度线 */}
              {ticks.map(({ time, major }, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: time * zoom }}
                >
                  <div className={`w-px ${major ? 'h-4 bg-gray-500' : 'h-2 bg-gray-700'}`} />
                  {major && (
                    <span className="text-[10px] text-gray-500 mt-0.5 select-none">
                      {formatTimeShort(time)}
                    </span>
                  )}
                </div>
              ))}

              {/* 播放头指示器（在刻度尺上） */}
              <div
                className="absolute top-0 w-0.5 h-full bg-red-500 z-10"
                style={{ left: playheadTime * zoom }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45 transform origin-center" />
              </div>
            </div>
          </div>

          {/* 场景轨道 */}
          <div
            className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
            onScroll={(e) => {
              // 同步滚动
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
              setScrollLeft(e.currentTarget.scrollLeft);
            }}
          >
            <div
              ref={trackRef}
              className="relative h-full"
              style={{ width: timelineWidth, minHeight: CARD_HEIGHT + 20 }}
            >
              {/* 轨道背景网格 */}
              <div className="absolute inset-0 opacity-20">
                {ticks.filter(t => t.major).map(({ time }, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-gray-700"
                    style={{ left: time * zoom }}
                  />
                ))}
              </div>

              {/* 播放头（在轨道上） */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-20 pointer-events-none"
                style={{ left: playheadTime * zoom }}
              />

              {/* 场景卡片 */}
              <div className="absolute top-2 bottom-2 left-0 right-0">
                {scenes.map((scene) => {
                  const imageSrc = getSceneImage(scene);
                  const cardWidth = Math.max(scene.duration * zoom - CARD_GAP, MIN_CARD_WIDTH);
                  const isSelected = selectedSceneId === scene.id;

                  return (
                    <div
                      key={scene.id}
                      className={`absolute top-0 bottom-0 rounded-lg overflow-hidden cursor-pointer transition-all
                        ${isSelected
                          ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-gray-900'
                          : 'hover:ring-1 hover:ring-gray-500'
                        }`}
                      style={{
                        left: scene.startTime * zoom,
                        width: cardWidth,
                      }}
                      onClick={(e) => handleSceneSelect(scene, e)}
                      onDoubleClick={() => onSceneClick(scene)}
                    >
                      {/* 场景背景/图片 */}
                      <div className="absolute inset-0 bg-gray-800">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt=""
                            className="w-full h-full object-cover opacity-80"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                            <Image size={24} className="text-gray-600" />
                          </div>
                        )}
                      </div>

                      {/* 渐变遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                      {/* 顶部色条 - 状态指示 */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${
                        scene.status === 'ready' ? 'bg-green-500' :
                        scene.status === 'generating' ? 'bg-yellow-500' :
                        scene.status === 'error' ? 'bg-red-500' :
                        'bg-gray-600'
                      }`} />

                      {/* 底部信息 */}
                      <div className="absolute bottom-0 left-0 right-0 p-1.5">
                        <div className="text-[10px] font-medium text-white truncate">
                          {scene.title}
                        </div>
                        <div className="text-[9px] text-gray-400 flex items-center gap-1">
                          <Clock size={8} />
                          {scene.duration}s
                        </div>
                      </div>

                      {/* 悬停操作 */}
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenImagePicker(scene.id); }}
                          className="p-1 bg-black/60 rounded text-gray-300 hover:text-white hover:bg-black/80"
                          title="选择图片"
                        >
                          <Image size={10} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onLocateScene(scene); }}
                          className="p-1 bg-black/60 rounded text-gray-300 hover:text-violet-400 hover:bg-black/80"
                          title="定位到画布"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onSceneDelete(scene.id); }}
                          className="p-1 bg-black/60 rounded text-gray-300 hover:text-red-400 hover:bg-black/80"
                          title="删除"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 添加新场景按钮 */}
                <button
                  onClick={onAddScene}
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 hover:border-violet-500 hover:bg-violet-500/10 transition-colors group"
                  style={{
                    left: totalDuration * zoom + CARD_GAP,
                    width: 60,
                  }}
                >
                  <Plus size={20} className="text-gray-600 group-hover:text-violet-400" />
                  <span className="text-[9px] text-gray-600 group-hover:text-violet-400 mt-1">添加</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
