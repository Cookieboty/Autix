import { parseText } from './text.parser';
import { parsePdf } from './pdf.parser';

export async function extractText(
  filePath: string,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePdf(filePath);
    case 'text/plain':
    case 'text/markdown':
      return parseText(filePath);
    default:
      return parseText(filePath);
  }
}
