'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

/**
 * 支持 @ 提及素材的提示词输入框。
 *
 * 用 contenteditable 而非 textarea：提及要渲染成「缩略图 + 彩色 @Image 1」的内联 chip，
 * textarea 只能显示纯文本，做不到。
 *
 * 三个必须小心的点（contenteditable 的经典坑）：
 * 1. **受控与光标**：每次 onChange 都把 value 写回 innerHTML 会让光标跳到开头。
 *    这里按「非受控 + 差异同步」处理：只有外部传入的 value 与当前内容序列化结果不一致时
 *    才重写 DOM（例如提示词优化返回、模板套用）。
 * 2. **中文输入法**：合成期间（compositionstart~end）DOM 里是拼音，此时上报会把拼音
 *    当正文。用 composing 标志跳过，合成结束再上报一次。
 * 3. **chip 不可编辑**：chip 用 contentEditable={false}，否则退格会把它拆成半截 HTML。
 */

export interface PromptMentionItem {
  id: string;
  /** 展示与插入用的标签，如 "Image 1" */
  label: string;
  url: string;
  mediaType?: 'image' | 'video' | 'audio';
}

/** 把编辑器 DOM 序列化成纯文本：chip → `@Label`，<br> → 换行 */
function serialize(root: HTMLElement): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const mention = el.dataset.mention;
    if (mention) {
      out += mention;
      return;
    }
    if (el.tagName === 'BR') {
      out += '\n';
      return;
    }
    // div/p 等块级元素之间补换行，避免多行内容序列化后粘成一行
    const isBlock = el.tagName === 'DIV' || el.tagName === 'P';
    if (isBlock && out !== '' && !out.endsWith('\n')) out += '\n';
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
}

/** 把光标移到某个节点之后 */
function placeCaretAfter(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function PromptMentionInput({
  value,
  onChange,
  placeholder,
  items,
  className,
  emptyHint,
  editorRef: externalEditorRef,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** 可提及的素材（当前已选中的那批） */
  items: PromptMentionItem[];
  className?: string;
  /** 没有可提及素材时的提示 */
  emptyHint?: string;
  /** 暴露编辑器节点，供外层「点卡片空白处聚焦输入」使用 */
  editorRef?: RefObject<HTMLDivElement | null>;
}) {
  const localEditorRef = useRef<HTMLDivElement | null>(null);
  const editorRef = externalEditorRef ?? localEditorRef;
  const composingRef = useRef(false);
  /** 最近一次由本组件上报出去的值，用于判断外部 value 是否真的变了 */
  const lastEmittedRef = useRef(value);

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  const filtered = query
    ? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  const emit = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const next = serialize(root);
    lastEmittedRef.current = next;
    onChange(next);
  }, [onChange]);

  // 外部值变化时才回写 DOM（优化结果、清空等），自己打字不会走这里
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    if (value === lastEmittedRef.current) return;
    root.textContent = value;
    lastEmittedRef.current = value;
  }, [value]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  /** 读取光标前的 @查询词，决定是否展开菜单 */
  const syncMention = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return closeMenu();
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return closeMenu();
    const before = (node.textContent ?? '').slice(0, range.startOffset);
    const atIndex = before.lastIndexOf('@');
    if (atIndex < 0) return closeMenu();
    const slice = before.slice(atIndex + 1);
    // @ 后面只允许字母数字空格中文，遇到别的说明不是在提及
    if (!/^[\w\s一-龥-]*$/.test(slice)) return closeMenu();

    const rect = range.getBoundingClientRect();
    setMenuPos({ left: rect.left, top: rect.bottom + 6 });
    setQuery(slice);
    setActiveIndex(0);
    setMenuOpen(true);
  }, [closeMenu]);

  const handleInput = useCallback(() => {
    if (composingRef.current) return;
    emit();
    syncMention();
  }, [emit, syncMention]);

  /** 用 chip 替换掉光标前的 `@查询词` */
  const insertMention = useCallback(
    (item: PromptMentionItem) => {
      const root = editorRef.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;
      const before = (node.textContent ?? '').slice(0, range.startOffset);
      const atIndex = before.lastIndexOf('@');
      if (atIndex < 0) return;

      // 删掉 `@查询词`
      const deleteRange = document.createRange();
      deleteRange.setStart(node, atIndex);
      deleteRange.setEnd(node, range.startOffset);
      deleteRange.deleteContents();

      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      chip.dataset.mention = `@${item.label}`;
      chip.className =
        'mx-0.5 inline-flex translate-y-[2px] items-center gap-1 rounded-md bg-growth-accent/15 px-1 py-0 align-baseline text-[12px] font-bold leading-[1.35] text-growth-accent';
      if (item.mediaType !== 'audio') {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = '';
        // 缩略图不能比文字行高大，否则它会成为撑高整行的那个元素，上下留白又回来了
        img.className = 'size-3.5 shrink-0 rounded-[3px] object-cover';
        chip.appendChild(img);
      }
      chip.appendChild(document.createTextNode(`@${item.label}`));

      deleteRange.insertNode(chip);
      // chip 后补一个空格，否则光标会卡在 chip 内部边界、继续打字会并进 chip
      const space = document.createTextNode(' ');
      chip.after(space);
      placeCaretAfter(space);

      closeMenu();
      emit();
    },
    [closeMenu, emit],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!menuOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (filtered.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const item = filtered[activeIndex] ?? filtered[0];
        if (item) insertMention(item);
      }
    },
    [activeIndex, closeMenu, filtered, insertMention, menuOpen],
  );

  // 点击别处关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && editorRef.current?.contains(target)) return;
      if (target && (target as HTMLElement).closest?.('[data-mention-menu]')) return;
      closeMenu();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [closeMenu, menuOpen]);

  return (
    <>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          handleInput();
        }}
        // 只接受纯文本粘贴：粘 HTML 进来会把外部样式和结构带进编辑器
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        className={`growth-prompt-editor whitespace-pre-wrap break-words outline-none ${className ?? ''}`}
      />

      {menuOpen && menuPos ? (
        <div
          data-mention-menu
          style={{ left: menuPos.left, top: menuPos.top }}
          className="fixed z-50 max-h-64 w-56 overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(28,30,32,0.92)] p-1.5 shadow-2xl backdrop-blur-[32px]"
        >
          {filtered.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-xs text-foreground/40">{emptyHint}</p>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={(event) => {
                  event.preventDefault();
                  insertMention(item);
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition ${index === activeIndex ? 'bg-white/[0.08] text-foreground' : 'text-foreground/82 hover:bg-white/[0.04]'
                  }`}
              >
                <span className="size-8 shrink-0 overflow-hidden rounded-[6px] bg-black/40">
                  {item.mediaType === 'video' ? (
                    <video src={item.url} muted playsInline preload="metadata" className="size-full object-cover" />
                  ) : item.mediaType === 'audio' ? null : (
                    <img src={item.url} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </>
  );
}
