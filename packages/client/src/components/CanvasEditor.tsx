import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  Type,
  Plus,
  ImagePlus,
  Camera,
  ArrowRight,
  Share2,
  ArrowLeft,
  Settings2,
  ZoomIn,
  ZoomOut,
  Maximize,
  X,
  SwitchCamera,
  Pencil,
  Square,
  Circle,
  Shapes,
  ScrollText,
  Lock,
  Diamond,
  MoveRight,
  Minus,
  Eraser,
  Image as LucideImage,
} from 'lucide-react';
import { CanvasOnboarding } from './CanvasOnboarding';
import { FloatingToolbar } from './FloatingToolbar';
import { IconBtn } from './IconBtn';
import { StoryboardEditor, SceneDetailModal, ImagePicker } from './Storyboard';
import { CanvasItem, ToolMode, Project, Storyboard, Scene } from '../types';
import * as API from '../services/api';
import * as ProjectService from '../services/projectService';
import { ChatbotPanel } from './chatbot';
import { generateId } from '../utils/id';
import { Tooltip } from './ui';
import { Logo } from './Logo';

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
  const [resolution, setResolution] = useState("1024");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [itemStart, setItemStart] = useState({ x: 0, y: 0 });

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [itemStartSize, setItemStartSize] = useState({ width: 0, height: 0, x: 0, y: 0 });

  // 框选状态
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

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

  // 图片裁切状态
  const [croppingImageId, setCroppingImageId] = useState<string | null>(null);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 创作工具菜单状态
  const [showCreativeTools, setShowCreativeTools] = useState(false);

  // Chatbot 状态
  const [isChatOpen, setIsChatOpen] = useState(false);

  // 剧本模式状态
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(project.storyboard || null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showSceneDetail, setShowSceneDetail] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imagePickerSceneId, setImagePickerSceneId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTemplateSelect = (template: 'cyberpunk' | 'mascot' | 'surreal') => {
    // Mock template loading - in real app this would load specific JSON
    const centerX = -pan.x + (window.innerWidth / 2);
    const centerY = -pan.y + (window.innerHeight / 2);

    let newItems: CanvasItem[] = [];

    if (template === 'cyberpunk') {
      newItems = [
        { id: generateId(), type: 'text', src: 'Cyberpunk City', x: centerX - 100, y: centerY - 150, width: 200, height: 40, zIndex: 1, fontSize: 32, fontFamily: 'system-ui', fontWeight: 'bold', color: '#0ea5e9', textAlign: 'center' },
        { id: generateId(), type: 'rectangle', src: '', x: centerX - 120, y: centerY - 100, width: 240, height: 200, zIndex: 0, fill: '#1e293b', stroke: '#0ea5e9', strokeWidth: 2, borderRadius: 16 }
      ];
    } else if (template === 'mascot') {
      newItems = [
        { id: generateId(), type: 'text', src: 'Cute Mascot', x: centerX - 100, y: centerY - 150, width: 200, height: 40, zIndex: 1, fontSize: 32, fontFamily: 'system-ui', fontWeight: 'bold', color: '#f59e0b', textAlign: 'center' },
        { id: generateId(), type: 'circle', src: '', x: centerX - 60, y: centerY - 60, width: 120, height: 120, zIndex: 0, fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2 }
      ];
    } else {
      newItems = [
        { id: generateId(), type: 'text', src: 'Surreal Art', x: centerX - 100, y: centerY - 150, width: 200, height: 40, zIndex: 1, fontSize: 32, fontFamily: 'system-ui', fontWeight: 'bold', color: '#a855f7', textAlign: 'center' },
        { id: generateId(), type: 'brush', src: '', x: 0, y: 0, width: 0, height: 0, zIndex: 0, stroke: '#a855f7', strokeWidth: 4, points: [{ x: centerX, y: centerY }, { x: centerX + 50, y: centerY + 50 }, { x: centerX + 100, y: centerY }] }
      ];
    }

    setItems(prev => [...prev, ...newItems]);
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
        storyboard: storyboard || undefined,
        updatedAt: Date.now(),
      };
      ProjectService.saveProject(updatedProject);
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [items, scale, pan, projectName, storyboard]);

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
              const base64Image = await API.generateImage({
                prompt: pendingPromptText,
                aspectRatio: '1:1',
              });

              const img = new window.Image();
              img.src = base64Image;
              img.onload = () => {
                const displaySize = 400;
                const newItem: CanvasItem = {
                  id: generateId(),
                  type: 'image',
                  src: base64Image,
                  x: -pan.x + (window.innerWidth / 2) - displaySize / 2,
                  y: -pan.y + (window.innerHeight / 2) - displaySize / 2,
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
              alert('生成失败，请检查后端服务是否正常运行。');
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

  // 键盘快捷键 - 删除选中项
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在编辑文字或输入框，不处理
      if (editingTextId || isEditingName || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Delete 或 Backspace 删除选中项
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingTextId, isEditingName]);

  // 摄像头视频源设置
  useEffect(() => {
    if (showCamera && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showCamera, stream]);

  // --- Actions ---

  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(0.1, prev + delta), 5));
  };

  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
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

  const switchCamera = async () => {
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
      x: -pan.x + (window.innerWidth / 2) - 200,
      y: -pan.y + (window.innerHeight / 2) - 150,
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
        const newItem: CanvasItem = {
          id: generateId(),
          type: 'image',
          src,
          x: -pan.x + (window.innerWidth / 2) - (img.width / 4),
          y: -pan.y + (window.innerHeight / 2) - (img.height / 4),
          width: img.width > 512 ? 512 : img.width,
          height: img.height > 512 ? (img.height / img.width) * 512 : img.height,
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
    setIsProcessing(true);
    try {
      const base64Image = await API.generateImage({
        prompt,
        aspectRatio,
      });

      const img = new window.Image();
      img.src = base64Image;
      img.onload = () => {
        // 根据宽高比计算显示尺寸
        const displaySize = 400;
        const [w, h] = aspectRatio.split(':').map(Number);
        const ratio = w / h;
        const width = ratio >= 1 ? displaySize : displaySize * ratio;
        const height = ratio >= 1 ? displaySize / ratio : displaySize;

        const newItem: CanvasItem = {
          id: generateId(),
          type: 'image',
          src: base64Image,
          x: -pan.x + (window.innerWidth / 2) - width / 2,
          y: -pan.y + (window.innerHeight / 2) - height / 2,
          width,
          height,
          zIndex: items.length + 1,
          prompt: prompt
        };
        setItems(prev => [...prev, newItem]);
        setSelectedIds([newItem.id]);
        setPrompt("");
      }
    } catch (error) {
      console.error(error);
      alert("生成失败，请检查后端服务是否正常运行。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContextAction = async (action: 'upscale' | 'edit' | 'removeBg' | 'expand', payload?: string) => {
    const selectedItem = selectedIds.length > 0 ? items.find(i => i.id === selectedIds[0]) : null;
    if (!selectedItem || isProcessing) return;

    setIsProcessing(true);
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
          item.id === selectedIds[0]
            ? { ...item, src: newImageSrc }
            : item
        ));
      }

    } catch (e) {
      console.error(e);
      alert("操作失败，请检查后端服务是否正常运行。");
    } finally {
      setIsProcessing(false);
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
    setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
  };

  // 开始裁切图片
  const startCropping = (imageId: string) => {
    const item = items.find(i => i.id === imageId);
    if (!item || item.type !== 'image') return;
    setCroppingImageId(imageId);
    setCropBox({ x: 0, y: 0, width: item.width, height: item.height });
  };

  // 应用裁切
  const applyCrop = () => {
    if (!croppingImageId) return;
    const item = items.find(i => i.id === croppingImageId);
    if (!item || item.type !== 'image') return;

    // 创建 canvas 进行裁切
    const img = new window.Image();
    img.src = item.src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 计算实际裁切区域（相对于原图）
      const scaleX = img.naturalWidth / item.width;
      const scaleY = img.naturalHeight / item.height;

      canvas.width = cropBox.width * scaleX;
      canvas.height = cropBox.height * scaleY;

      ctx.drawImage(
        img,
        cropBox.x * scaleX,
        cropBox.y * scaleY,
        cropBox.width * scaleX,
        cropBox.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const croppedSrc = canvas.toDataURL('image/png');

      setItems(prev => prev.map(i =>
        i.id === croppingImageId
          ? { ...i, src: croppedSrc, width: cropBox.width, height: cropBox.height, x: i.x + cropBox.x, y: i.y + cropBox.y }
          : i
      ));

      setCroppingImageId(null);
    };
  };

  // 取消裁切
  const cancelCrop = () => {
    setCroppingImageId(null);
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || toolMode === ToolMode.PAN) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const clickedItem = [...items].reverse().find(item => {
      const screenX = item.x * scale + pan.x + (window.innerWidth / 2);
      const screenY = item.y * scale + pan.y + (window.innerHeight / 2);
      const screenW = item.width * scale;
      const screenH = item.height * scale;

      return (
        e.clientX >= screenX &&
        e.clientX <= screenX + screenW &&
        e.clientY >= screenY &&
        e.clientY <= screenY + screenH
      );
    });

    if (clickedItem) {
      setSelectedIds([clickedItem.id]);
      if (toolMode === ToolMode.SELECT) {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setItemStart({ x: clickedItem.x, y: clickedItem.y });
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
          src: '输入文字',
          x: canvasX,
          y: canvasY,
          width: 200,
          height: 40,
          zIndex: items.length + 1,
          fontSize: 24,
          fontFamily: 'system-ui',
          fontWeight: 'normal',
          color: '#1f2937',
          textAlign: 'left',
        };
        setItems(prev => [...prev, newTextItem]);
        setSelectedIds([newTextItem.id]);
        setEditingTextId(newTextItem.id);
        setToolMode(ToolMode.SELECT);
      } else if (toolMode === ToolMode.RECTANGLE) {
        // 创建矩形
        const newRectItem: CanvasItem = {
          id: generateId(),
          type: 'rectangle',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 150,
          height: 100,
          zIndex: items.length + 1,
          fill: '#e5e7eb',
          stroke: '#9ca3af',
          strokeWidth: 2,
          borderRadius: 8,
        };
        setItems(prev => [...prev, newRectItem]);
        setSelectedIds([newRectItem.id]);
        setToolMode(ToolMode.SELECT);
      } else if (toolMode === ToolMode.CIRCLE) {
        // 创建圆形
        const newCircleItem: CanvasItem = {
          id: generateId(),
          type: 'circle',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 120,
          height: 120,
          zIndex: items.length + 1,
          fill: '#ddd6fe',
          stroke: '#a78bfa',
          strokeWidth: 2,
        };
        setItems(prev => [...prev, newCircleItem]);
        setSelectedIds([newCircleItem.id]);
        setToolMode(ToolMode.SELECT);
      } else if (toolMode === ToolMode.LINE) {
        // 创建直线
        const newLineItem: CanvasItem = {
          id: generateId(),
          type: 'line',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 150,
          height: 0,
          zIndex: items.length + 1,
          stroke: '#6b7280',
          strokeWidth: 2,
        };
        setItems(prev => [...prev, newLineItem]);
        setSelectedIds([newLineItem.id]);
        setToolMode(ToolMode.SELECT);
      } else if (toolMode === ToolMode.ARROW) {
        // 创建箭头
        const newArrowItem: CanvasItem = {
          id: generateId(),
          type: 'arrow',
          src: '',
          x: canvasX,
          y: canvasY,
          width: 150,
          height: 0,
          zIndex: items.length + 1,
          stroke: '#6b7280',
          strokeWidth: 2,
        };
        setItems(prev => [...prev, newArrowItem]);
        setSelectedIds([newArrowItem.id]);
        setToolMode(ToolMode.SELECT);
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
          stroke: '#8b5cf6',
          strokeWidth: 3,
          points: [{ x: canvasX, y: canvasY }],
        };
        setItems(prev => [...prev, newBrushItem]);
        setSelectedIds([newBrushItem.id]);
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (toolMode === ToolMode.SELECT) {
        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
        setSelectionEnd({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isResizing && selectedIds.length > 0 && resizeCorner) {
      const dx = (e.clientX - resizeStart.x) / scale;

      setItems(prev => prev.map(item => {
        if (item.id !== selectedIds[0]) return item;

        const ratio = itemStartSize.width / itemStartSize.height;
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
      }));
      return;
    }

    if (isSelecting) {
      setSelectionEnd({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDragging && selectedIds.length > 0) {
      const selectedItem = items.find(i => i.id === selectedIds[0]);

      // 画笔模式 - 添加新点
      if (selectedItem?.type === 'brush' && toolMode === ToolMode.BRUSH) {
        const canvasX = (e.clientX - window.innerWidth / 2 - pan.x) / scale;
        const canvasY = (e.clientY - window.innerHeight / 2 - pan.y) / scale;

        setItems(prev => prev.map(item =>
          item.id === selectedIds[0] && item.points
            ? { ...item, points: [...item.points, { x: canvasX, y: canvasY }] }
            : item
        ));
      } else {
        // 普通拖拽
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        setItems(prev => prev.map(item => {
          if (!selectedIds.includes(item.id)) return item;

          // 画笔需要同时移动所有点
          if (item.type === 'brush' && item.points) {
            const offsetX = (itemStart.x + dx) - item.x;
            const offsetY = (itemStart.y + dy) - item.y;
            return {
              ...item,
              x: itemStart.x + dx,
              y: itemStart.y + dy,
              points: item.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
            };
          }

          return { ...item, x: itemStart.x + dx, y: itemStart.y + dy };
        }));
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

    // 画笔绘制结束后计算边界框并切回选择模式
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
      setToolMode(ToolMode.SELECT);
    }

    setIsPanning(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeCorner(null);
    setIsSelecting(false);
  };

  const handleResizeStart = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    const selectedItem = selectedIds.length > 0 ? items.find(i => i.id === selectedIds[0]) : null;
    if (!selectedItem) return;

    setIsResizing(true);
    setResizeCorner(corner);
    setResizeStart({ x: e.clientX, y: e.clientY });
    setItemStartSize({
      width: selectedItem.width,
      height: selectedItem.height,
      x: selectedItem.x,
      y: selectedItem.y
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // 双指捏合缩放 - 以鼠标位置为焦点
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.03 : 0.03;
      const newScale = Math.min(Math.max(0.1, scale + delta), 5);

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
          const width = img.width > 512 ? 512 : img.width;
          const height = img.height > 512 ? (img.height / img.width) * 512 : img.height;
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

  // --- Storyboard Functions ---

  // 创建新的 Storyboard
  const createNewStoryboard = (): Storyboard => ({
    id: generateId(),
    projectId: project.id,
    title: '未命名剧本',
    rawScript: '',
    scenes: [],
    totalDuration: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    timelineZoom: 60,
    timelineScrollPosition: 0,
  });

  // 确保有 storyboard
  const currentStoryboard = storyboard || createNewStoryboard();

  // 更新场景
  const handleSceneUpdate = (updatedScene: Scene) => {
    const scenes = currentStoryboard.scenes.map(s =>
      s.id === updatedScene.id ? updatedScene : s
    );
    let currentTime = 0;
    scenes.forEach(s => {
      s.startTime = currentTime;
      currentTime += s.duration;
    });
    setStoryboard({
      ...currentStoryboard,
      scenes,
      totalDuration: currentTime,
      updatedAt: Date.now(),
    });
  };

  // 删除场景
  const handleSceneDelete = (sceneId: string) => {
    const scenes = currentStoryboard.scenes
      .filter(s => s.id !== sceneId)
      .map((s, i) => ({ ...s, order: i }));
    let currentTime = 0;
    scenes.forEach(s => {
      s.startTime = currentTime;
      currentTime += s.duration;
    });
    setStoryboard({
      ...currentStoryboard,
      scenes,
      totalDuration: currentTime,
      updatedAt: Date.now(),
    });
  };

  // 添加新场景
  const handleAddScene = () => {
    const sb = storyboard || createNewStoryboard();
    const newScene: Scene = {
      id: generateId(),
      order: sb.scenes.length,
      title: `镜头 ${sb.scenes.length + 1}`,
      description: '',
      dialogue: '',
      visualPrompt: '',
      duration: 5,
      startTime: sb.totalDuration,
      imageSource: 'none',
      status: 'draft',
    };
    setStoryboard({
      ...sb,
      scenes: [...sb.scenes, newScene],
      totalDuration: sb.totalDuration + 5,
      updatedAt: Date.now(),
    });
  };

  // 打开场景详情
  const handleSceneClick = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setShowSceneDetail(true);
  };

  // 打开图片选择器
  const handleOpenImagePicker = (sceneId: string) => {
    setImagePickerSceneId(sceneId);
    setShowImagePicker(true);
  };

  // 选择画布图片
  const handleSelectCanvasImage = (canvasItemId: string) => {
    if (!imagePickerSceneId || !storyboard) return;
    const scene = storyboard.scenes.find(s => s.id === imagePickerSceneId);
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
  };

  // 定位到场景对应的画布图片
  const handleLocateScene = (scene: Scene) => {
    if (scene.imageSource === 'canvas' && scene.canvasItemId) {
      const item = items.find(i => i.id === scene.canvasItemId);
      if (item) {
        // 计算需要的 pan 值，使图片居中显示
        const targetX = -(item.x + item.width / 2);
        const targetY = -(item.y + item.height / 2);
        setPan({ x: targetX, y: targetY });
        setScale(1);
        setSelectedIds([item.id]);
      }
    }
  };

  // 剧本导入（占位）
  const handleImportScript = () => {
    // TODO: 实现剧本导入功能
    alert('剧本导入功能即将上线！');
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

        <div className="flex items-center gap-3 pointer-events-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-500 shadow-sm rounded-lg hover:bg-violet-600 transition-all text-sm font-medium text-white">
            <Share2 size={16} />
            分享
          </button>
        </div>
      </div>

      {/* --- Left Tool Rail --- */}
      <div className="fixed left-4 flex flex-col items-center gap-1 p-2 bg-gray-100/90 backdrop-blur-sm shadow-lg rounded-full z-40" style={{ top: 'calc(50% + 32px)', transform: 'translateY(-50%)' }}>
        {/* 选择 */}
        <Tooltip content="选择 (V)" side="right">
          <button
            className={`relative p-3 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.SELECT ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
            onClick={() => { setToolMode(ToolMode.SELECT); setShowCreativeTools(false); }}
          >
            <MousePointer2 size={20} />
          </button>
        </Tooltip>

        {/* 平移 */}
        <Tooltip content="平移 (H)" side="right">
          <button
            className={`relative p-3 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.PAN ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
            onClick={() => { setToolMode(ToolMode.PAN); setShowCreativeTools(false); }}
          >
            <Hand size={20} />
          </button>
        </Tooltip>

        {/* 画笔 */}
        <Tooltip content="画笔 (B)" side="right">
          <button
            className={`relative p-3 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.BRUSH ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
            onClick={() => { setToolMode(ToolMode.BRUSH); setShowCreativeTools(false); }}
          >
            <Pencil size={20} />
          </button>
        </Tooltip>

        {/* 形状工具 */}
        <div className="relative">
          <Tooltip content="形状工具" side="right">
            <button
              className={`relative p-3 rounded-full transition-all duration-200 ease-out ${[ToolMode.TEXT, ToolMode.RECTANGLE, ToolMode.CIRCLE, ToolMode.LINE, ToolMode.ARROW].includes(toolMode) || showCreativeTools
                ? 'bg-gray-800 text-white shadow-md scale-105'
                : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'
                }`}
              onClick={() => setShowCreativeTools(!showCreativeTools)}
            >
              <Shapes size={20} />
            </button>
          </Tooltip>

          {/* 形状展开菜单 */}
          {showCreativeTools && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 flex gap-1 p-2 bg-gray-100/90 backdrop-blur-sm shadow-lg rounded-full z-50 animate-in slide-in-from-left-2 fade-in duration-200">
              <Tooltip content="文字 (T)" side="top">
                <button
                  className={`p-2.5 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.TEXT ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
                  onClick={() => { setToolMode(ToolMode.TEXT); setShowCreativeTools(false); }}
                >
                  <Type size={18} />
                </button>
              </Tooltip>
              <Tooltip content="直线 (L)" side="top">
                <button
                  className={`p-2.5 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.LINE ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
                  onClick={() => { setToolMode(ToolMode.LINE); setShowCreativeTools(false); }}
                >
                  <Minus size={18} />
                </button>
              </Tooltip>
              <Tooltip content="箭头 (A)" side="top">
                <button
                  className={`p-2.5 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.ARROW ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
                  onClick={() => { setToolMode(ToolMode.ARROW); setShowCreativeTools(false); }}
                >
                  <MoveRight size={18} />
                </button>
              </Tooltip>
              <Tooltip content="矩形 (R)" side="top">
                <button
                  className={`p-2.5 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.RECTANGLE ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
                  onClick={() => { setToolMode(ToolMode.RECTANGLE); setShowCreativeTools(false); }}
                >
                  <Square size={18} />
                </button>
              </Tooltip>
              <Tooltip content="圆形 (O)" side="top">
                <button
                  className={`p-2.5 rounded-full transition-all duration-200 ease-out ${toolMode === ToolMode.CIRCLE ? 'bg-gray-800 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
                  onClick={() => { setToolMode(ToolMode.CIRCLE); setShowCreativeTools(false); }}
                >
                  <Circle size={18} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div className="w-6 h-px bg-gray-300 my-1" />

        {/* 剧本模式 */}
        <Tooltip content="剧本模式" side="right">
          <button
            className={`relative p-3 rounded-full transition-all duration-200 ease-out ${showStoryboard ? 'bg-violet-500 text-white shadow-md scale-105' : 'text-gray-500 hover:bg-gray-200/50 hover:scale-105'}`}
            onClick={() => setShowStoryboard(!showStoryboard)}
          >
            <ScrollText size={20} />
          </button>
        </Tooltip>

        {/* AI 助手 */}
        <Tooltip content="AI 助手" side="right">
          <button
            className={`relative p-2 rounded-full transition-all duration-200 ease-out ${isChatOpen ? 'bg-violet-100 scale-105' : 'hover:bg-gray-200/50 hover:scale-105'}`}
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            <Logo size={28} showText={false} />
          </button>
        </Tooltip>
      </div>

      {/* --- Main Canvas --- */}
      <div
        ref={canvasRef}
        className={`flex-1 relative cursor-default overflow-hidden transition-colors ${isDragOver ? 'bg-violet-50/50' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          className="absolute top-1/2 left-1/2 w-0 h-0 transition-transform duration-150 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
          }}
        >
          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="absolute group select-none"
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  zIndex: item.zIndex
                }}
              >
                {/* 选中边框 - 单选时显示完整边框和手柄 */}
                {isSelected && selectedIds.length === 1 && (
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
                {/* 多选时单个元素只显示简单边框 */}
                {isSelected && selectedIds.length > 1 && (
                  <div className="absolute -inset-1 rounded-lg border-2 border-primary/40 pointer-events-none" />
                )}
                {/* 悬停边框 */}
                {!isSelected && (
                  <div className="absolute -inset-1 rounded-xl border border-transparent group-hover:border-gray-300 pointer-events-none transition-colors" />
                )}
                {/* 图片 */}
                {item.type === 'image' && (
                  <img
                    src={item.src}
                    alt="canvas item"
                    className="w-full h-full object-cover rounded-lg shadow-lg cursor-pointer"
                    draggable={false}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startCropping(item.id);
                    }}
                  />
                )}

                {/* 文字 */}
                {item.type === 'text' && (
                  editingTextId === item.id ? (
                    <textarea
                      autoFocus
                      value={item.src}
                      onChange={(e) => {
                        setItems(prev => prev.map(i =>
                          i.id === item.id ? { ...i, src: e.target.value } : i
                        ));
                      }}
                      onBlur={() => setEditingTextId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setEditingTextId(null);
                        }
                      }}
                      className="w-full h-full bg-transparent border-none outline-none resize-none p-2"
                      style={{
                        fontSize: item.fontSize || 24,
                        fontFamily: item.fontFamily || 'system-ui',
                        fontWeight: item.fontWeight || 'normal',
                        color: item.color || '#1f2937',
                        textAlign: item.textAlign || 'left',
                      }}
                    />
                  ) : (
                    <div
                      className="w-full h-full p-2 cursor-text"
                      style={{
                        fontSize: item.fontSize || 24,
                        fontFamily: item.fontFamily || 'system-ui',
                        fontWeight: item.fontWeight || 'normal',
                        color: item.color || '#1f2937',
                        textAlign: item.textAlign || 'left',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingTextId(item.id);
                      }}
                    >
                      {item.src}
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
                {item.type === 'brush' && item.points && item.points.length > 0 && (
                  <svg
                    className="absolute top-0 left-0 overflow-visible pointer-events-none"
                    style={{ width: 1, height: 1 }}
                  >
                    <path
                      d={item.points.reduce((acc, point, i) => {
                        const x = point.x - item.x;
                        const y = point.y - item.y;
                        return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                      }, '')}
                      fill="none"
                      stroke={item.stroke || '#8b5cf6'}
                      strokeWidth={item.strokeWidth || 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}

                {/* 直线 */}
                {item.type === 'line' && (
                  <svg
                    className="absolute top-0 left-0 overflow-visible"
                    style={{ width: item.width || 1, height: Math.max(item.height, 20) }}
                  >
                    <line
                      x1={0}
                      y1={item.height / 2 + 10}
                      x2={item.width}
                      y2={item.height / 2 + 10}
                      stroke={item.stroke || '#6b7280'}
                      strokeWidth={item.strokeWidth || 2}
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                {/* 箭头 */}
                {item.type === 'arrow' && (
                  <svg
                    className="absolute top-0 left-0 overflow-visible"
                    style={{ width: item.width || 1, height: Math.max(item.height, 20) }}
                  >
                    <defs>
                      <marker
                        id={`arrowhead-${item.id}`}
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 10 3.5, 0 7"
                          fill={item.stroke || '#6b7280'}
                        />
                      </marker>
                    </defs>
                    <line
                      x1={0}
                      y1={item.height / 2 + 10}
                      x2={item.width - 5}
                      y2={item.height / 2 + 10}
                      stroke={item.stroke || '#6b7280'}
                      strokeWidth={item.strokeWidth || 2}
                      strokeLinecap="round"
                      markerEnd={`url(#arrowhead-${item.id})`}
                    />
                  </svg>
                )}
                {/* Context Toolbar anchored to item - only for single selected images */}
                {isSelected && selectedIds.length === 1 && !isPanning && !isDragging && item.type === 'image' && (
                  <div className="absolute top-0 left-1/2" style={{ transform: `translateX(-50%) scale(${1 / scale})`, transformOrigin: 'bottom center' }}>
                    <FloatingToolbar
                      onUpscale={() => handleContextAction('upscale')}
                      onRemoveBg={() => handleContextAction('removeBg')}
                      onExpand={() => handleContextAction('expand')}
                      onEdit={(p) => handleContextAction('edit', p)}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      isProcessing={isProcessing}
                    />
                  </div>
                )}
                {/* Simple delete button for non-image items (single select only) */}
                {isSelected && selectedIds.length === 1 && !isPanning && !isDragging && item.type !== 'image' && !editingTextId && (
                  <div
                    style={{ transform: `scale(${1 / scale})`, transformOrigin: 'bottom center' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 z-50">
                      <button
                        onClick={handleDelete}
                        className="p-2 bg-white rounded-lg shadow-lg border border-gray-200 text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                )}
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
                <div
                  className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleResizeStart(e, 'tl')}
                />
                <div
                  className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleResizeStart(e, 'tr')}
                />
                <div
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleResizeStart(e, 'bl')}
                />
                <div
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleResizeStart(e, 'br')}
                />
                {/* 多选删除按钮 */}
                {!isPanning && !isDragging && (
                  <div
                    style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top center' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute top-[-45px] left-1/2 -translate-x-1/2 z-50">
                      <button
                        onClick={handleDelete}
                        className="p-2 bg-white rounded-lg shadow-lg border border-gray-200 text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                        title={`删除 ${selectedIds.length} 个元素`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        <span className="text-xs font-medium">{selectedIds.length}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
              {/* 三傻Logo动画 */}
              <div className="mb-6 flex justify-center">
                <div className="animate-bounce-slow">
                  <Logo size={72} showText={false} />
                </div>
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

      {/* --- Right Bottom Zoom Controls --- */}
      <div className="fixed bottom-4 right-4 flex items-center gap-1 bg-white border border-gray-200 shadow-float rounded-lg p-1 z-50">
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
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: '512', label: '标清', sub: '512px' },
                      { value: '768', label: '高清', sub: '768px' },
                      { value: '1024', label: '1K', sub: '1024px' },
                      { value: '1536', label: '2K', sub: '1536px' },
                    ].map(r => (
                      <button
                        key={r.value}
                        onClick={() => setResolution(r.value)}
                        className={`flex flex-col items-center p-2 rounded-xl transition-all ${resolution === r.value
                          ? 'bg-primary/10 ring-2 ring-primary/30'
                          : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                      >
                        <span className={`text-xs font-semibold ${resolution === r.value ? 'text-primary' : 'text-gray-700'}`}>
                          {r.label}
                        </span>
                        <span className={`text-[9px] ${resolution === r.value ? 'text-primary/70' : 'text-gray-400'}`}>
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
              {/* 选中图片预览 */}
              {selectedIds.length > 0 && (() => {
                const selectedImages = items.filter(item => selectedIds.includes(item.id) && item.type === 'image');
                if (selectedImages.length === 0) return null;
                return (
                  <div className="flex gap-2 mb-3 px-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {selectedImages.map((img, index) => (
                      <div
                        key={img.id}
                        className="relative w-10 h-10 rounded-lg overflow-hidden shadow-sm border border-gray-100 animate-in zoom-in-75 fade-in duration-200"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <img src={img.src} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
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

                {/* Settings Toggle - 仅在没有选中图片时显示 */}
                {selectedIds.length === 0 && (
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-1.5 rounded-full transition-colors ${showSettings ? 'bg-violet-100 text-violet-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Settings2 size={16} />
                  </button>
                )}

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

      {/* 裁切模式弹窗 */}
      {croppingImageId && (() => {
        const croppingItem = items.find(i => i.id === croppingImageId);
        if (!croppingItem) return null;

        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
            <div className="flex flex-col items-center gap-4">
              {/* 裁切区域 */}
              <div
                className="relative bg-gray-900 rounded-lg overflow-hidden"
                style={{ width: Math.min(croppingItem.width, 600), height: Math.min(croppingItem.height, 500) }}
              >
                <img
                  src={croppingItem.src}
                  alt="裁切预览"
                  className="w-full h-full object-contain"
                  style={{ opacity: 0.5 }}
                />
                {/* 裁切框 */}
                <div
                  className="absolute border-2 border-white shadow-lg"
                  style={{
                    left: (cropBox.x / croppingItem.width) * 100 + '%',
                    top: (cropBox.y / croppingItem.height) * 100 + '%',
                    width: (cropBox.width / croppingItem.width) * 100 + '%',
                    height: (cropBox.height / croppingItem.height) * 100 + '%',
                  }}
                >
                  <img
                    src={croppingItem.src}
                    alt=""
                    className="absolute object-contain"
                    style={{
                      width: (croppingItem.width / cropBox.width) * 100 + '%',
                      height: (croppingItem.height / cropBox.height) * 100 + '%',
                      left: -(cropBox.x / cropBox.width) * 100 + '%',
                      top: -(cropBox.y / cropBox.height) * 100 + '%',
                    }}
                  />
                  {/* 四角拖拽手柄 */}
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-white rounded-full cursor-nwse-resize" />
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full cursor-nesw-resize" />
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-white rounded-full cursor-nesw-resize" />
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-white rounded-full cursor-nwse-resize" />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={cancelCrop}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={applyCrop}
                  className="px-6 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
                >
                  应用裁切
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* 场景详情弹窗 */}
      {showSceneDetail && selectedSceneId && storyboard && (() => {
        const selectedScene = storyboard.scenes.find(s => s.id === selectedSceneId);
        if (!selectedScene) return null;
        return (
          <SceneDetailModal
            scene={selectedScene}
            onClose={() => setShowSceneDetail(false)}
            onUpdate={handleSceneUpdate}
            onDelete={() => {
              handleSceneDelete(selectedScene.id);
              setShowSceneDetail(false);
            }}
          />
        );
      })()}

      {/* 图片选择器 */}
      {showImagePicker && (
        <ImagePicker
          canvasItems={items}
          onSelect={handleSelectCanvasImage}
          onClose={() => {
            setShowImagePicker(false);
            setImagePickerSceneId(null);
          }}
        />
      )}

      {/* Chatbot 面板 */}
      <ChatbotPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* 全屏分镜编辑器弹窗 */}
      {showStoryboard && (
        <StoryboardEditor
          scenes={currentStoryboard.scenes}
          totalDuration={currentStoryboard.totalDuration}
          onClose={() => setShowStoryboard(false)}
          onSceneClick={handleSceneClick}
          onSceneUpdate={handleSceneUpdate}
          onSceneDelete={handleSceneDelete}
          onAddScene={handleAddScene}
          onOpenImagePicker={handleOpenImagePicker}
          onImportScript={handleImportScript}
          canvasItems={items}
        />
      )}

      <CanvasOnboarding
        onSelectTemplate={handleTemplateSelect}
        onClose={() => { }}
      />
      <CanvasOnboarding
        onSelectTemplate={handleTemplateSelect}
        onClose={() => { }}
      />
    </div>
  );
}
