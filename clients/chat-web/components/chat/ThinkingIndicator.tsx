'use client';

interface ThinkingIndicatorProps {
  message?: string;
}

export function ThinkingIndicator({ message = 'AI 正在思考中' }: ThinkingIndicatorProps) {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl max-w-[70%]" style={{ backgroundColor: 'var(--muted)' }}>
        <div className="flex items-center gap-2">
          {/* 三个点的加载动画 */}
          <div className="flex gap-1">
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                backgroundColor: 'var(--primary)',
                animationDelay: '0ms',
                animationDuration: '1s',
              }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                backgroundColor: 'var(--primary)',
                animationDelay: '150ms',
                animationDuration: '1s',
              }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                backgroundColor: 'var(--primary)',
                animationDelay: '300ms',
                animationDuration: '1s',
              }}
            />
          </div>
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {message}
          </span>
        </div>
      </div>
    </div>
  );
}
