'use client';

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { TemplatesWorkspaceView } from '@autix/shared-ui/template';

export function TemplatesWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const conversationId = new URLSearchParams(location.search).get('conversationId');

  return (
    <TemplatesWorkspaceView
      generationId={id}
      conversationId={conversationId}
      onBackToDetail={(templateId) => navigate(`/templates/${templateId}`)}
      onOpenConversation={(nextConversationId) => navigate(`/chat/${nextConversationId}`)}
    />
  );
}
