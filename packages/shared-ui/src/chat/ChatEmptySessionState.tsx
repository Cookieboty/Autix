'use client';

import { Laugh } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '../ui/empty';
import { ChatViewHeader } from './ChatViewHeader';

export function ChatEmptySessionState({
  onToggleSidebar,
}: {
  onToggleSidebar?: () => void;
}) {
  const t = useTranslations('chat');

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
      <ChatViewHeader onToggleSidebar={onToggleSidebar} />
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="text-muted-foreground">
            <Laugh aria-hidden="true" />
          </EmptyMedia>
          <EmptyDescription>{t('selectOrCreateChat')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
