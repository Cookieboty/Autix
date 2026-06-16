'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox } from '@autix/shared-ui/ui';
import { TemplateImportDialog } from '@autix/shared-ui/admin';
import { Check, X, RotateCcw, Eye, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  imageTemplateAdminApi,
  videoTemplateAdminApi,
  batchJobApi,
  type ImageTemplate,
  type VideoTemplate,
  type TemplateStatus,
} from '@/lib/api';

type TemplateItem = ImageTemplate | VideoTemplate;
type ResourceTypeSlug = 'image-templates' | 'video-templates';

const CATEGORY_I18N_KEY: Record<string, string> = {
  '人像': 'portrait', '风景': 'landscape', '产品': 'product',
  '插画': 'illustration', '建筑': 'architecture', '科幻': 'scifi', '场景': 'scene',
};

const statusStyle: Record<TemplateStatus, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' },
  IN_REVIEW: { backgroundColor: 'var(--info-bg)', color: 'var(--info-foreground)' },
  APPROVED: { backgroundColor: 'var(--success-soft)', color: 'var(--success)' },
  REJECTED: { backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' },
  ARCHIVED: { backgroundColor: 'var(--muted-soft)', color: 'var(--muted)' },
};

const filterButtonClass = (active: boolean) =>
  [
    'cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
  ].join(' ');

export default function AdminTemplatesPage() {
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

  const [resourceType, setResourceType] = useState<ResourceTypeSlug>('image-templates');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TemplateItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const getAdminApi = () =>
    resourceType === 'image-templates' ? imageTemplateAdminApi : videoTemplateAdminApi;

  const fetchList = async (p = page) => {
    setLoading(true);
    try {
      const res = await getAdminApi().list({
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

  useEffect(() => {
    setSelected(null);
    setSelectedIds(new Set());
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, resourceType]);

  const handleReview = async (id: string, action: 'approve' | 'reject' | 'revise') => {
    setActing(true);
    try {
      await getAdminApi().review(id, {
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

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map((tpl) => tpl.id)));
    }
  };

  const handleBatchReview = async (action: 'approve' | 'reject' | 'revise') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let reason: string | undefined;
    if (action !== 'approve') {
      reason = window.prompt(t('rejectReasonPlaceholder')) ?? undefined;
    }
    await getAdminApi().batchReview(ids, action, reason);
    setSelectedIds(new Set());
    fetchList();
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(t('confirmBatchDelete', { count: ids.length }))) return;
    await getAdminApi().batchDelete(ids);
    setSelectedIds(new Set());
    fetchList();
  };

  const handleToggleHot = async (tpl: TemplateItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !(tpl as { isHot?: boolean }).isHot;
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...t, isHot: newVal } : t)),
    );
    try {
      await getAdminApi().setHot(tpl.id, newVal);
    } catch {
      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? { ...t, isHot: !newVal } : t)),
      );
    }
  };

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async () => {
    const res = await getAdminApi().importTemplate();
    downloadJson(res.data, `${resourceType}-template.json`);
  };

  const handleExport = async () => {
    const res = await getAdminApi().exportTemplates({ status: statusFilter || undefined });
    downloadJson(res.data, `${resourceType}-export.json`);
  };

  const mediaList: string[] =
    selected == null
      ? []
      : resourceType === 'image-templates'
        ? ((selected as ImageTemplate).exampleImages ?? [])
        : ((selected as VideoTemplate).exampleMedia ?? []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{t('title')}</h1>
          <div className="flex gap-1.5">
            {([
              { label: t('imageTemplates'), value: 'image-templates' as const },
              { label: t('videoTemplates'), value: 'video-templates' as const },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={filterButtonClass(resourceType === opt.value)}
                onClick={() => { setResourceType(opt.value); setPage(1); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={filterButtonClass(statusFilter === opt.value)}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setImportOpen(true)}>
            {t('batchImport')}
          </Button>
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={handleDownloadTemplate}>
            {t('downloadTemplate')}
          </Button>
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={handleExport}>
            {t('exportTemplates')}
          </Button>
        </div>

        {/* Floating batch operations bar */}
        {selectedIds.size > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--panel-muted)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              {t('selectedCount', { count: selectedIds.size })}
            </span>
            <span className="flex-1" />
            <Button size="sm" className="cursor-pointer" onClick={() => handleBatchReview('approve')}>
              {t('batchApprove')}
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" style={{ color: 'var(--danger)' }} onClick={() => handleBatchReview('reject')}>
              {t('batchReject')}
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => handleBatchReview('revise')}>
              {t('batchRevise')}
            </Button>
            <Button size="sm" variant="ghost" className="cursor-pointer" style={{ color: 'var(--danger)' }} onClick={handleBatchDelete}>
              {t('batchDelete')}
            </Button>
          </div>
        )}

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
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={templates.length > 0 && selectedIds.size === templates.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerTitle')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerCategory')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('headerStatus')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>Hot</th>
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
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(tpl.id)}
                        onCheckedChange={() => toggleSelectId(tpl.id)}
                      />
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>{tpl.title}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{tCat(CATEGORY_I18N_KEY[tpl.category] ?? 'portrait')}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={statusStyle[tpl.status]}
                      >
                        {tpl.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cursor-pointer p-1 rounded transition-colors hover:bg-white/10"
                        onClick={(e) => handleToggleHot(tpl, e)}
                        title={(tpl as { isHot?: boolean }).isHot ? '取消热门' : '设为热门'}
                      >
                        <Flame
                          className="w-4 h-4"
                          style={{ color: (tpl as { isHot?: boolean }).isHot ? 'var(--hot)' : 'var(--muted)' }}
                          fill={(tpl as { isHot?: boolean }).isHot ? 'var(--hot)' : 'none'}
                        />
                      </button>
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
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{tCat(CATEGORY_I18N_KEY[selected.category] ?? 'portrait')}</p>
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
            {mediaList.length > 0 && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{tTemplate('exampleImages')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {mediaList.map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full rounded object-cover aspect-square" />
                  ))}
                </div>
              </div>
            )}
            {selected.rejectReason && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--danger)' }}>{t('rejectReason')}</p>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{selected.rejectReason}</p>
              </div>
            )}

            {/* Source info */}
            {(selected.originalUrl || selected.authorName || selected.sourcePlatform || selected.externalId) && (
              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{t('sourceInfo')}</p>
                {selected.authorName && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('authorName')}:</span>
                    {selected.authorUrl ? (
                      <a href={selected.authorUrl} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--link)' }}>
                        {selected.authorName}
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--foreground)' }}>{selected.authorName}</span>
                    )}
                  </div>
                )}
                {selected.sourcePlatform && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('sourcePlatform')}:</span>
                    <span className="text-xs" style={{ color: 'var(--foreground)' }}>{selected.sourcePlatform}</span>
                  </div>
                )}
                {selected.originalUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('originalUrl')}:</span>
                    <a href={selected.originalUrl} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline truncate" style={{ color: 'var(--link)' }}>
                      {t('viewSource')}
                    </a>
                  </div>
                )}
                {selected.externalId && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('externalId')}:</span>
                    <span className="text-xs font-mono" style={{ color: 'var(--foreground)' }}>{selected.externalId}</span>
                  </div>
                )}
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
                  style={{ color: 'var(--danger)' }}
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

      <TemplateImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => fetchList()}
        importFn={(items) => getAdminApi().importTemplates(items).then((r) => r.data)}
        pollJob={(jobId) => batchJobApi.get(jobId).then((r) => r.data)}
      />
    </div>
  );
}
