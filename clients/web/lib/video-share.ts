import type { VideoProjectShareDetail } from '@autix/shared-store';

function getApiOrigin(): string {
  return (process.env.API_URL || 'http://localhost:4000')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

export async function getSharedVideoProject(code: string): Promise<VideoProjectShareDetail | null> {
  try {
    const res = await fetch(
      `${getApiOrigin()}/api/video-projects/share/${encodeURIComponent(code)}`,
      {
        next: { revalidate: 60 },
        headers: { accept: 'application/json' },
      },
    );
    if (!res.ok) return null;
    const payload = await res.json();
    return (payload && typeof payload === 'object' && 'data' in payload
      ? payload.data
      : payload) as VideoProjectShareDetail;
  } catch {
    return null;
  }
}
