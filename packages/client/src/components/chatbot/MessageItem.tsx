import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Logo } from '../Logo';
import { ChatMessage } from '@/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 用户消息
  if (isUser) {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-right duration-200">
        <div className="max-w-[85%] px-4 py-3 bg-gray-800 text-white rounded-2xl rounded-tr-md">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((attachment) => (
                <div key={attachment.id}>
                  {attachment.type?.startsWith('image/') ? (
                    <img
                      src={attachment.previewUrl || attachment.content}
                      alt={attachment.name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 text-xs">
                      <span>{attachment.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // AI 消息
  return (
    <div className="animate-in fade-in slide-in-from-left duration-200">
      {/* AI 头像和名称 */}
      <div className="flex items-center gap-2 mb-2">
        <Logo size={20} showText={false} />
        <span className="text-sm font-medium text-gray-500">三傻</span>
      </div>

      {/* 消息内容 */}
      <div>
          <div className="bg-gray-100/80 rounded-2xl rounded-tl-md px-4 py-3">
            <div className="text-sm leading-relaxed">
              <MarkdownRenderer content={message.content} isStreaming={message.isStreaming} />
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 ml-1">
              {message.attachments.map((attachment) => (
                <div key={attachment.id}>
                  {attachment.type?.startsWith('image/') ? (
                    <img
                      src={attachment.previewUrl || attachment.content}
                      alt={attachment.name}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600">
                      <span>{attachment.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        {/* Copy button */}
        {isAssistant && !message.isStreaming && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制'}
          </button>
        )}
      </div>
    </div>
  );
};
