import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';

export async function parsePdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}
