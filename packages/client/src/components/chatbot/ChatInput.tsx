import React, { useState, useRef, useCallback } from 'react';
import { ArrowUp, Paperclip, Globe, X, FileText, FileSpreadsheet, Presentation, File } from 'lucide-react';
import { ChatAttachment } from '@/types';
import { generateId } from '@/utils/id';

// 获取文件类型图标
const getFileIcon = (mimeType: string | undefined) => {
  if (!mimeType) return <File size={20} className="text-gray-600" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet size={20} className="text-green-600" />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText size={20} className="text-blue-600" />;
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return <Presentation size={20} className="text-orange-600" />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText size={20} className="text-red-600" />;
  }
  return <File size={20} className="text-gray-600" />;
};

// 获取文件扩展名
const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toUpperCase() || '';
};

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
  const isComposingRef = useRef(false); // 中文输入法组合状态

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
    // 中文输入法组合中，回车是选字，不发送
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      // 图片
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      // 文本
      'text/plain',
      // PDF
      'application/pdf',
      // Excel
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      // Word
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/msword', // doc
      // PowerPoint
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint', // ppt
    ];

    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        alert(`文件 ${file.name} 超过50MB限制`);
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        alert(`不支持的文件类型: ${file.type}\n支持: 图片、PDF、Excel、Word、PPT`);
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
              {attachment.type?.startsWith('image/') ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl border border-gray-200 flex flex-col items-center justify-center bg-white gap-1">
                  {getFileIcon(attachment.type)}
                  <span className="text-[9px] text-gray-500 font-medium">
                    {getFileExtension(attachment.name)}
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
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
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
              accept="image/*,.txt,.pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt"
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
              <span>{webSearchEnabled ? '联网已开启' : '联网'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
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
