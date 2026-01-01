import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Copy, RotateCcw, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { CanvasOnboarding } from './CanvasOnboarding';
import { FloatingToolbar } from './FloatingToolbar';
import { ImageAdjustPanel, getImageFilterStyle, getImageTransformStyle, getImageBorderStyle, getImageOverlayStyle } from './ImageAdjustPanel';
import { CollaboratorCursors } from './Collaboration';
import { CanvasItem, ToolMode, Project } from '../types';
import * as API from '../services/api';
import * as ProjectService from '../services/projectService';
import { ChatbotPanel } from './chatbot';
import { generateId } from '../utils/id';
import { useCollaboration, useCropping, useMaskEditing, useClipboard, useObscureEffect } from '../hooks';
import { ObscureEditOverlay } from './ObscureEditOverlay';
import {
  CanvasHeader,
  CanvasToolbar,
  CanvasLayers,
  ChatButton,
  SelectionRect,
  DragOverlay,
  CameraModal,
  GenerationBar,
  useConnectionLines,
  useCanvasInteraction,
  useKeyboardShortcuts,
} from './Canvas';
import {
  DEFAULT_IMAGE_SIZE,
  MIN_SCALE,
  MAX_SCALE,
  MAX_DISPLAY_SIZE,
} from '../constants/canvas';

interface CanvasEditorProps {
  project: Project;
  onBack: () => void;
  onLogout?: () => void;
  user?: {
    id: string;
    nickname: string;
    avatar?: string;
  } | null;
}

export function CanvasEditor({ project, onBack, onLogout: _onLogout, user: _user }: CanvasEditorProps) {
  // --- State ---
  const [items, setItems] = useState<CanvasItem[]>(project.items);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.SELECT);
  const [lastShapeTool] = useState<ToolMode>(ToolMode.RECTANGLE);
  const [projectName, setProjectName] = useState(project.name);

  // Viewport state
  const [scale, setScale] = useState(project.viewport?.scale || 1);
  const [pan, setPan] = useState(project.viewport?.pan || { x: 0, y: 0 });

  // Generation State
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2K");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());  // 正在处理的图片 ID
  const [showSettings, setShowSettings] = useState(false);
  // 并发生成任务列表
  const [generatingTasks, setGeneratingTasks] = useState<Array<{
    id: string;
    position: { x: number; y: number; width: number; height: number };
    sourceIds: string[];
  }>>([]);
  // 用 ref 保持最新的任务列表，供异步回调访问
  const generatingTasksRef = useRef(generatingTasks);
  useEffect(() => {
    generatingTasksRef.current = generatingTasks;
  }, [generatingTasks]);

  // 各工具的颜色
  const [toolColors, setToolColors] = useState({
    brush: '#000000', line: '#000000', arrow: '#000000', rectangle: '#000000', circle: '#000000',
  });
  const setToolColor = (mode: ToolMode, color: string) => {
    if (mode === ToolMode.BRUSH) setToolColors(p => ({ ...p, brush: color }));
    else if (mode === ToolMode.LINE) setToolColors(p => ({ ...p, line: color }));
    else if (mode === ToolMode.ARROW) setToolColors(p => ({ ...p, arrow: color }));
    else if (mode === ToolMode.RECTANGLE) setToolColors(p => ({ ...p, rectangle: color }));
    else if (mode === ToolMode.CIRCLE) setToolColors(p => ({ ...p, circle: color }));
  };

  // 摄像头状态
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode] = useState<'user' | 'environment'>('user');

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

  // 快速双击检测（用于图片裁剪）
  const lastImageClickRef = useRef<{ time: number; itemId: string } | null>(null);
  const DOUBLE_CLICK_THRESHOLD = 300; // 300ms 内的两次点击视为双击

  // Chatbot 状态
  const [isChatOpen, setIsChatOpen] = useState(false);

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

  // 马赛克/模糊遮挡（使用 hook）
  const {
    obscureEditingId,
    obscureEffectType,
    obscureBrushSize,
    setObscureBrushSize,
    obscureIntensity,
    setObscureIntensity,
    isObscureDrawing,
    setIsObscureDrawing,
    hasObscureContent,
    obscureCanvasRef,
    effectCanvasRef,
    openObscureEdit,
    cancelObscureEdit,
    clearObscure,
    confirmObscureEdit,
    drawObscureBrush,
    resetLastPoint: resetObscureLastPoint,
  } = useObscureEffect({
    items,
    setItems,
    setProcessingIds,
  });

  // 图片调整面板状态
  const [adjustingImageId, setAdjustingImageId] = useState<string | null>(null);

  // 选择变化时关闭调整面板
  useEffect(() => {
    if (adjustingImageId && !selectedIds.includes(adjustingImageId)) {
      setAdjustingImageId(null);
    }
  }, [selectedIds, adjustingImageId]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
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
  const { clipboard, copy, cut, paste, duplicate, clearClipboard } = useClipboard({
    items,
    setItems,
    selectedIds,
    setSelectedIds,
    getMousePosition: () => mousePositionRef.current,
  });

  // 计算生图消耗的傻币
  const getGenerateCreditCost = (res: string): number => {
    const costs: Record<string, number> = {
      '720p': 2,
      '1K': 4,
      '2K': 6,
      '4K': 8,
    };
    return costs[res] || 4;
  };

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

  // 连接线管理
  const {
    calcUnifiedEndPoint,
    createConnectionCurve,
    updateConnectionsRealtime,
    updateConnections,
  } = useConnectionLines({ items, setItems });

  // 画布交互管理
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleResizeStart,
    handleLinePointDrag,
    isDragging,
    isResizing: _isResizing,
    isPanning,
    isSelecting,
    selectionStart,
    selectionEnd,
    mousePositionRef,
    setIsDragging,
    setDragStart,
    setItemStart,
    setItemsStartPositions,
    setLinePointDrag,
  } = useCanvasInteraction({
    items,
    setItems,
    selectedIds,
    setSelectedIds,
    toolMode,
    setToolMode,
    scale,
    pan,
    setPan,
    toolColors,
    croppingImageId,
    applyCrop,
    setEditingTextId,
    isCollabConnected,
    sendCursorMove,
    updateConnectionsRealtime,
    updateConnections,
  });

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

          // 延迟一帧后触发生成
          setTimeout(async () => {
            // 计算 loading 占位区域位置（画布中心）
            const displaySize = DEFAULT_IMAGE_SIZE;
            const loadingX = -pan.x / scale - displaySize / 2;
            const loadingY = -pan.y / scale - displaySize / 2;
            const initialPosition = { x: loadingX, y: loadingY, width: displaySize, height: displaySize };

            // 创建任务
            const taskId = generateId();
            setGeneratingTasks(prev => [...prev, { id: taskId, position: initialPosition, sourceIds: [] }]);

            try {
              const newImageSrc = await API.generateImage({
                prompt: pendingPromptText,
                aspectRatio: '1:1',
              });

              const img = new window.Image();
              img.onload = () => {
                // 从 ref 获取最新的任务位置
                const task = generatingTasksRef.current.find(t => t.id === taskId);
                const finalX = task?.position.x ?? loadingX;
                const finalY = task?.position.y ?? loadingY;

                const newItem: CanvasItem = {
                  id: generateId(),
                  type: 'image',
                  src: newImageSrc,
                  x: finalX,
                  y: finalY,
                  width: displaySize,
                  height: displaySize,
                  zIndex: 999,
                  prompt: pendingPromptText
                };
                // 分开调用 setState，避免嵌套
                setItems(prevItems => [...prevItems, newItem]);
                setSelectedIds([newItem.id]);
                setGeneratingTasks(prev => prev.filter(t => t.id !== taskId));
              };
              img.onerror = () => {
                console.error('Image load failed:', newImageSrc);
                setGeneratingTasks(prev => prev.filter(t => t.id !== taskId));
              };
              img.src = newImageSrc;
            } catch (error) {
              console.error('Auto-generate failed:', error);
              alert(error instanceof Error ? error.message : '生成失败，请检查后端服务是否正常运行。');
              setGeneratingTasks(prev => prev.filter(t => t.id !== taskId));
            }
          }, 100);
        }
      } catch (e) {
        localStorage.removeItem('pendingPrompt');
      }
    }
  }, [project.id]);

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

  // 键盘快捷键
  useKeyboardShortcuts({
    items,
    setItems,
    selectedIds,
    setSelectedIds,
    editingTextId,
    toolMode,
    setToolMode,
    lastShapeTool,
    clipboard,
    copy,
    cut,
    paste,
    duplicate,
    mousePositionRef,
    measureTextSize,
  });

  // --- Actions ---

  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(MIN_SCALE, prev + delta), MAX_SCALE));
  };

  // 自动定位到指定图片（带动画）
  const autoZoomToImage = (item: CanvasItem) => {
    // 计算图片中心点
    const centerX = item.x + (item.width || 200) / 2;
    const centerY = item.y + (item.height || 200) / 2;
    // 设置合适的缩放级别（确保图片可见）
    const targetScale = 1;
    // 计算 pan 使图片中心在屏幕中心
    const targetPanX = -centerX * targetScale;
    const targetPanY = -centerY * targetScale;

    // 平滑动画过渡
    const startScale = scale;
    const startPanX = pan.x;
    const startPanY = pan.y;
    const duration = 500; // 500ms 动画
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // 使用 easeOutCubic 缓动函数
      const eased = 1 - Math.pow(1 - progress, 3);

      setScale(startScale + (targetScale - startScale) * eased);
      setPan({
        x: startPanX + (targetPanX - startPanX) * eased,
        y: startPanY + (targetPanY - startPanY) * eased,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    // 选中该图片
    setSelectedIds([item.id]);
  };

  // 打开摄像头
  const openCamera = () => {
    setShowCamera(true);
  };

  // 处理摄像头拍照
  const handleCameraCapture = (imageData: string) => {
    const newItem: CanvasItem = {
      id: generateId(),
      type: 'image',
      src: imageData,
      x: -pan.x / scale - 200,
      y: -pan.y / scale - 150,
      width: 400,
      height: 300,
      zIndex: items.length + 1,
    };
    setItems(prev => [...prev, newItem]);
    setSelectedIds([newItem.id]);
  };

  // 处理文件选择（供 GenerationBar 使用）
  const handleFileSelect = (file: File) => {
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
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // 保存当前提示词并立即清空输入框
    const currentPrompt = prompt.trim();
    setPrompt("");

    // 计算 loading 占位区域的位置和尺寸（在视口中心，支持错开）
    const displaySize = DEFAULT_IMAGE_SIZE;
    const [w, h] = aspectRatio.split(':').map(Number);
    const ratio = w / h;
    const width = ratio >= 1 ? displaySize : displaySize * ratio;
    const height = ratio >= 1 ? displaySize / ratio : displaySize;
    // 根据现有任务数量错开位置
    const offset = generatingTasks.length * 30;
    const loadingX = -pan.x / scale - width / 2 + offset;
    const loadingY = -pan.y / scale - height / 2 + offset;
    const initialPosition = { x: loadingX, y: loadingY, width, height };

    // 获取所有选中的图片（支持多参考图）
    const selectedImages = selectedIds.length > 0
      ? items.filter(item => selectedIds.includes(item.id) && item.type === 'image')
      : [];

    // 创建任务 ID 并添加到任务列表
    const taskId = generateId();
    const newTask = {
      id: taskId,
      position: initialPosition,
      sourceIds: selectedImages.map(img => img.id),
    };
    setGeneratingTasks(prev => [...prev, newTask]);

    // 保存当前 aspectRatio 和 resolution 供闭包使用
    const currentAspectRatio = aspectRatio;
    const currentResolution = resolution;

    try {
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
          aspectRatio: currentAspectRatio,
          size: currentResolution,
        });
      }

      // 统一处理：创建新图片添加到画布
      const img = new window.Image();
      img.onload = () => {
        // 从 ref 获取最新的任务位置
        const task = generatingTasksRef.current.find(t => t.id === taskId);
        const finalX = task?.position.x ?? loadingX;
        const finalY = task?.position.y ?? loadingY;

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
          zIndex: 999,
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

        // 添加图片和连接线
        setItems(prevItems => [...prevItems, ...connectionLines, newItem]);
        setSelectedIds([newItem.id]);
        // 移除完成的任务
        setGeneratingTasks(prev => prev.filter(t => t.id !== taskId));
      };
      img.onerror = () => {
        console.error('Image load failed:', newImageSrc);
        setGeneratingTasks(prev => prev.filter(t => t.id !== taskId));
      };
      img.src = newImageSrc; // 必须设置 src 才能触发 onload

    } catch (error) {
      console.error(error);
      alert("处理失败，请检查后端服务是否正常运行。");
      // 移除失败的任务
      setGeneratingTasks(prev => prev.filter(t => t.id !== taskId));
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

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // 双指捏合缩放 - 以鼠标位置为焦点
      // preventDefault 由原生事件监听器处理（useEffect 中设置 passive: false）
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

  // --- Render ---

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-text overflow-hidden font-sans">

      {/* --- Top Bar --- */}
      <CanvasHeader
        projectId={project.id}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onBack={onBack}
        collaborators={collaborators}
        isConnected={isCollabConnected}
        myColor={myColor}
      />

      {/* --- 图层面板 --- */}
      <CanvasLayers
        items={items}
        selectedIds={selectedIds}
        onSelect={autoZoomToImage}
        onDelete={(id) => {
          setItems(prev => prev.filter(i => i.id !== id));
          setSelectedIds(prev => prev.filter(sid => sid !== id));
        }}
      />

      {/* --- Left Tool Rail --- */}
      <CanvasToolbar
        toolMode={toolMode}
        onToolModeChange={setToolMode}
        toolColors={toolColors}
        onToolColorChange={setToolColor}
      />

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
                  zIndex: (maskEditingId === item.id || obscureEditingId === item.id || isSelected) ? 9999 : item.zIndex,
                  overflow: item.type === 'text' ? 'visible' : undefined,
                }}
              >
                {/* 非图片类型的选中边框 - 单选时显示完整边框和手柄 */}
                {isSelected && selectedIds.length === 1 && croppingImageId !== item.id && item.type !== 'line' && item.type !== 'arrow' && item.type !== 'image' && (
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
                    {/* 边缘手柄 - 上下左右 */}
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-primary rounded-full shadow-md cursor-ns-resize hover:scale-110 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 't')}
                    />
                    <div
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-primary rounded-full shadow-md cursor-ns-resize hover:scale-110 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'b')}
                    />
                    <div
                      className="absolute top-1/2 -left-3 -translate-y-1/2 w-3 h-6 bg-white border-2 border-primary rounded-full shadow-md cursor-ew-resize hover:scale-110 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'l')}
                    />
                    <div
                      className="absolute top-1/2 -right-3 -translate-y-1/2 w-3 h-6 bg-white border-2 border-primary rounded-full shadow-md cursor-ew-resize hover:scale-110 transition-transform"
                      onMouseDown={(e) => handleResizeStart(e, 'r')}
                    />
                  </>
                )}
                {/* 非图片类型的悬停边框 */}
                {!isSelected && item.type !== 'line' && item.type !== 'arrow' && item.type !== 'brush' && item.type !== 'image' && (
                  <div className="absolute -inset-1 rounded-xl border border-transparent group-hover:border-gray-300 pointer-events-none transition-colors" />
                )}
                {/* 图片 - 带旋转容器，使边框跟随旋转 */}
                {item.type === 'image' && (
                  <div
                    className="w-full h-full"
                    style={isCropping ? undefined : getImageTransformStyle(item)}
                  >
                    {/* 图片选中边框 */}
                    {isSelected && selectedIds.length === 1 && croppingImageId !== item.id && (
                      <>
                        {/* 外发光 */}
                        <div className="absolute -inset-3 rounded-2xl bg-primary/10 blur-md pointer-events-none" />
                        {/* 边框 */}
                        <div className="absolute -inset-2 rounded-xl border-2 border-primary/60 pointer-events-none" />
                        {/* 四角手柄 */}
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
                    {/* 图片悬停边框 */}
                    {!isSelected && (
                      <div className="absolute -inset-1 rounded-xl border border-transparent group-hover:border-gray-300 pointer-events-none transition-colors" />
                    )}
                    <img
                      data-item-id={item.id}
                      src={isCropping ? (item.originalSrc || item.src) : item.src}
                      alt="canvas item"
                      className={`w-full h-full rounded-lg cursor-pointer ${isCropping ? 'opacity-40' : 'object-cover'}`}
                      style={isCropping ? undefined : { ...getImageFilterStyle(item), ...getImageBorderStyle(item) }}
                      draggable={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        // 快速双击检测
                        const now = Date.now();
                        const lastClick = lastImageClickRef.current;
                        if (lastClick && lastClick.itemId === item.id && now - lastClick.time < DOUBLE_CLICK_THRESHOLD) {
                          // 双击触发裁剪
                          if (!croppingImageId) {
                            startCropping(item.id);
                          }
                          lastImageClickRef.current = null;
                        } else {
                          // 记录本次点击
                          lastImageClickRef.current = { time: now, itemId: item.id };
                        }
                      }}
                    />
                    {/* 晕影/颗粒覆盖层 */}
                    {!isCropping && (() => {
                      const overlays = getImageOverlayStyle(item);
                      return (
                        <>
                          {overlays.vignette && <div style={overlays.vignette} />}
                          {overlays.grain && <div style={overlays.grain} />}
                        </>
                      );
                    })()}
                    {/* 水印 */}
                    {!isCropping && item.watermarkText && (
                      <div
                        className="absolute pointer-events-none select-none"
                        style={{
                          ...(item.watermarkPosition === 'top-left' ? { top: 8, left: 8 } :
                             item.watermarkPosition === 'top-right' ? { top: 8, right: 8 } :
                             item.watermarkPosition === 'center' ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } :
                             item.watermarkPosition === 'bottom-left' ? { bottom: 8, left: 8 } :
                             { bottom: 8, right: 8 }),
                          fontSize: item.watermarkSize ?? 16,
                          color: item.watermarkColor ?? '#ffffff',
                          opacity: (item.watermarkOpacity ?? 80) / 100,
                          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                          fontWeight: 500,
                        }}
                      >
                        {item.watermarkText}
                      </div>
                    )}
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
                            cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${maskBrushSize}' height='${maskBrushSize}' viewBox='0 0 ${maskBrushSize} ${maskBrushSize}'%3E%3Cdefs%3E%3CradialGradient id='g'%3E%3Cstop offset='0%25' stop-color='rgba(59,130,246,0.5)'/%3E%3Cstop offset='100%25' stop-color='rgba(59,130,246,0.15)'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='${maskBrushSize/2}' cy='${maskBrushSize/2}' r='${maskBrushSize/2 - 1}' fill='url(%23g)' stroke='white' stroke-width='1.5'/%3E%3Ccircle cx='${maskBrushSize/2}' cy='${maskBrushSize/2}' r='${maskBrushSize/2 - 1}' fill='none' stroke='rgba(59,130,246,0.4)' stroke-width='0.5'/%3E%3Ccircle cx='${maskBrushSize/2}' cy='${maskBrushSize/2}' r='2' fill='white'/%3E%3C/svg%3E") ${maskBrushSize/2} ${maskBrushSize/2}, crosshair`,
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
                            top: -56 / scale,
                            transform: `translateX(-50%) scale(${1 / scale})`,
                            transformOrigin: 'bottom center',
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl px-2 py-1.5 flex items-center gap-1 shadow-lg">
                            {/* 画笔大小 */}
                            <div className="flex items-center gap-2 px-2">
                              <input
                                type="range"
                                min="5"
                                max="100"
                                value={maskBrushSize}
                                onChange={(e) => setMaskBrushSize(Number(e.target.value))}
                                className="w-20 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-violet-500"
                              />
                              <span className="text-xs text-gray-500 w-6 tabular-nums">{maskBrushSize}</span>
                            </div>

                            {/* 分隔线 */}
                            <div className="w-px h-5 bg-gray-200" />

                            {/* 取消 */}
                            <button
                              onClick={handleCancelMaskEdit}
                              className="px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              取消
                            </button>

                            {/* 确认 - 显示傻币消耗 */}
                            <button
                              onClick={handleConfirmMaskEdit}
                              disabled={!hasMaskContent || (maskEditMode === 'repaint' && !repaintPrompt.trim())}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                              {/* 傻币图标 */}
                              <svg viewBox="0 0 24 24" className="w-4 h-4">
                                <circle cx="12" cy="12" r="11" fill="#FCD34D" />
                                <circle cx="12" cy="12" r="9" fill="#FBBF24" />
                                <circle cx="12" cy="12" r="7.5" fill="#F59E0B" />
                                <g transform="translate(6, 5) scale(0.5)">
                                  <path d="M12 0C9 0 7 2 7 4.5V8C7 8 7.4 7.4 8 8C8.6 8.6 9 8 9.5 8C10 8 10.3 8.6 12 8C13.7 8.6 14 8 14.5 8C15 8 15.4 8.6 16 8C16.6 7.4 17 8 17 8V4.5C17 2 15 0 12 0Z" fill="white" opacity="0.95"/>
                                  <path d="M6.5 7C3.5 7 1.5 9 1.5 11.5V15C1.5 15 1.9 14.4 2.5 15C3.1 15.6 3.5 15 4 15C4.5 15 4.8 15.6 6.5 15C8.2 15.6 8.5 15 9 15C9.5 15 9.9 15.6 10.5 15C11.1 14.4 11.5 15 11.5 15V11.5C11.5 9 9.5 7 6.5 7Z" fill="white" opacity="0.9"/>
                                  <path d="M17.5 7C14.5 7 12.5 9 12.5 11.5V15C12.5 15 12.9 14.4 13.5 15C14.1 15.6 14.5 15 15 15C15.5 15 15.8 15.6 17.5 15C19.2 15.6 19.5 15 20 15C20.5 15 20.9 15.6 21.5 15C22.1 14.4 22.5 15 22.5 15V11.5C22.5 9 20.5 7 17.5 7Z" fill="white" opacity="0.9"/>
                                </g>
                              </svg>
                              <span>2</span>
                            </button>
                          </div>
                        </div>
                        {/* 重绘提示词输入框 */}
                        {maskEditMode === 'repaint' && hasMaskContent && (
                          <div
                            className="absolute z-10"
                            style={{ right: -280 / scale, top: '50%', transform: `translateY(-50%) scale(${1 / scale})`, transformOrigin: 'left center' }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg min-w-[240px]">
                              <input
                                type="text"
                                value={repaintPrompt}
                                onChange={(e) => setRepaintPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && repaintPrompt.trim()) handleConfirmMaskEdit(); }}
                                placeholder="描述重绘内容..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                                autoFocus
                              />
                              <button
                                onClick={handleConfirmMaskEdit}
                                disabled={!repaintPrompt.trim()}
                                className="flex items-center gap-1 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              >
                                {/* 傻币图标 */}
                                <svg viewBox="0 0 24 24" className="w-4 h-4">
                                  <circle cx="12" cy="12" r="11" fill="#FCD34D" />
                                  <circle cx="12" cy="12" r="9" fill="#FBBF24" />
                                  <circle cx="12" cy="12" r="7.5" fill="#F59E0B" />
                                  <g transform="translate(6, 5) scale(0.5)">
                                    <path d="M12 0C9 0 7 2 7 4.5V8C7 8 7.4 7.4 8 8C8.6 8.6 9 8 9.5 8C10 8 10.3 8.6 12 8C13.7 8.6 14 8 14.5 8C15 8 15.4 8.6 16 8C16.6 7.4 17 8 17 8V4.5C17 2 15 0 12 0Z" fill="white" opacity="0.95"/>
                                    <path d="M6.5 7C3.5 7 1.5 9 1.5 11.5V15C1.5 15 1.9 14.4 2.5 15C3.1 15.6 3.5 15 4 15C4.5 15 4.8 15.6 6.5 15C8.2 15.6 8.5 15 9 15C9.5 15 9.9 15.6 10.5 15C11.1 14.4 11.5 15 11.5 15V11.5C11.5 9 9.5 7 6.5 7Z" fill="white" opacity="0.9"/>
                                    <path d="M17.5 7C14.5 7 12.5 9 12.5 11.5V15C12.5 15 12.9 14.4 13.5 15C14.1 15.6 14.5 15 15 15C15.5 15 15.8 15.6 17.5 15C19.2 15.6 19.5 15 20 15C20.5 15 20.9 15.6 21.5 15C22.1 14.4 22.5 15 22.5 15V11.5C22.5 9 20.5 7 17.5 7Z" fill="white" opacity="0.9"/>
                                  </g>
                                </svg>
                                <span>2</span>
                              </button>
                            </div>
                          </div>
                        )}
                        {/* 辅助提示文字 */}
                        {!hasMaskContent && (
                          <div
                            className="absolute left-1/2 pointer-events-none"
                            style={{ bottom: -40 / scale, transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: 'top center' }}
                          >
                            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-lg shadow-sm">
                              {maskEditMode === 'erase' ? '涂抹要擦除的区域' : '涂抹要重绘的区域'}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {/* 马赛克/模糊遮挡编辑模式 */}
                    {obscureEditingId === item.id && obscureEffectType && (
                      <ObscureEditOverlay
                        width={item.width}
                        height={item.height}
                        scale={scale}
                        effectType={obscureEffectType}
                        brushSize={obscureBrushSize}
                        onBrushSizeChange={setObscureBrushSize}
                        intensity={obscureIntensity}
                        onIntensityChange={setObscureIntensity}
                        hasContent={hasObscureContent}
                        canvasRef={obscureCanvasRef}
                        effectCanvasRef={effectCanvasRef}
                        isDrawing={isObscureDrawing}
                        setIsDrawing={setIsObscureDrawing}
                        onDraw={drawObscureBrush}
                        onResetLastPoint={resetObscureLastPoint}
                        onConfirm={confirmObscureEdit}
                        onCancel={cancelObscureEdit}
                        onClear={clearObscure}
                      />
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
                  </div>
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
                      {/* 透明粗路径 - 扩大点击范围 */}
                      <path d={pathD} stroke="transparent" strokeWidth={12} fill="none" strokeLinecap="round" className="cursor-move" onMouseDown={(e) => {
                        e.stopPropagation();
                        setLinePointDrag(null);
                        const currentSelectedIds = isSelected ? selectedIds : [item.id];
                        if (!isSelected) {
                          setSelectedIds([item.id]);
                        }
                        setIsDragging(true);
                        setDragStart({ x: e.clientX, y: e.clientY });
                        setItemStart({ x: item.x, y: item.y });
                        const positions: Record<string, { x: number; y: number }> = {};
                        items.forEach(i => { if (currentSelectedIds.includes(i.id)) positions[i.id] = { x: i.x, y: i.y }; });
                        setItemsStartPositions(positions);
                      }} />
                      {/* 可见路径 */}
                      <path d={pathD} stroke={item.stroke || '#6b7280'} strokeWidth={item.strokeWidth || 3} fill="none" strokeLinecap="round" className="pointer-events-none" />
                      {isSelected && (
                        <>
                          {/* 起点 - 可见圆圈 + 更小的点击区域 */}
                          <g className="group/start">
                            <circle cx={sx} cy={sy} r={6} fill="#6366f1" className="opacity-0 group-hover/start:opacity-20 transition-opacity pointer-events-none" />
                            <circle cx={sx} cy={sy} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} className="pointer-events-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                            <circle cx={sx} cy={sy} r={3} fill="transparent" className="cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setIsDragging(false); handleLinePointDrag(e, item.id, 'start'); }} />
                          </g>
                          {/* 终点 - 可见圆圈 + 更小的点击区域 */}
                          <g className="group/end">
                            <circle cx={ex} cy={ey} r={6} fill="#6366f1" className="opacity-0 group-hover/end:opacity-20 transition-opacity pointer-events-none" />
                            <circle cx={ex} cy={ey} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} className="pointer-events-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                            <circle cx={ex} cy={ey} r={3} fill="transparent" className="cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setIsDragging(false); handleLinePointDrag(e, item.id, 'end'); }} />
                          </g>
                          {/* 中点控制 - 可见圆圈 + 更小的点击区域 */}
                          <g className="group/ctrl">
                            <circle cx={midX} cy={midY} r={6} fill="#8b5cf6" className="opacity-0 group-hover/ctrl:opacity-25 transition-opacity pointer-events-none" />
                            <circle cx={midX} cy={midY} r={4} fill="#8b5cf6" stroke="white" strokeWidth={1.5} className="pointer-events-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                            <circle cx={midX} cy={midY} r={3} fill="transparent" className="cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setIsDragging(false); handleLinePointDrag(e, item.id, 'control'); }} />
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
                      {/* 透明粗路径 - 扩大点击范围 */}
                      <path d={pathD} stroke="transparent" strokeWidth={12} fill="none" strokeLinecap="round" className="cursor-move" onMouseDown={(e) => {
                        e.stopPropagation();
                        setLinePointDrag(null);
                        const currentSelectedIds = isSelected ? selectedIds : [item.id];
                        if (!isSelected) {
                          setSelectedIds([item.id]);
                        }
                        setIsDragging(true);
                        setDragStart({ x: e.clientX, y: e.clientY });
                        setItemStart({ x: item.x, y: item.y });
                        const positions: Record<string, { x: number; y: number }> = {};
                        items.forEach(i => { if (currentSelectedIds.includes(i.id)) positions[i.id] = { x: i.x, y: i.y }; });
                        setItemsStartPositions(positions);
                      }} />
                      {/* 可见路径 */}
                      <path d={pathD} stroke={item.stroke || '#6b7280'} strokeWidth={item.strokeWidth || 3} fill="none" strokeLinecap="round" markerEnd={`url(#arrowhead-${item.id})`} className="pointer-events-none" />
                      {isSelected && (
                        <>
                          {/* 起点 - 可见圆圈 + 更小的点击区域 */}
                          <g className="group/start">
                            <circle cx={sx} cy={sy} r={6} fill="#6366f1" className="opacity-0 group-hover/start:opacity-20 transition-opacity pointer-events-none" />
                            <circle cx={sx} cy={sy} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} className="pointer-events-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                            <circle cx={sx} cy={sy} r={3} fill="transparent" className="cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setIsDragging(false); handleLinePointDrag(e, item.id, 'start'); }} />
                          </g>
                          {/* 终点 - 可见圆圈 + 更小的点击区域 */}
                          <g className="group/end">
                            <circle cx={ex} cy={ey} r={6} fill="#6366f1" className="opacity-0 group-hover/end:opacity-20 transition-opacity pointer-events-none" />
                            <circle cx={ex} cy={ey} r={4} fill="white" stroke="#6366f1" strokeWidth={1.5} className="pointer-events-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                            <circle cx={ex} cy={ey} r={3} fill="transparent" className="cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setIsDragging(false); handleLinePointDrag(e, item.id, 'end'); }} />
                          </g>
                          {/* 中点控制 - 可见圆圈 + 更小的点击区域 */}
                          <g className="group/ctrl">
                            <circle cx={midX} cy={midY} r={6} fill="#8b5cf6" className="opacity-0 group-hover/ctrl:opacity-25 transition-opacity pointer-events-none" />
                            <circle cx={midX} cy={midY} r={4} fill="#8b5cf6" stroke="white" strokeWidth={1.5} className="pointer-events-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
                            <circle cx={midX} cy={midY} r={3} fill="transparent" className="cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setIsDragging(false); handleLinePointDrag(e, item.id, 'control'); }} />
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
                        strokeWidth={item.strokeWidth || 5}
                        fill="none"
                        strokeLinecap="round"
                        opacity="0.6"
                      />
                      {/* 起点圆点 */}
                      <circle cx={sx} cy={sy} r="5" fill={item.stroke || '#a78bfa'} opacity="0.8" />
                      {/* 终点圆点 */}
                      <circle cx={ex} cy={ey} r="5" fill={item.stroke || '#a78bfa'} opacity="0.8" />
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
                      onAdjust={() => {
                        const newId = adjustingImageId === item.id ? null : item.id;
                        setAdjustingImageId(newId);
                        // 打开修图面板时关闭其他弹窗
                        if (newId) {
                          setShowSettings(false);
                          setShowAddMenu(false);
                        }
                      }}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      isProcessing={processingIds.has(item.id)}
                      showAdjustPanel={adjustingImageId === item.id}
                    />
                    {/* 图片调整面板 */}
                    {adjustingImageId === item.id && (
                      <ImageAdjustPanel
                        item={item}
                        scale={scale}
                        onUpdate={(updates) => {
                          setItems(prev => prev.map(i =>
                            i.id === item.id ? { ...i, ...updates } : i
                          ));
                        }}
                        onClose={() => setAdjustingImageId(null)}
                        onMosaic={() => openObscureEdit(item.id, 'mosaic')}
                        onBlur={() => openObscureEdit(item.id, 'blur')}
                      />
                    )}
                  </div>
                )}
                {/* 底部提示词显示 - 仅当图片有提示词时显示，修图模式下隐藏 */}
                {isSelected && selectedIds.length === 1 && !isPanning && !isDragging && item.type === 'image' && !maskEditingId && !adjustingImageId && item.prompt && (
                  <div
                    className="absolute bottom-0 left-1/2"
                    style={{ transform: `translateX(-50%) translateY(100%) scale(${1 / scale})`, transformOrigin: 'top center' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mt-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/80 max-w-xs flex items-center gap-2">
                      <p
                        className="text-xs text-gray-500 flex-1 select-text cursor-text break-all"
                        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                        title={item.prompt}
                      >
                        {item.prompt}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const text = item.prompt || '';
                          navigator.clipboard.writeText(text).then(() => {
                            clearClipboard(); // 清空内部剪贴板，让 Ctrl+V 能正常粘贴文本
                            console.log('提示词复制成功:', text);
                          });
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                        title="复制提示词"
                      >
                        <Copy size={12} className="text-gray-400 hover:text-gray-600" />
                      </button>
                    </div>
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

            return (
              <div
                className="absolute cursor-move"
                style={{
                  left: minX,
                  top: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDragging(true);
                  setDragStart({ x: e.clientX, y: e.clientY });
                  const positions: Record<string, { x: number; y: number }> = {};
                  items.forEach(item => {
                    if (selectedIds.includes(item.id)) {
                      positions[item.id] = { x: item.x, y: item.y };
                    }
                  });
                  setItemsStartPositions(positions);
                }}
              >
                {/* 外发光 */}
                <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-md pointer-events-none" />
                {/* 边框 */}
                <div className="absolute inset-0 rounded-xl border-2 border-primary/60 border-dashed pointer-events-none" />
                {/* 四角手柄 - 大小不随缩放变化 */}
                {[
                  { pos: 'tl', top: -8, left: -8, cursor: 'nwse-resize' },
                  { pos: 'tr', top: -8, right: -8, cursor: 'nesw-resize' },
                  { pos: 'bl', bottom: -8, left: -8, cursor: 'nesw-resize' },
                  { pos: 'br', bottom: -8, right: -8, cursor: 'nwse-resize' },
                ].map((handle) => (
                  <div
                    key={handle.pos}
                    className="absolute bg-white border-primary rounded-full shadow-md"
                    style={{
                      width: 16 / scale,
                      height: 16 / scale,
                      borderWidth: Math.max(1, 2 / scale),
                      top: 'top' in handle ? handle.top / scale : undefined,
                      bottom: 'bottom' in handle ? handle.bottom / scale : undefined,
                      left: 'left' in handle ? handle.left / scale : undefined,
                      right: 'right' in handle ? handle.right / scale : undefined,
                      cursor: handle.cursor,
                    }}
                    onMouseDown={(e) => handleResizeStart(e, handle.pos as 'tl' | 'tr' | 'bl' | 'br')}
                  />
                ))}
              </div>
            );          })()}

          {/* AI 生成中 Loading 状态 - 支持多个并发任务 */}
          {generatingTasks.map(task => (
            <React.Fragment key={task.id}>
              {/* 临时连接线：从参考图片到占位框 */}
              {task.sourceIds.length > 0 && (() => {
                const sourceItems = task.sourceIds
                  .map(id => items.find(i => i.id === id))
                  .filter((s): s is CanvasItem => !!s);
                if (sourceItems.length === 0) return null;

                const gap = 12;
                const avgX = sourceItems.reduce((sum, s) => sum + s.x + s.width / 2, 0) / sourceItems.length;
                const avgY = sourceItems.reduce((sum, s) => sum + s.y + s.height / 2, 0) / sourceItems.length;
                const tCx = task.position.x + task.position.width / 2;
                const tCy = task.position.y + task.position.height / 2;
                const ddx = tCx - avgX;
                const ddy = tCy - avgY;
                const isVertical = Math.abs(ddy) > Math.abs(ddx);
                const fixedEndX = !isVertical
                  ? (ddx > 0 ? task.position.x - gap : task.position.x + task.position.width + gap)
                  : tCx;
                const fixedEndY = isVertical
                  ? (ddy > 0 ? task.position.y - gap : task.position.y + task.position.height + gap)
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
                      key={`${task.id}-${sourceItem.id}`}
                      className="absolute overflow-visible pointer-events-none"
                      style={{ left: svgX, top: svgY, width: svgW, height: svgH }}
                    >
                      <path d={pathD} stroke="#a78bfa" strokeWidth={3} fill="none" strokeLinecap="round" opacity="0.6" strokeDasharray="6 4" />
                      <circle cx={sx} cy={sy} r="4" fill="#a78bfa" opacity="0.7" />
                      <circle cx={ex} cy={ey} r="4" fill="#a78bfa" opacity="0.7" />
                    </svg>
                  );
                });
              })()}
              <div
                className="absolute rounded-xl cursor-move bg-gray-50 border-2 border-dashed border-gray-300 z-50"
                style={{
                  left: task.position.x,
                  top: task.position.y,
                  width: task.position.width,
                  height: task.position.height,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startPosX = task.position.x;
                  const startPosY = task.position.y;
                  const taskId = task.id;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const dx = (moveEvent.clientX - startX) / scale;
                    const dy = (moveEvent.clientY - startY) / scale;
                    setGeneratingTasks(prev => prev.map(t =>
                      t.id === taskId ? { ...t, position: { ...t.position, x: startPosX + dx, y: startPosY + dy } } : t
                    ));
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
            </React.Fragment>
          ))}
        </div>

        {/* 框选矩形 */}
        <SelectionRect
          isSelecting={isSelecting}
          start={selectionStart}
          end={selectionEnd}
        />

        {/* 拖放提示 */}
        <DragOverlay isDragOver={isDragOver} />


      </div>

      {/* --- Right Bottom: 问三傻 --- */}
      <ChatButton
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen(!isChatOpen)}
      />

      {/* --- Bottom Controls --- */}
      <GenerationBar
        prompt={prompt}
        onPromptChange={setPrompt}
        aspectRatio={aspectRatio}
        resolution={resolution}
        hidden={!!adjustingImageId}
        showSettings={showSettings}
        onAspectRatioChange={setAspectRatio}
        onResolutionChange={setResolution}
        onToggleSettings={() => setShowSettings(!showSettings)}
        selectedItems={items.filter(item => selectedIds.includes(item.id))}
        onRemoveSelectedItem={(id) => setSelectedIds(prev => prev.filter(i => i !== id))}
        showAddMenu={showAddMenu}
        onToggleAddMenu={() => setShowAddMenu(!showAddMenu)}
        onGenerate={handleGenerate}
        onFileSelect={handleFileSelect}
        onOpenCamera={openCamera}
        getGenerateCreditCost={getGenerateCreditCost}
      />

      {/* 摄像头弹窗 */}
      <CameraModal
        isOpen={showCamera}
        facingMode={facingMode}
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />

      {/* Chatbot 面板 */}
      <ChatbotPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        canvasItems={items}
        selectedIds={selectedIds}
      />

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
