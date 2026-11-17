import { escapeHtml } from './app-security.ts';
import { attendanceHours, formatAttendanceDuration, normalizeAttendanceMonth } from './osbb-attendance.ts';
import type { ElevatorEntry } from './osbb-elevator.ts';
import { garbageBins, normalizeGarbageMonth } from './osbb-garbage.ts';

// Звіт для керівництва (листопад 2026): гарна сторінка А4 за день, тиждень чи місяць,
// яку власник зберігає в PDF і пересилає. Тут лише чисті функції — без мережі й DOM.

export type ReportPeriodKind = 'day' | 'week' | 'month';
export type ReportSection = 'attendance' | 'garbage' | 'works' | 'elevator' | 'stock';
export const REPORT_SECTIONS: readonly { id: ReportSection; label: string }[] = [
    { id: 'attendance', label: 'Табель' },
    { id: 'garbage', label: 'Сміття' },
    { id: 'works', label: 'Виконані роботи' },
    { id: 'elevator', label: 'Ліфтер' },
    { id: 'stock', label: 'Склад' },
];
/** Склад за замовчуванням вимкнено — як і в щоденному Telegram-підсумку (041). */
export const DEFAULT_REPORT_SECTIONS: readonly ReportSection[] = ['attendance', 'garbage', 'works', 'elevator'];

const STAFF = [['electrician', 'Електрик'], ['janitor', 'Двірник'], ['plumber', 'Сантехнік']] as const;
const WORK_ROLE_LABELS: Record<string, string> = { electrician: 'Електрик', janitor: 'Двірник', plumber: 'Сантехнік', security: 'Охорона' };
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_NOM = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
const WEEKDAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface ReportPeriod { kind: ReportPeriodKind; from: Date; to: Date; title: string; label: string }

export function reportPeriod(kind: ReportPeriodKind, anchor: Date): ReportPeriod {
    const day = startOfDay(anchor);
    if (kind === 'day') {
        return { kind, from: day, to: day, title: 'Звіт за день', label: `${WEEKDAYS[day.getDay()]}, ${day.getDate()} ${MONTHS_GEN[day.getMonth()]} ${day.getFullYear()}` };
    }
    if (kind === 'week') {
        const from = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
        const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
        const sameMonth = from.getMonth() === to.getMonth();
        const label = sameMonth
            ? `${from.getDate()}–${to.getDate()} ${MONTHS_GEN[to.getMonth()]} ${to.getFullYear()}`
            : `${from.getDate()} ${MONTHS_GEN[from.getMonth()]} – ${to.getDate()} ${MONTHS_GEN[to.getMonth()]} ${to.getFullYear()}`;
        return { kind, from, to, title: 'Звіт за тиждень', label };
    }
    const from = new Date(day.getFullYear(), day.getMonth(), 1);
    const to = new Date(day.getFullYear(), day.getMonth() + 1, 0);
    return { kind, from, to, title: 'Звіт за місяць', label: `${MONTHS_NOM[from.getMonth()]} ${from.getFullYear()}` };
}

export function shiftReportAnchor(kind: ReportPeriodKind, anchor: Date, step: number): Date {
    if (kind === 'day') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + step);
    if (kind === 'week') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + step * 7);
    return new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
}

export function periodDays(period: ReportPeriod): Date[] {
    const days: Date[] = [];
    for (let d = new Date(period.from); d <= period.to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(d);
    return days;
}

/** Місяці, які зачіпає період: [рік, місяць 0–11]. Тиждень може перетинати межу місяця. */
export function periodMonths(period: ReportPeriod): [number, number][] {
    const months: [number, number][] = [];
    for (let d = new Date(period.from.getFullYear(), period.from.getMonth(), 1); d <= period.to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        months.push([d.getFullYear(), d.getMonth()]);
    }
    return months;
}

export interface ReportSourceData {
    /** Сирі дані табеля за ключем 'YYYY-MM'. */
    attendance: Record<string, unknown>;
    /** Сирі дані сміття за ключем 'YYYY-M' (місяць з нуля, як у журналі). */
    garbage: Record<string, unknown>;
    /** Записи ліфтера за ключем 'YYYY-M'. */
    elevator: Record<string, readonly ElevatorEntry[]>;
    works: readonly { work_date: string; worker_role: string; description: string; note?: string | null }[];
    issues: readonly { issued_at: string; item_id: number | string | null; item_name: string; quantity: number }[];
    receipts: readonly { received_at: string; item_id: number | string | null; quantity: number; purchase_price_unit?: number | null }[];
    items: readonly { id: number | string; name?: string; unit?: string | null; quantity: number; price_unit?: number | null; is_internal?: boolean | null; min_quantity?: number | null }[];
}

export interface ManagementReportModel {
    period: ReportPeriod;
    generatedAt: Date;
    /** Дні періоду до сьогодні включно (майбутні дні не рахуються «пропущеними»). */
    elapsedDays: number;
    attendance: { label: string; days: number; hours: number; today?: { checkIn: string; checkOut: string; absence: string } }[];
    totalHours: number;
    garbage: { date: Date; bins: number; time: string; recorded: boolean }[];
    garbageDays: number;
    garbageBins: number;
    works: { date: string; role: string; description: string; note: string }[];
    elevator: { date: Date; text: string }[];
    stock: { issues: number; issuedSum: number; top: { name: string; quantity: number; unit: string }[]; receipts: number; receivedSum: number; outOfStock: number; belowMin: number | null };
}

export function buildManagementReport(period: ReportPeriod, data: ReportSourceData, now: Date): ManagementReportModel {
    const days = periodDays(period);
    const today = startOfDay(now);
    const elapsed = days.filter((d) => d <= today);

    const attendance = STAFF.map(([role, label]) => {
        let workedDays = 0;
        let hours = 0;
        for (const d of days) {
            const month = normalizeAttendanceMonth(data.attendance[`${d.getFullYear()}-${pad(d.getMonth() + 1)}`]);
            const cell = month[String(d.getDate())]?.[role] ?? {};
            const h = attendanceHours(cell);
            if (h > 0) { workedDays += 1; hours += h; }
        }
        const row: ManagementReportModel['attendance'][number] = { label, days: workedDays, hours };
        if (period.kind === 'day') {
            const d = days[0];
            const cell = normalizeAttendanceMonth(data.attendance[`${d.getFullYear()}-${pad(d.getMonth() + 1)}`])[String(d.getDate())]?.[role] ?? {};
            row.today = { checkIn: cell.checkIn ?? '', checkOut: cell.checkOut ?? '', absence: cell.breakStart && cell.breakEnd ? `${cell.breakStart}–${cell.breakEnd}` : '' };
        }
        return row;
    });

    const garbage = days.map((d) => {
        const month = normalizeGarbageMonth(data.garbage[`${d.getFullYear()}-${d.getMonth()}`]);
        const row = month[pad(d.getDate())] ?? month[String(d.getDate())];
        const recorded = Boolean(row && (row.time || Object.values(row.types ?? {}).some((n) => Number(n) > 0)));
        return { date: d, bins: garbageBins(row?.types), time: typeof row?.time === 'string' ? row.time : '', recorded };
    });

    const fromIso = isoDay(period.from);
    const toIso = isoDay(period.to);
    const works = data.works
        .filter((w) => w.work_date >= fromIso && w.work_date <= toIso)
        .sort((a, b) => a.work_date.localeCompare(b.work_date))
        .map((w) => ({ date: w.work_date, role: WORK_ROLE_LABELS[w.worker_role] ?? w.worker_role, description: w.description, note: w.note ?? '' }));

    const elevator = periodMonths(period).flatMap(([y, m]) => (data.elevator[`${y}-${m}`] ?? [])
        .map((e) => ({ date: new Date(y, m, e.day), text: e.text })))
        .filter((e) => e.date >= period.from && e.date <= period.to)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const price = new Map(data.items.map((i) => [String(i.id), Number(i.price_unit) || 0]));
    const unit = new Map(data.items.map((i) => [String(i.id), i.unit || 'шт']));
    const inRange = (iso: string) => { const t = Date.parse(iso); return t >= period.from.getTime() && t < period.to.getTime() + 86_400_000; };
    const issues = data.issues.filter((i) => inRange(i.issued_at));
    const receipts = data.receipts.filter((r) => inRange(r.received_at));
    const byItem = new Map<string, { name: string; quantity: number; unit: string }>();
    for (const i of issues) {
        const key = String(i.item_id ?? i.item_name);
        const entry = byItem.get(key) ?? { name: i.item_name, quantity: 0, unit: unit.get(String(i.item_id)) ?? 'шт' };
        entry.quantity += Number(i.quantity) || 0;
        byItem.set(key, entry);
    }
    const hasMin = data.items.some((i) => i.min_quantity !== null && i.min_quantity !== undefined && i.is_internal !== true);
    const stock = {
        issues: issues.length,
        issuedSum: Math.round(issues.reduce((s, i) => s + (Number(i.quantity) || 0) * (price.get(String(i.item_id)) ?? 0), 0)),
        top: [...byItem.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
        receipts: receipts.length,
        receivedSum: Math.round(receipts.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.purchase_price_unit) || price.get(String(r.item_id)) || 0), 0)),
        outOfStock: data.items.filter((i) => i.is_internal !== true && Number(i.quantity) <= 0).length,
        belowMin: hasMin ? data.items.filter((i) => i.is_internal !== true && i.min_quantity != null && Number(i.quantity) < Number(i.min_quantity)).length : null,
    };

    const garbageRecorded = garbage.filter((g) => g.recorded);
    return {
        period,
        generatedAt: now,
        elapsedDays: elapsed.length,
        attendance,
        totalHours: attendance.reduce((s, a) => s + a.hours, 0),
        garbage,
        garbageDays: garbageRecorded.length,
        garbageBins: garbageRecorded.reduce((s, g) => s + g.bins, 0),
        works,
        elevator,
        stock,
    };
}

// ---------- Рендер сторінки ----------

const money = (v: number) => `${Math.round(v).toLocaleString('uk-UA').replace(/ /g, ' ')} грн`;
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
const isoToDate = (iso: string) => new Date(`${iso}T12:00:00`);
const hoursText = (h: number) => formatAttendanceDuration(h);
const plural = (n: number, one: string, few: string, many: string) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

function kpi(value: string, label: string): string {
    return `<div class="rpt-kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function section(title: string, body: string, note = ''): string {
    return `<section class="rpt-section"><h2>${escapeHtml(title)}</h2>${body}${note ? `<p class="rpt-note">${escapeHtml(note)}</p>` : ''}</section>`;
}

function renderAttendance(m: ManagementReportModel): string {
    if (m.period.kind === 'day') {
        const rows = m.attendance.map((a) => `<tr><th>${escapeHtml(a.label)}</th><td>${escapeHtml(a.today?.checkIn || '—')}</td><td>${escapeHtml(a.today?.checkOut || '—')}</td><td>${escapeHtml(a.today?.absence || '—')}</td><td class="rpt-num">${a.hours > 0 ? escapeHtml(hoursText(a.hours)) : '—'}</td></tr>`).join('');
        return section('Табель', `<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr><th>Працівник</th><th>Прихід</th><th>Відхід</th><th>Відсутність</th><th class="rpt-num">Відпрацьовано</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    }
    const rows = m.attendance.map((a) => `<tr><th>${escapeHtml(a.label)}</th><td class="rpt-num">${a.days}</td><td class="rpt-num">${escapeHtml(hoursText(a.hours))}</td><td class="rpt-num">${a.days ? escapeHtml(hoursText(a.hours / a.days)) : '—'}</td></tr>`).join('');
    return section('Табель', `<div class="rpt-table-wrap"><table class="rpt-table"><thead><tr><th>Працівник</th><th class="rpt-num">Робочих днів</th><th class="rpt-num">Годин</th><th class="rpt-num">У середньому за день</th></tr></thead><tbody>${rows}
        <tr class="rpt-total"><th>Разом</th><td class="rpt-num">${m.attendance.reduce((s, a) => s + a.days, 0)}</td><td class="rpt-num">${escapeHtml(hoursText(m.totalHours))}</td><td></td></tr></tbody></table></div>`,
    'Години — без часу відсутності.');
}

function renderGarbage(m: ManagementReportModel): string {
    if (m.period.kind === 'day') {
        const g = m.garbage[0];
        const text = g?.recorded
            ? `Вивезено${g.time ? ` о ${g.time}` : ''}${g.bins ? `, баків: ${g.bins}` : ''}.`
            : 'За цей день запису про вивіз немає.';
        return section('Вивіз сміття', `<p class="rpt-lead">${escapeHtml(text)}</p>`);
    }
    const max = Math.max(1, ...m.garbage.map((g) => g.bins));
    const bars = m.garbage.map((g) => {
        const label = m.period.kind === 'week' ? `${WEEKDAYS_SHORT[g.date.getDay()]} ${g.date.getDate()}` : String(g.date.getDate());
        const height = g.bins ? Math.max(6, Math.round((g.bins / max) * 100)) : 0;
        return `<div class="rpt-bar${g.recorded ? '' : ' is-empty'}"><span class="rpt-bar-value">${g.bins || ''}</span><span class="rpt-bar-fill" style="height:${height}%"></span><span class="rpt-bar-label">${escapeHtml(label)}</span></div>`;
    }).join('');
    const missed = m.garbage.filter((g, i) => i < m.elapsedDays && !g.recorded).length;
    return section('Вивіз сміття', `<p class="rpt-lead">${m.garbageDays} ${plural(m.garbageDays, 'день', 'дні', 'днів')} з вивозом, усього <strong>${m.garbageBins}</strong> ${plural(m.garbageBins, 'бак', 'баки', 'баків')}${missed ? ` · без запису: ${missed} ${plural(missed, 'день', 'дні', 'днів')}` : ''}.</p>
        <div class="rpt-bars rpt-bars--${m.period.kind}" role="img" aria-label="Баки по днях">${bars}</div>`);
}

function renderWorks(m: ManagementReportModel): string {
    if (!m.works.length) return section('Виконані роботи', '<p class="rpt-lead">За цей період записів немає.</p>');
    const rows = m.works.map((w) => `<tr><td class="rpt-date">${escapeHtml(shortDate(isoToDate(w.date)))}</td><td>${escapeHtml(w.role)}</td><td>${escapeHtml(w.description)}${w.note ? `<div class="rpt-sub">${escapeHtml(w.note)}</div>` : ''}</td></tr>`).join('');
    return section(`Виконані роботи · ${m.works.length}`, `<div class="rpt-table-wrap"><table class="rpt-table rpt-table--list"><thead><tr><th>Дата</th><th>Виконавець</th><th>Що зроблено</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

function renderElevator(m: ManagementReportModel): string {
    if (!m.elevator.length) return section('Ліфтер', '<p class="rpt-lead">Приїздів ліфтера за цей період не записано.</p>');
    const rows = m.elevator.map((e) => `<tr><td class="rpt-date">${escapeHtml(shortDate(e.date))}</td><td>${escapeHtml(e.text)}</td></tr>`).join('');
    return section(`Ліфтер · ${m.elevator.length}`, `<div class="rpt-table-wrap"><table class="rpt-table rpt-table--list"><thead><tr><th>Дата</th><th>Що зроблено</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

function renderStock(m: ManagementReportModel): string {
    const s = m.stock;
    const top = s.top.length
        ? `<div class="rpt-table-wrap"><table class="rpt-table rpt-table--list"><thead><tr><th>Найбільше видано</th><th class="rpt-num">Кількість</th></tr></thead><tbody>${s.top.map((t) => `<tr><td>${escapeHtml(t.name)}</td><td class="rpt-num">${escapeHtml(String(t.quantity))} ${escapeHtml(t.unit)}</td></tr>`).join('')}</tbody></table></div>`
        : '';
    const lead = `Видач: <strong>${s.issues}</strong>${s.issuedSum ? ` на ≈ ${escapeHtml(money(s.issuedSum))}` : ''} · надходжень: <strong>${s.receipts}</strong>${s.receivedSum ? ` на ≈ ${escapeHtml(money(s.receivedSum))}` : ''}. Зараз закінчились: ${s.outOfStock}${s.belowMin !== null ? `, нижче мінімуму: ${s.belowMin}` : ''}.`;
    return section('Склад', `<p class="rpt-lead">${lead}</p>${top}`, 'Суми зі знаком ≈ — за поточною ціною товару, якщо ціну закупівлі не вказано.');
}

export function renderManagementReport(m: ManagementReportModel, sections: ReadonlySet<ReportSection>): string {
    const p = m.period;
    const kpis = [
        sections.has('attendance') ? kpi(`${(Math.round(m.totalHours * 10) / 10).toLocaleString('uk-UA')} год`, p.kind === 'day' ? 'відпрацьовано за день' : 'відпрацьовано разом') : '',
        sections.has('garbage') ? kpi(String(m.garbageBins), p.kind === 'day' ? 'баків вивезено' : `баків за ${m.garbageDays} ${plural(m.garbageDays, 'день', 'дні', 'днів')}`) : '',
        sections.has('works') ? kpi(String(m.works.length), plural(m.works.length, 'виконана робота', 'виконані роботи', 'виконаних робіт')) : '',
        sections.has('elevator') ? kpi(String(m.elevator.length), plural(m.elevator.length, 'приїзд ліфтера', 'приїзди ліфтера', 'приїздів ліфтера')) : '',
        sections.has('stock') ? kpi(String(m.stock.issues), plural(m.stock.issues, 'видача зі складу', 'видачі зі складу', 'видач зі складу')) : '',
    ].filter(Boolean).join('');
    const body = [
        sections.has('attendance') ? renderAttendance(m) : '',
        sections.has('garbage') ? renderGarbage(m) : '',
        sections.has('works') ? renderWorks(m) : '',
        sections.has('elevator') ? renderElevator(m) : '',
        sections.has('stock') ? renderStock(m) : '',
    ].join('');
    const generated = `${m.generatedAt.getDate()} ${MONTHS_GEN[m.generatedAt.getMonth()]} ${m.generatedAt.getFullYear()}, ${pad(m.generatedAt.getHours())}:${pad(m.generatedAt.getMinutes())}`;
    const partial = startOfDay(m.generatedAt) < p.to && startOfDay(m.generatedAt) >= p.from ? ` (станом на ${shortDate(m.generatedAt)})` : '';
    return `<article class="rpt-page">
        <header class="rpt-head">
            <div class="rpt-brand"><span class="rpt-brand-mark" aria-hidden="true"></span>ОСББ «Микитська Слобода»</div>
            <h1>${escapeHtml(p.title)}</h1>
            <p class="rpt-period">${escapeHtml(p.label)}${escapeHtml(partial)}</p>
        </header>
        ${kpis ? `<div class="rpt-kpis">${kpis}</div>` : ''}
        ${body || '<p class="rpt-lead">Оберіть хоча б один розділ.</p>'}
        <footer class="rpt-foot">Сформовано ${escapeHtml(generated)} · Система обліку ОСББ «Микитська Слобода»</footer>
    </article>`;
}

export function managementReportFileName(period: ReportPeriod): string {
    const kind = { day: 'день', week: 'тиждень', month: 'місяць' }[period.kind];
    return `Звіт ОСББ — ${kind} — ${isoDay(period.from)}`;
}

/**
 * Де розрізати високу картинку звіту на сторінки для Telegram (той стискає фото довші
 * за ~2560 px). Ділимо на рівні частини й ріжемо по найближчій межі розділу чи рядка
 * таблиці, щоб не розітнути текст і не лишити «хвостик» з одним підвалом.
 * Повертає пари [від, до] у тих самих одиницях, що й вхідні висоти.
 */
export function chooseImageSlices(totalHeight: number, breakpoints: readonly number[], maxHeight: number): [number, number][] {
    const count = Math.ceil(totalHeight / maxHeight);
    if (count <= 1) return [[0, totalHeight]];
    const sorted = [...new Set(breakpoints.filter((y) => y > 0 && y < totalHeight))].sort((a, b) => a - b);
    const target = totalHeight / count;
    const slices: [number, number][] = [];
    let start = 0;
    for (let i = 1; totalHeight - start > maxHeight || i < count; i += 1) {
        const ideal = Math.min(i * target, start + maxHeight);
        const candidates = sorted.filter((y) => y > start + maxHeight / 2 && y <= start + maxHeight);
        const end = candidates.length
            ? candidates.reduce((best, y) => (Math.abs(y - ideal) < Math.abs(best - ideal) ? y : best))
            : Math.round(ideal);
        slices.push([start, end]);
        start = end;
        if (totalHeight - start <= 0) break;
    }
    slices.push([start, totalHeight]);
    return slices;
}
