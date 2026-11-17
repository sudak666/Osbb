import { escapeHtml } from './app-security.ts';
import { elevatorEntriesFromResponse, type ElevatorEntry } from './osbb-elevator.ts';
import { garbageMonthKeyCandidates } from './osbb-garbage.ts';
import {
    buildManagementReport, DEFAULT_REPORT_SECTIONS, isoDay, managementReportFileName, periodMonths, renderManagementReport,
    REPORT_SECTIONS, reportPeriod, shiftReportAnchor, type ReportPeriodKind, type ReportSection, type ReportSourceData,
} from './management-report.ts';
import type { SupabaseRestClient } from './supabase-api.ts';

// Перегляд «Звіту для керівництва» поверх shell: період, розділи, «Зберегти PDF».
// PDF робить сам браузер (друк → «Зберегти як PDF»), тому окремих бібліотек не треба.

export interface ShellReportOptions {
    root: HTMLElement;
    client: Pick<SupabaseRestClient, 'from'>;
    window: Window;
    now?: () => Date;
    warn?: (...args: unknown[]) => void;
}

const PERIODS: readonly { id: ReportPeriodKind; label: string }[] = [
    { id: 'day', label: 'День' },
    { id: 'week', label: 'Тиждень' },
    { id: 'month', label: 'Місяць' },
];
const icon = (name: string) => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
const pad = (n: number) => String(n).padStart(2, '0');

export function createShellReport(options: ShellReportOptions) {
    const { root, client } = options;
    const win = options.window;
    const doc = root.ownerDocument;
    const clock = options.now ?? (() => new Date());
    const warn = options.warn ?? console.warn;
    let kind: ReportPeriodKind = 'week';
    let anchor = clock();
    const sections = new Set<ReportSection>(DEFAULT_REPORT_SECTIONS);
    let loadToken = 0;
    let previousFocus: HTMLElement | null = null;

    root.innerHTML = `<div class="rpt-toolbar">
            <div class="rpt-toolbar-row">
                <button type="button" class="rpt-icon-btn md-state-layer" data-report-close aria-label="Закрити звіт">${icon('close')}</button>
                <h2 class="rpt-toolbar-title">Звіт для керівництва</h2>
                <button type="button" class="rpt-primary md-state-layer" data-report-print>${icon('download')}<span>Зберегти PDF</span></button>
            </div>
            <div class="rpt-toolbar-row rpt-toolbar-controls">
                <div class="rpt-seg" role="group" aria-label="Період звіту">${PERIODS.map((p) => `<button type="button" class="rpt-seg-btn md-state-layer" data-report-kind="${p.id}" aria-pressed="false">${p.label}</button>`).join('')}</div>
                <div class="rpt-nav">
                    <button type="button" class="rpt-icon-btn md-state-layer" data-report-step="-1" aria-label="Попередній період">${icon('chevron_left')}</button>
                    <span class="rpt-nav-label" data-report-label aria-live="polite"></span>
                    <button type="button" class="rpt-icon-btn md-state-layer" data-report-step="1" aria-label="Наступний період">${icon('chevron_right')}</button>
                </div>
            </div>
            <p class="rpt-hint">${icon('info')}<span>«Зберегти PDF» відкриває вікно друку: у полі «Принтер» виберіть «Зберегти як PDF» — браузер запам'ятає це на наступний раз.</span></p>
            <div class="rpt-chips" role="group" aria-label="Розділи звіту">${REPORT_SECTIONS.map((s) => `<label class="rpt-chip md-state-layer"><input type="checkbox" data-report-section="${s.id}"><span>${icon('check')}${escapeHtml(s.label)}</span></label>`).join('')}</div>
        </div>
        <div class="rpt-stage" data-report-stage></div>`;

    const stage = root.querySelector<HTMLElement>('[data-report-stage]')!;
    const label = root.querySelector<HTMLElement>('[data-report-label]')!;

    function syncControls(): void {
        root.querySelectorAll<HTMLButtonElement>('[data-report-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.reportKind === kind)));
        root.querySelectorAll<HTMLInputElement>('[data-report-section]').forEach((c) => { c.checked = sections.has(c.dataset.reportSection as ReportSection); });
        const next = root.querySelector<HTMLButtonElement>('[data-report-step="1"]');
        // Майбутні періоди порожні — не даємо в них гортати.
        if (next) next.disabled = reportPeriod(kind, shiftReportAnchor(kind, anchor, 1)).from > clock();
        label.textContent = reportPeriod(kind, anchor).label;
    }

    async function fetchSource(): Promise<ReportSourceData> {
        const period = reportPeriod(kind, anchor);
        const months = periodMonths(period);
        const unwrap = <T>(r: { data: unknown; error: unknown }): T => { if (r.error) throw r.error; return r.data as T; };
        const monthRows = await Promise.all(months.map(async ([y, m]) => {
            const [att, el] = await Promise.all([
                client.from('osbb_attendance').select('data').eq('month_key', `${y}-${pad(m + 1)}`).maybeSingle(),
                client.from('elevator_visits').select('data').eq('month_key', `${y}-${m}`).maybeSingle(),
            ]);
            let garbage: unknown = null;
            for (const key of garbageMonthKeyCandidates(y, m)) {
                const row = unwrap<{ data: unknown } | null>(await client.from('garbage').select('data').eq('month_key', key).maybeSingle());
                if (row) { garbage = row.data; break; }
            }
            return { y, m, attendance: unwrap<{ data: unknown } | null>(att)?.data, elevator: elevatorEntriesFromResponse(unwrap<{ data: unknown } | null>(el)?.data), garbage };
        }));
        const startIso = period.from.toISOString();
        const endIso = new Date(period.to.getFullYear(), period.to.getMonth(), period.to.getDate() + 1, 0, 0, 0, -1).toISOString();
        const wantStock = sections.has('stock');
        const [works, issues, receipts, items] = await Promise.all([
            client.from('completed_work').select('work_date,worker_role,description,note').gte('work_date', isoDay(period.from)).lte('work_date', isoDay(period.to)).order('work_date'),
            wantStock ? client.from('inventory_logs').select('issued_at,item_id,item_name,quantity').gte('issued_at', startIso).lte('issued_at', endIso) : Promise.resolve({ data: [], error: null }),
            wantStock ? client.from('inventory_receipts').select('received_at,item_id,quantity,purchase_price_unit').gte('received_at', startIso).lte('received_at', endIso) : Promise.resolve({ data: [], error: null }),
            wantStock ? client.from('inventory_items').select('id,name,unit,quantity,price_unit,is_internal,min_quantity') : Promise.resolve({ data: [], error: null }),
        ]);
        const attendance: Record<string, unknown> = {};
        const garbage: Record<string, unknown> = {};
        const elevator: Record<string, readonly ElevatorEntry[]> = {};
        for (const row of monthRows) {
            attendance[`${row.y}-${pad(row.m + 1)}`] = row.attendance;
            garbage[`${row.y}-${row.m}`] = row.garbage;
            elevator[`${row.y}-${row.m}`] = row.elevator;
        }
        return {
            attendance, garbage, elevator,
            works: unwrap<ReportSourceData['works']>(works) || [],
            issues: unwrap<ReportSourceData['issues']>(issues) || [],
            receipts: unwrap<ReportSourceData['receipts']>(receipts) || [],
            items: unwrap<ReportSourceData['items']>(items) || [],
        };
    }

    async function load(): Promise<void> {
        const token = ++loadToken;
        syncControls();
        stage.setAttribute('aria-busy', 'true');
        stage.innerHTML = '<article class="rpt-page rpt-page--loading"><div class="home-skel" aria-hidden="true"><span class="skel"></span><span class="skel"></span><span class="skel"></span></div><p class="rpt-lead">Готую звіт…</p></article>';
        try {
            const source = await fetchSource();
            if (token !== loadToken) return;
            stage.innerHTML = renderManagementReport(buildManagementReport(reportPeriod(kind, anchor), source, clock()), sections);
        } catch (error) {
            if (token !== loadToken) return;
            warn('management report failed:', error);
            stage.innerHTML = '<article class="rpt-page"><p class="rpt-lead rpt-error">Не вдалося зібрати звіт. Перевірте мережу й спробуйте ще раз.</p></article>';
        } finally {
            if (token === loadToken) stage.removeAttribute('aria-busy');
        }
    }

    function print(): void {
        const title = doc.title;
        doc.title = managementReportFileName(reportPeriod(kind, anchor));
        const restore = () => { doc.title = title; win.removeEventListener('afterprint', restore); };
        win.addEventListener('afterprint', restore);
        win.print();
        setTimeout(restore, 1500);
    }

    function open(): void {
        previousFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
        anchor = clock();
        root.hidden = false;
        doc.documentElement.classList.add('is-report-open');
        root.querySelector<HTMLElement>('[data-report-close]')?.focus();
        void load();
    }

    function close(): void {
        if (root.hidden) return;
        root.hidden = true;
        doc.documentElement.classList.remove('is-report-open');
        loadToken += 1;
        previousFocus?.focus();
    }

    root.addEventListener('click', (event) => {
        const target = event.target as Element | null;
        const kindBtn = target?.closest<HTMLElement>('[data-report-kind]');
        if (kindBtn) { kind = kindBtn.dataset.reportKind as ReportPeriodKind; anchor = clock(); void load(); return; }
        const step = target?.closest<HTMLElement>('[data-report-step]');
        if (step) { anchor = shiftReportAnchor(kind, anchor, Number(step.dataset.reportStep) || 0); void load(); return; }
        if (target?.closest('[data-report-print]')) { print(); return; }
        if (target?.closest('[data-report-close]')) close();
    });
    root.addEventListener('change', (event) => {
        const box = (event.target as Element | null)?.closest<HTMLInputElement>('[data-report-section]');
        if (!box) return;
        const id = box.dataset.reportSection as ReportSection;
        if (box.checked) sections.add(id); else sections.delete(id);
        void load();
    });
    root.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

    return { open, close, isOpen: () => !root.hidden };
}
