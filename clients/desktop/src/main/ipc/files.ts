import { ipcMain } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { z } from 'zod';
import log from 'electron-log/main';

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB hard cap
const pathSchema = z.string().min(1).max(4096);

const MIME_BY_EXT: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function registerFilesIpc(): void {
  ipcMain.handle('files:read-dropped', async (_e, raw) => {
    const path = pathSchema.parse(raw);
    const stats = await stat(path);
    if (!stats.isFile()) throw new Error('Path is not a regular file');
    if (stats.size > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${stats.size} bytes`);
    }
    const buffer = await readFile(path);
    const ext = extname(path).toLowerCase();
    const type = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    log.info(`[files] read ${path} (${stats.size} bytes, ${type})`);
    return {
      name: basename(path),
      type,
      data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  });
}
