import { appendPinDigit, deletePinDigit, isPinComplete, pinLockoutDelay } from './pin-entry.ts';
import { parseStaffList, parseStaffSession, type StaffListEntry, type StaffSession } from './osbb-staff.ts';

export interface OsbbStaffAuthControllerDeps {
    document: Document;
    isPreview: boolean;
    loadStaff: () => Promise<unknown>;
    filterStaff?: (person: StaffListEntry) => boolean;
    verifyPin: (staffId: string | number, pin: string) => Promise<unknown>;
    renderStaffList: (rows: StaffListEntry[]) => string;
    onAuthenticated: (session: StaffSession, pin: string) => void;
    setTimeout?: Window['setTimeout'];
}

export interface OsbbStaffAuthController {
    open(): Promise<void>;
    requestReauth(session: StaffSession): Promise<boolean>;
    select(staffId: unknown): void;
    back(): void;
    deleteDigit(): void;
    press(digit: unknown): Promise<void>;
}

const PREVIEW_STAFF: StaffListEntry[] = [
    { id: 'preview-dispatcher', full_name: 'Диспетчер (превʼю)', role: 'dispatcher' },
    { id: 'preview-plumber', full_name: 'Сантехнік (превʼю)', role: 'plumber' },
];

export function createOsbbStaffAuthController(deps: OsbbStaffAuthControllerDeps): OsbbStaffAuthController {
    const doc = deps.document;
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    let list: StaffListEntry[] = [];
    let selected: StaffListEntry | null = null;
    let buffer = '';
    let busy = false;
    let failures = 0;
    let reauthResolve: ((confirmed: boolean) => void) | null = null;

    const element = (id: string): HTMLElement | null => doc.getElementById(id);
    const showPinStep = (subtitle: string): void => {
        element('staff-login-list')?.classList.add('hidden');
        element('staff-login-pin-step')?.classList.remove('hidden');
        const sub = element('staff-login-pin-sub');
        if (sub) sub.textContent = subtitle;
        const error = element('staff-login-err');
        if (error) error.textContent = '';
        buffer = '';
        updateDots();
    };
    const updateDots = (): void => {
        for (let i = 0; i < 4; i++) element('staff-pin-d' + i)?.classList.toggle('is-entered', i < buffer.length);
    };
    const finishReauth = (confirmed: boolean): void => {
        const resolve = reauthResolve;
        reauthResolve = null;
        resolve?.(confirmed);
    };

    async function open(): Promise<void> {
        const modal = element('staff-login-modal');
        const listElement = element('staff-login-list');
        if (!modal || !listElement) return;
        selected = null;
        buffer = '';
        element('staff-login-pin-step')?.classList.add('hidden');
        listElement.classList.remove('hidden');
        listElement.innerHTML = '<div class="staff-login-loading">Завантаження списку...</div>';
        modal.style.display = 'flex';
        if (deps.isPreview) list = PREVIEW_STAFF.map(person => ({ ...person }));
        else {
            try { list = parseStaffList(await deps.loadStaff()); }
            catch { list = []; }
        }
        if (deps.filterStaff) list = list.filter(deps.filterStaff);
        listElement.innerHTML = list.length
            ? deps.renderStaffList(list)
            : '<div class="staff-login-loading">Профілі керування не налаштовані.</div>';
        if (list.length === 1) select(list[0].id);
    }

    function select(staffId: unknown): void {
        selected = list.find(person => String(person.id) === String(staffId)) ?? null;
        if (selected) showPinStep(`PIN для «${selected.full_name}»`);
    }

    function requestReauth(session: StaffSession): Promise<boolean> {
        if (reauthResolve) finishReauth(false);
        selected = { id: session.id, full_name: session.name, role: session.role };
        showPinStep(`Підтвердіть PIN «${selected.full_name}»`);
        const modal = element('staff-login-modal');
        if (modal) modal.style.display = 'flex';
        return new Promise(resolve => { reauthResolve = resolve; });
    }

    function back(): void {
        if (reauthResolve) {
            selected = null;
            const modal = element('staff-login-modal');
            if (modal) modal.style.display = 'none';
            finishReauth(false);
            return;
        }
        selected = null;
        buffer = '';
        element('staff-login-pin-step')?.classList.add('hidden');
        element('staff-login-list')?.classList.remove('hidden');
    }

    function deleteDigit(): void {
        if (busy) return;
        buffer = deletePinDigit(buffer);
        const error = element('staff-login-err');
        if (error) error.textContent = '';
        updateDots();
    }

    async function press(digit: unknown): Promise<void> {
        if (busy || !selected) return;
        const nextBuffer = appendPinDigit(buffer, digit);
        if (nextBuffer === buffer) return;
        buffer = nextBuffer;
        updateDots();
        if (!isPinComplete(buffer)) return;

        const attempt = buffer;
        const pendingSelection = selected;
        busy = true;
        let session: StaffSession | null = null;
        if (deps.isPreview) session = parseStaffSession({ id: selected.id, name: selected.full_name, role: selected.role });
        else {
            try {
                const response = await deps.verifyPin(selected.id, attempt);
                const result = Array.isArray(response) ? response[0] : response;
                session = result && typeof result === 'object' && (result as Record<string, unknown>).ok
                    ? parseStaffSession({
                        id: selected.id,
                        name: (result as Record<string, unknown>).full_name || selected.full_name,
                        role: (result as Record<string, unknown>).role,
                    })
                    : null;
            } catch { session = null; }
        }
        if (selected !== pendingSelection) { busy = false; return; }
        buffer = '';
        updateDots();
        if (session) {
            failures = 0;
            busy = false;
            const modal = element('staff-login-modal');
            if (modal) modal.style.display = 'none';
            deps.onAuthenticated(session, attempt);
            finishReauth(true);
            return;
        }
        failures++;
        const error = element('staff-login-err');
        if (error) error.textContent = 'Невірний PIN, спробуйте ще';
        setTimer(() => { if (selected === pendingSelection) busy = false; }, pinLockoutDelay(failures));
    }

    return { open, requestReauth, select, back, deleteDigit, press };
}
