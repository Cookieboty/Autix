'use client';

import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@autix/shared-ui/ui';

export interface PageHeaderProps {
  /** 页面标题 */
  title: string;
  /** 副标题 / 描述（可选） */
  subtitle?: string;
  /** 返回行为，不传默认 history.back（react-router 的 navigate(-1)） */
  onBack?: () => void;
  /** 是否隐藏返回按钮（顶层页面用） */
  hideBack?: boolean;
  /** 标题右侧操作区（保存按钮、Tag 等） */
  actions?: React.ReactNode;
}

/**
 * 二级页面统一 header — 左侧返回箭头 + title/subtitle + 右侧操作槽。
 */
export function PageHeader({
  title,
  subtitle,
  onBack,
  hideBack = false,
  actions,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const t = useTranslations('layout');
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        backgroundColor: 'var(--panel)',
      }}
    >
      {!hideBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          aria-label={t('back')}
          className="p-0 w-9 h-9 cursor-pointer rounded-md"
          style={{ flexShrink: 0 }}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: 'var(--foreground)' }} />
        </Button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--foreground)',
            lineHeight: 1.3,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={title}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              margin: '2px 0 0',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={subtitle}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
