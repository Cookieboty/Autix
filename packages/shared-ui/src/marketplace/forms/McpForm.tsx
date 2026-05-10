'use client';

import { useMemo, useState } from 'react';
import { Button } from '../../ui/button';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { mcpApi } from '@autix/shared-lib';
import { DrawerBody, DrawerSection } from '../../drawer-shell';
import {
  TextField,
  TextAreaField,
  TagsField,
  CategoryPicker,
  CoverField,
  ExampleMediaField,
  PointsCostField,
  RuntimeOverrideField,
  SelectField,
  initialCommonState,
  buildCommonPayload,
  type CommonFormState,
  type CategoryOption,
} from './shared';

const CATEGORY_KEYS = [
  'database',
  'cloud',
  'devtool',
  'communication',
  'other',
] as const;
const KEY_TO_VALUE: Record<(typeof CATEGORY_KEYS)[number], string> = {
  database: '数据库',
  cloud: '云服务',
  devtool: '开发工具',
  communication: '通信',
  other: '其他',
};

const DEFAULT_CONFIG = `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "\${HOME}/Documents"],
      "env": {}
    }
  }
}`;

interface Props {
  onSaved: () => void;
}

function parseConfig(raw: string): {
  value?: Record<string, unknown>;
  servers: string[];
  error?: string;
} {
  if (!raw.trim()) return { servers: [] };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const mcpServers = value.mcpServers;
    if (mcpServers && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
      return { value, servers: Object.keys(mcpServers as Record<string, unknown>) };
    }
    const single =
      typeof value.name === 'string'
        ? value.name
        : typeof value.serverName === 'string'
          ? value.serverName
          : undefined;
    return { value, servers: single ? [single] : [] };
  } catch (e) {
    return { servers: [], error: (e as Error).message };
  }
}

function inferDetection(raw: Record<string, unknown> | undefined, serverName?: string) {
  const servers = raw?.mcpServers as Record<string, unknown> | undefined;
  const server =
    servers && serverName ? (servers[serverName] as Record<string, unknown> | undefined) : raw;
  if (!server || typeof server !== 'object') return undefined;
  const transport = server.transport ?? server.type;
  if (transport === 'stdio' || 'command' in server) return 'mcpDetectionStdio';
  const url = typeof server.url === 'string' ? server.url : '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d|172\.(1[6-9]|2\d|3[01])\.)/.test(url)) {
    return 'mcpDetectionLocalUrl';
  }
  const env = JSON.stringify(server.env ?? {});
  if (/\$\{?(HOME|USER|PWD|CWD)\}?/.test(env)) return 'mcpDetectionLocalEnv';
  return 'mcpDetectionCloud';
}

export function McpForm({ onSaved }: Props) {
  const t = useTranslations('publish');
  const tCat = useTranslations('mcpCategoryOptions');
  const categories = useMemo<CategoryOption[]>(
    () =>
      CATEGORY_KEYS.map((k) => ({ value: KEY_TO_VALUE[k], label: tCat(k) })),
    [tCat],
  );

  const [common, setCommon] = useState<CommonFormState>(() =>
    initialCommonState(KEY_TO_VALUE.devtool),
  );
  const [rawConfig, setRawConfig] = useState(DEFAULT_CONFIG);
  const parsed = useMemo(() => parseConfig(rawConfig), [rawConfig]);
  const [selectedServer, setSelectedServer] = useState('filesystem');
  const activeServer = parsed.servers.includes(selectedServer)
    ? selectedServer
    : (parsed.servers[0] ?? '');
  const [installNotes, setInstallNotes] = useState('');
  const [securityNotes, setSecurityNotes] = useState('');
  const [exampleMedia, setExampleMedia] = useState<(string | undefined)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectionKey = inferDetection(parsed.value, activeServer);
  const canSubmit = !!parsed.value && !parsed.error && !!activeServer && !!common.category;

  const handleSubmit = async () => {
    if (!canSubmit || !parsed.value) return;

    setSubmitting(true);
    setError(null);
    try {
      await mcpApi.create({
        ...buildCommonPayload(common),
        rawConfig: parsed.value,
        configFormat: 'mcp_json',
        serverName: activeServer,
        installNotes: installNotes.trim() || undefined,
        securityNotes: securityNotes.trim() || undefined,
        exampleMedia: exampleMedia.filter(Boolean) as string[],
      } as Parameters<typeof mcpApi.create>[0]);
      onSaved();
    } catch (e) {
      const err = e as {
        msg?: string;
        response?: { data?: { message?: string; msg?: string } };
        message?: string;
      };
      setError(
        err.msg ??
          err.response?.data?.message ??
          err.response?.data?.msg ??
          err.message ??
          t('submitFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DrawerBody>
      <DrawerSection title={t('sectionBasic')}>
        <div className="space-y-4">
          <TextField
            label={t('fieldTitle')}
            hint={t('mcpTitleOptionalHint')}
            value={common.title}
            onChange={(v) => setCommon({ ...common, title: v })}
            placeholder={t('mcpTitlePlaceholder')}
          />
          <TextAreaField
            label={t('fieldDescription')}
            value={common.description}
            onChange={(v) => setCommon({ ...common, description: v })}
            rows={3}
            placeholder={t('mcpDescriptionPlaceholder')}
          />
          <CategoryPicker
            value={common.category}
            onChange={(v) => setCommon({ ...common, category: v })}
            options={categories}
          />
        </div>
      </DrawerSection>

      <DrawerSection
        title={t('sectionMcpServer')}
        description={t('mcpConfigDescription')}
      >
        <TextAreaField
          label={t('mcpRawConfigLabel')}
          required
          value={rawConfig}
          onChange={(v) => {
            setRawConfig(v);
            const next = parseConfig(v).servers[0];
            if (next) setSelectedServer(next);
          }}
          rows={12}
          mono
          placeholder={t('mcpRawConfigPlaceholder')}
        />
        {parsed.error ? (
          <p className="text-xs text-destructive">
            {t('mcpConfigParseError', { message: parsed.error })}
          </p>
        ) : parsed.servers.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('mcpConfigServersHint', { servers: parsed.servers.join(', ') })}
          </p>
        ) : null}
        {parsed.servers.length > 1 ? (
          <SelectField
            label={t('mcpSelectedServer')}
            value={activeServer}
            onChange={setSelectedServer}
            options={parsed.servers.map((name) => ({ value: name, label: name }))}
          />
        ) : null}
      </DrawerSection>

      <DrawerSection title={t('sectionCoverExample')}>
        <div className="space-y-4">
          <CoverField
            value={common.coverImage}
            onChange={(v) => setCommon({ ...common, coverImage: v })}
            folder="mcp"
          />
          <ExampleMediaField
            label={t('mcpExampleLabel')}
            values={exampleMedia}
            onChange={setExampleMedia}
            folder="mcp"
          />
        </div>
      </DrawerSection>

      <DrawerSection title={t('sectionAdvanced')}>
        <div className="grid grid-cols-2 gap-4">
          <TagsField
            value={common.tags}
            onChange={(v) => setCommon({ ...common, tags: v })}
          />
          <PointsCostField
            value={common.pointsCost}
            onChange={(v) => setCommon({ ...common, pointsCost: v })}
            hint={t('mcpPointsHint')}
          />
          <TextAreaField
            label={t('mcpInstallNotes')}
            value={installNotes}
            onChange={setInstallNotes}
            rows={3}
            placeholder={t('mcpInstallNotesPlaceholder')}
          />
          <TextAreaField
            label={t('mcpSecurityNotes')}
            value={securityNotes}
            onChange={setSecurityNotes}
            rows={3}
            placeholder={t('mcpSecurityNotesPlaceholder')}
          />
          <div className="col-span-2">
            <RuntimeOverrideField
              value={common.runtimeOverride}
              onChange={(v) => setCommon({ ...common, runtimeOverride: v })}
              detectionHint={detectionKey ? t(detectionKey) : undefined}
            />
          </div>
        </div>
      </DrawerSection>

      {error ? (
        <div className="rounded-md border border-destructive bg-card px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button
          variant="default"
          className="cursor-pointer"
          disabled={submitting || !canSubmit}
          onClick={handleSubmit}
        >
          <Send className="w-4 h-4 mr-1" />
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </DrawerBody>
  );
}
