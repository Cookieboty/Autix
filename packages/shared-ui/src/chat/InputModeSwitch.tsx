'use client';

import { ImageIcon, MessageSquare, Video, type LucideIcon } from 'lucide-react';
import type { AgentKind } from '@autix/shared-lib';
import { cn } from '../ui/utils';

export type InputMode = Extract<AgentKind, 'chat' | 'image' | 'video'>;

interface InputModeSwitchProps {
  value: InputMode;
  onChange: (value: InputMode) => void;
  disabled?: boolean;
}

const ITEMS: Array<{
  value: InputMode;
  label: string;
  icon: LucideIcon;
}> = [
  { value: 'chat', label: '普通', icon: MessageSquare },
  { value: 'image', label: '图片', icon: ImageIcon },
  { value: 'video', label: '视频', icon: Video },
];

export function InputModeSwitch({
  value,
  onChange,
  disabled,
}: InputModeSwitchProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-white/12 bg-black/72 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-white/62 transition-colors',
              'hover:bg-white/[0.08] hover:text-white',
              active && 'bg-white text-black shadow-sm hover:bg-white hover:text-black',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <Icon className="size-3.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
