'use client';

import React from 'react';

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
  message = 'AI 正在思考中', 
  progress 
}: ThinkingIndicatorProps) {
  const percentage = progress ? (progress.step / progress.totalSteps) * 100 : 0;
  
  return (
    <div className="flex justify-start">
      <div 
        className="relative flex flex-col gap-3 px-5 py-4 rounded-2xl max-w-[70%] backdrop-blur-sm"
        style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* 顶部：图标和标题 */}
        <div className="flex items-center gap-3">
          {/* 旋转加载图标 */}
          <div className="relative w-5 h-5 flex items-center justify-center">
            <svg 
              className="animate-spin w-5 h-5" 
              style={{ color: 'rgb(59, 130, 246)' }}
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="3"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          
          {/* 标题文本 */}
          <div className="flex-1">
            <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {progress ? progress.agentDisplayName : message}
            </div>
            {progress ? (
              <div className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                正在处理第 {progress.step} 步，共 {progress.totalSteps} 步
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                正在准备响应...
              </div>
            )}
          </div>
          
          {/* 百分比徽章 */}
          {progress && (
            <div 
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ 
                background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(147, 51, 234) 100%)',
                color: 'white',
              }}
            >
              {Math.round(percentage)}%
            </div>
          )}
        </div>
        
        {/* 进度条或脉冲动画 */}
        {progress ? (
          <div className="flex flex-col gap-2">
            <div 
              className="relative w-full h-2 rounded-full overflow-hidden" 
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
            >
              {/* 进度条背景光晕 */}
              <div 
                className="absolute inset-0 rounded-full transition-all duration-700 ease-out"
                style={{ 
                  width: `${percentage}%`,
                  background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%)',
                  filter: 'blur(8px)',
                }}
              />
              
              {/* 进度条主体 */}
              <div 
                className="relative h-full transition-all duration-700 ease-out rounded-full"
                style={{ 
                  width: `${percentage}%`,
                  background: 'linear-gradient(90deg, rgb(59, 130, 246) 0%, rgb(147, 51, 234) 100%)',
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
                }}
              >
                {/* 进度条光泽效果 */}
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 0%, transparent 50%, rgba(0, 0, 0, 0.1) 100%)',
                  }}
                />
                
                {/* 流动动画 */}
                <div 
                  className="absolute inset-0 rounded-full animate-pulse"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* 脉冲式加载条 */}
            <div 
              className="relative w-full h-2 rounded-full overflow-hidden" 
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
            >
              {/* 来回移动的光带 */}
              <div 
                className="absolute h-full rounded-full"
                style={{ 
                  width: '40%',
                  background: 'linear-gradient(90deg, transparent 0%, rgb(59, 130, 246) 50%, transparent 100%)',
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.6)',
                  animation: 'slideLoading 1.5s ease-in-out infinite',
                }}
              />
              
              {/* 添加动画样式 */}
              <style jsx>{`
                @keyframes slideLoading {
                  0% {
                    left: -40%;
                  }
                  50% {
                    left: 100%;
                  }
                  100% {
                    left: -40%;
                  }
                }
              `}</style>
            </div>
            
            {/* 跳动的点点 */}
            <div className="flex items-center justify-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{
                  background: 'linear-gradient(135deg, rgb(59, 130, 246), rgb(147, 51, 234))',
                  animationDelay: '0ms',
                  animationDuration: '1.4s',
                }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{
                  background: 'linear-gradient(135deg, rgb(59, 130, 246), rgb(147, 51, 234))',
                  animationDelay: '200ms',
                  animationDuration: '1.4s',
                }}
              />
              <div
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{
                  background: 'linear-gradient(135deg, rgb(59, 130, 246), rgb(147, 51, 234))',
                  animationDelay: '400ms',
                  animationDuration: '1.4s',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
