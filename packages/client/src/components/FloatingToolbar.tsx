import React, { useState } from 'react';
import { 
  Maximize2, 
  Scissors, 
  Eraser, 
  Paintbrush, 
  Download, 
  Trash2, 
  Expand,
  Wand2,
} from 'lucide-react';
import { IconBtn } from './IconBtn';

interface FloatingToolbarProps {
  onUpscale: () => void;
  onRemoveBg: () => void;
  onEdit: (prompt: string) => void;
  onExpand: () => void;
  onDelete: () => void;
  onDownload: () => void;
  isProcessing: boolean;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onUpscale,
  onRemoveBg,
  onEdit,
  onExpand,
  onDelete,
  onDownload,
  isProcessing
}) => {
  const [showEditInput, setShowEditInput] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPrompt.trim()) {
      onEdit(editPrompt);
      setShowEditInput(false);
      setEditPrompt("");
    }
  };

  return (
    <div
      className="absolute top-[-60px] left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-lg p-1.5 flex items-center gap-1">
        
        {/* Magic Edit Input Overlay */}
        {showEditInput ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-2 px-2 py-1">
             <input
                type="text"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="描述修改内容..."
                className="bg-gray-100 border-none rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary w-64"
                autoFocus
             />
             <button type="submit" className="bg-primary hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
               确定
             </button>
             <button type="button" onClick={() => setShowEditInput(false)} className="text-gray-400 hover:text-gray-600 px-1">
               ✕
             </button>
          </form>
        ) : (
          <>
             <div className="flex gap-1 pr-2 border-r border-gray-200">
              <IconBtn 
                icon={<Maximize2 size={18} />} 
                onClick={onUpscale} 
                disabled={isProcessing}
                tooltip="放大至4K"
              />
               <IconBtn 
                icon={<Expand size={18} />} 
                onClick={onExpand} 
                disabled={isProcessing}
                tooltip="扩展画面"
              />
            </div>

            <div className="flex gap-1 pr-2 border-r border-gray-200">
              <IconBtn 
                icon={<Scissors size={18} />} 
                onClick={onRemoveBg} 
                disabled={isProcessing}
                tooltip="移除背景"
              />
              <IconBtn 
                icon={<Eraser size={18} />} 
                onClick={() => {
                   setShowEditInput(true);
                   setEditPrompt("移除物体...");
                }}
                disabled={isProcessing}
                tooltip="擦除物体"
              />
               <IconBtn 
                icon={<Paintbrush size={18} />} 
                onClick={() => {
                   setShowEditInput(true);
                   setEditPrompt("修改...");
                }}
                disabled={isProcessing}
                tooltip="局部修改"
              />
               <IconBtn 
                icon={<Wand2 size={18} />} 
                onClick={() => setShowEditInput(true)} 
                disabled={isProcessing}
                className="text-accent hover:text-accent/80 hover:bg-accent/10"
                tooltip="魔法编辑"
              />
            </div>

            <div className="flex gap-1 pl-1">
               <IconBtn 
                icon={<Download size={18} />} 
                onClick={onDownload} 
                disabled={isProcessing}
                tooltip="下载"
              />
              <IconBtn 
                icon={<Trash2 size={18} />} 
                onClick={onDelete} 
                disabled={isProcessing}
                className="hover:bg-red-50 hover:text-red-500"
                tooltip="删除"
              />
            </div>
          </>
        )}
      </div>
      
      {isProcessing && (
         <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-primary/20 text-xs text-primary font-medium animate-pulse whitespace-nowrap shadow-sm">
           ✨ AI 正在处理...
         </div>
      )}
    </div>
  );
};