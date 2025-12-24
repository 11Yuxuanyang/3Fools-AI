import React from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';
import { ChatMessage } from '@/types';

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

  // 简单的 Markdown 渲染
  const renderContent = (content: string) => {
    // 处理代码块
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const firstLine = code.split('\n')[0];
        const language = firstLine.match(/^\w+$/) ? firstLine : '';
        const codeContent = language ? code.slice(firstLine.length + 1) : code;

        return (
          <pre key={index} className="bg-gray-800 text-gray-100 rounded-lg p-3 my-3 overflow-x-auto text-sm">
            <code>{codeContent.trim()}</code>
          </pre>
        );
      }

      // 处理普通文本
      return (
        <div key={index}>
          {part.split('\n').map((line, lineIndex) => {
            // 处理标题
            if (line.startsWith('## ')) {
              return <h2 key={lineIndex} className="text-base font-bold mt-4 mb-2 text-gray-800">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
              return <h3 key={lineIndex} className="text-sm font-bold mt-3 mb-1 text-gray-700">{line.slice(4)}</h3>;
            }
            // 处理粗体
            const boldProcessed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
            // 处理列表
            if (line.startsWith('- ')) {
              return (
                <div key={lineIndex} className="flex gap-2 my-1">
                  <span className="text-gray-400">•</span>
                  <span dangerouslySetInnerHTML={{ __html: boldProcessed.slice(2) }} />
                </div>
              );
            }
            if (/^\d+\.\s/.test(line)) {
              const match = line.match(/^(\d+)\.\s(.*)$/);
              if (match) {
                return (
                  <div key={lineIndex} className="flex gap-2 my-1">
                    <span className="text-gray-400 min-w-[1.2em]">{match[1]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: match[2].replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>') }} />
                  </div>
                );
              }
            }
            // 处理分隔线
            if (line === '---') {
              return <hr key={lineIndex} className="my-4 border-gray-200" />;
            }
            // 普通段落
            if (line.trim()) {
              return <p key={lineIndex} className="my-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: boldProcessed }} />;
            }
            return <div key={lineIndex} className="h-2" />;
          })}
        </div>
      );
    });
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
                  {attachment.type.startsWith('image/') ? (
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
      {/* AI 名称 */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={16} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-500">星流</span>
      </div>

      {/* 消息内容 */}
      <div>
          <div className="bg-gray-100/80 rounded-2xl rounded-tl-md px-4 py-3">
            <div className="text-sm text-gray-700 leading-relaxed">
              {renderContent(message.content)}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 rounded-sm" />
              )}
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 ml-1">
              {message.attachments.map((attachment) => (
                <div key={attachment.id}>
                  {attachment.type.startsWith('image/') ? (
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
