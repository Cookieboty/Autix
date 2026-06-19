'use client';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@autix/shared-ui/ui';
import { Plus, Pencil, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@autix/shared-store';
import { templateApi, type PromptTemplate, type TemplateStatus } from '@autix/sdk';
import { TemplateFormDrawer } from '@autix/shared-ui/template';

const statusStyle: Record<TemplateStatus, { bg: string; color: string }> = {
  PENDING: { bg: '#f59e0b20', color: '#f59e0b' },
  IN_REVIEW: { bg: '#3b82f620', color: '#3b82f6' },
  APPROVED: { bg: '#22c55e20', color: '#22c55e' },
  REJECTED: { bg: '#ef444420', color: '#ef4444' },
  ARCHIVED: { bg: '#6b728020', color: '#6b7280' },
};

const STATUS_I18N: Record<TemplateStatus, string> = {
  PENDING: 'statusPending',
  IN_REVIEW: 'statusInReview',
  APPROVED: 'statusApproved',
  REJECTED: 'statusRejected',
  ARCHIVED: 'statusArchived',
};

export function TemplatesMinePage() {
  const t = useTranslations('myTemplates');
  const tCommon = useTranslations('common');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFormDrawer, setShowFormDrawer] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchList = async (p = page) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await templateApi.list({ authorId: user.id, page: p, pageSize: 12 });
      const data = res.data as any;
      setTemplates(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(1); }, [user?.id]);

  const handleDelete = async (id: string) => {
    try {
      await templateApi.remove(id);
      setDeletingId(null);
      fetchList();
    } catch (e) {
      console.error(e);
    }
  };

  const pageCount = Math.ceil(total / 12);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-semibold text-foreground">{t('title')}</h1>
        <Button  size="sm" onClick={() => setShowFormDrawer(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('createTemplate')}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{tCommon('loading')}</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('empty')}</p>
            <Button  size="sm" onClick={() => setShowFormDrawer(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> {t('createFirst')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
              >
                {tpl.coverImage && (
                  <div className="aspect-video overflow-hidden">
                    <img src={tpl.coverImage} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--foreground)' }}>
                      {tpl.title}
                    </h3>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={statusStyle[tpl.status]}
                    >
                      {t(STATUS_I18N[tpl.status])}
                    </span>
                  </div>
                  {tpl.description && (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>{tpl.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => navigate(`/templates/${tpl.id}`)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => navigate(`/templates/${tpl.id}`)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {deletingId === tpl.id ? (
                      <div className="flex items-center gap-1 ml-auto">
                        <Button size="sm"  className="bg-danger text-white cursor-pointer" onClick={() => handleDelete(tpl.id)}>
                          {tCommon('confirm')}
                        </Button>
                        <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setDeletingId(null)}>
                          {tCommon('cancel')}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="cursor-pointer ml-auto" onClick={() => setDeletingId(tpl.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => fetchList(page - 1)} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{page} / {pageCount}</span>
          <Button size="sm" variant="ghost" disabled={page >= pageCount} onClick={() => fetchList(page + 1)} className="cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <TemplateFormDrawer
        open={showFormDrawer}
        onClose={() => setShowFormDrawer(false)}
        onSaved={() => fetchList()}
      />
    </div>
  );
}
