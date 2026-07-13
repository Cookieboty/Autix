'use client';

import { useNavigate, useParams } from 'react-router-dom';
import {
  TemplateDetailView,
  TemplatesMarketplaceView,
} from '@autix/shared-ui/template';

export function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <TemplatesMarketplaceView
      onOpenTemplate={(id) => navigate(`/templates/${id}`)}
    />
  );
}

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <TemplateDetailView
      templateId={id}
      onBackToList={() => navigate('/templates')}
    />
  );
}
