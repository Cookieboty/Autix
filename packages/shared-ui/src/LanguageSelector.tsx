'use client';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLanguageStore } from '@autix/shared-store';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
} from '@autix/i18n';

export function LanguageSelector() {
  const { language, setLanguage } = useLanguageStore();
  const t = useTranslations('sidebar');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="p-0 w-9 h-9" aria-label={t('switchLanguage')}>
          <Languages size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            className={language === lang ? 'font-medium' : ''}
          >
            {LANGUAGE_LABELS[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
