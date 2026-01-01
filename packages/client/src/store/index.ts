/**
 * Store Index - 状态管理统一导出
 *
 * 所有 Zustand stores 的统一入口
 */

// Canvas Store - 画布核心状态
export {
  useCanvasStore,
  useItems,
  useSelectedIds,
  useToolMode,
  useToolColors,
} from './canvasStore';

// Viewport Store - 视口状态
export {
  useViewportStore,
  useScale,
  usePan,
  useIsPanning,
} from './viewportStore';

// Generation Store - AI 生成任务状态
export {
  useGenerationStore,
  usePrompt,
  useAspectRatio,
  useResolution,
  useShowSettings,
  useProcessingIds,
  useGeneratingTasks,
} from './generationStore';
export type { GeneratingTask } from './generationStore';

// UI Store - 界面状态
export {
  useUIStore,
  useProjectName,
  useIsEditingName,
  useShowAddMenu,
  useShowCommunityQR,
  useIsChatOpen,
  useShowCamera,
  useEditingTextId,
} from './uiStore';

// Interaction Store - 交互状态
export {
  useInteractionStore,
  useIsDragging,
  useIsResizing,
  useIsSelecting,
  useLinePointDrag,
  getSelectionRect,
} from './interactionStore';
