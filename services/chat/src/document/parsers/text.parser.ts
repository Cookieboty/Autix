import * as fs from 'fs';

export async function parseText(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf-8');
}
