// Components
export { CanvasHeader } from './CanvasHeader';
export { CanvasLayers } from './CanvasLayers';
export { CanvasToolbar } from './CanvasToolbar';
export { ZoomControls } from './ZoomControls';
export { CameraModal } from './CameraModal';
export { GenerationBar } from './GenerationBar';
export { ChatButton } from './ChatButton';
export { SelectionRect } from './SelectionRect';
export { DragOverlay } from './DragOverlay';

// Context
export { CanvasProvider, useCanvasContext } from './CanvasContext';

// Hooks
export { useCanvasState, type CanvasStateReturn } from './hooks/useCanvasState';
export { useAutoSave } from './hooks/useAutoSave';
export { useConnectionLines } from './hooks/useConnectionLines';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export {
  useCanvasInteraction,
  screenToCanvas,
  canvasToScreen,
  findClickedItem,
  calculateBoundingBox,
  type InteractionHandlers,
} from './hooks/useCanvasInteraction';
