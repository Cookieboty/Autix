import { ChevronDown, ChevronUp, Layers, Plus, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { adminInputClassName, adminInputStyle } from '../../admin-drawer-shell';
import type { UserSystemRoleGroup } from './user-drawer-helpers';

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

interface NamedOption {
  id: string;
  name: string;
}

export function UserRoleAssignmentsPanel({
  assignedRoleCount,
  assignedSystemCount,
  rolesForSelectedSystem,
  rolesLoading,
  rolesPanelOpen,
  selectedRoleId,
  selectedSystemId,
  systems,
  t,
  userSystemRoles,
  onAddRole,
  onRemoveRole,
  onRoleChange,
  onSystemChange,
  onToggle,
}: {
  assignedRoleCount: number;
  assignedSystemCount: number;
  rolesForSelectedSystem: NamedOption[];
  rolesLoading: boolean;
  rolesPanelOpen: boolean;
  selectedRoleId: string;
  selectedSystemId: string;
  systems: NamedOption[];
  t: Translate;
  userSystemRoles: UserSystemRoleGroup[];
  onAddRole: () => void;
  onRemoveRole: (systemId: string, roleId: string) => void;
  onRoleChange: (roleId: string) => void;
  onSystemChange: (systemId: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <RoleMetric label={t('drawerAssignedSystems')} value={assignedSystemCount} />
        <RoleMetric label={t('drawerTotalRoles')} value={assignedRoleCount} />
      </div>

      <div
        className="overflow-hidden rounded-md border"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--panel)',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3 transition-colors"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--panel-muted) 72%, var(--panel))',
            borderBottom: rolesPanelOpen ? '1px solid var(--border)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            <Layers className="h-4 w-4" style={{ color: 'var(--brand)' }} />
            {t('drawerCurrentAssignments')}
          </div>
          {rolesPanelOpen ? (
            <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted)' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted)' }} />
          )}
        </button>

        {rolesPanelOpen && (
          <div className="space-y-5 px-4 py-4">
            <AssignedRolesList
              rolesLoading={rolesLoading}
              t={t}
              userSystemRoles={userSystemRoles}
              onRemoveRole={onRemoveRole}
            />

            <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {t('drawerAddRole')}
              </p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Select value={selectedSystemId || ''} onValueChange={onSystemChange}>
                  <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {systems.map((systemItem) => (
                      <SelectItem key={systemItem.id} value={systemItem.id}>
                        {systemItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedRoleId || ''} onValueChange={onRoleChange} disabled={!selectedSystemId}>
                  <SelectTrigger className={adminInputClassName} style={adminInputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesForSelectedSystem.map((roleItem) => (
                      <SelectItem key={roleItem.id} value={roleItem.id}>
                        {roleItem.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 min-w-[88px] cursor-pointer px-3"
                  disabled={!selectedSystemId || !selectedRoleId}
                  onClick={onAddRole}
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t('drawerAddBtn')}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md border px-4 py-3"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--panel-muted)',
      }}
    >
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

function AssignedRolesList({
  rolesLoading,
  t,
  userSystemRoles,
  onRemoveRole,
}: {
  rolesLoading: boolean;
  t: Translate;
  userSystemRoles: UserSystemRoleGroup[];
  onRemoveRole: (systemId: string, roleId: string) => void;
}) {
  if (rolesLoading) {
    return (
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {t('loading')}
      </p>
    );
  }

  if (userSystemRoles.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {t('drawerNoRoleAssignments')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {userSystemRoles.map((group) => (
        <div key={group.systemId} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {group.systemName}
            </p>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('drawerRoleCount', { count: group.roles.length })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.roles.map((roleItem) => (
              <span
                key={roleItem.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                style={{
                  color: 'var(--brand)',
                  backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--brand) 18%, var(--border))',
                }}
              >
                {roleItem.name}
                <button
                  type="button"
                  onClick={() => onRemoveRole(group.systemId, roleItem.id)}
                  className="transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
