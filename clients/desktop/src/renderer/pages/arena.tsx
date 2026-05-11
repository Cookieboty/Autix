import { useParams } from 'react-router-dom';
import { ArenaView } from '@autix/shared-ui/arena';

export function ArenaPage() {
  const { id } = useParams<{ id?: string }>();
  return <ArenaView sessionId={id} />;
}
