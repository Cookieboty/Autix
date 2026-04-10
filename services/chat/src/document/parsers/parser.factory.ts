import { parseText } from './text.parser';
import { parsePdf } from './pdf.parser';
import { parseDocx } from './docx.parser';

export async function extractText(
  filePath: string,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePdf(filePath);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return parseDocx(filePath);
    case 'text/plain':
    case 'text/markdown':
    case 'text/x-markdown':
      return parseText(filePath);
    default:
      return parseText(filePath);
  }
}
