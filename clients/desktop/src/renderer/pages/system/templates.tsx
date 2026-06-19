'use client';

import { useEffect, useState } from 'react';
import { Button } from '@autix/shared-ui/ui';
import { getTemplateCategoryI18nKey } from '@autix/shared-ui/template';
import { Check, X, RotateCcw, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  templateAdminApi,
  type PromptTemplate,
  type TemplateStatus,
} from '@autix/sdk';

const statusColor: Record<TemplateStatus, string> = {
  PENDING: '#f59e0b',
  IN_REVIEW: '#3b82f6',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  ARCHIVED: '#6b7280',
};

export function SystemTemplatesPage() {
  const t = useTranslations('templateReview');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categoryOptions');
  const tTemplate = useTranslations('template');

  const STATUS_OPTIONS: { label: string; value: TemplateStatus | '' }[] = [
    { label: tCommon('all'), value: '' },
    { label: t('pending'), value: 'PENDING' },
    { label: t('inReview'), value: 'IN_REVIEW' },
    { label: t('approved'), value: 'APPROVED' },
    { label: t('rejected'), value: 'REJECTED' },
  ];
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const fetchList = async (p = page) => {
    setLoading(true);
    try {
      const res = await templateAdminApi.list({
        status: statusFilter || undefined,
        page: p,
        pageSize: 15,
      });
      const data = res.data as any;
      setTemplates(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(1); }, [statusFilter]);

  const handleReview = async (id: string, action: 'approve' | 'reject' | 'revise') => {
    setActing(true);
    try {
      await templateAdminApi.review(id, {
        action,
        reason: action !== 'approve' ? rejectReason : undefined,
      });
      setRejectReason('');
      setSelected(null);
      fetchList();
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <span className="flex-1" />
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className="px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: statusFilter === opt.value ? 'var(--accent)' : 'var(--panel-muted)',
                  color: statusFilter === opt.value ? '#fff' : 'var(--muted)',
                }}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('noData')}</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerTitle')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerStatus')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerSubmittedAt')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerActions')}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr
                    key={tpl.id}
                    className="transition-colors cursor-pointer"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: selected?.id === tpl.id ? 'var(--nav-item-active)' : 'transparent',
                    }}
                    onClick={() => setSelected(tpl)}
                  >
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{tpl.title}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{tCat(getTemplateCategoryI18nKey(tpl.category))}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${statusColor[tpl.status]}20`, color: statusColor[tpl.status] }}
                      >
                        {tpl.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>
                      {new Date(tpl.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setSelected(tpl)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-center gap-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => fetchList(page - 1)} className="cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {Math.ceil(total / 15)}</span>
            <Button size="sm" variant="ghost" disabled={page * 15 >= total} onClick={() => fetchList(page + 1)} className="cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview panel */}
      {selected && (
        <aside
          className="w-[360px] flex-shrink-0 overflow-y-auto p-5 space-y-4"
          style={{ borderLeft: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{selected.title}</h2>
            <button className="cursor-pointer" onClick={() => setSelected(null)}>
              <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
            </button>
          </div>

          {selected.coverImage && (
            <img src={selected.coverImage} alt="" className="w-full rounded-lg" style={{ border: '1px solid var(--border)' }} />
          )}

          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</p>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{tCat(getTemplateCategoryI18nKey(selected.category))}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>Prompt</p>
              <div
                className="p-3 rounded-md text-xs leading-5 font-mono"
                style={{ backgroundColor: 'var(--panel-muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                {selected.prompt}
              </div>
            </div>
            {selected.description && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{tTemplate('description')}</p>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.description}</p>
              </div>
            )}
            {selected.exampleImages.length > 0 && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{tTemplate('exampleImages')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {selected.exampleImages.map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full rounded object-cover aspect-square" />
                  ))}
                </div>
              </div>
            )}
            {selected.rejectReason && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: '#ef4444' }}>{t('rejectReason')}</p>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.rejectReason}</p>
              </div>
            )}
          </div>

          {/* Review actions */}
          {(selected.status === 'PENDING' || selected.status === 'IN_REVIEW') && (
            <div className="space-y-3 pt-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-md outline-none resize-none"
                style={{ border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)' }}
              />
              <div className="flex gap-2">
                <Button
                  
                  className="flex-1 cursor-pointer"
                  disabled={acting}
                  onClick={() => handleReview(selected.id, 'approve')}
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> {t('approve')}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 cursor-pointer"
                  style={{ color: '#ef4444' }}
                  disabled={acting}
                  onClick={() => handleReview(selected.id, 'reject')}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> {t('reject')}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 cursor-pointer"
                  disabled={acting}
                  onClick={() => handleReview(selected.id, 'revise')}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('revise')}
                </Button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
