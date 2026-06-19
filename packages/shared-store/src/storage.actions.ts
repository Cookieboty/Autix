import { storageApi } from '@autix/sdk';

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
