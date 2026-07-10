'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Stethoscope } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui';
import type { GenerationPricingRule } from '@autix/shared-store';
import {
  BUSINESS_TASKS,
  formatRuleCost,
  formatRuleScope,
  getTaskName,
  type BusinessTask,
  type Translate,
} from './task-costs-helpers';

const CATEGORY_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'filters.allCategories' },
  { value: 'chat', labelKey: 'categories.chat.title' },
  { value: 'image', labelKey: 'categories.image.title' },
  { value: 'video', labelKey: 'categories.video.title' },
  { value: 'prompt', labelKey: 'categories.prompt.title' },
];

interface TaskCostsRuleListProps {
  rules: GenerationPricingRule[];
  taskByType: Map<string, BusinessTask>;
  onPreview: (rule: GenerationPricingRule) => void;
  onEditTask: (task: BusinessTask) => void;
  onCreate: (task: BusinessTask) => void;
  tAdmin: Translate;
}

export function TaskCostsRuleList({
  rules,
  taskByType,
  onPreview,
  onEditTask,
  onCreate,
  tAdmin,
}: TaskCostsRuleListProps) {
  const [category, setCategory] = useState('all');
  const [taskType, setTaskType] = useState('all');
  const [search, setSearch] = useState('');

  const taskOptions = useMemo(
    () => BUSINESS_TASKS.filter((task) => category === 'all' || task.category === category),
    [category],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rules.filter((rule) => {
      const task = taskByType.get(rule.taskType);
      if (category !== 'all' && task?.category !== category) return false;
      if (taskType !== 'all' && rule.taskType !== taskType) return false;
      if (keyword && !rule.name.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [rules, taskByType, category, taskType, search]);

  const activeTask = taskType !== 'all' ? taskByType.get(taskType) : undefined;

  const headerCell = 'px-4 py-3 text-left text-xs font-medium whitespace-nowrap';
  const bodyBorder = { borderBottom: '1px solid var(--border)' };

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setTaskType('all');
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {tAdmin(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={taskType} onValueChange={setTaskType}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={tAdmin('filters.allTasks')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tAdmin('filters.allTasks')}</SelectItem>
            {taskOptions.map((task) => (
              <SelectItem key={task.taskType} value={task.taskType}>
                {getTaskName(tAdmin, task)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tAdmin('filters.searchRuleName')}
          className="w-56"
        />

        <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
          {tAdmin('rules.count', { count: filtered.length })}
        </span>

        {activeTask && (
          <Button size="sm" variant="outline" onClick={() => onCreate(activeTask)}>
            <Plus className="mr-1 size-4" />
            {tAdmin('rules.create')}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--background)' }}>
            <tr style={bodyBorder}>
              <th className={headerCell} style={{ color: 'var(--muted)' }}>{tAdmin('rules.headers.rule')}</th>
              <th className={headerCell} style={{ color: 'var(--muted)' }}>{tAdmin('rules.headers.task')}</th>
              <th className={headerCell} style={{ color: 'var(--muted)' }}>{tAdmin('rules.headers.scope')}</th>
              <th className={headerCell} style={{ color: 'var(--muted)' }}>{tAdmin('rules.headers.cost')}</th>
              <th className={`${headerCell} text-right`} style={{ color: 'var(--muted)' }}>{tAdmin('rules.headers.status')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule) => {
              const task = taskByType.get(rule.taskType);
              const active = rule.isActive !== false;
              return (
                <tr key={rule.id} style={bodyBorder}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {rule.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                      {rule.taskType}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div style={{ color: 'var(--foreground)' }}>
                      {task ? getTaskName(tAdmin, task) : rule.taskType}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                      {rule.baseUnit}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-[11px]"
                    style={{ color: 'var(--muted)' }}
                  >
                    {formatRuleScope(rule, tAdmin)}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-[11px]"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {formatRuleCost(rule, tAdmin)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className="inline-flex w-12 justify-center whitespace-nowrap rounded py-0.5 text-[11px]"
                        style={{
                          color: active ? '#16a34a' : 'var(--muted)',
                          border: `1px solid ${active ? '#16a34a55' : 'var(--border)'}`,
                        }}
                      >
                        {active ? tAdmin('rules.enabled') : tAdmin('rules.disabled')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 cursor-pointer px-2 text-xs"
                        onClick={() => onPreview(rule)}
                      >
                        <Stethoscope className="mr-1 size-3.5" />
                        {tAdmin('rules.preview')}
                      </Button>
                      {task ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 cursor-pointer px-0"
                          onClick={() => onEditTask(task)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : (
                        <span className="inline-block h-7 w-7" aria-hidden />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  {tAdmin('rules.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
