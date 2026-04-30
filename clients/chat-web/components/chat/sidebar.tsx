'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useArtifactStore } from '@/store/artifact.store';
import { useAIUIStore } from '@/store/ai-ui.store';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  LogOut,
  BookOpen,
  Sun,
  Moon,
  X,
  Settings,
  Bell,
  MoreHorizontal,
  AlertTriangle,
  Swords,
  Palette,
  FolderOpen,
  Languages,
  Crown,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Button,
  Avatar,
  Dropdown,
  ModalBackdrop,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { useTaskStore } from '@/store/task.store';
import { useUiStore } from '@/store/ui.store';
import { useLanguageStore } from '@/store/language.store';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@autix/i18n';
import { useTranslations } from 'next-intl';

export function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuthStore();
  const t = useTranslations('sidebar');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tChat = useTranslations('chat');
  const { sessions, activeSessionId, createSession, setActiveSession, deleteSession } = useChatStore();
  const clearArtifact = useArtifactStore((s) => s.clearArtifact);
  const resetAIUI = useAIUIStore((s) => s.reset);
  const { theme, setTheme } = useTheme();
  const unreadCount = useTaskStore((s) => s.events.filter((e) => !e.readAt).length);
  const openNotificationDrawer = useUiStore((s) => s.openNotificationDrawer);
  const { language, setLanguage } = useLanguageStore();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const closeDeleteConfirm = () => setPendingDelete(null);
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const wasActive = pendingDelete.id === activeSessionId;
    deleteSession(pendingDelete.id);
    if (wasActive) {
      clearArtifact();
      resetAIUI();
    }
    setPendingDelete(null);
  };

  const isLibrary = pathname === '/library';
  const isModels = pathname === '/models';
  const isArena = pathname.startsWith('/arena');
  const isTemplates = pathname.startsWith('/templates') && !pathname.startsWith('/templates/mine');
  const isMyTemplates = pathname.startsWith('/templates/mine');
  const isMembership = pathname.startsWith('/membership');

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleNewChat = async () => {
    const id = await createSession(tChat('newConversation'));
    setSearchOpen(false);
    setSearch('');
    router.push(`/c/${id}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const displayName = (user as any)?.realName || (user as any)?.username || t('defaultUser');
  const displayEmail = (user as any)?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const navItems = [
    { label: t('newSession'), icon: Plus, href: '/c/new', active: false, action: handleNewChat },
    { label: t('arena'), icon: Swords, href: '/arena', active: isArena },
    { label: t('templateMarket'), icon: Palette, href: '/templates', active: isTemplates },
    { label: t('myTemplates'), icon: FolderOpen, href: '/templates/mine', active: isMyTemplates },
    { label: t('library'), icon: BookOpen, href: '/library', active: isLibrary },
    { label: t('modelConfig'), icon: Settings, href: '/models', active: isModels },
    { label: t('membership'), icon: Crown, href: '/membership', active: isMembership },
  ];

  return (
    <aside
      className="w-[244px] flex flex-col flex-shrink-0 h-full px-3 py-3"
      style={{
        backgroundColor: 'var(--app-shell)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-lg"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="px-4 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Amux Studio"
              width={30}
              height={30}
              style={{ width: 30, height: 30 }}
              className="rounded-md flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
                Amux Studio
              </p>
            </div>
          </div>
        </div>

        <div className="px-2 pb-2 flex-shrink-0 space-y-1">
          {navItems.map(({ label, icon: Icon, href, active, action }) => {
            const className = `w-full min-w-0 justify-start h-11 px-3.5 rounded-md text-sm font-medium cursor-pointer transition-colors`;

            const style = {
              backgroundColor: active ? 'var(--nav-item-active)' : 'var(--nav-item)',
              color: 'var(--foreground)',
            } as const;

            const icon = (
              <Icon
                className="w-4 h-4 mr-2.5 flex-shrink-0"
                style={{ color: active ? 'var(--foreground)' : 'var(--muted)' }}
              />
            );

            const labelNode = (
              <span className="min-w-0 flex-1 truncate text-left" title={label}>
                {label}
              </span>
            );

            if (action) {
              return (
                <Button key={label} variant="ghost" className={className} style={style} onPress={action}>
                  {icon}
                  {labelNode}
                </Button>
              );
            }

            return (
              <Button key={label} variant="ghost" className={className} style={style} onPress={() => router.push(href!)}>
                {icon}
                {labelNode}
              </Button>
            );
          })}
        </div>

        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
              {t('recentChats')}
            </span>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="cursor-pointer min-w-8 h-8 rounded-md"
              style={{ backgroundColor: searchOpen ? 'var(--panel-muted)' : 'transparent' }}
              onPress={() => setSearchOpen((v) => !v)}
              aria-label={t('searchLabel')}
            >
              <Search className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
            </Button>
          </div>

          {searchOpen && (
            <div className="relative mb-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--muted)' }} />
              <input
                ref={searchRef as any}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full h-10 pl-9 pr-9 text-sm rounded-md outline-none bg-transparent"
                style={{
                  border: '1px solid var(--input-border)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--foreground)',
                  boxShadow: '0 0 0 0 transparent',
                }}
                onKeyDown={(e) => e.key === 'Escape' && setSearchOpen(false)}
              />
              {search && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer min-w-7 h-7 rounded-md"
                  aria-label={t('clearSearch')}
                  onPress={() => {
                    setSearch('');
                    setSearchOpen(false);
                  }}
                >
                  <X className="w-3 h-3" style={{ color: 'var(--muted)' }} />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
          {filtered.length > 0 ? (
            filtered.map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <div key={session.id} className="flex min-w-0 items-center gap-1 group">
                  <Button
                    variant="ghost"
                    className="min-w-0 flex-1 justify-start h-auto min-h-11 px-3 py-2.5 text-xs rounded-md cursor-pointer"
                    style={{
                      backgroundColor: isActive ? 'var(--nav-item-active)' : 'transparent',
                      color: isActive ? 'var(--foreground)' : 'var(--muted)',
                    }}
                    onPress={() => {
                      setActiveSession(session.id);
                      router.push(`/c/${session.id}`);
                    }}
                  >
                    <MessageSquare
                      className="w-3.5 h-3.5 flex-shrink-0 mr-2.5"
                      style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)' }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-left leading-5"
                      title={session.title}
                    >
                      {session.title}
                    </span>
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer opacity-0 group-hover:opacity-100 min-w-7 h-7 rounded-md flex-shrink-0"
                    onPress={() => setPendingDelete({ id: session.id, title: session.title })}
                    aria-label={t('deleteLabel')}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-8 text-center rounded-md" style={{ backgroundColor: 'var(--panel-muted)' }}>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {search ? tChat('noMatchingConversation') : tChat('noConversations')}
              </p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1 mb-1.5">
            <Dropdown.Root>
              <Dropdown.Trigger
                className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-[var(--nav-item-hover)] cursor-pointer"
                aria-label={t('switchLanguage')}
              >
                <Languages className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              </Dropdown.Trigger>
              <Dropdown.Popover placement="top" className="w-[160px]">
                <Dropdown.Menu
                  aria-label={t('languageSelection')}
                  onAction={(key) => setLanguage(key as SupportedLanguage)}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <Dropdown.Item key={lang} id={lang} textValue={LANGUAGE_LABELS[lang]}>
                      <span className={lang === language ? 'font-medium' : ''}>
                        {LANGUAGE_LABELS[lang]}
                      </span>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
            <span className="text-[11px] flex-1" style={{ color: 'var(--muted)' }}>{LANGUAGE_LABELS[language]}</span>
          </div>
          <Dropdown.Root>
            <Dropdown.Trigger
              className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--nav-item-hover)]"
              style={{ backgroundColor: 'transparent' }}
              aria-label={t('userMenu')}
            >
              <div className="relative flex-shrink-0">
                <Avatar
                  size="sm"
                  className="h-8 w-8"
                  style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--foreground)' }}
                >
                  {avatarLetter}
                </Avatar>
                {unreadCount > 0 && (
                  <span
                    className="absolute right-0 top-0 block h-2 w-2 rounded-full ring-2"
                    style={{ backgroundColor: 'var(--danger, #ef4444)', boxShadow: '0 0 0 2px var(--panel)' }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium leading-[1.2]"
                  style={{ color: 'var(--foreground)' }}
                  title={displayName}
                >
                  {displayName}
                </p>
                {displayEmail && (
                  <p
                    className="mt-0.5 truncate text-[11px] leading-[1.2]"
                    style={{ color: 'var(--muted)' }}
                    title={displayEmail}
                  >
                    {displayEmail}
                  </p>
                )}
              </div>
              <MoreHorizontal className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="top" className="w-[220px]">
              <Dropdown.Menu aria-label={t('userActions')}>
                <Dropdown.Item onAction={openNotificationDrawer} textValue={t('notifications')}>
                  <div className="flex w-full items-center gap-2">
                    <Bell className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                    <span className="flex-1 text-sm">{t('notifications')}</span>
                    {unreadCount > 0 && (
                      <span
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: 'var(--danger, #ef4444)' }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </Dropdown.Item>
                <Dropdown.Item
                  onAction={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  textValue={theme === 'dark' ? tc('switchThemeLight') : tc('switchThemeDark')}
                >
                  <div className="flex w-full items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                    ) : (
                      <Moon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
                    )}
                    <span className="flex-1 text-sm">
                      {theme === 'dark' ? tc('switchThemeLight') : tc('switchThemeDark')}
                    </span>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item onAction={handleLogout} textValue={tAuth('logout')}>
                  <div className="flex w-full items-center gap-2" style={{ color: 'var(--danger, #ef4444)' }}>
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-sm">{tAuth('logout')}</span>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>
      </div>

      {pendingDelete && (
        <ModalBackdrop
          isOpen
          onOpenChange={(open) => {
            if (!open) closeDeleteConfirm();
          }}
        >
          <ModalDialog>
              <ModalHeader>
                <ModalHeading className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-danger" />
                  {tChat('deleteConversationTitle')}
                </ModalHeading>
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-600">
                  {tChat('deleteConversationMsg', { title: pendingDelete.title })}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={closeDeleteConfirm}>
                  {tc('cancel')}
                </Button>
                <Button variant="danger" onPress={confirmDelete}>
                  {tc('confirmDelete')}
                </Button>
              </ModalFooter>
          </ModalDialog>
        </ModalBackdrop>
      )}
    </aside>
  );
}
