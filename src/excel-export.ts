export interface ExportSheet {
  name: string;
  rows: Record<string, unknown>[];
  widths: number[];
}

/** Explicit primitive values keep user text (including '=…') out of formulas. */
export function exportSheetData(rows: Record<string, unknown>[]): (string | number | boolean | null)[][] {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return [headers, ...rows.map(row => headers.map(key => {
    const value = row[key];
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    return String(value);
  }))];
}

export async function downloadWorkbook(sheets: ExportSheet[], fileName: string): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(sheets.map(sheet => ({
    sheet: sheet.name,
    data: exportSheetData(sheet.rows),
    columns: sheet.widths.map(width => ({ width })),
  }))).toFile(fileName);
}
