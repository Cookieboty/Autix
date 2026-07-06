import type { DrawElement } from './draw-scene-mapper';
import type { Tool, Tr } from './draw-types';

export function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function tr(t: Tr, key: string, fallback: string, values?: Record<string, string | number>): string {
  try {
    if (t.has && !t.has(key)) return fallback;
    const value = t(key, values);
    return value === key || value.endsWith(`.${key}`) ? fallback : value;
  } catch {
    return fallback;
  }
}

export function stopHandledPasteEvent(event: { preventDefault: () => void; stopPropagation: () => void; nativeEvent?: Event }): void {
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent?.stopImmediatePropagation();
}

export function localizeExcalidrawContextMenu(root: ParentNode, t: Tr): void {
  const items = [
    ['wrapSelectionInFrame', 'contextMenu.wrapSelectionInFrame', '将选区包入画框'],
    ['copyElementLink', 'contextMenu.copyElementLink', '复制对象链接'],
  ] as const;

  for (const [testId, key, fallback] of items) {
    const label = root.querySelector(`.context-menu [data-testid="${testId}"] .context-menu-item__label`);
    if (label instanceof HTMLElement) {
      const text = tr(t, key, fallback);
      if (label.textContent !== text) label.textContent = text;
    }
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeTool(tool: string | undefined): Tool {
  if (tool === 'frame' || tool === 'rectangle' || tool === 'freedraw' || tool === 'text' || tool === 'eraser') return tool;
  return 'selection';
}

export function excalidrawLangCode(locale: string): string {
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'zh-TW') return 'zh-TW';
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'ja') return 'ja-JP';
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'vi') return 'vi-VN';
  return 'en';
}

export function isColorableElement(element: DrawElement): boolean {
  return (
    element.type === 'text' ||
    element.type === 'frame' ||
    element.type === 'rectangle' ||
    element.type === 'diamond' ||
    element.type === 'ellipse' ||
    element.type === 'arrow' ||
    element.type === 'line' ||
    element.type === 'freedraw'
  );
}

export function isConflict(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 409,
  );
}

export function errorMessage(error: unknown, t: Tr): string {
  if (error && typeof error === 'object') {
    const e = error as { msg?: string; message?: string };
    return e.msg ?? e.message ?? t('chat.generateFailed');
  }
  return t('chat.generateFailed');
}

export function saveLabel(status: 'idle' | 'saving' | 'saved' | 'conflict', t: Tr): string {
  if (status === 'saving') return t('status.saving');
  if (status === 'saved') return t('status.saved');
  if (status === 'conflict') return t('status.conflict');
  return '';
}
