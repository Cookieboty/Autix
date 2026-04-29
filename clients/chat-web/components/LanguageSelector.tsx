'use client';

import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from '@heroui/react';
import { Languages } from 'lucide-react';
import { useLanguageStore } from '@/store/language.store';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from '@autix/i18n';

export function LanguageSelector() {
  const { language, setLanguage } = useLanguageStore();

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant="ghost" size="sm" aria-label="Switch language">
          <Languages size={18} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Language selection"
        selectionMode="single"
        selectedKeys={new Set([language])}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as SupportedLanguage;
          if (selected) setLanguage(selected);
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownItem key={lang}>{LANGUAGE_LABELS[lang]}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
