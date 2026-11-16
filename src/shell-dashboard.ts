import { escapeHtml } from './app-security.ts';
import { attendanceHours, formatAttendanceDuration, normalizeAttendanceMonth } from './osbb-attendance.ts';
import { elevatorEntriesFromResponse, type ElevatorEntry } from './osbb-elevator.ts';
import { garbageBins, garbageMonthKey, garbageMonthKeyCandidates, normalizeGarbageMonth } from './osbb-garbage.ts';
import { buildMonthlyReportSheets, monthlyReportFileName, monthRange, type ReportIssue, type ReportItem, type ReportReceipt, type ReportWork } from './monthly-report.ts';
import { estimatedItemValue } from './sklad-domain.ts';
import { hasMinimums, isBelowMinimum } from './sklad-purchasing.ts';
import type { ShellSection } from './shell-nav.ts';
import type { SupabaseRestClient } from './supabase-api.ts';

// «Головна» (листопад 2026): один екран зі станом будинку на сьогодні.
// Лише читає вже наявні таблиці журналу й складу — нічого не записує.

export type StaffRole = 'electrician' | 'janitor' | 'plumber';
const STAFF_ROLES: readonly StaffRole[] = ['electrician', 'janitor', 'plumber'];
const ROLE_LABELS: Record<StaffRole, string> = { electrician: 'Електрик', janitor: 'Двірник', plumber: 'Сантехнік' };
const ROLE_ICONS: Record<StaffRole, string> = { electrician: 'bolt', janitor: 'cleaning_services', plumber: 'plumbing' };
const MONTHS_GENITIVE = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_NOMINATIVE = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
/** Той самий поріг, що й у складі (sortLowStockItems): ≤ 3 одиниць — «мало». */
const LOW_STOCK_THRESHOLD = 3;

export interface AttendanceTodayRow { role: StaffRole; label: string; status: 'working' | 'done' | 'none'; text: string }

export function attendanceToday(monthData: unknown, day: number): AttendanceTodayRow[] {
    const dayData = normalizeAttendanceMonth(monthData)[String(day)] || {};
    return STAFF_ROLES.map((role) => {
        const cell = dayData[role] || {};
        const label = ROLE_LABELS[role];
        if (cell.checkIn && cell.checkOut) {
            const hours = attendanceHours(cell);
            return { role, label, status: 'done', text: `${cell.checkIn}–${cell.checkOut} · ${formatAttendanceDuration(hours)}` };
        }
        if (cell.checkIn) return { role, label, status: 'working', text: `На роботі з ${cell.checkIn}` };
        return { role, label, status: 'none', text: 'Не відмічено' };
    });
}

export interface GarbageTodaySummary { recorded: boolean; bins: number; time: string; monthDays: number; monthBins: number }

export function garbageToday(monthData: unknown, day: number): GarbageTodaySummary {
    const month = normalizeGarbageMonth(monthData);
    const row = month[String(day).padStart(2, '0')] ?? month[String(day)];
    // Запис дня — це будь-який вивіз (баки, пластик чи скло) або хоча б час.
    const isRecorded = (value: typeof row) => Boolean(value && (value.time || Object.values(value.types ?? {}).some((n) => Number(n) > 0)));
    let monthDays = 0;
    let monthBins = 0;
    for (const value of Object.values(month)) {
        if (!isRecorded(value)) continue;
        monthDays += 1;
        monthBins += garbageBins(value.types);
    }
    return { recorded: isRecorded(row), bins: garbageBins(row?.types), time: typeof row?.time === 'string' ? row.time : '', monthDays, monthBins };
}

export interface StockItemLike { id: number | string; name?: string; quantity: number; unit?: string | null; price_unit?: number | null; is_internal?: boolean | null; min_quantity?: number | null }
export interface StockLogLike { item_id: number | string | null; item_name?: string; quantity: number; issued_to?: string | null; issued_at?: string | null }
export interface StockSummary { available: number; outOfStock: number; low: number; belowMin: number | null; value: number; monthIssues: number; monthSpend: number }

export function stockSummary(items: readonly StockItemLike[], monthLogs: readonly StockLogLike[]): StockSummary {
    const priceById = new Map<string, number>();
    const minimums = hasMinimums(items.map((item) => ({ ...item, name: item.name ?? '' })));
    const summary: StockSummary = { available: 0, outOfStock: 0, low: 0, belowMin: minimums ? 0 : null, value: 0, monthIssues: monthLogs.length, monthSpend: 0 };
    for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        priceById.set(String(item.id), Number(item.price_unit) || 0);
        if (quantity > 0) summary.available += 1;
        summary.value += estimatedItemValue({ quantity, price_unit: item.price_unit ?? null });
        if (summary.belowMin !== null && isBelowMinimum({ ...item, name: item.name ?? '' })) summary.belowMin += 1;
        if (item.is_internal === true) continue;
        if (quantity <= 0) summary.outOfStock += 1;
        else if (quantity <= LOW_STOCK_THRESHOLD) summary.low += 1;
    }
    for (const log of monthLogs) {
        const price = priceById.get(String(log.item_id)) ?? 0;
        summary.monthSpend += Math.max(0, Number(log.quantity) || 0) * price;
    }
    summary.value = Math.round(summary.value);
    summary.monthSpend = Math.round(summary.monthSpend);
    return summary;
}

export interface ElevatorVisit { date: Date; text: string }

/** Останній приїзд ліфтера з поточного й попереднього місяців. */
export function latestElevatorVisit(current: readonly ElevatorEntry[], previous: readonly ElevatorEntry[], now: Date): ElevatorVisit | null {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const visits = [
        ...current.map((entry) => ({ date: new Date(now.getFullYear(), now.getMonth(), entry.day), text: entry.text })),
        ...previous.map((entry) => ({ date: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), entry.day), text: entry.text })),
    ].filter((visit) => visit.date.getTime() <= now.getTime());
    visits.sort((a, b) => b.date.getTime() - a.date.getTime());
    return visits[0] ?? null;
}

export function formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString('uk-UA').replace(/ /g, ' ')} грн`;
}

export function formatLongDate(date: Date): string {
    return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

function formatShortDate(value: string | Date | null | undefined): string {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

function daysAgo(date: Date, now: Date): string {
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
    if (diff <= 0) return 'сьогодні';
    if (diff === 1) return 'вчора';
    return `${diff} дн. тому`;
}

// ---------- Рендер ----------

type Loadable<T> = { state: 'loading' } | { state: 'error' } | { state: 'ok'; value: T };

interface WorkRow { work_date: string; worker_role: string; description: string }
interface DashboardData {
    attendance: Loadable<AttendanceTodayRow[]>;
    garbage: Loadable<GarbageTodaySummary>;
    stock: Loadable<{ summary: StockSummary; recent: StockLogLike[] }>;
    works: Loadable<{ monthCount: number; recent: WorkRow[] }>;
    elevator: Loadable<ElevatorVisit | null>;
}

const icon = (name: string, extra = '') => `<span class="material-symbols-rounded${extra ? ` ${extra}` : ''}" aria-hidden="true">${name}</span>`;
const go = (section: ShellSection, label: string, iconName: string, tone: 'tonal' | 'text' = 'tonal', focus = '') =>
    `<button type="button" class="home-btn home-btn--${tone} md-state-layer" data-dashboard-go="${section}"${focus ? ` data-dashboard-focus="${focus}"` : ''}>${icon(iconName)}<span>${escapeHtml(label)}</span></button>`;
const skeleton = '<div class="home-skel" aria-hidden="true"><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>';
const failed = '<p class="home-error">' + icon('cloud_off') + 'Не вдалося завантажити. Перевірте мережу й оновіть.</p>';

function card(id: string, title: string, iconName: string, body: string, footer = ''): string {
    return `<article class="home-card" id="home-card-${id}">
        <header class="home-card-head"><span class="home-card-icon">${icon(iconName)}</span><h2>${escapeHtml(title)}</h2></header>
        <div class="home-card-body">${body}</div>${footer ? `<footer class="home-card-foot">${footer}</footer>` : ''}
    </article>`;
}

function renderAttendance(data: Loadable<AttendanceTodayRow[]>): string {
    const body = data.state === 'loading' ? skeleton : data.state === 'error' ? failed : `<ul class="home-list">${data.value.map((row) => `
        <li class="home-row"><span class="home-row-icon">${icon(ROLE_ICONS[row.role])}</span>
        <span class="home-row-main"><strong>${escapeHtml(row.label)}</strong></span>
        <span class="home-chip is-${row.status}">${escapeHtml(row.text)}</span></li>`).join('')}</ul>`;
    return card('attendance', 'Табель сьогодні', 'schedule', body, go('tabel', 'Відкрити табель', 'chevron_right', 'text'));
}

function renderGarbage(data: Loadable<GarbageTodaySummary>, monthName: string): string {
    if (data.state !== 'ok') return card('garbage', 'Вивіз сміття', 'delete', data.state === 'loading' ? skeleton : failed);
    const g = data.value;
    const status = g.recorded
        ? `<p class="home-status is-ok">${icon('check_circle')}<span>Сьогодні записано${g.time ? ` о ${escapeHtml(g.time)}` : ''}${g.bins ? `: <strong>${g.bins}</strong> ${g.bins === 1 ? 'бак' : g.bins < 5 ? 'баки' : 'баків'}` : ''}</span></p>`
        : `<p class="home-status is-warn">${icon('pending')}<span>Сьогодні ще не записано</span></p>`;
    const month = `<p class="home-muted">За ${monthName}: ${g.monthDays} ${g.monthDays === 1 ? 'день' : g.monthDays < 5 && g.monthDays > 0 ? 'дні' : 'днів'}, ${g.monthBins} баків</p>`;
    return card('garbage', 'Вивіз сміття', 'delete', status + month, go('garbage', g.recorded ? 'Відкрити журнал' : 'Записати', g.recorded ? 'chevron_right' : 'add', g.recorded ? 'text' : 'tonal'));
}

function renderStock(data: DashboardData['stock'], monthName: string): string {
    if (data.state !== 'ok') return card('stock', 'Склад', 'inventory_2', data.state === 'loading' ? skeleton : failed);
    const { summary: s, recent } = data.value;
    const metrics = `<div class="home-metrics">
        <div class="home-metric"><strong>${s.available}</strong><span>у наявності</span></div>
        <div class="home-metric${s.outOfStock ? ' is-warn' : ''}"><strong>${s.outOfStock}</strong><span>закінчились</span></div>
        ${s.belowMin !== null
        ? `<div class="home-metric${s.belowMin ? ' is-warn' : ''}"><strong>${s.belowMin}</strong><span>нижче мінімуму</span></div>`
        : `<div class="home-metric"><strong>${s.low}</strong><span>мало (1–${LOW_STOCK_THRESHOLD})</span></div>`}
    </div>
    <p class="home-muted">Вартість залишків ≈ <strong>${formatMoney(s.value)}</strong>. За ${monthName} видано ${s.monthIssues} ${s.monthIssues === 1 ? 'раз' : 'разів'}${s.monthSpend ? ` на ≈ ${formatMoney(s.monthSpend)}` : ''}.</p>`;
    const list = recent.length ? `<ul class="home-list home-list--compact">${recent.map((log) => `
        <li class="home-row"><span class="home-row-main"><strong>${escapeHtml(log.item_name || '—')}</strong><small>${escapeHtml(formatShortDate(log.issued_at))}${log.issued_to ? ` · ${escapeHtml(log.issued_to)}` : ''}</small></span>
        <span class="home-qty">−${escapeHtml(String(log.quantity))}</span></li>`).join('')}</ul>` : '<p class="home-muted">Видач ще не було.</p>';
    return card('stock', 'Склад', 'inventory_2', metrics + '<h3 class="home-subhead">Останні видачі</h3>' + list, go('items', 'Відкрити склад', 'chevron_right', 'text'));
}

function renderWorks(data: DashboardData['works'], monthName: string): string {
    if (data.state !== 'ok') return card('works', 'Виконані роботи', 'task_alt', data.state === 'loading' ? skeleton : failed);
    const { monthCount, recent } = data.value;
    const head = `<p class="home-muted">За ${monthName}: <strong>${monthCount}</strong> ${monthCount === 1 ? 'запис' : monthCount > 1 && monthCount < 5 ? 'записи' : 'записів'}</p>`;
    const list = recent.length ? `<ul class="home-list home-list--compact">${recent.map((row) => `
        <li class="home-row"><span class="home-row-icon">${icon(ROLE_ICONS[row.worker_role as StaffRole] || 'work')}</span>
        <span class="home-row-main"><strong>${escapeHtml(row.description)}</strong><small>${escapeHtml(formatShortDate(row.work_date))} · ${escapeHtml(ROLE_LABELS[row.worker_role as StaffRole] || row.worker_role)}</small></span></li>`).join('')}</ul>`
        : '<p class="home-muted">Записів ще немає.</p>';
    return card('works', 'Виконані роботи', 'task_alt', head + list, go('completed-work', 'Додати роботу', 'add'));
}

function renderElevator(data: Loadable<ElevatorVisit | null>, now: Date): string {
    if (data.state !== 'ok') return card('elevator', 'Ліфтер', 'elevator', data.state === 'loading' ? skeleton : failed);
    const visit = data.value;
    const body = visit
        ? `<p class="home-status">${icon('history')}<span>Останній приїзд: <strong>${escapeHtml(formatShortDate(visit.date))}</strong> (${daysAgo(visit.date, now)})</span></p>${visit.text ? `<p class="home-muted">${escapeHtml(visit.text)}</p>` : ''}`
        : '<p class="home-muted">За цей і минулий місяць приїздів не записано.</p>';
    return card('elevator', 'Ліфтер', 'elevator', body, go('completed-work', 'Журнал ліфтера', 'chevron_right', 'text', 'elevator'));
}

export function renderDashboard(data: DashboardData, now: Date): string {
    const monthName = MONTHS_NOMINATIVE[now.getMonth()] ?? '';
    return `<div class="home-wrap">
        <header class="home-head">
            <div><p class="home-date">${escapeHtml(formatLongDate(now))}</p><h1>Сьогодні</h1></div>
            <div class="home-head-actions">
                <button type="button" class="home-btn home-btn--tonal md-state-layer" data-dashboard-report="0">${icon('summarize')}<span>Звіт за ${escapeHtml(MONTHS_NOMINATIVE[now.getMonth()] ?? '')}</span></button>
                <button type="button" class="home-btn home-btn--text md-state-layer" data-dashboard-report="-1">за ${escapeHtml(MONTHS_NOMINATIVE[(now.getMonth() + 11) % 12] ?? '')}</button>
                <button type="button" class="home-btn home-btn--text md-state-layer" data-dashboard-refresh aria-label="Оновити дані">${icon('refresh')}<span>Оновити</span></button>
            </div>
        </header>
        <p class="home-report-status" role="status" aria-live="polite"></p>
        <div class="home-grid">
            ${renderAttendance(data.attendance)}
            ${renderGarbage(data.garbage, monthName)}
            ${renderStock(data.stock, monthName)}
            ${renderWorks(data.works, monthName)}
            ${renderElevator(data.elevator, now)}
        </div>
    </div>`;
}

// ---------- Контролер ----------

export interface ShellDashboardOptions {
    container: HTMLElement;
    client: Pick<SupabaseRestClient, 'from'>;
    now?: () => Date;
    onNavigate: (section: ShellSection, focus?: string) => void;
    warn?: (...args: unknown[]) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function createShellDashboard(options: ShellDashboardOptions) {
    const { container, client } = options;
    const clock = options.now ?? (() => new Date());
    const warn = options.warn ?? console.warn;
    const REFRESH_AFTER_MS = 60_000;
    let lastLoaded = 0;
    let loading: Promise<void> | null = null;

    container.addEventListener('click', (event) => {
        const target = (event.target as Element | null)?.closest<HTMLElement>('[data-dashboard-go],[data-dashboard-refresh],[data-dashboard-report]');
        if (!target) return;
        if (target.hasAttribute('data-dashboard-refresh')) { void refresh(true); return; }
        if (target.hasAttribute('data-dashboard-report')) { void downloadReport(Number(target.dataset.dashboardReport) || 0, target as HTMLButtonElement); return; }
        const section = target.dataset.dashboardGo as ShellSection | undefined;
        if (section) options.onNavigate(section, target.dataset.dashboardFocus || undefined);
    });

    async function settle<T>(label: string, task: () => Promise<T>): Promise<Loadable<T>> {
        try { return { state: 'ok', value: await task() }; } catch (error) { warn(`dashboard ${label} failed:`, error); return { state: 'error' }; }
    }
    function unwrap<T>(result: { data: unknown; error: unknown }): T {
        if (result.error) throw result.error;
        return result.data as T;
    }

    async function load(): Promise<void> {
        const now = clock();
        const year = now.getFullYear();
        const month = now.getMonth();
        const prev = new Date(year, month - 1, 1);
        const monthStart = new Date(year, month, 1);
        container.innerHTML = renderDashboard({ attendance: { state: 'loading' }, garbage: { state: 'loading' }, stock: { state: 'loading' }, works: { state: 'loading' }, elevator: { state: 'loading' } }, now);

        const [attendance, garbage, stock, works, elevator] = await Promise.all([
            settle('attendance', async () => {
                const row = unwrap<{ data: unknown } | null>(await client.from('osbb_attendance').select('data').eq('month_key', `${year}-${pad(month + 1)}`).maybeSingle());
                return attendanceToday(row?.data, now.getDate());
            }),
            settle('garbage', async () => {
                const row = unwrap<{ data: unknown } | null>(await client.from('garbage').select('data').eq('month_key', garbageMonthKey(year, month)).maybeSingle());
                return garbageToday(row?.data, now.getDate());
            }),
            settle('stock', async () => {
                const [items, monthLogs, recent] = await Promise.all([
                    client.from('inventory_items').select('id,name,quantity,unit,price_unit,is_internal,min_quantity'),
                    client.from('inventory_logs').select('item_id,quantity').gte('issued_at', monthStart.toISOString()),
                    client.from('inventory_logs').select('item_id,item_name,quantity,issued_to,issued_at').order('issued_at', { ascending: false }).limit(3),
                ]);
                return {
                    summary: stockSummary(unwrap<StockItemLike[]>(items) || [], unwrap<StockLogLike[]>(monthLogs) || []),
                    recent: unwrap<StockLogLike[]>(recent) || [],
                };
            }),
            settle('works', async () => {
                const [monthRows, recent] = await Promise.all([
                    client.from('completed_work').select('id').gte('work_date', isoDate(monthStart)),
                    client.from('completed_work').select('work_date,worker_role,description').order('work_date', { ascending: false }).limit(3),
                ]);
                return { monthCount: (unwrap<unknown[]>(monthRows) || []).length, recent: unwrap<WorkRow[]>(recent) || [] };
            }),
            settle('elevator', async () => {
                const [current, previous] = await Promise.all([
                    client.from('elevator_visits').select('data').eq('month_key', `${year}-${month}`).maybeSingle(),
                    client.from('elevator_visits').select('data').eq('month_key', `${prev.getFullYear()}-${prev.getMonth()}`).maybeSingle(),
                ]);
                const entries = (result: { data: unknown; error: unknown }) => elevatorEntriesFromResponse(unwrap<{ data: unknown } | null>(result)?.data);
                return latestElevatorVisit(entries(current), entries(previous), now);
            }),
        ]);
        container.innerHTML = renderDashboard({ attendance, garbage, stock, works, elevator }, now);
        lastLoaded = Date.now();
    }

    function setReportStatus(text: string, isError = false): void {
        const status = container.querySelector<HTMLElement>('.home-report-status');
        if (!status) return;
        status.textContent = text;
        status.classList.toggle('is-error', isError);
    }

    /** Місячний звіт Excel: offset 0 — поточний місяць, -1 — попередній. */
    async function downloadReport(offset: number, button: HTMLButtonElement | null): Promise<void> {
        const now = clock();
        const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const year = target.getFullYear();
        const month = target.getMonth();
        const range = monthRange(year, month);
        if (button) button.disabled = true;
        setReportStatus('Готую звіт…');
        try {
            const garbageRow = async () => {
                for (const key of garbageMonthKeyCandidates(year, month)) {
                    const row = unwrap<{ data: unknown } | null>(await client.from('garbage').select('data').eq('month_key', key).maybeSingle());
                    if (row) return row.data;
                }
                return null;
            };
            const [works, attendance, garbage, elevator, issues, receipts, items] = await Promise.all([
                client.from('completed_work').select('work_date,worker_role,description,note').gte('work_date', range.first).lte('work_date', range.last).order('work_date'),
                client.from('osbb_attendance').select('data').eq('month_key', `${year}-${pad(month + 1)}`).maybeSingle(),
                garbageRow(),
                client.from('elevator_visits').select('data').eq('month_key', `${year}-${month}`).maybeSingle(),
                client.from('inventory_logs').select('issued_at,item_id,item_name,quantity,issued_to,note').gte('issued_at', range.startIso).lte('issued_at', range.endIso).order('issued_at'),
                client.from('inventory_receipts').select('received_at,item_id,item_name,quantity,supplier,purchase_price_unit').gte('received_at', range.startIso).lte('received_at', range.endIso).order('received_at'),
                client.from('inventory_items').select('id,category,price_unit'),
            ]);
            const sheets = buildMonthlyReportSheets({
                year, month,
                works: unwrap<ReportWork[]>(works) || [],
                attendance: unwrap<{ data: unknown } | null>(attendance)?.data,
                garbage,
                elevator: elevatorEntriesFromResponse(unwrap<{ data: unknown } | null>(elevator)?.data),
                issues: unwrap<ReportIssue[]>(issues) || [],
                receipts: unwrap<ReportReceipt[]>(receipts) || [],
                items: unwrap<ReportItem[]>(items) || [],
            });
            const { downloadWorkbook } = await import('./excel-export.ts');
            await downloadWorkbook(sheets, monthlyReportFileName(year, month));
            setReportStatus(`Звіт за ${MONTHS_NOMINATIVE[month]} ${year} завантажено.`);
        } catch (error) {
            warn('monthly report failed:', error);
            setReportStatus('Не вдалося підготувати звіт. Перевірте мережу й спробуйте ще раз.', true);
        } finally {
            if (button) button.disabled = false;
        }
    }

    /** Оновлює «Головну», але не частіше ніж раз на хвилину, якщо не force. */
    function refresh(force = false): Promise<void> {
        if (loading) return loading;
        if (!force && lastLoaded && Date.now() - lastLoaded < REFRESH_AFTER_MS) return Promise.resolve();
        loading = load().finally(() => { loading = null; });
        return loading;
    }

    return { refresh, downloadReport };
}
