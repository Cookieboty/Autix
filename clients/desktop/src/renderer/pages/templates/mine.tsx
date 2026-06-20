'use client';

import { useNavigate } from 'react-router-dom';
import { TemplatesMineView } from '@autix/shared-ui/template';

export function TemplatesMinePage() {
  const navigate = useNavigate();

  return <TemplatesMineView onOpenTemplate={(id) => navigate(`/templates/${id}`)} />;
}
