import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import {
  MousePointer2,
  Type,
  Plus,
  ImagePlus,
  Camera,
  ArrowRight,
  Settings2,
  ZoomIn,
  ZoomOut,
  X,
  Pencil,
  Square,
  Circle,
  Shapes,
  MoveRight,
  Minus,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { CanvasOnboarding } from './CanvasOnboarding';
import { FloatingToolbar } from './FloatingToolbar';
import { CollaboratorCursors, SharePanel } from './Collaboration';
import { CanvasItem, ToolMode, Project } from '../types';
import * as API from '../services/api';
import * as ProjectService from '../services/projectService';
import { ChatbotPanel } from './chatbot';
import { generateId } from '../utils/id';
import { Tooltip } from './ui';
import { Logo } from './Logo';
import { ShabiCoins } from './ShabiCoins';
import { Users, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import { useCollaboration, useCropping, useMaskEditing, useClipboard } from '../hooks';
import {
  DEFAULT_IMAGE_SIZE,
  MIN_SCALE,
  MAX_SCALE,
  MAX_DISPLAY_SIZE,
} from '../constants/canvas';

interface CanvasEditorProps {
  project: Project;
  onBack: () => void;
}

export function CanvasEditor({ project, onBack }: CanvasEditorProps) {
  // --- State ---
  const [items, setItems] = useState<CanvasItem[]>(project.items);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.SELECT);
  const [projectName, setProjectName] = useState(project.name);
  const [isEditingName, setIsEditingName] = useState(false);

  // Viewport state
  const [scale, setScale] = useState(project.viewport?.scale || 1);
  const [pan, setPan] = useState(project.viewport?.pan || { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Generation State
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2K");
  const [isProcessing, setIsProcessing] = useState(false);  // 全局生成状态（文生图）
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());  // 正在处理的图片 ID
  const [showSettings, setShowSettings] = useState(false);
  // Loading 占位区域位置（画布坐标系）
  const [loadingPosition, setLoadingPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // 生成期间的参考图片 ID（用于显示临时连接线）
  const [loadingSourceIds, setLoadingSourceIds] = useState<string[]>([]);

  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [itemStart, setItemStart] = useState({ x: 0, y: 0 });
  // 多选拖动时保存所有选中元素的初始位置
  const [itemsStartPositions, setItemsStartPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [itemStartSize, setItemStartSize] = useState({ width: 0, height: 0, x: 0, y: 0 });
  // 多选缩放时保存边界框和所有元素的初始状态
  const [multiResizeData, setMultiResizeData] = useState<{
    boundingBox: { x: number; y: number; width: number; height: number };
    items: Record<string, { x: number; y: number; width: number; height: number; relX: number; relY: number; relW: number; relH: number }>;
  } | null>(null);

  // 线条/箭头端点拖拽状态
  const [linePointDrag, setLinePointDrag] = useState<{
    itemId: string;
    pointType: 'start' | 'end' | 'control';
  } | null>(null);

  // 框选状态
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  // 各工具的颜色
  const colorPalette = ['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const [toolColors, setToolColors] = useState({
    brush: '#000000', line: '#000000', arrow: '#000000', rectangle: '#000000', circle: '#000000',
  });
  const getToolColor = (mode: ToolMode) => {
    if (mode === ToolMode.BRUSH) return toolColors.brush;
    if (mode === ToolMode.LINE) return toolColors.line;
    if (mode === ToolMode.ARROW) return toolColors.arrow;
    if (mode === ToolMode.RECTANGLE) return toolColors.rectangle;
    if (mode === ToolMode.CIRCLE) return toolColors.circle;
    return '#000000';
  };
  const setToolColor = (mode: ToolMode, color: string) => {
    if (mode === ToolMode.BRUSH) setToolColors(p => ({ ...p, brush: color }));
    else if (mode === ToolMode.LINE) setToolColors(p => ({ ...p, line: color }));
    else if (mode === ToolMode.ARROW) setToolColors(p => ({ ...p, arrow: color }));
    else if (mode === ToolMode.RECTANGLE) setToolColors(p => ({ ...p, rectangle: color }));
    else if (mode === ToolMode.CIRCLE) setToolColors(p => ({ ...p, circle: color }));
  };

  // 摄像头状态
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);

  // 添加菜单状态
  const [showAddMenu, setShowAddMenu] = useState(false);

  // 拖放状态
  const [isDragOver, setIsDragOver] = useState(false);

  // 文字编辑状态
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // 图片裁切（使用 hook）
  const {
    croppingImageId,
    cropBox,
    setCropBox,
    startCropping,
    applyCrop,
    cancelCrop: _cancelCrop,
  } = useCropping({ items, setItems });

  // 创作工具菜单状态
  const [showCreativeTools, setShowCreativeTools] = useState(false);

  // 社群弹窗状态
  const [showCommunityQR, setShowCommunityQR] = useState(false);

  // 图片索引面板状态
  const [showImageIndex, setShowImageIndex] = useState(false);

  // Chatbot 状态
  const [isChatOpen, setIsChatOpen] = useState(false);

  // AI 融合状态
  const [showFusionPanel, setShowFusionPanel] = useState(false);
  const [fusionPrompt, setFusionPrompt] = useState('');
  const [_isFusing, setIsFusing] = useState(false);
  const [fusionReferenceImage, setFusionReferenceImage] = useState<string | null>(null);

  // 图片擦除/重绘（使用 hook）
  const {
    maskEditingId,
    maskEditMode,
    maskBrushSize,
    setMaskBrushSize,
    repaintPrompt,
    setRepaintPrompt,
    maskCanvasRef,
    isMaskDrawing,
    setIsMaskDrawing,
    hasMaskContent,
    openMaskEdit: handleOpenMaskEdit,
    cancelMaskEdit: handleCancelMaskEdit,
    clearMask: handleClearMask,
    confirmMaskEdit: handleConfirmMaskEdit,
    drawMaskBrush,
    resetLastPoint,
  } = useMaskEditing({
    items,
    setItems,
    selectedIds,
    addProcessingId: (id: string) => setProcessingIds(prev => new Set(prev).add(id)),
    removeProcessingId: (id: string) => setProcessingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    }),
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingPositionRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // 鼠标位置（画布坐标）
  const textMeasureRef = useRef<HTMLDivElement>(null); // 用于测量文字尺寸

  // 测量文字尺寸（Excalidraw 风格：宽度由最长行决定，不自动换行）
  const measureTextSize = useCallback((text: string, fontSize: number, fontFamily: string, fontWeight: string) => {
    if (!textMeasureRef.current) return { width: 60, height: 44 };

    const measureEl = textMeasureRef.current;
    measureEl.style.fontSize = `${fontSize}px`;
    measureEl.style.fontFamily = fontFamily;
    measureEl.style.fontWeight = fontWeight;
    measureEl.style.lineHeight = '1.4';
    measureEl.style.padding = '8px';
    measureEl.style.whiteSpace = 'pre'; // 不自动换行，保留空格和换行符
    measureEl.style.display = 'inline-block';
    measureEl.style.boxSizing = 'content-box';

    // 处理文字：空文字用占位符
    measureEl.textContent = text || ' ';

    const rect = measureEl.getBoundingClientRect();
    // 增加足够的余量确保文字不被裁切
    return {
      width: Math.max(60, Math.ceil(rect.width) + 8),
      height: Math.max(44, Math.ceil(rect.height) + 8),
    };
  }, []);

  // 剪贴板功能（使用 hook）
  const { clipboard, copy, cut, paste, duplicate } = useClipboard({
    items,
    setItems,
    selectedIds,
    setSelectedIds,
    getMousePosition: () => mousePositionRef.current,
  });

  // 协作功能
  const {
    isConnected: isCollabConnected,
    collaborators,
    remoteCursors,
    remoteSelections: _remoteSelections,
    myColor,
    sendCursorMove,
    sendSelectionChange,
    collaboratorCount: _collaboratorCount,
  } = useCollaboration({
    projectId: project.id,
    enabled: true, // 默认启用协作
  });

  // 选择变化时同步给其他协作者
  useEffect(() => {
    if (isCollabConnected) {
      sendSelectionChange(selectedIds);
    }
  }, [selectedIds, isCollabConnected, sendSelectionChange]);

  // 计算连接线的起点和终点（就近原则：选择最近的边连接）
  // fixedEnd: 可选的固定终点，用于多源图片时保持终点一致
  const calcConnectionPoints = useCallback((
    sourceItem: CanvasItem,
    targetItem: CanvasItem,
    fixedEnd?: { x: number; y: number }
  ) => {
    const gap = 12;
    const sCx = sourceItem.x + sourceItem.width / 2;
    const sCy = sourceItem.y + sourceItem.height / 2;

    let startX: number, startY: number, endX: number, endY: number;
    let isVertical: boolean;

    if (fixedEnd) {
      // 使用固定终点
      endX = fixedEnd.x;
      endY = fixedEnd.y;
      const dx = endX - sCx;
      const dy = endY - sCy;
      isVertical = Math.abs(dy) > Math.abs(dx);
      if (!isVertical) {
        startX = dx > 0 ? sourceItem.x + sourceItem.width + gap : sourceItem.x - gap;
        startY = sCy;
      } else {
        startY = dy > 0 ? sourceItem.y + sourceItem.height + gap : sourceItem.y - gap;
        startX = sCx;
      }
    } else {
      const tCx = targetItem.x + targetItem.width / 2;
      const tCy = targetItem.y + targetItem.height / 2;
      const dx = tCx - sCx;
      const dy = tCy - sCy;
      isVertical = Math.abs(dy) > Math.abs(dx);

      if (!isVertical) {
        if (dx > 0) {
          startX = sourceItem.x + sourceItem.width + gap;
          endX = targetItem.x - gap;
        } else {
          startX = sourceItem.x - gap;
          endX = targetItem.x + targetItem.width + gap;
        }
        startY = sCy;
        endY = tCy;
      } else {
        if (dy > 0) {
          startY = sourceItem.y + sourceItem.height + gap;
          endY = targetItem.y - gap;
        } else {
          startY = sourceItem.y - gap;
          endY = targetItem.y + targetItem.height + gap;
        }
        startX = sCx;
        endX = tCx;
      }
    }
    return { startX, startY, endX, endY, isVertical };
  }, []);

  // 计算多源图片时的统一目标连接点
  const calcUnifiedEndPoint = useCallback((sourceItems: CanvasItem[], targetItem: CanvasItem) => {
    const gap = 12;
    // 计算所有源图片中心的平均位置
    const avgX = sourceItems.reduce((sum, s) => sum + s.x + s.width / 2, 0) / sourceItems.length;
    const avgY = sourceItems.reduce((sum, s) => sum + s.y + s.height / 2, 0) / sourceItems.length;
    const tCx = targetItem.x + targetItem.width / 2;
    const tCy = targetItem.y + targetItem.height / 2;
    const dx = tCx - avgX;
    const dy = tCy - avgY;
    const isVertical = Math.abs(dy) > Math.abs(dx);

    let endX: number, endY: number;
    if (!isVertical) {
      endX = dx > 0 ? targetItem.x - gap : targetItem.x + targetItem.width + gap;
      endY = tCy;
    } else {
      endY = dy > 0 ? targetItem.y - gap : targetItem.y + targetItem.height + gap;
      endX = tCx;
    }
    return { x: endX, y: endY };
  }, []);

  // 创建溯源连接线（贝塞尔曲线）
  const createConnectionCurve = useCallback((
    sourceItem: CanvasItem,
    targetItem: CanvasItem,
    fixedEnd?: { x: number; y: number }
  ): CanvasItem => {
    const { startX, startY, endX, endY } = calcConnectionPoints(sourceItem, targetItem, fixedEnd);

    return {
      id: generateId(),
      type: 'connection',
      src: '',
      x: Math.min(startX, endX) - 20,
      y: Math.min(startY, endY) - 20,
      width: Math.abs(endX - startX) + 40,
      height: Math.abs(endY - startY) + 40,
      zIndex: 0,
      stroke: '#a78bfa',
      strokeWidth: 3,
      startPoint: { x: startX, y: startY },
      endPoint: { x: endX, y: endY },
      sourceItemId: sourceItem.id,
      targetItemId: targetItem.id,
    };
  }, [calcConnectionPoints]);

  // 更新与指定元素关联的所有连接线（实时更新）
  const updateConnectionsRealtime = useCallback((currentItems: CanvasItem[], movedItemIds: string[]): CanvasItem[] => {
    const movedSet = new Set(movedItemIds);

    // 找出需要更新的连接线，并按目标分组
    const connectionsByTarget = new Map<string, CanvasItem[]>();
    currentItems.forEach(item => {
      if (item.type !== 'connection' || !item.targetItemId) return;
      if (!connectionsByTarget.has(item.targetItemId)) {
        connectionsByTarget.set(item.targetItemId, []);
      }
      connectionsByTarget.get(item.targetItemId)!.push(item);
    });

    // 预计算每个目标的统一终点（仅当有多个源时）
    const unifiedEndPoints = new Map<string, { x: number; y: number } | undefined>();
    connectionsByTarget.forEach((connections, targetId) => {
      const targetItem = currentItems.find(i => i.id === targetId);
      if (!targetItem) return;
      if (connections.length > 1) {
        const sourceItems = connections
          .map(c => currentItems.find(i => i.id === c.sourceItemId))
          .filter((s): s is CanvasItem => !!s);
        if (sourceItems.length > 1) {
          unifiedEndPoints.set(targetId, calcUnifiedEndPoint(sourceItems, targetItem));
        }
      }
    });

    return currentItems.map(item => {
      if (item.type !== 'connection') return item;
      if (!item.sourceItemId || !item.targetItemId) return item;
      if (!movedSet.has(item.sourceItemId) && !movedSet.has(item.targetItemId)) return item;

      const sourceItem = currentItems.find(i => i.id === item.sourceItemId);
      const targetItem = currentItems.find(i => i.id === item.targetItemId);
      if (!sourceItem || !targetItem) return item;

      const fixedEnd = unifiedEndPoints.get(item.targetItemId);
      const { startX, startY, endX, endY } = calcConnectionPoints(sourceItem, targetItem, fixedEnd);

      return {
        ...item,
        x: Math.min(startX, endX) - 20,
        y: Math.min(startY, endY) - 20,
        width: Math.abs(endX - startX) + 40,
        height: Math.abs(endY - startY) + 40,
        startPoint: { x: startX, y: startY },
        endPoint: { x: endX, y: endY },
      };
    });
  }, [calcConnectionPoints, calcUnifiedEndPoint]);

  // 更新与指定元素关联的所有连接线
  const updateConnections = useCallback((movedItemIds: string[]) => {
    setItems(prev => updateConnectionsRealtime(prev, movedItemIds));
  }, [updateConnectionsRealtime]);

  const handleTemplateSelect = (_template: 'cyberpunk' | 'mascot' | 'surreal') => {
    // TODO: 模板加载功能待实现
    console.log('模板选择功能开发中');
  };


  // Auto-save effect
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      const firstImage = items.find(i => i.type === 'image');
      const updatedProject: Project = {
        ...project,
        name: projectName,
        items,
        thumbnail: firstImage?.src,
        viewport: { scale, pan },
        updatedAt: Date.now(),
      };
      ProjectService.saveProject(updatedProject);
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [items, scale, pan, projectName]);

  // Check for pending prompt from homepage
  useEffect(() => {
    const pendingData = localStorage.getItem('pendingPrompt');
    if (pendingData) {
      try {
        const { projectId, prompt: pendingPromptText } = JSON.parse(pendingData);
        if (projectId === project.id && pendingPromptText) {
          localStorage.removeItem('pendingPrompt');
          // 设置 prompt 并触发生成
          setPrompt(pendingPromptText);
          // 延迟一帧后触发生成，确保状态已更新
          setTimeout(async () => {
            setIsProcessing(true);
            try {
              const newImageSrc = await API.generateImage({
                prompt: pendingPromptText,
                aspectRatio: '1:1',
              });

              const img = new window.Image();
              img.src = newImageSrc;
              img.onload = () => {
                const displaySize = DEFAULT_IMAGE_SIZE;
                const newItem: CanvasItem = {
                  id: generateId(),
                  type: 'image',
                  src: newImageSrc,
                  x: -pan.x / scale - displaySize / 2,
                  y: -pan.y / scale - displaySize / 2,
                  width: displaySize,
                  height: displaySize,
                  zIndex: items.length + 1,
                  prompt: pendingPromptText
                };
                setItems(prev => [...prev, newItem]);
                setSelectedIds([newItem.id]);
                setPrompt('');
              };
            } catch (error) {
              console.error('Auto-generate failed:', error);
              alert(error instanceof Error ? error.message : '生成失败，请检查后端服务是否正常运行。');
            } finally {
              setIsProcessing(false);
            }
          }, 100);
        }
      } catch (e) {
        localStorage.removeItem('pendingPrompt');
      }
    }
  }, [project.id]);

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // 阻止浏览器默认的双指缩放行为
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelPrevent = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // 使用 passive: false 来允许 preventDefault
    canvas.addEventListener('wheel', handleWheelPrevent, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheelPrevent);
    };
  }, []);

  // 键盘快捷键 - 删除、复制、粘贴
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在编辑文字或输入框，不处理
      if (editingTextId || isEditingName || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Delete 或 Backspace 删除选中项
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
      }

      // Ctrl/Cmd + C 复制
      if (isMod && e.key === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        copy();
      }

      // Ctrl/Cmd + X 剪切
      if (isMod && e.key === 'x' && selectedIds.length > 0) {
        e.preventDefault();
        cut();
      }

      // Ctrl/Cmd + V 粘贴到鼠标位置
      if (isMod && e.key === 'v' && clipboard.length > 0) {
        e.preventDefault();
        paste();
      }

      // Ctrl/Cmd + D 快速复制（原地偏移复制）
      if (isMod && e.key === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        duplicate();
      }

      // Ctrl/Cmd + A 全选（排除连接线）
      if (isMod && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(items.filter(i => i.type !== 'connection').map(i => i.id));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingTextId, isEditingName, items, clipboard, copy, cut, paste, duplicate]);

  // 摄像头视频源设置
  useEffect(() => {
    if (showCamera && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showCamera, stream]);

  // --- Actions ---

  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(MIN_SCALE, prev + delta), MAX_SCALE));
  };

  const _handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // 自动定位到指定图片
  const autoZoomToImage = (item: CanvasItem) => {
    // 计算图片中心点
    const centerX = item.x + (item.width || 200) / 2;
    const centerY = item.y + (item.height || 200) / 2;
    // 设置合适的缩放级别（确保图片可见）
    const targetScale = 1;
    // 计算 pan 使图片中心在屏幕中心
    const newPanX = -centerX * targetScale;
    const newPanY = -centerY * targetScale;
    setScale(targetScale);
    setPan({ x: newPanX, y: newPanY });
    // 选中该图片
    setSelectedIds([item.id]);
  };

  // 摄像头功能
  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode }
      });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('无法打开摄像头:', err);
      alert('无法访问摄像头，请检查权限设置');
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const _switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const src = canvas.toDataURL('image/png');

    const newItem: CanvasItem = {
      id: generateId(),
      type: 'image',
      src,
      x: -pan.x / scale - 200,
      y: -pan.y / scale - 150,
      width: 400,
      height: 300,
      zIndex: items.length + 1,
    };
    setItems(prev => [...prev, newItem]);
    setSelectedIds([newItem.id]);
    closeCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const displayWidth = img.width > MAX_DISPLAY_SIZE ? MAX_DISPLAY_SIZE : img.width;
        const displayHeight = img.height > MAX_DISPLAY_SIZE ? (img.height / img.width) * MAX_DISPLAY_SIZE : img.height;
        const newItem: CanvasItem = {
          id: generateId(),
          type: 'image',
          src,
          x: -pan.x / scale - displayWidth / 2,
          y: -pan.y / scale - displayHeight / 2,
          width: displayWidth,
          height: displayHeight,
          zIndex: items.length + 1,
        };
        setItems(prev => [...prev, newItem]);
        setSelectedIds([newItem.id]);
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // 保存当前提示词并立即清空输入框
    const currentPrompt = prompt.trim();
    setPrompt("");
    setIsProcessing(true);

    // 计算 loading 占位区域的位置和尺寸（在视口中心）
    const displaySize = DEFAULT_IMAGE_SIZE;
    const [w, h] = aspectRatio.split(':').map(Number);
    const ratio = w / h;
    const width = ratio >= 1 ? displaySize : displaySize * ratio;
    const height = ratio >= 1 ? displaySize / ratio : displaySize;
    // 视口中心对应的画布坐标 = -pan / scale
    const loadingX = -pan.x / scale - width / 2;
    const loadingY = -pan.y / scale - height / 2;
    const initialPosition = { x: loadingX, y: loadingY, width, height };
    setLoadingPosition(initialPosition);
    loadingPositionRef.current = initialPosition;

    try {
      // 获取所有选中的图片（支持多参考图）
      const selectedImages = selectedIds.length > 0
        ? items.filter(item => selectedIds.includes(item.id) && item.type === 'image')
        : [];

      // 设置参考图片 ID，用于显示临时连接线
      setLoadingSourceIds(selectedImages.map(img => img.id));

      let newImageSrc: string;

      if (selectedImages.length > 0) {
        // 图生图模式：支持单张或多张参考图
        const imageSources = selectedImages.map(img => img.src);

        newImageSrc = await API.editImage({
          // 单张图传字符串，多张图传数组
          image: imageSources.length === 1 ? imageSources[0] : imageSources,
          prompt: currentPrompt,
        });
      } else {
        // 文生图模式
        newImageSrc = await API.generateImage({
          prompt: currentPrompt,
          aspectRatio,
          size: resolution,
        });
      }

      // 统一处理：创建新图片添加到画布（使用 ref 获取最新的 loading 位置）
      const img = new window.Image();
      img.src = newImageSrc;
      img.onload = () => {
        // 使用 ref 获取最新的 loading 位置（用户可能拖动了）
        const currentPos = loadingPositionRef.current;
        const finalX = currentPos?.x ?? loadingX;
        const finalY = currentPos?.y ?? loadingY;

        // 使用图片的实际尺寸，缩小50%面积（宽高各乘0.707）
        const SCALE_FACTOR = 0.707; // √0.5 ≈ 0.707
        const actualWidth = Math.round(img.naturalWidth * SCALE_FACTOR);
        const actualHeight = Math.round(img.naturalHeight * SCALE_FACTOR);

        const newItem: CanvasItem = {
          id: generateId(),
          type: 'image',
          src: newImageSrc,
          x: finalX,
          y: finalY,
          width: actualWidth,
          height: actualHeight,
          zIndex: items.length + 1,
          prompt: currentPrompt
        };

        // 如果有参考图片，创建溯源连接线
        const connectionLines: CanvasItem[] = [];
        if (selectedImages.length > 0) {
          // 多图时计算统一终点
          const fixedEnd = selectedImages.length > 1
            ? calcUnifiedEndPoint(selectedImages, newItem)
            : undefined;
          selectedImages.forEach(sourceImage => {
            const connection = createConnectionCurve(sourceImage, newItem, fixedEnd);
            connectionLines.push(connection);
          });
        }

        setItems(prev => [...prev, ...connectionLines, newItem]);
        setSelectedIds([newItem.id]);
        setLoadingPosition(null);
        loadingPositionRef.current = null;
        setLoadingSourceIds([]);
      };

    } catch (error) {
      console.error(error);
      alert("处理失败，请检查后端服务是否正常运行。");
      setLoadingPosition(null);
      loadingPositionRef.current = null;
      setLoadingSourceIds([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContextAction = async (action: 'upscale' | 'edit' | 'removeBg' | 'expand', payload?: string) => {
    const selectedItem = selectedIds.length > 0 ? items.find(i => i.id === selectedIds[0]) : null;
    if (!selectedItem) return;

    const itemId = selectedItem.id;
    // 检查该图片是否正在处理
    if (processingIds.has(itemId)) return;

    // 标记该图片正在处理
    setProcessingIds(prev => new Set(prev).add(itemId));
    try {
      let newImageSrc = "";

      if (action === 'upscale') {
        newImageSrc = await API.upscaleImage({
          image: selectedItem.src,
          resolution: "4K",
        });
      } else if (action === 'removeBg') {
        newImageSrc = await API.editImage({
          image: selectedItem.src,
          prompt: "Remove the background completely. Make it transparent or solid white.",
        });
      } else if (action === 'expand') {
        newImageSrc = await API.editImage({
          image: selectedItem.src,
          prompt: "Zoom out, showing more of the surroundings and environment. Expand the view.",
        });
      } else if (action === 'edit' && payload) {
        newImageSrc = await API.editImage({
          image: selectedItem.src,
          prompt: payload,
        });
      }

      if (newImageSrc) {
        setItems(prev => prev.map(item =>
          item.id === itemId
            ? { ...item, src: newImageSrc }
            : item
        ));
      }

    } catch (e) {
      console.error(e);
      alert("操作失败，请检查后端服务是否正常运行。");
    } finally {
      // 移除该图片的处理状态
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDownload = () => {
    const selectedItem = selectedIds.length > 0 ? items.find(i => i.id === selectedIds[0]) : null;
    if (!selectedItem || selectedItem.type !== 'image') return;
    const a = document.createElement('a');
    a.href = selectedItem.src;
    a.download = `canvas-ai-${Date.now()}.png`;
    a.click();
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    // 删除选中的元素，同时删除关联的连接线
    setItems(prev => prev.filter(i => {
      if (selectedIds.includes(i.id)) return false;
      // 如果是连接线，检查源或目标是否被删除
      if (i.type === 'connection') {
        if (selectedIds.includes(i.sourceItemId || '') || selectedIds.includes(i.targetItemId || '')) {
          return false;
        }
      }
      return true;
    }));
    setSelectedIds([]);
  };

  // AI 融合 - 截取选中区域作为参考图
  const handleAIFusion = async () => {
    if (selectedIds.length < 2 || !canvasContentRef.current) return;

    const selectedItems = items.filter(item => selectedIds.includes(item.id));
    if (selectedItems.length === 0) return;

    // 计算选中区域的边界
    const minX = Math.min(...selectedItems.map(item => item.x));
    const minY = Math.min(...selectedItems.map(item => item.y));
    const maxX = Math.max(...selectedItems.map(item => item.x + item.width));
    const maxY = Math.max(...selectedItems.map(item => item.y + item.height));

    const padding = 20;
    const boundingBox = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };

    try {
      // 使用 html2canvas 截取画布内容区域
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await html2canvas(canvasContentRef.current, {
        backgroundColor: '#f8f9fa',
        scale: 2, // 高清截图
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
        useCORS: true,
        allowTaint: true,
      } as any);

      const dataUrl = canvas.toDataURL('image/png');
      setFusionReferenceImage(dataUrl);
      setShowFusionPanel(true);
    } catch (error) {
      console.error('截取画布失败:', error);
    }
  };

  // 执行 AI 融合生成
  const executeAIFusion = async () => {
    if (!fusionReferenceImage || !fusionPrompt.trim()) return;

    setIsFusing(true);
    setShowFusionPanel(false);

    // 计算放置位置（在选中区域右侧）
    const selectedItems = items.filter(item => selectedIds.includes(item.id));
    const maxX = Math.max(...selectedItems.map(item => item.x + item.width));
    const minY = Math.min(...selectedItems.map(item => item.y));
    const _avgHeight = selectedItems.reduce((sum, item) => sum + item.height, 0) / selectedItems.length;

    // 解析宽高比
    const [w, h] = aspectRatio.split(':').map(Number);
    const ratio = w / h;
    const width = ratio >= 1 ? MAX_DISPLAY_SIZE : MAX_DISPLAY_SIZE * ratio;
    const height = ratio >= 1 ? MAX_DISPLAY_SIZE / ratio : MAX_DISPLAY_SIZE;

    // 设置 loading 位置
    const loadingPos = {
      x: maxX + 40,
      y: minY,
      width,
      height,
    };
    setLoadingPosition(loadingPos);
    loadingPositionRef.current = loadingPos;

    try {
      // 调用 AI 生成 API，传入参考图
      const newImageSrc = await API.generateImage({
        prompt: fusionPrompt,
        aspectRatio,
        size: resolution,
        referenceImage: fusionReferenceImage,
      });

      // 加载图片以获取实际尺寸
      const img = new window.Image();
      img.src = newImageSrc;
      img.onload = () => {
        const pos = loadingPositionRef.current || loadingPos;
        const newItem: CanvasItem = {
          id: generateId(),
          type: 'image',
          src: newImageSrc,
          x: pos.x,
          y: pos.y,
          width: Math.round(img.naturalWidth * 0.707),  // 缩小50%面积
          height: Math.round(img.naturalHeight * 0.707),
          zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
        };

        // 为所有选中的图片创建溯源连接线
        const connectionLines: CanvasItem[] = [];
        const selectedImageItems = selectedItems.filter(item => item.type === 'image');
        selectedImageItems.forEach(sourceImage => {
          const connection = createConnectionCurve(sourceImage, newItem);
          connectionLines.push(connection);
        });

        setItems(prev => [...prev, ...connectionLines, newItem]);
        setSelectedIds([newItem.id]);

        // 清理 loading 状态
        setLoadingPosition(null);
        loadingPositionRef.current = null;
      };
    } catch (error) {
      console.error('AI 融合失败:', error);
      // 失败时清理 loading 状态
      setLoadingPosition(null);
      loadingPositionRef.current = null;
    } finally {
      setIsFusing(false);
      setFusionReferenceImage(null);
      setFusionPrompt('');
    }
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // 如果正在裁剪，点击画布其他位置时确认裁剪
    if (croppingImageId) {
      // 检查是否点击在裁剪框或其手柄上（通过事件目标判断）
      const target = e.target as HTMLElement;
      const isCropInteraction = target.closest('[data-crop-handle]') || target.closest('[data-crop-box]');
      if (!isCropInteraction) {
        applyCrop();
      }
      // 裁剪模式下阻止所有其他交互
      return;
    }

    if (e.button === 1 || toolMode === ToolMode.PAN) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const clickedItem = [...items].reverse().find(item => {
      // 连接线不可选中
      if (item.type === 'connection') return false;
      const screenX = item.x * scale + pan.x + (window.innerWidth / 2);
      const screenY = item.y * scale + pan.y + (window.innerHeight / 2);
      // 为线条和箭头添加最小点击区域
      const minHitArea = (item.type === 'line' || item.type === 'arrow') ? 20 : 0;
      const screenW = Math.max(item.width * scale, minHitArea);
      const screenH = Math.max(item.height * scale, minHitArea);
      // 对于线条，需要调整点击区域的起始位置
      const offsetX = (item.type === 'line' || item.type === 'arrow') && item.width * scale < minHitArea
        ? -(minHitArea - item.width * scale) / 2 : 0;
      const offsetY = (item.type === 'line' || item.type === 'arrow') && item.height * scale < minHitArea
        ? -(minHitArea - item.height * scale) / 2 : 0;

      return (
        e.clientX >= screenX + offsetX &&
        e.clientX <= screenX + offsetX + screenW &&
        e.clientY >= screenY + offsetY &&
        e.clientY <= screenY + offsetY + screenH
      );
    });

    if (clickedItem) {
      const isAlreadySelected = selectedIds.includes(clickedItem.id);

      // 点击选择：单选模式（多选只能通过框选实现）
      if (!isAlreadySelected) {
        setSelectedIds([clickedItem.id]);
      }
      // 已选中的元素：直接准备拖动，不改变选中状态

      if (toolMode === ToolMode.SELECT) {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: clickedItem.x, y: clickedItem.y });
        // 保存所有选中元素的初始位置
        const currentSelectedIds = isAlreadySelected ? selectedIds : [clickedItem.id];
        const positions: Record<string, { x: number; y: number }> = {};
        items.forEach(item => {
          if (currentSelectedIds.includes(item.id)) {
            positions[item.id] = { x: item.x, y: item.y };
          }
        });
        setItemsStartPositions(positions);
      }
    } else {
      // 没有点击到物品
      setSelectedIds([]);

      const canvasX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
      const canvasY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;

      if (toolMode === ToolMode.TEXT) {
        // 在点击位置创建文字
        const newTextItem: CanvasItem = {
          id: generateId(),
          type: 'text',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 50, // 初始最小宽度
          height: 40,
          zIndex: items.length + 1,
          fontSize: 24,
          fontFamily: '"Xiaolai SC", "Virgil", cursive',
          fontWeight: 'normal',
          color: '#1f2937',
          textAlign: 'left',
        };
        setItems(prev => [...prev, newTextItem]);
        setSelectedIds([newTextItem.id]);
        setEditingTextId(newTextItem.id);
        setToolMode(ToolMode.SELECT);
      } else if (toolMode === ToolMode.RECTANGLE) {
        // 创建矩形 - 拖拽绘制
        const newRectItem: CanvasItem = {
          id: generateId(),
          type: 'rectangle',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          fill: toolColors.rectangle + '20',
          stroke: toolColors.rectangle,
          strokeWidth: 2,
          borderRadius: 8,
        };
        setItems(prev => [...prev, newRectItem]);
        setSelectedIds([newRectItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasX, y: canvasY });
      } else if (toolMode === ToolMode.CIRCLE) {
        // 创建圆形 - 拖拽绘制
        const newCircleItem: CanvasItem = {
          id: generateId(),
          type: 'circle',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          fill: toolColors.circle + '20',
          stroke: toolColors.circle,
          strokeWidth: 2,
        };
        setItems(prev => [...prev, newCircleItem]);
        setSelectedIds([newCircleItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasX, y: canvasY });
      } else if (toolMode === ToolMode.LINE) {
        // 创建直线 - 拖拽绘制
        const newLineItem: CanvasItem = {
          id: generateId(),
          type: 'line',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          stroke: toolColors.line,
          strokeWidth: 2,
          startPoint: { x: canvasX, y: canvasY },
          endPoint: { x: canvasX, y: canvasY },
        };
        setItems(prev => [...prev, newLineItem]);
        setSelectedIds([newLineItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasX, y: canvasY });
      } else if (toolMode === ToolMode.ARROW) {
        // 创建箭头 - 拖拽绘制
        const newArrowItem: CanvasItem = {
          id: generateId(),
          type: 'arrow',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          stroke: toolColors.arrow,
          strokeWidth: 2,
          startPoint: { x: canvasX, y: canvasY },
          endPoint: { x: canvasX, y: canvasY },
        };
        setItems(prev => [...prev, newArrowItem]);
        setSelectedIds([newArrowItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: canvasX, y: canvasY });
      } else if (toolMode === ToolMode.BRUSH) {
        // 画笔 - 开始绘制路径
        const newBrushItem: CanvasItem = {
          id: generateId(),
          type: 'brush',
          src: '',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          zIndex: items.length + 1,
          stroke: toolColors.brush,
          strokeWidth: 3,
          points: [{ x: canvasX, y: canvasY }],
        };
        setItems(prev => [...prev, newBrushItem]);
        setSelectedIds([newBrushItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (toolMode === ToolMode.SELECT) {
        // 在空白处拖动触发框选
        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionEnd({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 更新鼠标位置（画布坐标）
    const mouseCanvasX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
    const mouseCanvasY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;
    mousePositionRef.current = { x: mouseCanvasX, y: mouseCanvasY };

    // 同步光标位置给协作者
    if (isCollabConnected) {
      sendCursorMove(mouseCanvasX, mouseCanvasY);
    }

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 线条/箭头端点拖拽
    if (linePointDrag) {
      const canvasX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
      const canvasY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;

      setItems(prev => prev.map(item => {
        if (item.id !== linePointDrag.itemId) return item;
        if (!item.startPoint || !item.endPoint) return item;

        if (linePointDrag.pointType === 'start') {
          // 更新起点
          const newStartPoint = { x: canvasX, y: canvasY };
          const minX = Math.min(newStartPoint.x, item.endPoint.x);
          const minY = Math.min(newStartPoint.y, item.endPoint.y);
          const maxX = Math.max(newStartPoint.x, item.endPoint.x);
          const maxY = Math.max(newStartPoint.y, item.endPoint.y);
          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            startPoint: newStartPoint,
          };
        } else if (linePointDrag.pointType === 'end') {
          // 更新终点
          const newEndPoint = { x: canvasX, y: canvasY };
          const minX = Math.min(item.startPoint.x, newEndPoint.x);
          const minY = Math.min(item.startPoint.y, newEndPoint.y);
          const maxX = Math.max(item.startPoint.x, newEndPoint.x);
          const maxY = Math.max(item.startPoint.y, newEndPoint.y);
          return {
            ...item,
            x: minX,
            y: minY,
            width: Math.max(maxX - minX, 1),
            height: Math.max(maxY - minY, 1),
            endPoint: newEndPoint,
          };
        } else if (linePointDrag.pointType === 'control') {
          // 用户拖拽的是曲线中点 M，反向计算贝塞尔控制点 P1
          // M = 0.25*P0 + 0.5*P1 + 0.25*P2
          // P1 = 2*M - (P0 + P2)/2
          const startX = item.startPoint.x;
          const startY = item.startPoint.y;
          const endX = item.endPoint.x;
          const endY = item.endPoint.y;
          const controlPointX = 2 * canvasX - (startX + endX) / 2;
          const controlPointY = 2 * canvasY - (startY + endY) / 2;
          return {
            ...item,
            controlPoint: { x: controlPointX, y: controlPointY },
          };
        }
        return item;
      }));
      return;
    }

    if (isResizing && selectedIds.length > 0 && resizeCorner) {
      const dx = (e.clientX - resizeStart.x) / scale;
      const dy = (e.clientY - resizeStart.y) / scale;

      // 多选整体缩放
      if (multiResizeData && selectedIds.length > 1) {
        const bb = multiResizeData.boundingBox;
        const ratio = bb.height > 0 ? bb.width / bb.height : 1;
        let newBBWidth = bb.width;
        let newBBHeight = bb.height;
        let newBBX = bb.x;
        let newBBY = bb.y;

        // 计算新的边界框大小（等比缩放）
        if (resizeCorner === 'br') {
          newBBWidth = Math.max(50, bb.width + dx);
          newBBHeight = newBBWidth / ratio;
        } else if (resizeCorner === 'bl') {
          newBBWidth = Math.max(50, bb.width - dx);
          newBBHeight = newBBWidth / ratio;
          newBBX = bb.x + (bb.width - newBBWidth);
        } else if (resizeCorner === 'tr') {
          newBBWidth = Math.max(50, bb.width + dx);
          newBBHeight = newBBWidth / ratio;
          newBBY = bb.y + (bb.height - newBBHeight);
        } else if (resizeCorner === 'tl') {
          newBBWidth = Math.max(50, bb.width - dx);
          newBBHeight = newBBWidth / ratio;
          newBBX = bb.x + (bb.width - newBBWidth);
          newBBY = bb.y + (bb.height - newBBHeight);
        }

        // 更新所有选中元素
        setItems(prev => {
          const resizedItems = prev.map(item => {
            if (!selectedIds.includes(item.id)) return item;
            const itemData = multiResizeData.items[item.id];
            if (!itemData) return item;

            const newX = newBBX + itemData.relX * newBBWidth;
            const newY = newBBY + itemData.relY * newBBHeight;
            const newWidth = Math.max(20, itemData.relW * newBBWidth);
            const newHeight = Math.max(20, itemData.relH * newBBHeight);

            return { ...item, x: newX, y: newY, width: newWidth, height: newHeight };
          });
          // 实时更新连接线
          return updateConnectionsRealtime(resizedItems, selectedIds);
        });
        return;
      }

      // 单选缩放
      setItems(prev => {
        const resizedItems = prev.map(item => {
          if (item.id !== selectedIds[0]) return item;

          // LINE/ARROW 使用自由缩放，同时更新起点终点
          if (item.type === 'line' || item.type === 'arrow') {
            let newWidth = itemStartSize.width;
            let newHeight = itemStartSize.height;
            let newX = itemStartSize.x;
            let newY = itemStartSize.y;

            if (resizeCorner === 'br') {
              newWidth = Math.max(10, itemStartSize.width + dx);
              newHeight = Math.max(10, itemStartSize.height + dy);
            } else if (resizeCorner === 'bl') {
              newWidth = Math.max(10, itemStartSize.width - dx);
              newHeight = Math.max(10, itemStartSize.height + dy);
              newX = itemStartSize.x + (itemStartSize.width - newWidth);
            } else if (resizeCorner === 'tr') {
              newWidth = Math.max(10, itemStartSize.width + dx);
              newHeight = Math.max(10, itemStartSize.height - dy);
              newY = itemStartSize.y + (itemStartSize.height - newHeight);
            } else if (resizeCorner === 'tl') {
              newWidth = Math.max(10, itemStartSize.width - dx);
              newHeight = Math.max(10, itemStartSize.height - dy);
              newX = itemStartSize.x + (itemStartSize.width - newWidth);
              newY = itemStartSize.y + (itemStartSize.height - newHeight);
            }

            // 更新起点终点坐标
            const scaleX = itemStartSize.width > 0 ? newWidth / itemStartSize.width : 1;
            const scaleY = itemStartSize.height > 0 ? newHeight / itemStartSize.height : 1;
            let newStartPoint = item.startPoint;
            let newEndPoint = item.endPoint;

            if (item.startPoint && item.endPoint) {
              const relStartX = item.startPoint.x - itemStartSize.x;
              const relStartY = item.startPoint.y - itemStartSize.y;
              const relEndX = item.endPoint.x - itemStartSize.x;
              const relEndY = item.endPoint.y - itemStartSize.y;

              newStartPoint = { x: newX + relStartX * scaleX, y: newY + relStartY * scaleY };
              newEndPoint = { x: newX + relEndX * scaleX, y: newY + relEndY * scaleY };
            }

            return { ...item, width: newWidth, height: newHeight, x: newX, y: newY, startPoint: newStartPoint, endPoint: newEndPoint };
          }

          // 其他形状使用等比缩放
          const ratio = itemStartSize.height > 0 ? itemStartSize.width / itemStartSize.height : 1;
          let newWidth = itemStartSize.width;
          let newHeight = itemStartSize.height;
          let newX = itemStartSize.x;
          let newY = itemStartSize.y;

          if (resizeCorner === 'br') {
            newWidth = Math.max(50, itemStartSize.width + dx);
            newHeight = newWidth / ratio;
          } else if (resizeCorner === 'bl') {
            newWidth = Math.max(50, itemStartSize.width - dx);
            newHeight = newWidth / ratio;
            newX = itemStartSize.x + (itemStartSize.width - newWidth);
          } else if (resizeCorner === 'tr') {
            newWidth = Math.max(50, itemStartSize.width + dx);
            newHeight = newWidth / ratio;
            newY = itemStartSize.y + (itemStartSize.height - newHeight);
          } else if (resizeCorner === 'tl') {
            newWidth = Math.max(50, itemStartSize.width - dx);
            newHeight = newWidth / ratio;
            newX = itemStartSize.x + (itemStartSize.width - newWidth);
            newY = itemStartSize.y + (itemStartSize.height - newHeight);
          }

          return { ...item, width: newWidth, height: newHeight, x: newX, y: newY };
        });
        // 实时更新连接线
        return updateConnectionsRealtime(resizedItems, selectedIds);
      });
      return;
    }

    if (isSelecting) {
      setSelectionEnd({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDragging && selectedIds.length > 0) {
      const selectedItem = items.find(i => i.id === selectedIds[0]);
      const canvasX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
      const canvasY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;

      // 画笔模式 - 添加新点
      if (selectedItem?.type === 'brush' && toolMode === ToolMode.BRUSH) {
        setItems(prev => prev.map(item =>
          item.id === selectedIds[0] && item.points
            ? { ...item, points: [...item.points, { x: canvasX, y: canvasY }] }
            : item
        ));
      }
      // 矩形绘制模式
      else if (selectedItem?.type === 'rectangle' && toolMode === ToolMode.RECTANGLE) {
        const startX = itemStart.x;
        const startY = itemStart.y;
        const newX = Math.min(startX, canvasX);
        const newY = Math.min(startY, canvasY);
        const newWidth = Math.abs(canvasX - startX);
        const newHeight = Math.abs(canvasY - startY);

        setItems(prev => prev.map(item =>
          item.id === selectedIds[0]
            ? { ...item, x: newX, y: newY, width: newWidth, height: newHeight }
            : item
        ));
      }
      // 圆形绘制模式
      else if (selectedItem?.type === 'circle' && toolMode === ToolMode.CIRCLE) {
        const startX = itemStart.x;
        const startY = itemStart.y;
        const newX = Math.min(startX, canvasX);
        const newY = Math.min(startY, canvasY);
        const newWidth = Math.abs(canvasX - startX);
        const newHeight = Math.abs(canvasY - startY);

        setItems(prev => prev.map(item =>
          item.id === selectedIds[0]
            ? { ...item, x: newX, y: newY, width: newWidth, height: newHeight }
            : item
        ));
      }
      // 直线绘制模式
      else if (selectedItem?.type === 'line' && toolMode === ToolMode.LINE) {
        const startX = itemStart.x;
        const startY = itemStart.y;
        const minX = Math.min(startX, canvasX);
        const minY = Math.min(startY, canvasY);
        const maxX = Math.max(startX, canvasX);
        const maxY = Math.max(startY, canvasY);

        setItems(prev => prev.map(item =>
          item.id === selectedIds[0]
            ? {
                ...item,
                x: minX,
                y: minY,
                width: Math.max(maxX - minX, 1),
                height: Math.max(maxY - minY, 1),
                startPoint: { x: startX, y: startY },
                endPoint: { x: canvasX, y: canvasY }
              }
            : item
        ));
      }
      // 箭头绘制模式
      else if (selectedItem?.type === 'arrow' && toolMode === ToolMode.ARROW) {
        const startX = itemStart.x;
        const startY = itemStart.y;
        const minX = Math.min(startX, canvasX);
        const minY = Math.min(startY, canvasY);
        const maxX = Math.max(startX, canvasX);
        const maxY = Math.max(startY, canvasY);

        setItems(prev => prev.map(item =>
          item.id === selectedIds[0]
            ? {
                ...item,
                x: minX,
                y: minY,
                width: Math.max(maxX - minX, 1),
                height: Math.max(maxY - minY, 1),
                startPoint: { x: startX, y: startY },
                endPoint: { x: canvasX, y: canvasY }
              }
            : item
        ));
      }
      else {
        // 普通拖拽移动
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        setItems(prev => {
          // 先移动选中的元素
          const movedItems = prev.map(item => {
            if (!selectedIds.includes(item.id)) return item;

            // 获取该元素的初始位置
            const startPos = itemsStartPositions[item.id] || { x: item.x, y: item.y };
            const newX = startPos.x + dx;
            const newY = startPos.y + dy;

            // 画笔需要同时移动所有点
            if (item.type === 'brush' && item.points) {
              const offsetX = newX - item.x;
              const offsetY = newY - item.y;
              return {
                ...item,
                x: newX,
                y: newY,
                points: item.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
              };
            }

            // 直线和箭头移动时需要同时移动起点、终点和控制点
            if ((item.type === 'line' || item.type === 'arrow') && item.startPoint && item.endPoint) {
              const offsetX = newX - item.x;
              const offsetY = newY - item.y;
              return {
                ...item,
                x: newX,
                y: newY,
                startPoint: {
                  x: item.startPoint.x + offsetX,
                  y: item.startPoint.y + offsetY
                },
                endPoint: {
                  x: item.endPoint.x + offsetX,
                  y: item.endPoint.y + offsetY
                },
                // 同时移动控制点，保持曲线形状不变
                ...(item.controlPoint && {
                  controlPoint: {
                    x: item.controlPoint.x + offsetX,
                    y: item.controlPoint.y + offsetY
                  }
                })
              };
            }

            return { ...item, x: newX, y: newY };
          });

          // 实时更新关联的连接线
          return updateConnectionsRealtime(movedItems, selectedIds);
        });
      }
    }
  };

  const handleMouseUp = () => {
    // 框选结束时，检测选中的物品
    if (isSelecting) {
      const minX = Math.min(selectionStart.x, selectionEnd.x);
      const maxX = Math.max(selectionStart.x, selectionEnd.x);
      const minY = Math.min(selectionStart.y, selectionEnd.y);
      const maxY = Math.max(selectionStart.y, selectionEnd.y);

      // 只有拖拽足够距离才算框选
      if (maxX - minX > 5 || maxY - minY > 5) {
        // 选中所有与框相交的物品
        const selectedItems = items.filter(item => {
          // 连接线不可选中
          if (item.type === 'connection') return false;
          const screenX = item.x * scale + pan.x + (window.innerWidth / 2);
          const screenY = item.y * scale + pan.y + (window.innerHeight / 2);
          const screenW = item.width * scale;
          const screenH = item.height * scale;

          // 检查物品是否与选框相交
          return !(screenX + screenW < minX || screenX > maxX || screenY + screenH < minY || screenY > maxY);
        });

        if (selectedItems.length > 0) {
          setSelectedIds(selectedItems.map(item => item.id));
        }
      }
    }

    // 画笔绘制结束后计算边界框
    if (toolMode === ToolMode.BRUSH && isDragging && selectedIds.length > 0) {
      const brushItem = items.find(i => i.id === selectedIds[0]);
      if (brushItem?.points && brushItem.points.length > 0) {
        const padding = 10; // 增加一些内边距便于点击
        const xs = brushItem.points.map(p => p.x);
        const ys = brushItem.points.map(p => p.y);
        const minX = Math.min(...xs) - padding;
        const maxX = Math.max(...xs) + padding;
        const minY = Math.min(...ys) - padding;
        const maxY = Math.max(...ys) + padding;

        setItems(prev => prev.map(item =>
          item.id === selectedIds[0]
            ? { ...item, x: minX, y: minY, width: maxX - minX, height: maxY - minY }
            : item
        ));
      }
      setSelectedIds([]); // 取消选中，准备画下一个
    }

    // 形状工具绘制结束
    if ((toolMode === ToolMode.RECTANGLE || toolMode === ToolMode.CIRCLE ||
         toolMode === ToolMode.LINE || toolMode === ToolMode.ARROW) && isDragging && selectedIds.length > 0) {
      const shapeItem = items.find(i => i.id === selectedIds[0]);
      // 如果形状太小，删除它
      if (shapeItem && shapeItem.width < 5 && shapeItem.height < 5) {
        setItems(prev => prev.filter(item => item.id !== selectedIds[0]));
      }
      setSelectedIds([]); // 取消选中，准备画下一个
    }

    // 拖动或缩放结束时，更新关联的连接线
    if ((isDragging || isResizing) && selectedIds.length > 0) {
      updateConnections(selectedIds);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);
    setIsSelecting(false);
    setLinePointDrag(null);
  };

  // 双击画布空白区域创建文字
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    // 计算画布坐标
    const canvasX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
    const canvasY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;

    // 检查是否点击在已有元素上
    const clickedItem = items.find(item => {
      if (item.type === 'connection') return false; // 忽略连接线
      return (
        canvasX >= item.x &&
        canvasX <= item.x + item.width &&
        canvasY >= item.y &&
        canvasY <= item.y + item.height
      );
    });

    // 如果点击在空白区域，创建文字
    if (!clickedItem) {
      const newTextItem: CanvasItem = {
        id: generateId(),
        type: 'text',
        src: '',
        x: canvasX,
        y: canvasY - 20,
        width: 50, // 初始最小宽度
        height: 40,
        zIndex: items.length + 1,
        fontSize: 24,
        fontFamily: '"Xiaolai SC", "Virgil", cursive',
        fontWeight: 'normal',
        color: '#1f2937',
        textAlign: 'left',
      };
      setItems(prev => [...prev, newTextItem]);
      setSelectedIds([newTextItem.id]);
      setEditingTextId(newTextItem.id);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    if (selectedIds.length === 0) return;

    setIsResizing(true);
    setResizeCorner(corner);
    setResizeStart({ x: e.clientX, y: e.clientY });

    // 多选缩放：计算边界框和每个元素的相对位置
    if (selectedIds.length > 1) {
      const selectedItems = items.filter(item => selectedIds.includes(item.id));
      const minX = Math.min(...selectedItems.map(item => item.x));
      const minY = Math.min(...selectedItems.map(item => item.y));
      const maxX = Math.max(...selectedItems.map(item => item.x + item.width));
      const maxY = Math.max(...selectedItems.map(item => item.y + item.height));
      const bbWidth = maxX - minX;
      const bbHeight = maxY - minY;

      const itemsData: Record<string, { x: number; y: number; width: number; height: number; relX: number; relY: number; relW: number; relH: number }> = {};
      selectedItems.forEach(item => {
        itemsData[item.id] = {
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          relX: bbWidth > 0 ? (item.x - minX) / bbWidth : 0,
          relY: bbHeight > 0 ? (item.y - minY) / bbHeight : 0,
          relW: bbWidth > 0 ? item.width / bbWidth : 1,
          relH: bbHeight > 0 ? item.height / bbHeight : 1,
        };
      });

      setMultiResizeData({
        boundingBox: { x: minX, y: minY, width: bbWidth, height: bbHeight },
        items: itemsData,
      });
      setItemStartSize({ x: minX, y: minY, width: bbWidth, height: bbHeight });
    } else {
      // 单选缩放
      const selectedItem = items.find(i => i.id === selectedIds[0]);
      if (!selectedItem) return;
      setMultiResizeData(null);
      setItemStartSize({
        width: selectedItem.width,
        height: selectedItem.height,
        x: selectedItem.x,
        y: selectedItem.y
      });
    }
  };

  // 线条/箭头端点拖拽开始
  const handleLinePointDrag = (e: React.MouseEvent, itemId: string, pointType: 'start' | 'end' | 'control') => {
    e.stopPropagation();
    setLinePointDrag({ itemId, pointType });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // 双指捏合缩放 - 以鼠标位置为焦点
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.03 : 0.03;
      const newScale = Math.min(Math.max(MIN_SCALE, scale + delta), MAX_SCALE);

      // 鼠标相对于屏幕中心的位置
      const mouseX = e.clientX - window.innerWidth / 2;
      const mouseY = e.clientY - window.innerHeight / 2;

      // 鼠标在画布坐标系中的位置
      const canvasX = (mouseX - pan.x) / scale;
      const canvasY = (mouseY - pan.y) / scale;

      // 缩放后调整 pan，保持鼠标下方的画布内容不变
      const newPanX = mouseX - canvasX * newScale;
      const newPanY = mouseY - canvasY * newScale;

      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
    } else {
      // 双指滑动移动画布
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // 拖放处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;

    // 获取拖放位置（转换为画布坐标）
    const dropX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
    const dropY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const img = new Image();
        img.src = src;
        img.onload = () => {
          const width = img.width > MAX_DISPLAY_SIZE ? MAX_DISPLAY_SIZE : img.width;
          const height = img.height > MAX_DISPLAY_SIZE ? (img.height / img.width) * MAX_DISPLAY_SIZE : img.height;
          const newItem: CanvasItem = {
            id: generateId(),
            type: 'image',
            src,
            x: dropX - width / 2 + index * 30,
            y: dropY - height / 2 + index * 30,
            width,
            height,
            zIndex: items.length + 1 + index,
          };
          setItems(prev => [...prev, newItem]);
          setSelectedIds([newItem.id]);
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (projectName.trim() === '') {
      setProjectName('未命名画布');
    }
  };

  // --- Render ---

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-text overflow-hidden font-sans">

      {/* --- Top Bar --- */}
      <div className="fixed top-0 left-0 right-0 h-16 px-4 flex items-center justify-between z-40 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
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
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                className="text-sm font-semibold text-gray-900 bg-white border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <h1
                onClick={() => setIsEditingName(true)}
                className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-primary transition-colors"
              >
                {projectName}
              </h1>
            )}
            <span className="text-[10px] text-gray-500">已自动保存</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 傻币 */}
          <ShabiCoins />

          {/* 社群按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowCommunityQR(!showCommunityQR)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-sm transition-colors"
              style={{ backgroundColor: '#A855F7' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#9333EA'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#A855F7'}
            >
              <Users size={18} className="text-white" />
              <span className="text-sm font-semibold text-white">社群</span>
            </button>

            {/* 社群下拉面板 */}
            {showCommunityQR && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-center mb-3">
                  <h3 className="text-base font-semibold text-gray-900">加入三傻社群</h3>
                  <p className="text-xs text-gray-500 mt-1">分享更多AI的有趣玩法，一起探索创意可能</p>
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
            isConnected={isCollabConnected}
            myColor={myColor}
            projectId={project.id}
            projectName={projectName}
          />

          {/* 图片索引 */}
          {items.filter(item => item.type === 'image' && item.imageData).length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowImageIndex(!showImageIndex)}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <LayoutGrid size={18} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {items.filter(item => item.type === 'image' && item.imageData).length}
                </span>
                {showImageIndex ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </button>

              {/* 索引下拉面板 */}
              {showImageIndex && (
                <div className="absolute top-full right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-3 gap-2">
                    {items
                      .filter(item => item.type === 'image' && item.imageData)
                      .map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            autoZoomToImage(item);
                            setShowImageIndex(false);
                          }}
                          className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-400 transition-all group"
                        >
                          <img
                            src={item.imageData}
                            alt={`图片 ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <div className="absolute top-1 left-1 bg-black/60 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                            {index + 1}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Left Tool Rail --- */}
      <div className="fixed left-4 flex flex-col items-center gap-1 p-2 bg-gray-100/90 backdrop-blur-sm shadow-lg rounded-full z-40" style={{ top: '50%', transform: 'translateY(-50%)' }}>
        {/* 选择 */}
        <Tooltip content="选择 (V)" side="right">
          <button
            className={`relative p-3 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.SELECT ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
            onClick={() => { setToolMode(ToolMode.SELECT); setShowCreativeTools(false); }}
          >
            <MousePointer2 size={20} />
          </button>
        </Tooltip>

        {/* 形状工具（含画笔） */}
        <div
          className="relative"
          onMouseEnter={() => setShowCreativeTools(true)}
          onMouseLeave={() => setShowCreativeTools(false)}
        >
          <Tooltip content="形状工具" side="right">
            <button
              className={`relative p-3 rounded-full transition-all duration-200 ease-out ${[ToolMode.BRUSH, ToolMode.TEXT, ToolMode.RECTANGLE, ToolMode.CIRCLE, ToolMode.LINE, ToolMode.ARROW].includes(toolMode)
                ? 'bg-gray-800 shadow-md scale-105'
                : 'hover:bg-gray-200/50 hover:scale-105'
                }`}
              onClick={() => setShowCreativeTools(!showCreativeTools)}
            >
              <Shapes size={20} style={{ color: getToolColor(toolMode) }} />
            </button>
          </Tooltip>

          {/* 形状展开菜单 */}
          {showCreativeTools && (
            <div className="absolute left-full top-0 flex items-start z-50">
              <div className="w-3" />
              <div className="flex flex-col gap-3 p-3 bg-white/98 backdrop-blur-md shadow-2xl rounded-2xl animate-in slide-in-from-left-3 fade-in duration-200 border border-gray-200/80">
                {/* 形状工具行 */}
                <div className="flex gap-1.5">
                  <Tooltip content="画笔 (B)" side="top">
                    <button
                      className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${toolMode === ToolMode.BRUSH ? 'bg-gray-900 text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      onClick={() => setToolMode(ToolMode.BRUSH)}
                    >
                      <Pencil size={18} />
                    </button>
                  </Tooltip>
                  <Tooltip content="文字 (T)" side="top">
                    <button
                      className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${toolMode === ToolMode.TEXT ? 'bg-gray-900 text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      onClick={() => setToolMode(ToolMode.TEXT)}
                    >
                      <Type size={18} />
                    </button>
                  </Tooltip>
                  <Tooltip content="直线 (L)" side="top">
                    <button
                      className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${toolMode === ToolMode.LINE ? 'bg-gray-900 text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      onClick={() => setToolMode(ToolMode.LINE)}
                    >
                      <Minus size={18} />
                    </button>
                  </Tooltip>
                  <Tooltip content="箭头 (A)" side="top">
                    <button
                      className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${toolMode === ToolMode.ARROW ? 'bg-gray-900 text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      onClick={() => setToolMode(ToolMode.ARROW)}
                    >
                      <MoveRight size={18} />
                    </button>
                  </Tooltip>
                  <Tooltip content="矩形 (R)" side="top">
                    <button
                      className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${toolMode === ToolMode.RECTANGLE ? 'bg-gray-900 text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      onClick={() => setToolMode(ToolMode.RECTANGLE)}
                    >
                      <Square size={18} />
                    </button>
                  </Tooltip>
                  <Tooltip content="圆形 (O)" side="top">
                    <button
                      className={`w-10 h-10 rounded-xl transition-all duration-200 flex items-center justify-center ${toolMode === ToolMode.CIRCLE ? 'bg-gray-900 text-white shadow-lg scale-105' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                      onClick={() => setToolMode(ToolMode.CIRCLE)}
                    >
                      <Circle size={18} />
                    </button>
                  </Tooltip>
                </div>
                {/* 分隔线 */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                {/* 颜色选择器行 */}
                <div className="flex gap-1.5">
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      className={`w-10 h-10 rounded-xl transition-all duration-200 hover:scale-110 ${getToolColor(toolMode) === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setToolColor(toolMode, color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* --- Main Canvas --- */}
      <div
        ref={canvasRef}
        className={`flex-1 relative cursor-default overflow-hidden transition-colors ${isDragOver ? 'bg-gray-100' : 'bg-gray-50'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleCanvasDoubleClick}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Background Dot Grid */}
        <div
          className="absolute inset-0 dot-grid opacity-60 pointer-events-none"
          style={{
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundSize: `${24 * scale}px ${24 * scale}px`
          }}
        />

        {/* Viewport Origin Center */}
        <div
          ref={canvasContentRef}
          className="absolute top-1/2 left-1/2 w-0 h-0 transition-transform duration-150 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
          }}
        >
          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            // 为线条和箭头添加最小尺寸，确保选择框可见
            const isLineType = item.type === 'line' || item.type === 'arrow';
            const minSize = isLineType ? 20 : 0;
            // 裁剪模式下使用原始尺寸和原始位置
            const isCropping = croppingImageId === item.id;
            const effectiveX = isCropping ? (item.originalX ?? item.x) : item.x;
            const effectiveY = isCropping ? (item.originalY ?? item.y) : item.y;
            const effectiveWidth = isCropping ? (item.originalWidth || item.width) : item.width;
            const effectiveHeight = isCropping ? (item.originalHeight || item.height) : item.height;
            const displayWidth = Math.max(effectiveWidth, minSize);
            const displayHeight = Math.max(effectiveHeight, minSize);
            const offsetX = isLineType && effectiveWidth < minSize ? -(minSize - effectiveWidth) / 2 : 0;
            const offsetY = isLineType && effectiveHeight < minSize ? -(minSize - effectiveHeight) / 2 : 0;
            return (
              <div
                key={item.id}
                className="absolute group select-none"
                style={{
                  left: effectiveX + offsetX,
                  top: effectiveY + offsetY,
                  width: displayWidth,
                  height: displayHeight,
                  zIndex: (maskEditingId === item.id || isSelected) ? 9999 : item.zIndex,
                  overflow: item.type === 'text' ? 'visible' : undefined,
                }}
              >
                {/* 选中边框 - 单选时显示完整边框和手柄（裁剪时隐藏，线段/箭头使用端点控制不需要边框） */}
                {isSelected && selectedIds.length === 1 && croppingImageId !== item.id && item.type !== 'line' && item.type !== 'arrow' && (
                  <>
                    {/* 外发光 */}
                    <div className="absolute -inset-3 rounded-2xl bg-primary/10 blur-md pointer-events-none" />
                    {/* 边框 */}
                    <div className="absolute -inset-2 rounded-xl border-2 border-primary/60 pointer-events-none" />
                    {/* 四角手柄 - 可拖拽缩放 */}
                    <div
                      className="absolute -top-3 -left-3 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'tl')}
                    />
                    <div
                      className="absolute -top-3 -right-3 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'tr')}
                    />
                    <div
                      className="absolute -bottom-3 -left-3 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'bl')}
                    />
                    <div
                      className="absolute -bottom-3 -right-3 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'br')}
                    />
                  </>
                )}
                {/* 悬停边框（线段/箭头不需要） */}
                {!isSelected && item.type !== 'line' && item.type !== 'arrow' && (
                  <div className="absolute -inset-1 rounded-xl border border-transparent group-hover:border-gray-300 pointer-events-none transition-colors" />
                )}
                {/* 图片 */}
                {item.type === 'image' && (
                  <>
                    <img
                      src={isCropping ? (item.originalSrc || item.src) : item.src}
                      alt="canvas item"
                      className={`w-full h-full rounded-lg shadow-lg cursor-pointer ${isCropping ? 'opacity-40' : 'object-cover'}`}
                      draggable={false}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startCropping(item.id);
                      }}
                    />
                    {/* 裁剪模式 - 内联裁剪框 */}
                    {isCropping && (() => {
                      const origW = item.originalWidth || item.width;
                      const origH = item.originalHeight || item.height;
                      const origSrc = item.originalSrc || item.src;
                      return (
                      <>
                        {/* 裁剪框 - 使用 background-image 精确定位 */}
                        <div
                          data-crop-box
                          className="absolute ring-[3px] ring-violet-500 pointer-events-auto cursor-move"
                          style={{
                            left: cropBox.x,
                            top: cropBox.y,
                            width: cropBox.width,
                            height: cropBox.height,
                            backgroundImage: `url(${origSrc})`,
                            backgroundSize: `${origW}px ${origH}px`,
                            backgroundPosition: `-${cropBox.x}px -${cropBox.y}px`,
                            backgroundRepeat: 'no-repeat',
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startCropX = cropBox.x;
                            const startCropY = cropBox.y;
                            const handleMove = (moveE: MouseEvent) => {
                              const dx = (moveE.clientX - startX) / scale;
                              const dy = (moveE.clientY - startY) / scale;
                              setCropBox(prev => ({
                                ...prev,
                                x: Math.max(0, Math.min(origW - prev.width, startCropX + dx)),
                                y: Math.max(0, Math.min(origH - prev.height, startCropY + dy)),
                              }));
                            };
                            const handleUp = () => {
                              document.removeEventListener('mousemove', handleMove);
                              document.removeEventListener('mouseup', handleUp);
                            };
                            document.addEventListener('mousemove', handleMove);
                            document.addEventListener('mouseup', handleUp);
                          }}
                        />
                        {/* 四角拖拽手柄 - L形角标 */}
                        {['tl', 'tr', 'bl', 'br'].map((corner) => {
                          const isTop = corner.includes('t');
                          const isLeft = corner.includes('l');
                          const size = 20;
                          const thickness = 4;
                          return (
                            <div
                              key={corner}
                              data-crop-handle
                              className="absolute z-10 pointer-events-auto"
                              style={{
                                left: isLeft ? cropBox.x - thickness : cropBox.x + cropBox.width - size,
                                top: isTop ? cropBox.y - thickness : cropBox.y + cropBox.height - size,
                                width: size + thickness,
                                height: size + thickness,
                                cursor: (isTop === isLeft) ? 'nwse-resize' : 'nesw-resize',
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const startX = e.clientX;
                                const startY = e.clientY;
                                const startBox = { ...cropBox };
                                const handleMove = (moveE: MouseEvent) => {
                                  const dx = (moveE.clientX - startX) / scale;
                                  const dy = (moveE.clientY - startY) / scale;
                                  const newBox = { ...startBox };
                                  if (isLeft) {
                                    newBox.x = Math.max(0, Math.min(startBox.x + startBox.width - 50, startBox.x + dx));
                                    newBox.width = startBox.width - (newBox.x - startBox.x);
                                  } else {
                                    newBox.width = Math.max(50, Math.min(origW - startBox.x, startBox.width + dx));
                                  }
                                  if (isTop) {
                                    newBox.y = Math.max(0, Math.min(startBox.y + startBox.height - 50, startBox.y + dy));
                                    newBox.height = startBox.height - (newBox.y - startBox.y);
                                  } else {
                                    newBox.height = Math.max(50, Math.min(origH - startBox.y, startBox.height + dy));
                                  }
                                  setCropBox(newBox);
                                };
                                const handleUp = () => {
                                  document.removeEventListener('mousemove', handleMove);
                                  document.removeEventListener('mouseup', handleUp);
                                };
                                document.addEventListener('mousemove', handleMove);
                                document.addEventListener('mouseup', handleUp);
                              }}
                            >
                              {/* L形角标 - 水平线 */}
                              <div
                                className="absolute"
                                style={{
                                  width: size,
                                  height: thickness,
                                  left: isLeft ? 0 : thickness,
                                  top: isTop ? 0 : size,
                                  backgroundColor: '#4F46E5',
                                }}
                              />
                              {/* L形角标 - 垂直线 */}
                              <div
                                className="absolute"
                                style={{
                                  width: thickness,
                                  height: size + thickness,
                                  left: isLeft ? 0 : size,
                                  top: 0,
                                  backgroundColor: '#4F46E5',
                                }}
                              />
                            </div>
                          );
                        })}
                      </>
                    );})()}
                    {/* 遮罩编辑模式 - 内联在图片上 */}
                    {maskEditingId === item.id && (
                      <>
                        {/* 遮罩绘制 canvas */}
                        <canvas
                          ref={maskCanvasRef}
                          width={item.width}
                          height={item.height}
                          className="absolute inset-0 rounded-lg pointer-events-auto"
                          style={{
                            width: item.width,
                            height: item.height,
                            cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${maskBrushSize}' height='${maskBrushSize}' viewBox='0 0 ${maskBrushSize} ${maskBrushSize}'%3E%3Ccircle cx='${maskBrushSize/2}' cy='${maskBrushSize/2}' r='${maskBrushSize/2 - 1}' fill='rgba(59,130,246,0.3)' stroke='white' stroke-width='1'/%3E%3C/svg%3E") ${maskBrushSize/2} ${maskBrushSize/2}, crosshair`,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsMaskDrawing(true);
                            resetLastPoint();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = (e.clientX - rect.left) * (item.width / rect.width);
                            const y = (e.clientY - rect.top) * (item.height / rect.height);
                            drawMaskBrush(x, y, true);
                          }}
                          onMouseMove={(e) => {
                            if (!isMaskDrawing) return;
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = (e.clientX - rect.left) * (item.width / rect.width);
                            const y = (e.clientY - rect.top) * (item.height / rect.height);
                            drawMaskBrush(x, y, false);
                          }}
                          onMouseUp={() => {
                            setIsMaskDrawing(false);
                            resetLastPoint();
                          }}
                          onMouseLeave={() => {
                            setIsMaskDrawing(false);
                            resetLastPoint();
                          }}
                        />
                        {/* 遮罩编辑工具栏 */}
                        <div
                          className="absolute left-1/2 z-10"
                          style={{
                            top: -60 / scale,
                            transform: `translateX(-50%) scale(${1 / scale})`,
                            transformOrigin: 'bottom center',
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl shadow-lg px-3 py-2 flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-400" />
                              <input
                                type="range"
                                min="5"
                                max="100"
                                value={maskBrushSize}
                                onChange={(e) => setMaskBrushSize(Number(e.target.value))}
                                className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                              <div className="w-4 h-4 rounded-full bg-blue-400" />
                            </div>
                            <div className="w-px h-5 bg-gray-200" />
                            <button onClick={handleClearMask} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">清空</button>
                            <div className="w-px h-5 bg-gray-200" />
                            <button onClick={handleCancelMaskEdit} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                            <button
                              onClick={handleConfirmMaskEdit}
                              disabled={!hasMaskContent || (maskEditMode === 'repaint' && !repaintPrompt.trim())}
                              className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg"
                            >
                              {maskEditMode === 'erase' ? '擦除' : '重绘'}
                            </button>
                          </div>
                        </div>
                        {maskEditMode === 'repaint' && hasMaskContent && (
                          <div
                            className="absolute z-10"
                            style={{ right: -300 / scale, top: '50%', transform: `translateY(-50%) scale(${1 / scale})`, transformOrigin: 'left center' }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 px-4 py-2 min-w-[260px]">
                              <input
                                type="text"
                                value={repaintPrompt}
                                onChange={(e) => setRepaintPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && repaintPrompt.trim()) handleConfirmMaskEdit(); }}
                                placeholder="描述想重绘的内容..."
                                className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 text-sm placeholder-gray-400"
                                autoFocus
                              />
                              <button
                                onClick={handleConfirmMaskEdit}
                                disabled={!repaintPrompt.trim()}
                                className="ml-2 p-1.5 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors"
                              >
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        {!hasMaskContent && (
                          <div
                            className="absolute left-1/2 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full pointer-events-none"
                            style={{ bottom: -40 / scale, transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: 'top center' }}
                          >
                            {maskEditMode === 'erase' ? '涂抹要擦除的区域' : '涂抹要重绘的区域'}
                          </div>
                        )}
                      </>
                    )}
                    {/* 多图选中时显示序号 */}
                    {isSelected && selectedIds.filter(id => items.find(i => i.id === id && i.type === 'image')).length > 1 && !croppingImageId && !maskEditingId && (
                      <div
                        className="absolute top-2 left-2 bg-violet-500 text-white text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg pointer-events-none"
                        style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top left' }}
                      >
                        {selectedIds.filter(id => items.find(i => i.id === id && i.type === 'image')).indexOf(item.id) + 1}
                      </div>
                    )}
                  </>
                )}

                {/* 文字 */}
                {item.type === 'text' && (
                  editingTextId === item.id ? (
                    <textarea
                      autoFocus
                      value={item.src}
                      onChange={(e) => {
                        const newText = e.target.value;
                        const { width, height } = measureTextSize(
                          newText,
                          item.fontSize || 24,
                          item.fontFamily || '"Xiaolai SC", "Virgil", cursive',
                          String(item.fontWeight || 'normal')
                        );
                        setItems(prev => prev.map(i =>
                          i.id === item.id ? { ...i, src: newText, width, height } : i
                        ));
                      }}
                      onBlur={() => setEditingTextId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setEditingTextId(null);
                        }
                      }}
                      className="w-full h-full bg-transparent border-none outline-none resize-none p-2 no-scrollbar"
                      style={{
                        fontSize: item.fontSize || 24,
                        fontFamily: item.fontFamily || '"Xiaolai SC", "Virgil", cursive',
                        fontWeight: item.fontWeight || 'normal',
                        color: item.color || '#1f2937',
                        textAlign: item.textAlign || 'left',
                        lineHeight: 1.4,
                        whiteSpace: 'pre',
                      }}
                    />
                  ) : (
                    <div
                      className="w-full h-full p-2 cursor-text overflow-visible"
                      style={{
                        fontSize: item.fontSize || 24,
                        fontFamily: item.fontFamily || '"Xiaolai SC", "Virgil", cursive',
                        fontWeight: item.fontWeight || 'normal',
                        color: item.color || '#1f2937',
                        textAlign: item.textAlign || 'left',
                        lineHeight: 1.4,
                        whiteSpace: 'pre',
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingTextId(item.id);
                      }}
                    >
                      {item.src || ' '}
                    </div>
                  )
                )}

                {/* 矩形 */}
                {item.type === 'rectangle' && (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: item.fill || '#e5e7eb',
                      border: `${item.strokeWidth || 2}px solid ${item.stroke || '#9ca3af'}`,
                      borderRadius: item.borderRadius || 8,
                    }}
                  />
                )}

                {/* 圆形 */}
                {item.type === 'circle' && (
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      backgroundColor: item.fill || '#ddd6fe',
                      border: `${item.strokeWidth || 2}px solid ${item.stroke || '#a78bfa'}`,
                    }}
                  />
                )}

                {/* 画笔路径 */}
                {item.type === 'brush' && item.points && item.points.length > 0 && (() => {
                  const pathD = item.points.reduce((acc, point, i) => {
                    const x = point.x - item.x;
                    const y = point.y - item.y;
                    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                  }, '');
                  return (
                    <svg
                      className="absolute top-0 left-0 overflow-visible"
                      style={{ width: 1, height: 1 }}
                    >
                      {/* 透明点击区域 */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={Math.max(12, (item.strokeWidth || 3) + 8)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="cursor-pointer"
                        onMouseDown={(e) => { e.stopPropagation(); setSelectedIds([item.id]); }}
                      />
                      {/* 可见路径 */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={item.stroke || '#8b5cf6'}
                        strokeWidth={item.strokeWidth || 3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-none"
                      />
                    </svg>
                  );
                })()}

                {/* 直线 - 支持贝塞尔曲线和端点控制 */}
                {item.type === 'line' && item.startPoint && item.endPoint && (() => {
                  const sx = item.startPoint.x - item.x;
                  const sy = item.startPoint.y - item.y;
                  const ex = item.endPoint.x - item.x;
                  const ey = item.endPoint.y - item.y;
                  const ctrlX = item.controlPoint ? item.controlPoint.x - item.x : (sx + ex) / 2;
                  const ctrlY = item.controlPoint ? item.controlPoint.y - item.y : (sy + ey) / 2;
                  const hasControlPoint = !!item.controlPoint;
                  const midX = 0.25 * sx + 0.5 * ctrlX + 0.25 * ex;
                  const midY = 0.25 * sy + 0.5 * ctrlY + 0.25 * ey;
                  const pathD = hasControlPoint ? `M ${sx} ${sy} Q ${ctrlX} ${ctrlY} ${ex} ${ey}` : `M ${sx} ${sy} L ${ex} ${ey}`;
                  return (
                    <svg className="absolute overflow-visible" style={{ left: -offsetX, top: -offsetY, width: 1, height: 1 }}>
                      <path d={pathD} stroke="transparent" strokeWidth={Math.max(12, (item.strokeWidth || 3) + 8)} fill="none" strokeLinecap="round" className={isSelected ? "cursor-move" : "cursor-pointer"} onMouseDown={(e) => {
                        e.stopPropagation();
                        if (isSelected) {
                          setIsDragging(true);
                          setDragStart({ x: e.clientX, y: e.clientY });
                          setItemStart({ x: item.x, y: item.y });
                          const positions: Record<string, { x: number; y: number }> = {};
                          items.forEach(i => { if (selectedIds.includes(i.id)) positions[i.id] = { x: i.x, y: i.y }; });
                          setItemsStartPositions(positions);
                        } else {
                          setSelectedIds([item.id]);
                        }
                      }} />
                      <path d={pathD} stroke={item.stroke || '#6b7280'} strokeWidth={item.strokeWidth || 3} fill="none" strokeLinecap="round" className="pointer-events-none" />
                      {isSelected && (
                        <>
                          {/* 起点 */}
                          <g className="group/start cursor-move" onMouseDown={(e) => { e.stopPropagation(); handleLinePointDrag(e, item.id, 'start'); }}>
                            <circle cx={sx} cy={sy} r={10} fill="transparent" />
                            <circle cx={sx} cy={sy} r={8} fill="#6366f1" className="opacity-0 group-hover/start:opacity-20 transition-opacity" />
                            <circle cx={sx} cy={sy} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                          </g>
                          {/* 终点 */}
                          <g className="group/end cursor-move" onMouseDown={(e) => { e.stopPropagation(); handleLinePointDrag(e, item.id, 'end'); }}>
                            <circle cx={ex} cy={ey} r={10} fill="transparent" />
                            <circle cx={ex} cy={ey} r={8} fill="#6366f1" className="opacity-0 group-hover/end:opacity-20 transition-opacity" />
                            <circle cx={ex} cy={ey} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                          </g>
                          {/* 中点控制 */}
                          <g className="group/ctrl cursor-move" onMouseDown={(e) => { e.stopPropagation(); handleLinePointDrag(e, item.id, 'control'); }}>
                            <circle cx={midX} cy={midY} r={10} fill="transparent" />
                            <circle cx={midX} cy={midY} r={8} fill="#8b5cf6" className="opacity-0 group-hover/ctrl:opacity-25 transition-opacity" />
                            <circle cx={midX} cy={midY} r={4} fill="#8b5cf6" stroke="white" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                          </g>
                        </>
                      )}
                    </svg>
                  );
                })()}

                {/* 箭头 - 支持贝塞尔曲线和端点控制 */}
                {item.type === 'arrow' && item.startPoint && item.endPoint && (() => {
                  const sx = item.startPoint.x - item.x;
                  const sy = item.startPoint.y - item.y;
                  const ex = item.endPoint.x - item.x;
                  const ey = item.endPoint.y - item.y;
                  const ctrlX = item.controlPoint ? item.controlPoint.x - item.x : (sx + ex) / 2;
                  const ctrlY = item.controlPoint ? item.controlPoint.y - item.y : (sy + ey) / 2;
                  const hasControlPoint = !!item.controlPoint;
                  const midX = 0.25 * sx + 0.5 * ctrlX + 0.25 * ex;
                  const midY = 0.25 * sy + 0.5 * ctrlY + 0.25 * ey;
                  const pathD = hasControlPoint ? `M ${sx} ${sy} Q ${ctrlX} ${ctrlY} ${ex} ${ey}` : `M ${sx} ${sy} L ${ex} ${ey}`;
                  return (
                    <svg className="absolute overflow-visible" style={{ left: -offsetX, top: -offsetY, width: 1, height: 1 }}>
                      <defs>
                        <marker id={`arrowhead-${item.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill={item.stroke || '#6b7280'} />
                        </marker>
                      </defs>
                      <path d={pathD} stroke="transparent" strokeWidth={Math.max(12, (item.strokeWidth || 3) + 8)} fill="none" strokeLinecap="round" className={isSelected ? "cursor-move" : "cursor-pointer"} onMouseDown={(e) => {
                        e.stopPropagation();
                        if (isSelected) {
                          setIsDragging(true);
                          setDragStart({ x: e.clientX, y: e.clientY });
                          setItemStart({ x: item.x, y: item.y });
                          const positions: Record<string, { x: number; y: number }> = {};
                          items.forEach(i => { if (selectedIds.includes(i.id)) positions[i.id] = { x: i.x, y: i.y }; });
                          setItemsStartPositions(positions);
                        } else {
                          setSelectedIds([item.id]);
                        }
                      }} />
                      <path d={pathD} stroke={item.stroke || '#6b7280'} strokeWidth={item.strokeWidth || 3} fill="none" strokeLinecap="round" markerEnd={`url(#arrowhead-${item.id})`} className="pointer-events-none" />
                      {isSelected && (
                        <>
                          {/* 起点 */}
                          <g className="group/start cursor-move" onMouseDown={(e) => { e.stopPropagation(); handleLinePointDrag(e, item.id, 'start'); }}>
                            <circle cx={sx} cy={sy} r={10} fill="transparent" />
                            <circle cx={sx} cy={sy} r={8} fill="#6366f1" className="opacity-0 group-hover/start:opacity-20 transition-opacity" />
                            <circle cx={sx} cy={sy} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                          </g>
                          {/* 终点 */}
                          <g className="group/end cursor-move" onMouseDown={(e) => { e.stopPropagation(); handleLinePointDrag(e, item.id, 'end'); }}>
                            <circle cx={ex} cy={ey} r={10} fill="transparent" />
                            <circle cx={ex} cy={ey} r={8} fill="#6366f1" className="opacity-0 group-hover/end:opacity-20 transition-opacity" />
                            <circle cx={ex} cy={ey} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                          </g>
                          {/* 中点控制 */}
                          <g className="group/ctrl cursor-move" onMouseDown={(e) => { e.stopPropagation(); handleLinePointDrag(e, item.id, 'control'); }}>
                            <circle cx={midX} cy={midY} r={10} fill="transparent" />
                            <circle cx={midX} cy={midY} r={8} fill="#8b5cf6" className="opacity-0 group-hover/ctrl:opacity-25 transition-opacity" />
                            <circle cx={midX} cy={midY} r={4} fill="#8b5cf6" stroke="white" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                          </g>
                        </>
                      )}
                    </svg>
                  );
                })()}

                {/* 溯源连接线（贝塞尔曲线）*/}
                {item.type === 'connection' && item.startPoint && item.endPoint && (() => {
                  const sx = item.startPoint.x - item.x;
                  const sy = item.startPoint.y - item.y;
                  const ex = item.endPoint.x - item.x;
                  const ey = item.endPoint.y - item.y;
                  const dx = ex - sx;
                  const dy = ey - sy;
                  const isVertical = Math.abs(dy) > Math.abs(dx);
                  // 根据方向选择控制点偏移
                  const offset = isVertical ? Math.abs(dy) * 0.4 : Math.abs(dx) * 0.4;
                  const pathD = isVertical
                    ? `M ${sx} ${sy} C ${sx} ${sy + (dy > 0 ? offset : -offset)}, ${ex} ${ey + (dy > 0 ? -offset : offset)}, ${ex} ${ey}`
                    : `M ${sx} ${sy} C ${sx + (dx > 0 ? offset : -offset)} ${sy}, ${ex + (dx > 0 ? -offset : offset)} ${ey}, ${ex} ${ey}`;
                  return (
                    <svg
                      className="absolute overflow-visible pointer-events-none"
                      style={{
                        left: 0,
                        top: 0,
                        width: Math.max(item.width, 1),
                        height: Math.max(item.height, 1)
                      }}
                    >
                      <path
                        d={pathD}
                        stroke={item.stroke || '#a78bfa'}
                        strokeWidth={item.strokeWidth || 3}
                        fill="none"
                        strokeLinecap="round"
                        opacity="0.6"
                      />
                      {/* 起点圆点 */}
                      <circle cx={sx} cy={sy} r="4" fill={item.stroke || '#a78bfa'} opacity="0.8" />
                      {/* 终点圆点 */}
                      <circle cx={ex} cy={ey} r="4" fill={item.stroke || '#a78bfa'} opacity="0.8" />
                    </svg>
                  );
                })()}
                {/* Context Toolbar anchored to item - only for single selected images (not in mask editing mode) */}
                {isSelected && selectedIds.length === 1 && !isPanning && !isDragging && item.type === 'image' && !maskEditingId && (
                  <div className="absolute top-0 left-1/2" style={{ transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: 'bottom center' }}>
                    <FloatingToolbar
                      onUpscale={() => handleContextAction('upscale')}
                      onRemoveBg={() => handleContextAction('removeBg')}
                      onExpand={() => handleContextAction('expand')}
                      onEdit={(p) => handleContextAction('edit', p)}
                      onInpaint={() => handleOpenMaskEdit('erase')}
                      onRepaint={() => handleOpenMaskEdit('repaint')}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      isProcessing={processingIds.has(item.id)}
                    />
                  </div>
                )}
                {/* Simple delete button for non-image items (single select only) */}
              </div>
            );
          })}


          {/* 多选统一外框 */}
          {selectedIds.length > 1 && (() => {
            const selectedItems = items.filter(item => selectedIds.includes(item.id));
            if (selectedItems.length === 0) return null;

            const minX = Math.min(...selectedItems.map(item => item.x));
            const minY = Math.min(...selectedItems.map(item => item.y));
            const maxX = Math.max(...selectedItems.map(item => item.x + item.width));
            const maxY = Math.max(...selectedItems.map(item => item.y + item.height));

            const padding = 8;

            return (
              <div
                className="absolute"
                style={{
                  left: minX - padding,
                  top: minY - padding,
                  width: maxX - minX + padding * 2,
                  height: maxY - minY + padding * 2,
                }}
              >
                {/* 外发光 */}
                <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-md pointer-events-none" />
                {/* 边框 */}
                <div className="absolute inset-0 rounded-xl border-2 border-primary/60 border-dashed pointer-events-none" />
                {/* 四角手柄 */}
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, 'tl')} />
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, 'tr')} />
                <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, 'bl')} />
                <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, 'br')} />
                {/* 多选工具栏 */}
                {!isPanning && !isDragging && (
                  <div style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top center' }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
                      <button onClick={handleAIFusion} className="px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg shadow-lg text-white hover:from-violet-600 hover:to-purple-700 transition-all flex items-center gap-2 group" title="AI 融合 - 将选中元素作为参考生成新图像">
                        <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
                        <span className="text-xs font-medium">AI 融合</span>
                        <Sparkles size={12} className="opacity-70" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );          })()}

          {/* AI 生成中 Loading 状态 - 在画布内渲染 */}
          {isProcessing && loadingPosition && (
            <>
              {/* 临时连接线：从参考图片到占位框（就近原则）*/}
              {loadingSourceIds.length > 0 && (() => {
                // 计算统一终点
                const sourceItems = loadingSourceIds
                  .map(id => items.find(i => i.id === id))
                  .filter((s): s is CanvasItem => !!s);
                if (sourceItems.length === 0) return null;

                const gap = 12;
                const avgX = sourceItems.reduce((sum, s) => sum + s.x + s.width / 2, 0) / sourceItems.length;
                const avgY = sourceItems.reduce((sum, s) => sum + s.y + s.height / 2, 0) / sourceItems.length;
                const tCx = loadingPosition.x + loadingPosition.width / 2;
                const tCy = loadingPosition.y + loadingPosition.height / 2;
                const ddx = tCx - avgX;
                const ddy = tCy - avgY;
                const isVertical = Math.abs(ddy) > Math.abs(ddx);
                // 统一终点
                const fixedEndX = !isVertical
                  ? (ddx > 0 ? loadingPosition.x - gap : loadingPosition.x + loadingPosition.width + gap)
                  : tCx;
                const fixedEndY = isVertical
                  ? (ddy > 0 ? loadingPosition.y - gap : loadingPosition.y + loadingPosition.height + gap)
                  : tCy;

                return sourceItems.map(sourceItem => {
                  const sCx = sourceItem.x + sourceItem.width / 2;
                  const sCy = sourceItem.y + sourceItem.height / 2;
                  const dx = fixedEndX - sCx;
                  const dy = fixedEndY - sCy;
                  const startX = !isVertical
                    ? (dx > 0 ? sourceItem.x + sourceItem.width + gap : sourceItem.x - gap)
                    : sCx;
                  const startY = isVertical
                    ? (dy > 0 ? sourceItem.y + sourceItem.height + gap : sourceItem.y - gap)
                    : sCy;

                  const svgX = Math.min(startX, fixedEndX) - 20;
                  const svgY = Math.min(startY, fixedEndY) - 20;
                  const svgW = Math.abs(fixedEndX - startX) + 40;
                  const svgH = Math.abs(fixedEndY - startY) + 40;
                  const sx = startX - svgX;
                  const sy = startY - svgY;
                  const ex = fixedEndX - svgX;
                  const ey = fixedEndY - svgY;
                  const offset = isVertical ? Math.abs(ey - sy) * 0.4 : Math.abs(ex - sx) * 0.4;
                  const pathD = isVertical
                    ? `M ${sx} ${sy} C ${sx} ${sy + (dy > 0 ? offset : -offset)}, ${ex} ${ey + (dy > 0 ? -offset : offset)}, ${ex} ${ey}`
                    : `M ${sx} ${sy} C ${sx + (dx > 0 ? offset : -offset)} ${sy}, ${ex + (dx > 0 ? -offset : offset)} ${ey}, ${ex} ${ey}`;

                  return (
                    <svg
                      key={sourceItem.id}
                      className="absolute overflow-visible pointer-events-none"
                      style={{ left: svgX, top: svgY, width: svgW, height: svgH }}
                    >
                      <path
                        d={pathD}
                        stroke="#a78bfa"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        opacity="0.6"
                        strokeDasharray="6 4"
                      />
                      {/* 起点圆点 */}
                      <circle cx={sx} cy={sy} r="4" fill="#a78bfa" opacity="0.7" />
                      {/* 终点圆点 */}
                      <circle cx={ex} cy={ey} r="4" fill="#a78bfa" opacity="0.7" />
                    </svg>
                  );
                });
              })()}
              <div
                className="absolute rounded-xl cursor-move bg-gray-50 border-2 border-dashed border-gray-300 z-50"
                style={{
                  left: loadingPosition.x,
                  top: loadingPosition.y,
                  width: loadingPosition.width,
                  height: loadingPosition.height,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startPosX = loadingPosition.x;
                  const startPosY = loadingPosition.y;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const dx = (moveEvent.clientX - startX) / scale;
                    const dy = (moveEvent.clientY - startY) / scale;
                    const newPos = {
                      ...loadingPosition,
                      x: startPosX + dx,
                      y: startPosY + dy,
                    };
                    setLoadingPosition(newPos);
                    loadingPositionRef.current = newPos;
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  <p className="text-gray-500 text-sm font-medium">生成中...</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 框选矩形 */}
        {isSelecting && (
          <div
            className="fixed border-2 border-violet-400 bg-violet-400/10 rounded pointer-events-none z-50"
            style={{
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y),
            }}
          />
        )}

        {/* 拖放提示 */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border-2 border-dashed border-violet-400">
              <p className="text-violet-600 font-medium">松开鼠标放置图片</p>
            </div>
          </div>
        )}

        {/* --- Empty State / Onboarding --- */}
        {items.length === 0 && !isProcessing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
            <div className="pointer-events-auto text-center max-w-md">
              {/* 三傻Logo */}
              <div className="mb-6 flex justify-center">
                <Logo size={72} showText={false} />
              </div>

              {/* 欢迎文案 */}
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                三傻来帮你搞创作！
              </h2>
              <p className="text-gray-500 mb-8">
                在下方输入你想要的画面，或者点击试试我们的灵感
              </p>

              {/* 灵感按钮 */}
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { label: '🌃 赛博城市', prompt: '赛博朋克风格的未来城市夜景，霓虹灯，雨天，高楼大厦' },
                  { label: '🧸 毛绒玩偶', prompt: '一只毛茸茸的小熊玩偶，柔软材质，暖色调，可爱' },
                  { label: '🎨 水墨山水', prompt: '中国水墨画风格的山水画，云雾缭绕，意境深远' },
                  { label: '🚀 太空探索', prompt: '宇航员在外太空漂浮，地球背景，星空璀璨' },
                  { label: '🍜 美食诱惑', prompt: '一碗热气腾腾的拉面，精致摆盘，食欲满满' },
                  { label: '🐱 萌宠日常', prompt: '一只橘猫慵懒地躺在阳光下，毛发蓬松，眯眼享受' },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(item.prompt)}
                    className="px-4 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all duration-200 shadow-sm hover:shadow"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 提示 */}
              <p className="mt-8 text-xs text-gray-400">
                💡 也可以直接拖拽图片到画布，或使用左侧工具开始创作
              </p>
            </div>
          </div>
        )}

      </div>

      {/* --- Left Bottom Zoom Controls --- */}
      <div className="fixed bottom-4 left-4 flex items-center gap-1 bg-white border border-gray-200 shadow-float rounded-lg p-1 z-50">
        <button
          onClick={() => handleZoom(-0.05)}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="缩小"
        >
          <ZoomOut size={18} />
        </button>
        <span className="px-2 py-1 min-w-[50px] text-center text-sm font-medium text-gray-600">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => handleZoom(0.05)}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="放大"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* --- Right Bottom: 问三傻 --- */}
      <button
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl shadow-sm transition-colors"
        style={{ backgroundColor: '#1F2937' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#111827'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1F2937'}
        onClick={() => setIsChatOpen(!isChatOpen)}
      >
        <div className="w-5 h-5 rounded-lg bg-white/90 flex items-center justify-center">
          <Logo size={14} showText={false} />
        </div>
        <span className="text-sm font-semibold text-white">问三傻</span>
      </button>

      {/* --- Bottom Controls --- */}
      <div className="fixed bottom-8 left-0 right-0 px-8 flex items-center justify-center z-50 pointer-events-none">

        {/* Center: Generation Bar */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5 max-w-md w-full">

          {/* Settings Popover */}
          {showSettings && (
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-100 w-full mb-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-4">
                {/* 宽高比 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded border-2 border-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">宽高比</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: '1:1', icon: 'aspect-square' },
                      { value: '4:3', icon: 'aspect-4-3' },
                      { value: '3:4', icon: 'aspect-3-4' },
                      { value: '16:9', icon: 'aspect-wide' },
                      { value: '9:16', icon: 'aspect-tall' },
                      { value: '3:2', icon: 'aspect-3-2' },
                      { value: '2:3', icon: 'aspect-2-3' },
                      { value: '21:9', icon: 'aspect-ultra' },
                    ].map(r => {
                      const [w, h] = r.value.split(':').map(Number);
                      const ratio = w / h;
                      const boxW = ratio >= 1 ? 20 : 20 * ratio;
                      const boxH = ratio >= 1 ? 20 / ratio : 20;
                      return (
                        <button
                          key={r.value}
                          onClick={() => setAspectRatio(r.value)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${aspectRatio === r.value
                            ? 'bg-primary/10 ring-2 ring-primary/30'
                            : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                        >
                          <div
                            className={`rounded-sm ${aspectRatio === r.value ? 'bg-primary' : 'bg-gray-400'}`}
                            style={{ width: boxW, height: boxH }}
                          />
                          <span className={`text-[10px] font-medium ${aspectRatio === r.value ? 'text-primary' : 'text-gray-500'}`}>
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
                    {[
                      { value: '720', label: '720p', sub: '极速' },
                      { value: '1K', label: '1K', sub: '快速' },
                      { value: '1080', label: '1080p', sub: '标准' },
                      { value: '2K', label: '2K', sub: '高清' },
                      { value: '4K', label: '4K', sub: '超清' },
                    ].map(r => (
                      <button
                        key={r.value}
                        onClick={() => setResolution(r.value)}
                        className={`flex flex-col items-center p-1.5 rounded-lg transition-all ${resolution === r.value
                          ? 'bg-primary/10 ring-2 ring-primary/30'
                          : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                      >
                        <span className={`text-[10px] font-semibold ${resolution === r.value ? 'text-primary' : 'text-gray-700'}`}>
                          {r.label}
                        </span>
                        <span className={`text-[8px] ${resolution === r.value ? 'text-primary/70' : 'text-gray-400'}`}>
                          {r.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 w-full">
            {/* 加号按钮和弹出菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className={`p-2.5 rounded-full transition-all bg-white shadow-float border border-gray-200 ${showAddMenu ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Plus size={18} className={`transition-transform ${showAddMenu ? 'rotate-45' : ''}`} />
              </button>
              {/* 弹出菜单 */}
              {showAddMenu && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex gap-2 bg-white rounded-full shadow-lg p-1.5">
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowAddMenu(false); }}
                    className="p-2.5 rounded-full hover:bg-violet-50 text-gray-600 hover:text-violet-600 transition-colors"
                    title="上传图片"
                  >
                    <ImagePlus size={18} />
                  </button>
                  <button
                    onClick={() => { openCamera(); setShowAddMenu(false); }}
                    className="p-2.5 rounded-full hover:bg-violet-50 text-gray-600 hover:text-violet-600 transition-colors"
                    title="打开摄像头"
                  >
                    <Camera size={18} />
                  </button>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
            </div>

            {/* 输入框 */}
            <div className="flex-1 bg-white p-3 rounded-3xl shadow-float border border-gray-200 transition-all duration-300 ease-out hover:shadow-lg ring-1 ring-transparent focus-within:ring-violet-200">
              {/* 选中图片预览（多参考图模式） */}
              {selectedIds.length > 0 && (() => {
                const selectedImages = items.filter(item => selectedIds.includes(item.id) && item.type === 'image');
                if (selectedImages.length === 0) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2 mb-3 px-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* 图片预览列表 */}
                    {selectedImages.map((img, index) => (
                      <div
                        key={img.id}
                        className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm border-2 border-violet-300 animate-in zoom-in-75 fade-in duration-200 cursor-pointer group hover:border-violet-400 transition-colors"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => setSelectedIds(prev => prev.filter(id => id !== img.id))}
                        title="点击移除"
                      >
                        <img src={img.src} alt="" className="w-full h-full object-cover" />
                        {/* 序号标识 */}
                        <div className="absolute top-0.5 left-0.5 bg-violet-500 text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center shadow">
                          {index + 1}
                        </div>
                        {/* 移除按钮（hover 时显示） */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <X className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ))}
                    {/* 选中数量提示 */}
                    <span className="text-xs text-gray-500 ml-1">
                      已选 {selectedImages.length}/5 张参考图
                    </span>
                  </div>
                );
              })()}

              <div className="flex items-center gap-1">
                <input
                  className="flex-1 bg-transparent border-none focus:outline-none text-gray-800 placeholder-gray-400 text-sm px-2"
                  placeholder={selectedIds.length > 0 ? "你想怎么修改？" : "你想创作什么？"}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleGenerate()}
                />

                {/* Settings Toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-full transition-colors ${showSettings ? 'bg-violet-100 text-violet-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Settings2 size={16} />
                </button>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isProcessing || !prompt.trim()}
                  className={`p-2 rounded-full transition-all duration-300 ${isProcessing || !prompt.trim()
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-violet-500 hover:bg-violet-600 text-white shadow-md'
                    }`}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 摄像头弹窗 */}
      {showCamera && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[100]">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-gray-800" style={{ width: '560px' }}>
            {/* 视频预览 */}
            <div className="relative aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
              {/* 关闭按钮 */}
              <button
                onClick={closeCamera}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-700/80 text-white hover:bg-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
              {/* 拍照按钮 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button
                  onClick={takePhoto}
                  className="w-14 h-14 rounded-full bg-white/90 hover:bg-white transition-colors shadow-lg flex items-center justify-center"
                >
                  <div className="w-11 h-11 rounded-full bg-gray-200" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot 面板 */}
      <ChatbotPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        canvasItems={items}
        selectedIds={selectedIds}
      />

      {/* AI 融合面板 */}
      {showFusionPanel && fusionReferenceImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* 头部 */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Wand2 size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">AI 融合创作</h3>
                  <p className="text-sm text-white/80">基于选中元素生成新图像</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowFusionPanel(false);
                  setFusionReferenceImage(null);
                  setFusionPrompt('');
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-6 space-y-6">
              {/* 参考图预览 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  参考画面 <span className="text-gray-400 font-normal">（已选中元素的截图）</span>
                </label>
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={fusionReferenceImage}
                    alt="参考图"
                    className="w-full max-h-64 object-contain"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-md">
                    {selectedIds.length} 个元素
                  </div>
                </div>
              </div>

              {/* 创意描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  创意描述 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={fusionPrompt}
                  onChange={(e) => setFusionPrompt(e.target.value)}
                  placeholder="描述你想要的融合效果，例如：将这些元素融合成一幅赛博朋克风格的插画，保持原有的构图但增加霓虹灯效果..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none transition-all"
                  rows={3}
                  autoFocus
                />
              </div>

              {/* 快捷提示词 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  风格参考
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    '保持原有构图',
                    '融合成一体',
                    '赛博朋克风格',
                    '水彩画风格',
                    '3D渲染效果',
                    '增加光影效果',
                    '复古胶片风',
                    '极简线条',
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFusionPrompt(prev => prev ? `${prev}，${tag}` : tag)}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-violet-100 text-gray-600 hover:text-violet-700 rounded-full transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                融合生成的图片将放置在选中区域右侧
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFusionPanel(false);
                    setFusionReferenceImage(null);
                    setFusionPrompt('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={executeAIFusion}
                  disabled={!fusionPrompt.trim()}
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    fusionPrompt.trim()
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={16} />
                  开始融合
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 协作者光标 */}
      <CollaboratorCursors
        cursors={remoteCursors}
        scale={scale}
        pan={pan}
      />

      <CanvasOnboarding
        onSelectTemplate={handleTemplateSelect}
        onClose={() => { }}
      />

      {/* 隐藏的文字测量元素 */}
      <div
        ref={textMeasureRef}
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
