import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ChatMessage } from '@/types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  onQuickPrompt?: (prompt: string) => void;
}

// 快捷提示分组
const quickPromptGroups = [
  [
    '你能为我做什么？',
    '帮我写一个剧本大纲',
    '创作一个科幻故事',
  ],
  [
    '设计一个电影场景',
    '写一段感人的对白',
    '创建角色人物设定',
  ],
  [
    '分析一个经典剧本',
    '帮我改进故事情节',
    '创作一首诗歌',
  ],
];

export const MessageList: React.FC<MessageListProps> = ({ messages, onQuickPrompt }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [promptGroupIndex, setPromptGroupIndex] = useState(0);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRefreshPrompts = () => {
    setPromptGroupIndex((prev) => (prev + 1) % quickPromptGroups.length);
  };

  const currentPrompts = quickPromptGroups[promptGroupIndex];

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col px-6 py-8 overflow-y-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">
            <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
              又来找我了？
            </span>
          </h1>
          <p className="text-xl text-gray-400">
            说吧，这次想写点什么~
          </p>
        </div>

        {/* Quick Prompts */}
        <div className="space-y-3">
          {currentPrompts.map((prompt, index) => (
            <button
              key={`${promptGroupIndex}-${index}`}
              onClick={() => onQuickPrompt?.(prompt)}
              className="w-fit px-5 py-3 rounded-2xl bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 text-sm font-medium transition-all duration-200 hover:shadow-sm animate-in fade-in slide-in-from-left duration-300"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefreshPrompts}
          className="flex items-center gap-2 mt-6 text-gray-400 hover:text-gray-600 text-sm transition-colors group"
        >
          <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
          <span>换一换</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
