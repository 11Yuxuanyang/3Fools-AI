import React, { useState, useCallback } from 'react';
import { useDraggablePanel } from '../../hooks/useDraggablePanel';
import { Scene, Storyboard, CanvasItem } from '../../types';
import { generateId } from '../../utils/id';
import { StoryboardHeader } from './StoryboardHeader';
import { ScriptInputArea } from './ScriptInputArea';
import { TimelineView } from './TimelineView';
import { SceneDetailModal } from './SceneDetailModal';
import { ImagePicker } from './ImagePicker';

interface StoryboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  storyboard: Storyboard | null;
  onStoryboardChange: (storyboard: Storyboard) => void;
  canvasItems: CanvasItem[];
  onAddToCanvas: (imageSrc: string, scene: Scene) => void;
  projectId: string;
}

export function StoryboardPanel({
  isOpen,
  onClose,
  storyboard,
  onStoryboardChange,
  canvasItems,
  onAddToCanvas,
  projectId,
}: StoryboardPanelProps) {
  const { position, size, isDragging, isResizing, handleDragStart, handleResizeStart } = useDraggablePanel({
    initialPosition: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 250 },
    initialSize: { width: 800, height: 500 },
  });

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showSceneDetail, setShowSceneDetail] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imagePickerSceneId, setImagePickerSceneId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // 创建新的 Storyboard
  const createNewStoryboard = useCallback((): Storyboard => ({
    id: generateId(),
    projectId,
    title: '未命名剧本',
    rawScript: '',
    scenes: [],
    totalDuration: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timelineZoom: 80,
    timelineScrollPosition: 0,
  }), [projectId]);

  // 确保有 storyboard
  const currentStoryboard = storyboard || createNewStoryboard();

  // 更新剧本标题
  const handleTitleChange = useCallback((title: string) => {
    onStoryboardChange({
      ...currentStoryboard,
      title,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  // 更新原始脚本
  const handleScriptChange = useCallback((rawScript: string) => {
    onStoryboardChange({
      ...currentStoryboard,
      rawScript,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  // AI 解析脚本（占位实现）
  const handleParseScript = useCallback(async () => {
    if (!currentStoryboard.rawScript.trim()) return;

    setIsParsing(true);
    try {
      // 占位：简单的段落分割逻辑
      await new Promise(resolve => setTimeout(resolve, 1000));

      const paragraphs = currentStoryboard.rawScript
        .split(/\n\n+/)
        .filter(p => p.trim())
        .slice(0, 20); // 最多20个场景

      let currentTime = 0;
      const scenes: Scene[] = paragraphs.map((p, i) => {
        const duration = 3 + Math.floor(Math.random() * 5); // 3-7秒
        const scene: Scene = {
          id: generateId(),
          order: i,
          title: `镜头 ${i + 1}`,
          description: p.trim().slice(0, 200),
          dialogue: '',
          visualPrompt: `电影画面：${p.trim().slice(0, 100)}`,
          duration,
          startTime: currentTime,
          imageSource: 'none',
          status: 'draft',
        };
        currentTime += duration;
        return scene;
      });

      onStoryboardChange({
        ...currentStoryboard,
        scenes,
        totalDuration: currentTime,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('解析失败:', error);
    } finally {
      setIsParsing(false);
    }
  }, [currentStoryboard, onStoryboardChange]);

  // 更新场景
  const handleSceneUpdate = useCallback((updatedScene: Scene) => {
    const scenes = currentStoryboard.scenes.map(s =>
      s.id === updatedScene.id ? updatedScene : s
    );
    // 重新计算时间
    let currentTime = 0;
    scenes.forEach(s => {
      s.startTime = currentTime;
      currentTime += s.duration;
    });
    onStoryboardChange({
      ...currentStoryboard,
      scenes,
      totalDuration: currentTime,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  // 删除场景
  const handleSceneDelete = useCallback((sceneId: string) => {
    const scenes = currentStoryboard.scenes
      .filter(s => s.id !== sceneId)
      .map((s, i) => ({ ...s, order: i }));
    // 重新计算时间
    let currentTime = 0;
    scenes.forEach(s => {
      s.startTime = currentTime;
      currentTime += s.duration;
    });
    onStoryboardChange({
      ...currentStoryboard,
      scenes,
      totalDuration: currentTime,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  // 重新排序场景
  const handleScenesReorder = useCallback((reorderedScenes: Scene[]) => {
    // 重新计算时间和顺序
    let currentTime = 0;
    const scenes = reorderedScenes.map((s, i) => {
      const scene = { ...s, order: i, startTime: currentTime };
      currentTime += s.duration;
      return scene;
    });
    onStoryboardChange({
      ...currentStoryboard,
      scenes,
      totalDuration: currentTime,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  // 添加新场景
  const handleAddScene = useCallback(() => {
    const newScene: Scene = {
      id: generateId(),
      order: currentStoryboard.scenes.length,
      title: `镜头 ${currentStoryboard.scenes.length + 1}`,
      description: '',
      dialogue: '',
      visualPrompt: '',
      duration: 5,
      startTime: currentStoryboard.totalDuration,
      imageSource: 'none',
      status: 'draft',
    };
    onStoryboardChange({
      ...currentStoryboard,
      scenes: [...currentStoryboard.scenes, newScene],
      totalDuration: currentStoryboard.totalDuration + 5,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  // 打开场景详情
  const handleSceneClick = useCallback((scene: Scene) => {
    setSelectedSceneId(scene.id);
    setShowSceneDetail(true);
  }, []);

  // 打开图片选择器
  const handleOpenImagePicker = useCallback((sceneId: string) => {
    setImagePickerSceneId(sceneId);
    setShowImagePicker(true);
  }, []);

  // 选择画布图片
  const handleSelectCanvasImage = useCallback((canvasItemId: string) => {
    if (!imagePickerSceneId) return;
    const scene = currentStoryboard.scenes.find(s => s.id === imagePickerSceneId);
    if (scene) {
      handleSceneUpdate({
        ...scene,
        imageSource: 'canvas',
        canvasItemId,
        status: 'ready',
      });
    }
    setShowImagePicker(false);
    setImagePickerSceneId(null);
  }, [imagePickerSceneId, currentStoryboard.scenes, handleSceneUpdate]);

  // 更新时间轴缩放
  const handleZoomChange = useCallback((zoom: number) => {
    onStoryboardChange({
      ...currentStoryboard,
      timelineZoom: zoom,
      updatedAt: Date.now(),
    });
  }, [currentStoryboard, onStoryboardChange]);

  if (!isOpen) return null;

  const selectedScene = currentStoryboard.scenes.find(s => s.id === selectedSceneId);

  return (
    <>
      <div
        className="fixed z-[60] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Header */}
        <StoryboardHeader
          title={currentStoryboard.title}
          onTitleChange={handleTitleChange}
          onClose={onClose}
          onDragStart={handleDragStart}
        />

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Script Input Area */}
          <ScriptInputArea
            script={currentStoryboard.rawScript}
            onScriptChange={handleScriptChange}
            onParse={handleParseScript}
            isParsing={isParsing}
            hasScenes={currentStoryboard.scenes.length > 0}
          />

          {/* Timeline View */}
          <TimelineView
            scenes={currentStoryboard.scenes}
            totalDuration={currentStoryboard.totalDuration}
            zoom={currentStoryboard.timelineZoom}
            onZoomChange={handleZoomChange}
            onSceneClick={handleSceneClick}
            onSceneUpdate={handleSceneUpdate}
            onSceneDelete={handleSceneDelete}
            onScenesReorder={handleScenesReorder}
            onAddScene={handleAddScene}
            onOpenImagePicker={handleOpenImagePicker}
            canvasItems={canvasItems}
          />
        </div>

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg
            className="w-full h-full text-gray-300"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14ZM10 10H8V8H10V10ZM6 14H4V12H6V14Z" />
          </svg>
        </div>
      </div>

      {/* Scene Detail Modal */}
      {showSceneDetail && selectedScene && (
        <SceneDetailModal
          scene={selectedScene}
          onClose={() => setShowSceneDetail(false)}
          onUpdate={handleSceneUpdate}
          onDelete={() => {
            handleSceneDelete(selectedScene.id);
            setShowSceneDetail(false);
          }}
        />
      )}

      {/* Image Picker Modal */}
      {showImagePicker && (
        <ImagePicker
          canvasItems={canvasItems}
          onSelect={handleSelectCanvasImage}
          onClose={() => {
            setShowImagePicker(false);
            setImagePickerSceneId(null);
          }}
        />
      )}
    </>
  );
}
