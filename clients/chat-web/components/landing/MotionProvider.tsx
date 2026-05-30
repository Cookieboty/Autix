'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

// 客户端边界:framer-motion 的 MotionConfig 依赖 React context,不能直接在 RSC 渲染。
// reducedMotion="user" 让所有子级 motion 在系统「减少动态效果」时自动跳过位移/缩放。
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
