'use client';

import type { RefObject } from 'react';
import { Film, MessageSquare, Search, Trash2, X } from 'lucide-react';

import { Button } from '../ui/button';
import { KindBadge, type ChatSidebarSessionListItem, type KindKey } from './ChatSidebarTypes';

export function ChatSidebarRecentControls({
  searchOpen,
  search,
  searchRef,
  kindFilter,
  labels,
  kindLabel,
  onSearchOpenChange,
  onSearchChange,
  onKindFilterChange,
}: {
  searchOpen: boolean;
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  kindFilter: KindKey | null;
  labels: {
    recentChats: string;
    searchLabel: string;
    searchPlaceholder: string;
    clearSearch: string;
    all: string;
  };
  kindLabel: (kind: KindKey) => string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onKindFilterChange: (kind: KindKey | null) => void;
}) {
  return (
    <div className="px-3 pt-3 pb-2 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {labels.recentChats}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={`cursor-pointer p-0 min-w-8 h-8 rounded-md ${searchOpen ? 'bg-secondary' : 'bg-transparent'}`}
          onClick={() => onSearchOpenChange(!searchOpen)}
          aria-label={labels.searchLabel}
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>

      {searchOpen && (
        <div className="relative mb-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="w-full h-10 pl-9 pr-9 text-sm rounded-md outline-none bg-background text-foreground border border-input"
            onKeyDown={(event) => {
              if (event.key === 'Escape') onSearchOpenChange(false);
            }}
          />
          {search && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer p-0 min-w-7 h-7 rounded-md"
              aria-label={labels.clearSearch}
              onClick={() => {
                onSearchChange('');
                onSearchOpenChange(false);
              }}
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center gap-1 overflow-x-auto">
        <Button
          variant={kindFilter === null ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-[11px] rounded-md cursor-pointer shrink-0"
          onClick={() => onKindFilterChange(null)}
        >
          {labels.all}
        </Button>
        <Button
          variant={kindFilter === 'chat' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-[11px] rounded-md cursor-pointer shrink-0"
          onClick={() => onKindFilterChange('chat')}
        >
          <MessageSquare className="w-3 h-3 mr-1" />
          {kindLabel('chat')}
        </Button>
        <Button
          variant={kindFilter === 'video' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-[11px] rounded-md cursor-pointer shrink-0"
          onClick={() => onKindFilterChange('video')}
        >
          <Film className="w-3 h-3 mr-1" />
          {kindLabel('video')}
        </Button>
      </div>
    </div>
  );
}

export function ChatSidebarRecentList({
  sessions,
  activeSessionId,
  isChatRoute,
  search,
  labels,
  kindLabel,
  projectStatusLabel,
  clipCountLabel,
  onSelectSession,
  onRequestDelete,
}: {
  sessions: ChatSidebarSessionListItem[];
  activeSessionId: string | null | undefined;
  isChatRoute: boolean;
  search: string;
  labels: {
    deleteLabel: string;
    noMatchingConversation: string;
    noConversations: string;
  };
  kindLabel: (kind: KindKey) => string;
  projectStatusLabel: (status: string) => string;
  clipCountLabel: (count: number) => string;
  onSelectSession: (id: string) => void;
  onRequestDelete: (session: { id: string; title: string }) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
      {sessions.length > 0 ? (
        sessions.map((session) => {
          const isActive = isChatRoute && activeSessionId === session.id;
          const sessionKind: KindKey = session.kind ?? 'chat';
          return (
            <div key={session.id} className="flex min-w-0 items-center gap-1 group">
              <Button
                variant="ghost"
                className={`min-w-0 flex-1 justify-start h-auto min-h-11 px-3 py-2.5 text-xs rounded-md cursor-pointer ${isActive ? 'bg-accent text-foreground' : 'bg-transparent text-muted-foreground'
                  }`}
                onClick={() => onSelectSession(session.id)}
              >
                <KindBadge kind={sessionKind} label={kindLabel(sessionKind)} />
                <div className="ml-2 min-w-0 flex-1">
                  <div
                    className={`truncate text-left leading-5 ${isActive ? 'text-foreground' : ''}`}
                    title={session.title}
                  >
                    {session.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {session.agentName ? (
                      <span className="truncate" title={session.agentName}>
                        {session.agentName}
                      </span>
                    ) : (
                      <span>{kindLabel(sessionKind)}</span>
                    )}
                    {session.projectMeta && (
                      <>
                        <span>·</span>
                        <span>{projectStatusLabel(session.projectMeta.status)}</span>
                        <span>·</span>
                        <span>{clipCountLabel(session.projectMeta.clipCount)}</span>
                      </>
                    )}
                  </div>
                </div>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer p-0 opacity-0 group-hover:opacity-100 min-w-7 h-7 rounded-md shrink-0"
                onClick={() => onRequestDelete(session)}
                aria-label={labels.deleteLabel}
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        })
      ) : (
        <div className="px-3 py-8 text-center rounded-md bg-secondary">
          <p className="text-xs text-muted-foreground">
            {search ? labels.noMatchingConversation : labels.noConversations}
          </p>
        </div>
      )}
    </div>
  );
}
