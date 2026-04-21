'use client';

interface ThinkingIndicatorProps {
  message?: string;
  progress?: {
    agent: string;
    agentDisplayName: string;
    step: number;
    totalSteps: number;
  } | null;
}

export function ThinkingIndicator({
  message = 'Claude 正在整理回答',
  progress,
}: ThinkingIndicatorProps) {
  const percentage = progress ? (progress.step / progress.totalSteps) * 100 : 0;

  return (
    <div className="flex justify-start">
      <div
        className="flex w-full max-w-[720px] flex-col gap-4 rounded-lg px-5 py-4"
        style={{
          backgroundColor: 'var(--chat-thinking-bg)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--panel)' }}>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: 'var(--accent)', animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: 'var(--accent)', animationDelay: '180ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: 'var(--accent)', animationDelay: '360ms' }} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {progress ? progress.agentDisplayName : message}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {progress
                ? `正在执行第 ${progress.step} 步，共 ${progress.totalSteps} 步`
                : '正在准备响应内容…'}
            </div>
          </div>

          {progress && (
            <div
              className="rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums"
              style={{
                backgroundColor: 'var(--panel)',
                color: 'var(--muted)',
                border: '1px solid var(--border)',
              }}
            >
              {Math.round(percentage)}%
            </div>
          )}
        </div>

        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: progress ? `${percentage}%` : '28%',
              backgroundColor: 'var(--foreground)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
