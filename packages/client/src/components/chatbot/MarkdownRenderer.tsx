import React, { memo, Component, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

// 错误边界组件 - 防止 Markdown 渲染错误导致白屏
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallbackContent: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallbackContent: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MarkdownRenderer] 渲染错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // 渲染失败时显示纯文本
      return (
        <div className="text-sm text-gray-700 whitespace-pre-wrap">
          {this.props.fallbackContent}
        </div>
      );
    }
    return this.props.children;
  }
}

// 代码块组件
const CodeBlock = memo(({ language, children }: { language: string; children: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      {language && (
        <div className="absolute left-3 top-0 -translate-y-1/2 px-2 py-0.5 text-xs text-gray-400 bg-gray-800 rounded">
          {language}
        </div>
      )}
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.8125rem',
          padding: '1rem',
        }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// 内部 Markdown 渲染组件
const MarkdownContent: React.FC<MarkdownRendererProps> = memo(({ content, isStreaming }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 标题
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-4 mb-2 text-gray-800 border-b border-gray-200 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-4 mb-2 text-gray-800">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold mt-3 mb-1.5 text-gray-700">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-2 mb-1 text-gray-700">
              {children}
            </h4>
          ),

          // 段落
          p: ({ children }) => (
            <p className="my-2 leading-relaxed text-gray-700">
              {children}
            </p>
          ),

          // 列表
          ul: ({ children }) => (
            <ul className="my-2 ml-1 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-1 space-y-1 list-decimal list-inside">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex gap-2">
              <span className="flex-1">{children}</span>
            </li>
          ),

          // 代码
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded text-[0.8125rem] font-mono" {...props}>
                  {children}
                </code>
              );
            }

            // 安全地提取代码内容
            let codeContent = '';
            if (typeof children === 'string') {
              codeContent = children;
            } else if (Array.isArray(children)) {
              codeContent = children.map(child =>
                typeof child === 'string' ? child : ''
              ).join('');
            } else if (children != null) {
              codeContent = String(children);
            }

            return (
              <CodeBlock language={match?.[1] || ''}>
                {codeContent.replace(/\n$/, '')}
              </CodeBlock>
            );
          },

          // 引用
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-4 border-gray-300 text-gray-600 italic">
              {children}
            </blockquote>
          ),

          // 链接
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              {children}
            </a>
          ),

          // 粗体和斜体
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-800">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),

          // 分隔线
          hr: () => <hr className="my-4 border-gray-200" />,

          // 表格
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-100">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-3 py-2 text-gray-600">
              {children}
            </td>
          ),

          // 任务列表
          input: ({ checked }) => (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-2 rounded border-gray-300"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 rounded-sm" />
      )}
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

// 导出包装了错误边界的组件
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content, isStreaming }) => {
  return (
    <MarkdownErrorBoundary fallbackContent={content}>
      <MarkdownContent content={content} isStreaming={isStreaming} />
    </MarkdownErrorBoundary>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
