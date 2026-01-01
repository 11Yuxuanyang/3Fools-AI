/**
 * Generation Store - AI 生成任务状态管理
 *
 * 管理图片生成任务、进行中的处理等
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// 生成任务类型
export interface GeneratingTask {
  id: string;
  position: { x: number; y: number; width: number; height: number };
  sourceIds: string[];
}

interface GenerationState {
  // 生成提示词
  prompt: string;
  // 宽高比
  aspectRatio: string;
  // 分辨率
  resolution: string;
  // 是否显示设置面板
  showSettings: boolean;
  // 正在处理的图片 ID 集合
  processingIds: Set<string>;
  // 并发生成任务列表
  generatingTasks: GeneratingTask[];
}

interface GenerationActions {
  // Prompt
  setPrompt: (prompt: string) => void;

  // Settings
  setAspectRatio: (ratio: string) => void;
  setResolution: (resolution: string) => void;
  setShowSettings: (show: boolean) => void;
  toggleSettings: () => void;

  // Processing
  addProcessingId: (id: string) => void;
  removeProcessingId: (id: string) => void;
  isProcessing: (id: string) => boolean;
  clearProcessingIds: () => void;

  // Tasks
  addGeneratingTask: (task: GeneratingTask) => void;
  removeGeneratingTask: (taskId: string) => void;
  getGeneratingTask: (taskId: string) => GeneratingTask | undefined;
  clearGeneratingTasks: () => void;
}

type GenerationStore = GenerationState & GenerationActions;

export const useGenerationStore = create<GenerationStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    prompt: '',
    aspectRatio: '1:1',
    resolution: '2K',
    showSettings: false,
    processingIds: new Set(),
    generatingTasks: [],

    // Prompt Actions
    setPrompt: (prompt) => set({ prompt }),

    // Settings Actions
    setAspectRatio: (aspectRatio) => set({ aspectRatio }),
    setResolution: (resolution) => set({ resolution }),
    setShowSettings: (showSettings) => set({ showSettings }),
    toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

    // Processing Actions
    addProcessingId: (id) =>
      set((state) => ({
        processingIds: new Set(state.processingIds).add(id),
      })),

    removeProcessingId: (id) =>
      set((state) => {
        const next = new Set(state.processingIds);
        next.delete(id);
        return { processingIds: next };
      }),

    isProcessing: (id) => get().processingIds.has(id),

    clearProcessingIds: () => set({ processingIds: new Set() }),

    // Task Actions
    addGeneratingTask: (task) =>
      set((state) => ({
        generatingTasks: [...state.generatingTasks, task],
      })),

    removeGeneratingTask: (taskId) =>
      set((state) => ({
        generatingTasks: state.generatingTasks.filter((t) => t.id !== taskId),
      })),

    getGeneratingTask: (taskId) =>
      get().generatingTasks.find((t) => t.id === taskId),

    clearGeneratingTasks: () => set({ generatingTasks: [] }),
  }))
);

// 选择器 hooks
export const usePrompt = () => useGenerationStore((state) => state.prompt);
export const useAspectRatio = () => useGenerationStore((state) => state.aspectRatio);
export const useResolution = () => useGenerationStore((state) => state.resolution);
export const useShowSettings = () => useGenerationStore((state) => state.showSettings);
export const useProcessingIds = () => useGenerationStore((state) => state.processingIds);
export const useGeneratingTasks = () => useGenerationStore((state) => state.generatingTasks);
