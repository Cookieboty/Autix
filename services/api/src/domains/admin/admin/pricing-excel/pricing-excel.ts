/**
 * exceljs I/O for the pricing-rules bulk template.
 * Thin layer: workbook <-> array of cell records. All row/record semantics and
 * validation live in the pure `pricing-excel-mapping.ts`.
 */
import { Workbook, type CellValue } from 'exceljs';
import type { PricingRuleRow } from '@autix/domain/billing';
import {
  PRICING_EXCEL_COLUMNS,
  rowToRecord,
  type PricingExcelRecord,
} from './pricing-excel-mapping';

const SHEET_NAME = '计价规则';
export const PRICING_EXCEL_SCHEMA_VERSION = 1;

function cellToPrimitive(value: CellValue): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Rich text / hyperlink / formula result objects.
    const obj = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (typeof obj.text === 'string') return obj.text;
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join('');
    if (obj.result != null) return cellToPrimitive(obj.result as CellValue);
  }
  return String(value);
}

export async function buildPricingWorkbookBuffer(
  rows: PricingRuleRow[],
  taskType: string,
): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'Amux Studio';

  const sheet = workbook.addWorksheet(SHEET_NAME);
  sheet.columns = PRICING_EXCEL_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: Math.max(12, col.header.length + 2),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    sheet.addRow(rowToRecord(row));
  }

  // Hidden metadata sheet — lets the importer verify origin/version.
  const meta = workbook.addWorksheet('_meta');
  meta.state = 'veryHidden';
  meta.addRow(['taskType', taskType]);
  meta.addRow(['schemaVersion', PRICING_EXCEL_SCHEMA_VERSION]);
  meta.addRow(['columns', PRICING_EXCEL_COLUMNS.map((c) => c.key).join(',')]);

  const written = await workbook.xlsx.writeBuffer();
  return Buffer.from(new Uint8Array(written as ArrayBuffer));
}

/**
 * Read the first data worksheet into cell records keyed by column key.
 * Columns are matched by header text (order-tolerant); unrecognized headers are
 * ignored. Returns records in sheet order (excluding the header row).
 */
export async function parsePricingWorkbook(buffer: Buffer): Promise<PricingExcelRecord[]> {
  const workbook = new Workbook();
  // exceljs ships its own global `Buffer extends ArrayBuffer` type that clashes
  // with Node's Buffer; it accepts a Node Buffer at runtime, so cast the type.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet =
    workbook.getWorksheet(SHEET_NAME) ??
    workbook.worksheets.find((ws) => ws.state !== 'veryHidden' && ws.name !== '_meta') ??
    workbook.worksheets[0];
  if (!sheet) return [];

  const headerToKey = new Map(PRICING_EXCEL_COLUMNS.map((c) => [c.header, c.key]));
  const keyByHeader = new Map(PRICING_EXCEL_COLUMNS.map((c) => [c.key, c.key]));

  // Build a column-index -> key map from the header row.
  const colIndexToKey = new Map<number, string>();
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const headerText = String(cellToPrimitive(cell.value) ?? '').trim();
    const key = headerToKey.get(headerText) ?? keyByHeader.get(headerText);
    if (key) colIndexToKey.set(colNumber, key);
  });
  if (colIndexToKey.size === 0) return [];

  const records: PricingExcelRecord[] = [];
  const lastRow = sheet.rowCount;
  for (let r = 2; r <= lastRow; r += 1) {
    const row = sheet.getRow(r);
    const record: PricingExcelRecord = {};
    for (const [colNumber, key] of colIndexToKey) {
      record[key] = cellToPrimitive(row.getCell(colNumber).value);
    }
    records.push(record);
  }
  return records;
}
