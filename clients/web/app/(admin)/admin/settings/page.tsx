'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  toast,
} from '@autix/shared-ui/ui';
import {
  systemSettingsApi,
  type SystemSettingCategory,
  type SystemSettingItem,
} from '@/lib/api';

const MASKED_VALUE = '********';

const CATEGORY_META: Record<
  SystemSettingCategory,
  { title: string; description: string }
> = {
  features: {
    title: '功能开关',
    description: '控制运行时功能入口和后端接口可用性。',
  },
  integration: {
    title: 'Amux 集成',
    description: '配置 Amux 授权、导入模型和代理调用地址。',
  },
  payments: {
    title: 'Stripe 支付',
    description: '配置支付币种、Checkout 跳转、Webhook 校验和调用密钥。',
  },
  storage: {
    title: 'Cloudflare R2',
    description: '配置对象存储上传、删除和公开访问地址。',
  },
  mail: {
    title: 'SMTP 邮件',
    description: '配置账号激活、密码重置和通知邮件发送。',
  },
};

const CATEGORY_ORDER: SystemSettingCategory[] = [
  'features',
  'integration',
  'payments',
  'storage',
  'mail',
];

function initialValue(setting: SystemSettingItem) {
  if (setting.sensitive && setting.value === MASKED_VALUE) return '';
  return setting.value ?? '';
}

function buildInitialValues(settings: SystemSettingItem[]) {
  return settings.reduce<Record<string, string | boolean>>((acc, setting) => {
    acc[setting.key] =
      setting.type === 'boolean'
        ? ['1', 'true', 'yes', 'on', 'enabled'].includes(String(setting.value).toLowerCase())
        : initialValue(setting);
    return acc;
  }, {});
}

function formatDate(value?: string) {
  if (!value) return '环境变量';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '已保存';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminSystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedSettings = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      meta: CATEGORY_META[category],
      items: settings.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [settings]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemSettingsApi.getAdmin();
      const items = Array.isArray(res.data) ? res.data : [];
      setSettings(items);
      setValues(buildInitialValues(items));
    } catch (err: any) {
      setError(err?.response?.data?.msg ?? err?.message ?? '系统配置加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setValue = (key: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const saveSetting = async (setting: SystemSettingItem, value: string | boolean) => {
    if (!setting.editable) return;
    const previousValue = values[setting.key];
    setValue(setting.key, value);
    setSavingKey(setting.key);
    setError(null);
    try {
      await systemSettingsApi.updateAdmin({ [setting.key]: value });
      await load();
      toast.success(`${setting.label}已保存`);
    } catch (err: any) {
      setValue(setting.key, previousValue ?? '');
      const message = err?.response?.data?.msg ?? err?.message ?? '系统配置保存失败';
      setError(message);
      toast.error(message);
    } finally {
      setSavingKey(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = settings.reduce<Record<string, string | boolean>>((acc, setting) => {
        if (!setting.editable) return acc;
        const value = values[setting.key];
        if (setting.sensitive && typeof value === 'string' && !value.trim()) {
          return acc;
        }
        acc[setting.key] = value;
        return acc;
      }, {});
      await systemSettingsApi.updateAdmin(payload);
      await load();
      toast.success('系统配置已保存');
    } catch (err: any) {
      const message = err?.response?.data?.msg ?? err?.message ?? '系统配置保存失败';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground text-lg font-semibold">系统配置</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              管理功能开关、支付、存储、邮件和外部集成的运行时配置。
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading || saving}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={loading || saving}>
            <Save className="h-3.5 w-3.5" />
            {saving ? '保存中' : '保存配置'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto py-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {groupedSettings.map((group) => (
              <Card key={group.category} className="rounded-lg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{group.meta.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {group.meta.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-border divide-y">
                    {group.items.map((setting) => (
                      <SettingField
                        key={setting.key}
                        setting={setting}
                        value={values[setting.key]}
                        saving={savingKey === setting.key}
                        onChange={(value) => setValue(setting.key, value)}
                        onCommit={(value) => saveSetting(setting, value)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingField({
  setting,
  value,
  onChange,
  onCommit,
  saving,
}: {
  setting: SystemSettingItem;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  onCommit: (value: string | boolean) => void;
  saving: boolean;
}) {
  const inputId = `setting-${setting.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const sourceText = setting.source === 'database' ? '后台配置' : '环境变量';
  const disabled = !setting.editable;

  return (
    <div className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,0.9fr)_minmax(260px,1.1fr)] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={inputId} className="text-foreground">
            {setting.label}
          </Label>
          <Badge variant={setting.source === 'database' ? 'secondary' : 'outline'}>
            {sourceText}
          </Badge>
          {setting.sensitive && <Badge variant="outline">敏感</Badge>}
          {!setting.editable && <Badge variant="outline">只读</Badge>}
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-5">
          {setting.description}
        </p>
        <p className="text-muted-foreground mt-1 truncate text-[11px]">
          {setting.envKeys.join(' / ')} · {formatDate(setting.updatedAt)}
        </p>
      </div>

      {setting.type === 'boolean' ? (
        <div
          className="border-border bg-background flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 py-2"
        >
          <span className="text-muted-foreground text-sm">
            {saving ? '保存中' : value ? '已开启' : '已关闭'}
          </span>
          <Switch
            id={inputId}
            checked={Boolean(value)}
            disabled={disabled || saving}
            aria-label={setting.label}
            onCheckedChange={(checked) => onCommit(checked === true)}
          />
        </div>
      ) : (
        <Input
          id={inputId}
          type={setting.sensitive ? 'password' : 'text'}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          aria-label={setting.label}
          placeholder={
            setting.sensitive
              ? setting.value === MASKED_VALUE
                ? '已配置，留空则不修改'
                : '输入后保存'
              : setting.defaultValue || (setting.allowEmpty ? '可留空' : '')
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
