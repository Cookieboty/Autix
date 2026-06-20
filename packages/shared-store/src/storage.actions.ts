import { storageApi } from '@autix/sdk';
import { authFetch, getApiUrl } from './http.actions';

export interface StoredUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function uploadFileToStorage(
  file: File,
  options: { folder?: string; contentType?: string } = {},
): Promise<StoredUploadResult> {
  const contentType = options.contentType ?? file.type;
  const presignRes = await storageApi.presign({
    fileName: file.name,
    contentType,
    folder: options.folder,
  });
  const result = presignRes.data as StoredUploadResult;
  await fetch(result.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  });
  return result;
}

export async function uploadBase64ImageToStorage(
  image: string,
  options: { folder?: string } = {},
): Promise<{ publicUrl: string }> {
  const response = await authFetch(getApiUrl('/api/storage/upload-base64'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image,
      folder: options.folder,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json() as {
    data?: { publicUrl: string };
    publicUrl?: string;
  };
  const uploaded = payload.data ?? payload;
  return { publicUrl: typeof uploaded.publicUrl === 'string' ? uploaded.publicUrl : '' };
}
