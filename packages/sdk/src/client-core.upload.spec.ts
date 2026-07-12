import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadToPresignedUrl } from './client-core';

describe('uploadToPresignedUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a successful PUT response', async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadToPresignedUrl('https://upload.example/object', 'body', {
      contentType: 'image/png',
    })).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith('https://upload.example/object', expect.objectContaining({
      method: 'PUT',
      body: 'body',
    }));
  });

  it('rejects a non-2xx PUT before callers can consume the reservation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

    await expect(uploadToPresignedUrl('https://upload.example/object', 'body'))
      .rejects.toThrow('Presigned upload failed with status 403');
  });
});
