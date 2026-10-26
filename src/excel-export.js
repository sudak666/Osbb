// Згенеровано з src/excel-export.ts (scripts/build-js-fallback.mjs). Не редагувати вручну.
function exportSheetData(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...rows.map((row) => headers.map((key) => {
    const value = row[key];
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value;
    return String(value);
  }))];
}
async function downloadWorkbook(sheets, fileName) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile(sheets.map((sheet) => ({
    sheet: sheet.name,
    data: exportSheetData(sheet.rows),
    columns: sheet.widths.map((width) => ({ width }))
  }))).toFile(fileName);
}
export {
  downloadWorkbook,
  exportSheetData
};
