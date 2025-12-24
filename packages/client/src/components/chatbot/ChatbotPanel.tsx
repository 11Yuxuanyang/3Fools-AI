import React, { useState, useCallback } from 'react';
import { X, Plus, History, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessage, ChatAttachment } from '@/types';
import { chatStream, ChatMessageInput } from '@/services/api';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatbotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleSend = useCallback(async (content: string, attachments: ChatAttachment[]) => {
    if (isLoading) return;

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: Date.now(),
    };

    // 创建助手消息占位符
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      // 构建消息历史
      const messageHistory: ChatMessageInput[] = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments?.map((a) => ({
            type: a.type,
            content: a.content,
          })),
        })),
        {
          role: 'user' as const,
          content,
          attachments: attachments.map((a) => ({
            type: a.type,
            content: a.content,
          })),
        },
      ];

      // 流式获取响应
      let fullContent = '';
      for await (const chunk of chatStream({
        messages: messageHistory,
        webSearchEnabled,
      })) {
        fullContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: fullContent }
              : m
          )
        );
      }

      // 完成流式响应
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : '发送失败，请重试';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: `错误: ${errorMessage}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [messages, webSearchEnabled, isLoading]);

  const handleQuickPrompt = (prompt: string) => {
    handleSend(prompt, []);
  };

  const handleClear = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed right-4 top-16 bottom-4 bg-[#fafafa] border border-gray-200/80 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 rounded-2xl overflow-hidden ${
        isMaximized ? 'left-4' : 'w-[420px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">新对话</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="新建对话"
          >
            <Plus size={18} />
          </button>
          <button
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="历史记录"
          >
            <History size={18} />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={isMaximized ? "缩小" : "最大化"}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-1"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Message List */}
      <MessageList
        messages={messages}
        onQuickPrompt={handleQuickPrompt}
      />

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onWebSearchToggle={setWebSearchEnabled}
        webSearchEnabled={webSearchEnabled}
        isLoading={isLoading}
      />
    </div>
  );
};
