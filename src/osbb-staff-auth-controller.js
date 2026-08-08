import { appendPinDigit, deletePinDigit, isPinComplete, pinLockoutDelay } from './pin-entry.js';
import { parseStaffList, parseStaffSession } from './osbb-staff.js';

const PREVIEW_STAFF = [
    { id: 'preview-dispatcher', full_name: 'Диспетчер (превʼю)', role: 'dispatcher' },
    { id: 'preview-plumber', full_name: 'Сантехнік (превʼю)', role: 'plumber' },
];

export function createOsbbStaffAuthController(deps) {
    const doc = deps.document;
    const setTimer = deps.setTimeout ?? window.setTimeout.bind(window);
    let list = [];
    let selected = null;
    let buffer = '';
    let busy = false;
    let failures = 0;
    let reauthResolve = null;
    const element = id => doc.getElementById(id);
    const updateDots = () => {
        for (let i = 0; i < 4; i++) element('staff-pin-d' + i)?.classList.toggle('is-entered', i < buffer.length);
    };
    const showPinStep = subtitle => {
        element('staff-login-list')?.classList.add('hidden');
        element('staff-login-pin-step')?.classList.remove('hidden');
        const sub = element('staff-login-pin-sub');
        if (sub) sub.textContent = subtitle;
        const error = element('staff-login-err');
        if (error) error.textContent = '';
        buffer = '';
        updateDots();
    };
    const finishReauth = confirmed => {
        const resolve = reauthResolve;
        reauthResolve = null;
        resolve?.(confirmed);
    };
    async function open() {
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
        listElement.innerHTML = list.length ? deps.renderStaffList(list) : '<div class="staff-login-loading">Список співробітників порожній. Зверніться до адміністратора.</div>';
    }
    function select(staffId) {
        selected = list.find(person => String(person.id) === String(staffId)) ?? null;
        if (selected) showPinStep(`PIN для «${selected.full_name}»`);
    }
    function requestReauth(session) {
        if (reauthResolve) finishReauth(false);
        selected = { id: session.id, full_name: session.name, role: session.role };
        showPinStep(`Підтвердіть PIN «${selected.full_name}»`);
        const modal = element('staff-login-modal');
        if (modal) modal.style.display = 'flex';
        return new Promise(resolve => { reauthResolve = resolve; });
    }
    function back() {
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
    function deleteDigit() {
        if (busy) return;
        buffer = deletePinDigit(buffer);
        const error = element('staff-login-err');
        if (error) error.textContent = '';
        updateDots();
    }
    async function press(digit) {
        if (busy || !selected) return;
        const nextBuffer = appendPinDigit(buffer, digit);
        if (nextBuffer === buffer) return;
        buffer = nextBuffer;
        updateDots();
        if (!isPinComplete(buffer)) return;
        const attempt = buffer;
        const pendingSelection = selected;
        busy = true;
        let session = null;
        if (deps.isPreview) session = parseStaffSession({ id: selected.id, name: selected.full_name, role: selected.role });
        else {
            try {
                const response = await deps.verifyPin(selected.id, attempt);
                const result = Array.isArray(response) ? response[0] : response;
                session = result && typeof result === 'object' && result.ok ? parseStaffSession({ id: selected.id, name: result.full_name || selected.full_name, role: result.role }) : null;
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
