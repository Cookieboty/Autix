'use client';

import * as React from 'react';
import { Laugh, MessageSquare, Search, Trash2 } from 'lucide-react';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '../ui/empty';
import { Input } from '../ui/input';
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../ui/sidebar';

export interface AppSidebarRecentSession {
  id: string;
  title: string;
}

interface AppSidebarRecentChatsLabels {
  recentChats: string;
  searchLabel: string;
  searchPlaceholder: string;
  cancel: string;
  deleteLabel: string;
  noMatchingConversation: string;
  noConversations: string;
}

export function AppSidebarRecentChats({
  sessions,
  activeSessionId,
  isChatRoute,
  search,
  searchOpen,
  searchRef,
  labels,
  onSearchChange,
  onSearchOpenChange,
  onSelectSession,
  onRequestDelete,
}: {
  sessions: AppSidebarRecentSession[];
  activeSessionId: string | null | undefined;
  isChatRoute: boolean;
  search: string;
  searchOpen: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  labels: AppSidebarRecentChatsLabels;
  onSearchChange: (value: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  onSelectSession: (id: string) => void;
  onRequestDelete: (session: AppSidebarRecentSession) => void;
}) {
  const filtered = sessions.filter((session) =>
    session.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:p-1.5">
      {searchOpen ? (
        <div className="mb-1 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={labels.searchPlaceholder}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  onSearchChange('');
                  onSearchOpenChange(false);
                }
              }}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <button
            type="button"
            className="shrink-0 px-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              onSearchChange('');
              onSearchOpenChange(false);
            }}
          >
            {labels.cancel}
          </button>
        </div>
      ) : (
        <>
          <SidebarGroupLabel className="text-muted-foreground">
            {labels.recentChats}
          </SidebarGroupLabel>
          <SidebarGroupAction
            title={labels.searchLabel}
            onClick={() => onSearchOpenChange(true)}
          >
            <Search />
            <span className="sr-only">{labels.searchLabel}</span>
          </SidebarGroupAction>
        </>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {filtered.length > 0 ? (
            filtered.map((session) => {
              const isActive = isChatRoute && activeSessionId === session.id;
              return (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton
                    tooltip={session.title}
                    isActive={isActive}
                    onClick={() => onSelectSession(session.id)}
                    className="text-sidebar-foreground/72 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/12 data-[active=true]:text-white"
                  >
                    <MessageSquare />
                    <span>{session.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    aria-label={labels.deleteLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDelete(session);
                    }}
                  >
                    <Trash2 />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              );
            })
          ) : (
            <Empty className="gap-3 border-0 px-2 py-6 md:p-6">
              <EmptyHeader className="gap-1.5">
                <EmptyMedia
                  variant="icon"
                  className="mb-1 size-9 text-muted-foreground [&_svg:not([class*='size-'])]:size-5"
                >
                  <Laugh aria-hidden="true" />
                </EmptyMedia>
                <EmptyDescription>
                  {search
                    ? labels.noMatchingConversation
                    : labels.noConversations}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
