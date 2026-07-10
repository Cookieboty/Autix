'use client';

import { useState } from 'react';
import { RefreshCw, ShieldAlert, Ban, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useBlockRiskUserMutation,
  useRiskUserDetailQuery,
  useRiskUsersQuery,
  useSetRiskLevelMutation,
  useUnblockRiskUserMutation,
  type RiskLevel,
  type RiskUserListItem,
} from '@autix/shared-store';
import { Button } from '../../ui';

const LEVELS: RiskLevel[] = ['L0', 'L1', 'L2', 'L3'];
const LEVEL_COLOR: Record<RiskLevel, string> = {
  L0: 'var(--muted)',
  L1: '#b8860b',
  L2: '#d2691e',
  L3: '#c0392b',
};

function levelLabelKey(level: RiskLevel) {
  return `risk.levels.${level}` as const;
}

function LevelBadge({ level }: { level: RiskLevel }) {
  const t = useTranslations('adminOperations');
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      style={{ color: '#fff', background: LEVEL_COLOR[level] }}
    >
      {t('risk.levelBadge', { level, label: t(levelLabelKey(level)) })}
    </span>
  );
}

export interface AdminRiskViewProps {
  onBack?: () => void;
}

export function AdminRiskView(_props: AdminRiskViewProps = {}) {
  const t = useTranslations('adminOperations');
  const [level, setLevel] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isFetching, refetch } = useRiskUsersQuery({ level: level || undefined, page: 1, pageSize: 50 });
  const items = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <ShieldAlert className="h-5 w-5" style={{ color: 'var(--foreground)' }} />
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('risk.title')}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('risk.description')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1">
            <FilterChip active={level === ''} onClick={() => setLevel('')}>{t('common.all')}</FilterChip>
            {LEVELS.map((lv) => (
              <FilterChip key={lv} active={level === lv} onClick={() => setLevel(lv)}>
                {t(levelLabelKey(lv))}
              </FilterChip>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => void refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {isFetching && items.length === 0 ? (
            <Centered>{t('common.loading')}</Centered>
          ) : items.length === 0 ? (
            <Centered>{t('risk.emptyUsers')}</Centered>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Th>{t('risk.columns.user')}</Th>
                  <Th>{t('risk.columns.securityLevel')}</Th>
                  <Th>{t('risk.columns.score')}</Th>
                  <Th>{t('risk.columns.inviter')}</Th>
                  <Th>{t('risk.columns.inviteCount')}</Th>
                  <Th>{t('risk.columns.signals')}</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <RiskRow
                    key={row.user.id}
                    row={row}
                    selected={selectedId === row.user.id}
                    onSelect={() => setSelectedId(row.user.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedId && (
          <RiskDetailPanel userId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => void refetch()} />
        )}
      </div>
    </div>
  );
}

function RiskRow({ row, selected, onSelect }: { row: RiskUserListItem; selected: boolean; onSelect: () => void }) {
  return (
    <tr
      onClick={onSelect}
      className="cursor-pointer"
      style={{ borderBottom: '1px solid var(--border)', background: selected ? 'var(--accent)' : undefined }}
    >
      <Td>
        <div className="font-medium" style={{ color: 'var(--foreground)' }}>{row.user.username ?? row.user.id}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{row.user.email ?? '-'}</div>
      </Td>
      <Td><LevelBadge level={row.level} /></Td>
      <Td>{row.score}</Td>
      <Td>{row.inviter?.username ?? row.inviter?.id ?? '-'}</Td>
      <Td>{row.inviteCount}</Td>
      <Td><span className="text-xs" style={{ color: 'var(--muted)' }}>{(row.topSignals ?? []).join(', ') || '-'}</span></Td>
    </tr>
  );
}

function RiskDetailPanel({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('adminOperations');
  const { data, isFetching } = useRiskUserDetailQuery(userId);
  const [reason, setReason] = useState('');
  const onSuccess = () => {
    setReason('');
    onChanged();
  };
  const setLevelMutation = useSetRiskLevelMutation({ onSuccess });
  const blockMutation = useBlockRiskUserMutation({ onSuccess });
  const unblockMutation = useUnblockRiskUserMutation({ onSuccess });
  const busy = setLevelMutation.isPending || blockMutation.isPending || unblockMutation.isPending;

  return (
    <aside className="w-96 shrink-0 overflow-auto p-4" style={{ borderLeft: '1px solid var(--border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('risk.detailTitle')}</h2>
        <Button size="xs" variant="ghost" className="cursor-pointer" onClick={onClose}>{t('common.close')}</Button>
      </div>

      {isFetching && !data ? (
        <Centered>{t('common.loading')}</Centered>
      ) : !data ? (
        <Centered>{t('common.noData')}</Centered>
      ) : (
        <div className="space-y-4 text-sm">
          <section>
            <Label>{t('risk.labels.level')}</Label>
            <LevelBadge level={data.profile.level} />
            <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
              {t('risk.scoreText', { score: data.profile.score })}{data.profile.manualOverride ? t('risk.manualOverrideSuffix') : ''}
            </span>
          </section>

          <section>
            <Label>{t('risk.labels.inviteRelation')}</Label>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('risk.inviteSummary', {
                inviter: data.inviter?.username ?? data.inviter?.id ?? t('common.none'),
                count: data.inviteCount,
              })}
            </div>
          </section>

          <section>
            <Label>{t('risk.labels.timeline')}</Label>
            <ul className="space-y-1">
              {data.events.length === 0 && <li className="text-xs" style={{ color: 'var(--muted)' }}>{t('risk.noEvents')}</li>}
              {data.events.map((e) => (
                <li key={e.id} className="text-xs" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--foreground)' }}>{e.type}</span> · sev {e.severity} · {new Date(e.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <Label>{t('risk.labels.action')}</Label>
            <textarea
              className="w-full rounded border bg-transparent p-2 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              rows={2}
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder={t('risk.reasonPlaceholder')}
            />
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lv) => (
                <Button
                  key={lv}
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  className="cursor-pointer"
                  onClick={() => setLevelMutation.mutate({ userId, level: lv, reason: reason || undefined })}
                >
                  {t('risk.setLevel', { level: t(levelLabelKey(lv)) })}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="destructive"
                disabled={busy}
                className="cursor-pointer"
                onClick={() => blockMutation.mutate({ userId, reason: reason || undefined })}
              >
                <Ban className="mr-1 h-3 w-3" /> {t('risk.block')}
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                className="cursor-pointer"
                onClick={() => unblockMutation.mutate({ userId, reason: reason || undefined })}
              >
                <ShieldCheck className="mr-1 h-3 w-3" /> {t('risk.unblock')}
              </Button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-2 py-1 text-xs cursor-pointer"
      style={{
        color: active ? 'var(--foreground)' : 'var(--muted)',
        background: active ? 'var(--accent)' : 'transparent',
        border: '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top" style={{ color: 'var(--foreground)' }}>{children}</td>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-medium" style={{ color: 'var(--muted)' }}>{children}</div>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--muted)' }}>{children}</div>;
}
