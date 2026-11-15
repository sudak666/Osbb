import type { ExportSheet } from './excel-export.ts';
import {
    buildAttendanceExportRows, buildAttendanceSummaryRows, calculateAttendanceTotals, normalizeAttendanceMonth,
} from './osbb-attendance.ts';
import type { ElevatorEntry } from './osbb-elevator.ts';
import { garbageBins, normalizeGarbageMonth } from './osbb-garbage.ts';

// Місячний звіт для правління й мешканців однією кнопкою (тиждень 4 аудиту).
// Чисті функції: на вході — уже завантажені дані місяця, на виході — аркуші Excel.

const ROLES = ['electrician', 'janitor', 'plumber'] as const;
const ROLE_NAMES: Record<string, string> = { electrician: 'Електрик', janitor: 'Двірник', plumber: 'Сантехнік' };
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

export interface ReportWork { work_date: string; worker_role: string; description: string; note?: string | null }
export interface ReportIssue { issued_at: string; item_id: number | string | null; item_name: string; quantity: number; issued_to?: string | null; note?: string | null }
export interface ReportReceipt { received_at: string; item_id: number | string | null; item_name: string; quantity: number; supplier?: string | null; purchase_price_unit?: number | null }
export interface ReportItem { id: number | string; category?: string | null; price_unit?: number | null }

export interface MonthlyReportInput {
    year: number;
    /** 0–11 */
    month: number;
    works: readonly ReportWork[];
    attendance: unknown;
    garbage: unknown;
    elevator: readonly ElevatorEntry[];
    issues: readonly ReportIssue[];
    receipts: readonly ReportReceipt[];
    items: readonly ReportItem[];
}

export function monthTitle(year: number, month: number): string {
    return `${MONTHS[month] ?? ''} ${year}`;
}

export function monthRange(year: number, month: number): { first: string; last: string; startIso: string; endIso: string; days: number } {
    const days = new Date(year, month + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
        first: `${year}-${pad(month + 1)}-01`,
        last: `${year}-${pad(month + 1)}-${pad(days)}`,
        startIso: new Date(year, month, 1).toISOString(),
        endIso: new Date(new Date(year, month + 1, 1).getTime() - 1).toISOString(),
        days,
    };
}

const dateLabel = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const money = (value: number) => Math.round(value * 100) / 100;
const orEmpty = (rows: Record<string, unknown>[]) => (rows.length ? rows : [{ 'Примітка': 'За цей місяць записів немає' }]);

export function buildMonthlyReportSheets(input: MonthlyReportInput): ExportSheet[] {
    const { year, month } = input;
    const { days } = monthRange(year, month);
    const itemById = new Map(input.items.map((item) => [String(item.id), item]));
    const priceOf = (id: number | string | null) => Number(itemById.get(String(id))?.price_unit) || 0;

    const attendance = normalizeAttendanceMonth(input.attendance);
    const totals = calculateAttendanceTotals(attendance, ROLES, days);
    const attendanceDaily = buildAttendanceExportRows(attendance, ROLES, ROLE_NAMES, year, month, days)
        .filter((row) => row['Стан'] !== 'Немає запису');

    const garbage = normalizeGarbageMonth(input.garbage);
    const garbageRows = Object.entries(garbage)
        .map(([day, row]) => ({ day: Number(day), row }))
        .filter(({ row }) => row.time || Object.values(row.types ?? {}).some((n) => Number(n) > 0))
        .sort((a, b) => a.day - b.day)
        .map(({ day, row }) => ({
            'Дата': dateLabel(new Date(year, month, day)),
            'Час': row.time ?? '',
            'Баки': garbageBins(row.types),
            'Пластик': Number(row.types?.plastic) || 0,
            'Скло': Number(row.types?.glass) || 0,
        }));

    const issueRows = [...input.issues].sort((a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at)).map((log) => {
        const price = priceOf(log.item_id);
        return {
            'Дата': dateLabel(log.issued_at),
            'Товар': log.item_name,
            'Категорія': itemById.get(String(log.item_id))?.category ?? '',
            'Кількість': Number(log.quantity) || 0,
            'Кому': log.issued_to ?? '',
            'Ціна за од., грн': price || '',
            'Сума ≈, грн': price ? money(price * (Number(log.quantity) || 0)) : '',
            'Примітка': log.note ?? '',
        };
    });
    const receiptRows = [...input.receipts].sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at)).map((receipt) => {
        const price = Number(receipt.purchase_price_unit) || priceOf(receipt.item_id);
        return {
            'Дата': dateLabel(receipt.received_at),
            'Товар': receipt.item_name,
            'Кількість': Number(receipt.quantity) || 0,
            'Постачальник': receipt.supplier ?? '',
            'Ціна за од., грн': price || '',
            'Сума ≈, грн': price ? money(price * (Number(receipt.quantity) || 0)) : '',
        };
    });
    const issuedSum = money(issueRows.reduce((sum, row) => sum + (Number(row['Сума ≈, грн']) || 0), 0));
    const receivedSum = money(receiptRows.reduce((sum, row) => sum + (Number(row['Сума ≈, грн']) || 0), 0));
    const elevator = [...input.elevator].sort((a, b) => a.day - b.day);

    const summary: Record<string, unknown>[] = [
        { 'Показник': 'Місяць', 'Значення': monthTitle(year, month) },
        { 'Показник': 'Виконаних робіт', 'Значення': input.works.length },
        ...ROLES.map((role) => ({
            'Показник': `${ROLE_NAMES[role]}: відпрацьовано`,
            'Значення': `${totals[role]?.days ?? 0} дн., ${Math.round((totals[role]?.hours ?? 0) * 10) / 10} год`,
        })),
        { 'Показник': 'Днів вивозу сміття', 'Значення': garbageRows.length },
        { 'Показник': 'Вивезено баків', 'Значення': garbageRows.reduce((sum, row) => sum + row['Баки'], 0) },
        { 'Показник': 'Приїздів ліфтера', 'Значення': elevator.length },
        { 'Показник': 'Видач зі складу', 'Значення': issueRows.length },
        { 'Показник': 'Видано матеріалів на суму ≈, грн', 'Значення': issuedSum },
        { 'Показник': 'Надходжень на склад', 'Значення': receiptRows.length },
        { 'Показник': 'Закуплено на суму ≈, грн', 'Значення': receivedSum },
        { 'Показник': 'Примітка', 'Значення': 'Суми зі знаком ≈ рахуються за поточною ціною товару, якщо ціну закупівлі не вказано.' },
    ];

    return [
        { name: 'Підсумок', rows: summary, widths: [36, 60] },
        {
            name: 'Виконані роботи',
            rows: orEmpty([...input.works].sort((a, b) => a.work_date.localeCompare(b.work_date)).map((work) => ({
                'Дата': dateLabel(work.work_date),
                'Виконавець': ROLE_NAMES[work.worker_role] ?? work.worker_role,
                'Що зроблено': work.description,
                'Примітка': work.note ?? '',
            }))),
            widths: [12, 14, 70, 40],
        },
        { name: 'Табель — підсумок', rows: buildAttendanceSummaryRows(attendance, ROLES, ROLE_NAMES, days), widths: [16, 20, 20] },
        { name: 'Табель — по днях', rows: orEmpty(attendanceDaily), widths: [12, 14, 14, 10, 10, 12, 10, 20, 16] },
        { name: 'Сміття', rows: orEmpty(garbageRows), widths: [12, 8, 8, 10, 8] },
        {
            name: 'Ліфтер',
            rows: orEmpty(elevator.map((entry) => ({ 'Дата': dateLabel(new Date(year, month, entry.day)), 'Що зроблено': entry.text }))),
            widths: [12, 80],
        },
        { name: 'Склад — видачі', rows: orEmpty(issueRows), widths: [12, 50, 18, 10, 24, 14, 14, 30] },
        { name: 'Склад — надходження', rows: orEmpty(receiptRows), widths: [12, 50, 10, 24, 14, 14] },
    ];
}

export function monthlyReportFileName(year: number, month: number): string {
    return `Звіт_ОСББ_${year}-${String(month + 1).padStart(2, '0')}.xlsx`;
}

