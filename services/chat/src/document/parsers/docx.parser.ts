import * as fs from 'fs';
import * as mammoth from 'mammoth';

export async function parseDocx(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
