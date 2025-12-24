import React, { useState, useRef, useCallback } from 'react';
import { ArrowUp, Paperclip, Globe, X, ChevronDown } from 'lucide-react';
import { ChatAttachment } from '@/types';
import { generateId } from '@/utils/id';

interface ChatInputProps {
  onSend: (content: string, attachments: ChatAttachment[]) => void;
  onWebSearchToggle: (enabled: boolean) => void;
  webSearchEnabled: boolean;
  isLoading: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onWebSearchToggle,
  webSearchEnabled,
  isLoading,
  disabled,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, []);

  const handleSubmit = () => {
    if (!content.trim() && attachments.length === 0) return;
    if (isLoading || disabled) return;

    onSend(content.trim(), attachments);
    setContent('');
    setAttachments([]);

    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain', 'application/pdf'];

    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        alert(`文件 ${file.name} 超过10MB限制`);
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        alert(`不支持的文件类型: ${file.type}`);
        continue;
      }

      const content = await readFileAsBase64(file);
      const attachment: ChatAttachment = {
        id: generateId(),
        name: file.name,
        type: file.type,
        size: file.size,
        content,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };

      setAttachments((prev) => [...prev, attachment]);
    }

    // 清空 input
    e.target.value = '';
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const canSend = (content.trim() || attachments.length > 0) && !isLoading && !disabled;

  return (
    <div className="p-4 bg-[#fafafa]">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 px-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative group animate-in zoom-in-95 duration-200">
              {attachment.type.startsWith('image/') ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl border border-gray-200 flex items-center justify-center bg-white">
                  <span className="text-[10px] text-gray-500 text-center px-1 truncate">
                    {attachment.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Container */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        {/* Textarea */}
        <div className="px-4 pt-4 pb-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="选择文件或输入任何问题"
            disabled={isLoading || disabled}
            rows={1}
            className="w-full resize-none bg-transparent text-gray-600 placeholder-gray-400/80 text-sm focus:outline-none disabled:text-gray-400"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || disabled}
              className="p-2 rounded-lg border border-gray-200/80 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Web Search Toggle - Pill Style */}
            <button
              onClick={() => onWebSearchToggle(!webSearchEnabled)}
              disabled={isLoading || disabled}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all disabled:opacity-50 text-sm
                ${webSearchEnabled
                  ? 'border-cyan-300 text-cyan-600 bg-cyan-50'
                  : 'border-gray-200/80 text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
              `}
            >
              <Globe size={16} />
              <span>{webSearchEnabled ? '联网已开启' : '全部来源'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <button
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200/80 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            >
              <span>星流</span>
              <ChevronDown size={14} />
            </button>

            {/* Send Button */}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`
                p-2.5 rounded-full transition-all duration-200
                ${canSend
                  ? 'bg-gray-600 text-white hover:bg-gray-700 shadow-sm'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
              `}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
