'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Crown, FileX, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDocumentStore, useMembershipGateStore } from '@autix/shared-store';
import type { DocumentWithChunks } from '@autix/shared-store';
import { DocumentCard } from './DocumentCard';
import { UploadZone } from './UploadZone';
import { ChunksDrawer } from './ChunksDrawer';
import { SidebarTrigger } from '../ui/sidebar';
import { useSystemFeatureFlag } from '../hooks/useModelConfigEnabled';
import { useRouter } from '../navigation';

export function LibraryView() {
  const t = useTranslations('library');
  const router = useRouter();
  const libraryFeature = useSystemFeatureFlag('libraryEnabled', false);
  const { documents, loading, loadDocuments } = useDocumentStore();
  const isMember = useMembershipGateStore((s) => s.isActiveMember);
  const loadMembershipGate = useMembershipGateStore((s) => s.loadMembershipGate);
  const resetMembershipGate = useMembershipGateStore((s) => s.resetMembershipGate);
  const [chunksDoc, setChunksDoc] = useState<DocumentWithChunks | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (libraryFeature.loading || libraryFeature.enabled) return;
    router.replace('/');
  }, [libraryFeature.enabled, libraryFeature.loading, router]);

  useEffect(() => {
    if (libraryFeature.loading || !libraryFeature.enabled) return;
    resetMembershipGate();
    void loadMembershipGate();
  }, [
    libraryFeature.enabled,
    libraryFeature.loading,
    loadMembershipGate,
    resetMembershipGate,
  ]);

  useEffect(() => {
    if (libraryFeature.loading || !libraryFeature.enabled) return;
    if (isMember !== true) return;
    void loadDocuments();
  }, [isMember, libraryFeature.enabled, libraryFeature.loading, loadDocuments]);

  if (libraryFeature.loading || !libraryFeature.enabled || isMember === null) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center shrink-0 h-12 px-4 border-b border-border">
          <SidebarTrigger className="-ml-1" />
          <BookOpen className="w-4 h-4 text-muted-foreground ml-2" />
          <span className="text-sm font-semibold text-foreground ml-2">{t('title')}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center shrink-0 h-12 px-4 border-b border-border">
          <SidebarTrigger className="-ml-1" />
          <BookOpen className="w-4 h-4 text-muted-foreground ml-2" />
          <span className="text-sm font-semibold text-foreground ml-2">{t('title')}</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <Crown className="w-12 h-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">{t('membershipRequired')}</h2>
            <p className="text-sm text-muted-foreground">{t('membershipRequiredDesc')}</p>
            <button
              onClick={() => router.push('/membership/upgrade')}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer transition-colors hover:opacity-90"
            >
              {t('upgradeMembership')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0 h-12 px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <BookOpen className="w-4 h-4 text-muted-foreground ml-1" />
          <span className="text-sm font-semibold text-foreground">
            {t('title')}
          </span>
          {documents.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-card text-muted-foreground">
              {documents.length}
            </span>
          )}
        </div>

        {/* Upload toggle button */}
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            showUpload
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-card text-foreground border-border'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('uploadDocument')}
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Upload zone: shown when toggled or no documents */}
          {(showUpload || documents.length === 0) && (
            <UploadZone />
          )}

          {/* Document grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl h-36 animate-pulse bg-card" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileX className="w-12 h-12 opacity-20 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('noDocumentsHint')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onViewChunks={setChunksDoc}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Chunks drawer ── */}
      {chunksDoc && (
        <ChunksDrawer doc={chunksDoc} onClose={() => setChunksDoc(null)} />
      )}
    </div>
  );
}
