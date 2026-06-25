'use client';

import { useState } from 'react';
import { RefreshCw, ShieldAlert, Ban, ShieldCheck } from 'lucide-react';
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
const LEVEL_LABEL: Record<RiskLevel, string> = {
  L0: '正常',
  L1: '关注',
  L2: '受限',
  L3: '封禁',
};
const LEVEL_COLOR: Record<RiskLevel, string> = {
  L0: 'var(--muted)',
  L1: '#b8860b',
  L2: '#d2691e',
  L3: '#c0392b',
};

function LevelBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      style={{ color: '#fff', background: LEVEL_COLOR[level] }}
    >
      {level} · {LEVEL_LABEL[level]}
    </span>
  );
}

export interface AdminRiskViewProps {
  onBack?: () => void;
}

export function AdminRiskView(_props: AdminRiskViewProps = {}) {
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
            风控与用户管理
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            异常/封控用户、邀请关系与安全等级
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1">
            <FilterChip active={level === ''} onClick={() => setLevel('')}>全部</FilterChip>
            {LEVELS.map((lv) => (
              <FilterChip key={lv} active={level === lv} onClick={() => setLevel(lv)}>
                {LEVEL_LABEL[lv]}
              </FilterChip>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => void refetch()}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {isFetching && items.length === 0 ? (
            <Centered>加载中…</Centered>
          ) : items.length === 0 ? (
            <Centered>暂无风控用户</Centered>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Th>用户</Th>
                  <Th>安全等级</Th>
                  <Th>分数</Th>
                  <Th>邀请人</Th>
                  <Th>邀请数</Th>
                  <Th>信号</Th>
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
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>用户风控详情</h2>
        <Button size="xs" variant="ghost" className="cursor-pointer" onClick={onClose}>关闭</Button>
      </div>

      {isFetching && !data ? (
        <Centered>加载中…</Centered>
      ) : !data ? (
        <Centered>无数据</Centered>
      ) : (
        <div className="space-y-4 text-sm">
          <section>
            <Label>等级</Label>
            <LevelBadge level={data.profile.level} />
            <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>分数 {data.profile.score}{data.profile.manualOverride ? ' · 人工置级' : ''}</span>
          </section>

          <section>
            <Label>邀请关系</Label>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              邀请人：{data.inviter?.username ?? data.inviter?.id ?? '无'} · 共邀请 {data.inviteCount} 人
            </div>
          </section>

          <section>
            <Label>风险时间线</Label>
            <ul className="space-y-1">
              {data.events.length === 0 && <li className="text-xs" style={{ color: 'var(--muted)' }}>无事件</li>}
              {data.events.map((e) => (
                <li key={e.id} className="text-xs" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--foreground)' }}>{e.type}</span> · sev {e.severity} · {new Date(e.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <Label>处置（原因可选）</Label>
            <textarea
              className="w-full rounded border bg-transparent p-2 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              rows={2}
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="处置原因"
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
                  置为 {LEVEL_LABEL[lv]}
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
                <Ban className="mr-1 h-3 w-3" /> 封禁
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={busy}
                className="cursor-pointer"
                onClick={() => unblockMutation.mutate({ userId, reason: reason || undefined })}
              >
                <ShieldCheck className="mr-1 h-3 w-3" /> 解封
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
