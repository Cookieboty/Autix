'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { marketplaceActions } from '@autix/shared-store';
import type { AcquiredItem } from './types';

const TYPE_TO_TAG: Record<string, string> = {
  SKILL: 'skill',
  MCP: 'mcp',
  AGENT: 'agent',
};

interface UseChatPromptMentionsOptions {
  input: string;
  setInput: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function useChatPromptMentions({
  input,
  setInput,
  textareaRef,
}: UseChatPromptMentionsOptions) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  const [acquired, setAcquired] = useState<AcquiredItem[]>([]);

  const loadAcquired = useCallback(async () => {
    try {
      const items = await marketplaceActions.listAcquiredResources();
      setAcquired((items as AcquiredItem[]).filter((it) => TYPE_TO_TAG[it.resourceType]));
    } catch {
      // Mentions are best-effort; a marketplace failure should not block input.
    }
  }, []);

  useEffect(() => {
    if (mentionOpen && acquired.length === 0) loadAcquired();
  }, [mentionOpen, acquired.length, loadAcquired]);

  const filteredMentions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return acquired.slice(0, 8);
    return acquired
      .filter((it) => (it.resource?.title ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, acquired]);

  const handleInputChange = useCallback(
    (val: string) => {
      setInput(val);
      const ta = textareaRef.current;
      const caret = ta?.selectionStart ?? val.length;
      const before = val.slice(0, caret);
      const atIdx = before.lastIndexOf('@');
      if (atIdx >= 0) {
        const slice = before.slice(atIdx + 1);
        if (/^[\w-\u4e00-\u9fa5]*$/.test(slice)) {
          setMentionAnchor(atIdx);
          setMentionQuery(slice);
          setMentionOpen(true);
          return;
        }
      }
      setMentionOpen(false);
    },
    [setInput, textareaRef],
  );

  const insertMention = useCallback(
    (item: AcquiredItem) => {
      const tag = TYPE_TO_TAG[item.resourceType];
      if (!tag) return;
      const id = item.resourceId;
      const marker = `@${tag}:${id} `;
      const before = input.slice(0, mentionAnchor);
      const ta = textareaRef.current;
      const caret = ta?.selectionStart ?? input.length;
      const after = input.slice(caret);
      const next = before + marker + after;
      setInput(next);
      setMentionOpen(false);
      setMentionQuery('');
      requestAnimationFrame(() => {
        const pos = before.length + marker.length;
        ta?.focus();
        ta?.setSelectionRange(pos, pos);
      });
    },
    [input, mentionAnchor, setInput, textareaRef],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
      if (mentionOpen && e.key === 'Enter' && filteredMentions.length > 0) {
        e.preventDefault();
        insertMention(filteredMentions[0]);
      }
    },
    [filteredMentions, insertMention, mentionOpen],
  );

  return {
    mentionOpen,
    filteredMentions,
    handleInputChange,
    handleKeyDown,
    insertMention,
  };
}
