/**
 * UI Store - 界面状态管理
 *
 * 管理各种弹窗、面板、编辑状态等 UI 相关状态
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface UIState {
  // 项目名称编辑
  projectName: string;
  isEditingName: boolean;

  // 菜单和面板
  showAddMenu: boolean;
  showCommunityQR: boolean;
  isChatOpen: boolean;

  // 摄像头
  showCamera: boolean;
  facingMode: 'user' | 'environment';
  stream: MediaStream | null;

  // 拖放
  isDragOver: boolean;

  // 文字编辑
  editingTextId: string | null;
}

interface UIActions {
  // Project Name
  setProjectName: (name: string) => void;
  setIsEditingName: (isEditing: boolean) => void;

  // Menus and Panels
  setShowAddMenu: (show: boolean) => void;
  toggleAddMenu: () => void;
  setShowCommunityQR: (show: boolean) => void;
  toggleCommunityQR: () => void;
  setIsChatOpen: (isOpen: boolean) => void;
  toggleChat: () => void;

  // Camera
  setShowCamera: (show: boolean) => void;
  setFacingMode: (mode: 'user' | 'environment') => void;
  toggleFacingMode: () => void;
  setStream: (stream: MediaStream | null) => void;
  closeCamera: () => void;

  // Drag and Drop
  setIsDragOver: (isDragOver: boolean) => void;

  // Text Editing
  setEditingTextId: (id: string | null) => void;
  startEditingText: (id: string) => void;
  stopEditingText: () => void;

  // Reset
  resetUI: () => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  projectName: '',
  isEditingName: false,
  showAddMenu: false,
  showCommunityQR: false,
  isChatOpen: false,
  showCamera: false,
  facingMode: 'user',
  stream: null,
  isDragOver: false,
  editingTextId: null,
};

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Project Name Actions
    setProjectName: (projectName) => set({ projectName }),
    setIsEditingName: (isEditingName) => set({ isEditingName }),

    // Menu Actions
    setShowAddMenu: (showAddMenu) => set({ showAddMenu }),
    toggleAddMenu: () => set((state) => ({ showAddMenu: !state.showAddMenu })),
    setShowCommunityQR: (showCommunityQR) => set({ showCommunityQR }),
    toggleCommunityQR: () => set((state) => ({ showCommunityQR: !state.showCommunityQR })),
    setIsChatOpen: (isChatOpen) => set({ isChatOpen }),
    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

    // Camera Actions
    setShowCamera: (showCamera) => set({ showCamera }),
    setFacingMode: (facingMode) => set({ facingMode }),
    toggleFacingMode: () =>
      set((state) => ({
        facingMode: state.facingMode === 'user' ? 'environment' : 'user',
      })),
    setStream: (stream) => set({ stream }),
    closeCamera: () => {
      const state = get();
      if (state.stream) {
        state.stream.getTracks().forEach((track) => track.stop());
      }
      set({ showCamera: false, stream: null });
    },

    // Drag and Drop Actions
    setIsDragOver: (isDragOver) => set({ isDragOver }),

    // Text Editing Actions
    setEditingTextId: (editingTextId) => set({ editingTextId }),
    startEditingText: (id) => set({ editingTextId: id }),
    stopEditingText: () => set({ editingTextId: null }),

    // Reset
    resetUI: () => {
      const state = get();
      if (state.stream) {
        state.stream.getTracks().forEach((track) => track.stop());
      }
      set(initialState);
    },
  }))
);

// 选择器 hooks
export const useProjectName = () => useUIStore((state) => state.projectName);
export const useIsEditingName = () => useUIStore((state) => state.isEditingName);
export const useShowAddMenu = () => useUIStore((state) => state.showAddMenu);
export const useShowCommunityQR = () => useUIStore((state) => state.showCommunityQR);
export const useIsChatOpen = () => useUIStore((state) => state.isChatOpen);
export const useShowCamera = () => useUIStore((state) => state.showCamera);
export const useEditingTextId = () => useUIStore((state) => state.editingTextId);
