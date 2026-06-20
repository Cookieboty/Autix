'use client';

import { useEffect, useMemo, useState } from 'react';
import { videoWorkbenchActions } from '@autix/shared-store';
import {
  loadWorkbenchVideoTemplates,
  templateMatchesQuery,
  type WorkbenchVideoTemplate,
} from './constants';

interface UseVideoWorkbenchTemplatesOptions {
  initialTemplateId?: string | null;
  initialWorkflowTemplateId?: string | null;
}

export function useVideoWorkbenchTemplates({
  initialTemplateId = null,
  initialWorkflowTemplateId = null,
}: UseVideoWorkbenchTemplatesOptions = {}) {
  const [templates, setTemplates] = useState<WorkbenchVideoTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    loadWorkbenchVideoTemplates()
      .then(async (items) => {
        if (cancelled) return;
        const extras: WorkbenchVideoTemplate[] = [];
        if (initialTemplateId && !items.some((item) => item.templateKind === 'standard' && item.id === initialTemplateId)) {
          try {
            const detail = await videoWorkbenchActions.getStandardTemplate(initialTemplateId);
            extras.push({
              ...detail,
              templateKind: 'standard' as const,
              templateKey: `standard:${detail.id}`,
            });
          } catch {
            // Keep the template picker usable even if a deep-linked template is unavailable.
          }
        }
        if (
          initialWorkflowTemplateId &&
          !items.some((item) => item.templateKind === 'workflow' && item.id === initialWorkflowTemplateId)
        ) {
          try {
            const detail = await videoWorkbenchActions.getWorkflowTemplate(initialWorkflowTemplateId);
            extras.push({
              ...detail,
              templateKind: 'workflow' as const,
              templateKey: `workflow:${detail.id}`,
            });
          } catch {
            // Keep the template picker usable even if a deep-linked workflow template is unavailable.
          }
        }
        if (cancelled) return;
        setTemplates([...extras, ...items]);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialTemplateId, initialWorkflowTemplateId]);

  const templateCategories = useMemo(
    () => Array.from(new Set(templates.map((tpl) => tpl.category).filter(Boolean))).sort(),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchSearch = templateMatchesQuery(tpl, templateSearch);
      const matchCategory = templateCategory === 'all' || tpl.category === templateCategory;
      return matchSearch && matchCategory;
    });
  }, [templateCategory, templateSearch, templates]);

  return {
    templates,
    templatesLoading,
    templateSearch,
    setTemplateSearch,
    templateCategory,
    setTemplateCategory,
    templateCategories,
    filteredTemplates,
  };
}
