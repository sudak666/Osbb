    import { escapeAttr, escapeHtml, safeExternalUrl } from './app-security.js';
    import { isAuthSessionValid, setAuthSession } from './auth-session.js';
    import { createAutoLockController } from './osbb-auto-lock.js';
    import { createOsbbLockController } from './osbb-lock-controller.js';
    import { createOsbbLightboxController } from './osbb-lightbox-controller.js';
    import { createOsbbPhotoController } from './osbb-photo-controller.js';
    import { createOsbbPinModalController } from './osbb-pin-modal-controller.js';
    import { createOsbbStaffAuthController } from './osbb-staff-auth-controller.js';
    import { createOsbbShiftSettingsController } from './osbb-shift-settings-controller.js';
    import { createOsbbShiftCalendarController } from './osbb-shift-calendar-controller.js';
    import { createOsbbAttendanceController } from './osbb-attendance-controller.js';
    import { buildAttendanceExportRows, buildAttendanceSummaryRows } from './osbb-attendance.js';
    import { createOsbbGarbageController } from './osbb-garbage-controller.js';
    import { createOsbbElevatorController } from './osbb-elevator-controller.js';
    import { createOsbbCompletedWorkController } from './osbb-completed-work-controller.js';
    import { createOsbbRuntimeController } from './osbb-runtime-controller.js';
    import { formatTimeMaskValue, isCompleteTimeValue, loadOsbbTheme, nextOsbbTheme, saveOsbbTheme, shouldApplyRealtimeRefresh } from './osbb-client-state.js';
    import { adjacentCalendarDays, calendarMonthDays, isCalendarMonth, oneBasedMonthKey, shiftCalendarMonth, sundayFirstDayOffset, zeroBasedMonthKey } from './osbb-calendar.js';
    import { osbbOfflineMonthKey, readOsbbOfflineValue, removeOsbbOfflineValue, writeOsbbOfflineValue } from './osbb-offline.js';
    import { createSupabaseRestClient, SUPABASE_KEY, SUPABASE_URL } from './supabase-api.js';
    import {
        createElevatorEntry,
        elevatorEntriesFromResponse,
        removeElevatorEntry,
        sortElevatorEntries,
    } from './osbb-elevator.js';
    import {
        STAFF_ROLE_ICONS,
        STAFF_ROLE_LABELS,
        clearStoredStaffSession,
        isDispatcherSession as isDispatcherStaffSession,
        isTabAllowedForSession as isStaffTabAllowed,
        loadStoredStaffSession,
        saveStoredStaffSession,
    } from './osbb-staff.js';
    import {
        TICKET_PRIORITIES as ticketPriorities,
        formatJiraShareText,
        jiraPriorityClass,
    } from './osbb-tickets.js';
    import { createOsbbRuntimeState, jiraIssuesFromResponse } from './osbb-state.js';
    import { completedWorkDefaultDate, filterCompletedWork } from './osbb-completed-work.js';
    import { enhanceSelect, refreshEnhancedSelect } from '../shared/enhance-select.js';

    // Вкладка "Журнал" у shell-оболонці (index.html в корені) вантажить цю
    // сторінку в iframe з ?embed=1 — це НЕ прев'ю, і синк з Supabase має
    // працювати як завжди, тому виключаємо цей випадок з детекції прев'ю.
    const IS_EMBEDDED_SHELL = isEmbeddedShellFrame();

    // Повідомляємо shell-оболонку про активність усередині iframe, щоб idle-lock
    // не блокував застосунок, поки користувач реально працює в модулі.
    function notifyShellActivity() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'osbb:user-activity' }, window.location.origin);
        }
    }
    ['pointerdown','keydown','touchstart'].forEach(evt => document.addEventListener(evt, notifyShellActivity, { passive: true }));
    const IS_PREVIEW = !IS_EMBEDDED_SHELL && (location.hostname.includes('claudeusercontent') || location.hostname.includes('claude.site') || window.self !== window.top);

    // ==========================================
    // ЕКРАН БЛОКУВАННЯ ВХОДУ
    // PIN перевіряється на сервері (Supabase RPC verify_lock_pin),
    // сам код нікому не відомий на клієнті.
    // Якщо PIN вже введено на рівні shell-оболонки (спільний sessionStorage
    // в межах одного origin), повторно не питаємо.
    // ==========================================
    const db = createSupabaseRestClient();

    const lockController = createOsbbLockController({
        document,
        verifyPin: attempt => db.rpc('verify_lock_pin', { attempt }),
        onUnlocked: () => {
            setAuthSession();
        },
    });

    if (IS_EMBEDDED_SHELL || localStorage.getItem('osbb_pin_enabled') === '0' || isAuthSessionValid()) {
        lockController.hide();
    }

    // ==========================================
    // STAFF AUTH: персональний вхід поверх спільного PIN журналу.
    // Роль сесії визначає доступ до Табеля (редагування) і заявок
    // (повний "Диспетчер" таб vs "Мої заявки"). Ролі "охорона" немає.
    // ==========================================
    let staffSession = null;   // { id, name, role }
    let staffPinCache = null;  // особистий PIN сесії — тримається лише в пам'яті, не в storage
    let shellPinCache = /^\d{4}$/.test(window.__osbbShellPin || '') ? window.__osbbShellPin : null;
    let jiraAccessEnabled = false;
    let jiraAccessPending = false;
    let staffAuthResolve = null;
    let {
        photosCache,
        jiraIssues,
        elevatorData,
    } = createOsbbRuntimeState();

    const lightboxController = createOsbbLightboxController({
        document,
        getPhotoCache: () => photosCache,
    });

    const photoController = createOsbbPhotoController({
        isPreview: IS_PREVIEW,
        getMonthKey: () => zeroBasedMonthKey(currentYear, currentMonth),
        loadRows: async monthKey => (await db.from('photos').select('id, url, day, role').eq('month_key', monthKey)).data || [],
        compress: file => compressImage(file),
        upload: async (path, blob) => {
            const { error } = await db.storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
            if (error) throw error;
        },
        publicUrl: path => db.storage.from('photos').getPublicUrl(path).data.publicUrl,
        insertRow: async row => {
            const { data, error } = await db.from('photos').insert(row);
            if (error) throw error;
            return data;
        },
        verifyDelete: (id, pin) => db.rpc('delete_photo', { p_photo_id: id, attempt: pin }),
        removeObject: async path => { await db.storage.from('photos').remove([path]); },
        requestDeletePin: callback => showPinModal('Видалення фото', 'PIN для видалення фото', callback, true),
        onCacheChanged: (cache, day, role) => {
            photosCache = cache;
            if (day === undefined || !role) return;
            const photos = photoController.get(day, role);
            const desktop = document.getElementById(`photos-${day}-${role}`);
            if (desktop) renderPhotoContainer(desktop, photos, day, role);
            const mobile = document.getElementById(`mobile-photos-${day}-${role}`);
            if (mobile) renderPhotoContainer(mobile, photos, day, role, true);
        },
        onStatus: (status, error) => {
            const states = {
                preview: ['ok', 'Превью'], uploading: ['loading', 'Завантажую...'], uploaded: ['ok', 'Фото збережено'],
                deleted: ['ok', 'Фото видалено'], bad_pin: ['error', 'PIN не підтверджено'], error: ['error', 'Помилка фото'],
            };
            const [kind, label] = states[status];
            if (error) console.error('photo error:', error);
            setSyncStatus(kind, `<span class="status-label">${label}</span>`);
        },
    });

    function loadStaffSession() {
        staffSession = loadStoredStaffSession(sessionStorage);
        if (staffSession && !isDispatcherStaffSession(staffSession)) {
            clearStoredStaffSession(sessionStorage);
            staffSession = null;
        }
    }

    function saveStaffSession() {
        if (staffSession) saveStoredStaffSession(sessionStorage, staffSession);
    }

    function staffLogout() {
        staffSession = null;
        staffPinCache = null;
        clearStoredStaffSession(sessionStorage);
        applyRoleGating();
        openStaffLogin();
    }

    const staffAuthController = createOsbbStaffAuthController({
        document,
        isPreview: IS_PREVIEW,
        loadStaff: () => db.rpc('list_osbb_staff', {}),
        filterStaff: person => isDispatcherStaffSession({ id: person.id, name: person.full_name, role: person.role }),
        verifyPin: (staffId, attempt) => db.rpc('verify_staff_pin', { p_staff_id: staffId, attempt }),
        renderStaffList: rows => rows.map(s => `
            <button type="button" class="staff-login-item md-state-layer" data-staff-select="${escapeAttr(s.id)}">
                <span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">${STAFF_ROLE_ICONS[s.role] || 'person'}</span>
                <span class="staff-login-item-name">${escapeHtml(s.full_name)}</span>
                <span class="staff-login-item-role">${escapeHtml(STAFF_ROLE_LABELS[s.role] || s.role)}</span>
            </button>
        `).join(''),
        onAuthenticated: (session, pin) => {
            const needsInitialTabLoad = !staffSession;
            staffSession = session;
            staffPinCache = pin;
            saveStaffSession();
            if (jiraAccessPending) {
                jiraAccessPending = false;
                jiraAccessEnabled = true;
                const toggle = document.querySelector('[data-jira-access-toggle]');
                if (toggle) { toggle.checked = true; toggle.disabled = false; }
                document.querySelector('[data-staff-login-cancel]')?.classList.add('hidden');
            }
            applyRoleGating();
            const resolveAuth = staffAuthResolve;
            staffAuthResolve = null;
            document.querySelector('[data-staff-login-cancel]')?.classList.add('hidden');
            resolveAuth?.(true);
            if (jiraAccessEnabled && runtimeController) setTab('my-tickets');
            else if (needsInitialTabLoad && runtimeController) setTab(currentTab);
        },
    });

    const pinModalController = createOsbbPinModalController({
        document,
        verifyPin: (rpc, attempt) => db.rpc(rpc, { attempt }),
    });

    async function ensureStaffAuth() {
        loadStaffSession();
        if (staffSession) {
            if (shellPinCache) staffPinCache = shellPinCache;
            applyRoleGating();
            if (IS_EMBEDDED_SHELL && !staffPinCache) {
                window.parent.postMessage({ type: 'osbb:request-shell-pin' }, window.location.origin);
            }
            return;
        }
        if (shellPinCache && await staffAuthController.authenticateSingle(shellPinCache)) return;
        if (IS_EMBEDDED_SHELL && !shellPinCache) {
            window.parent.postMessage({ type: 'osbb:request-shell-pin' }, window.location.origin);
        }
        await openStaffLogin();
    }

    window.addEventListener('osbb:shell-pin', event => {
        const pin = event.detail;
        if (!/^\d{4}$/.test(pin || '')) return;
        shellPinCache = pin;
        if (!jiraAccessEnabled && !jiraAccessPending) return;
        loadStaffSession();
        if (staffSession) {
            staffPinCache = pin;
            document.getElementById('staff-login-modal')?.style.setProperty('display', 'none');
            applyRoleGating();
        } else {
            void staffAuthController.authenticateSingle(pin);
        }
    });
    window.addEventListener('osbb:shell-pin-cleared', () => {
        shellPinCache = null;
        staffPinCache = null;
    });

    function openStaffLogin() {
        return staffAuthController.open();
    }

    function requestStaffReauth() {
        if (staffSession) return staffAuthController.requestReauth(staffSession);
        if (staffAuthResolve) staffAuthResolve(false);
        document.querySelector('[data-staff-login-cancel]')?.classList.remove('hidden');
        void openStaffLogin();
        return new Promise(resolve => { staffAuthResolve = resolve; });
    }

    async function requestJiraAccess() {
        jiraAccessPending = true;
        const toggle = document.querySelector('[data-jira-access-toggle]');
        if (toggle) toggle.disabled = true;
        document.querySelector('[data-staff-login-cancel]')?.classList.remove('hidden');
        loadStaffSession();
        if (staffSession) {
            const confirmed = await requestStaffReauth();
            if (!confirmed) {
                jiraAccessPending = false;
                if (toggle) { toggle.checked = false; toggle.disabled = false; }
            }
            return;
        }
        await openStaffLogin();
    }

    function cancelPendingStaffAccess() {
        const resolveAuth = staffAuthResolve;
        staffAuthResolve = null;
        resolveAuth?.(false);
        document.getElementById('staff-login-modal')?.style.setProperty('display', 'none');
        document.querySelector('[data-staff-login-cancel]')?.classList.add('hidden');
    }

    function disableJiraAccess() {
        jiraAccessPending = false;
        jiraAccessEnabled = false;
        jiraIssues = [];
        document.getElementById('staff-login-modal')?.style.setProperty('display', 'none');
        document.querySelector('[data-staff-login-cancel]')?.classList.add('hidden');
        const toggle = document.querySelector('[data-jira-access-toggle]');
        if (toggle) { toggle.checked = false; toggle.disabled = false; }
        if (currentTab === 'my-tickets') setTab('garbage');
        applyRoleGating();
    }

    document.addEventListener('click', (e) => {
        const staffButton = e.target.closest('[data-staff-select]');
        if (staffButton) { staffAuthController.select(staffButton.dataset.staffSelect); return; }
        const digitBtn = e.target.closest('[data-staff-pin-digit]');
        if (digitBtn) { staffAuthController.press(digitBtn.dataset.staffPinDigit); return; }
        if (e.target.closest('[data-staff-pin-delete]')) { staffAuthController.deleteDigit(); return; }
        if (e.target.closest('[data-staff-pin-back]')) { staffAuthController.back(); return; }
        if (e.target.closest('[data-staff-login-cancel]')) {
            staffAuthController.back();
            if (jiraAccessPending) disableJiraAccess();
            else cancelPendingStaffAccess();
            return;
        }
    });

    // dispatcher/admin/board — рівнозначні "повний доступ" ролі: увесь журнал,
    // редагування Табеля, заявки. "Зміни" сюди не входять навмисно — той таб
    // захищений серверною перевіркою загального PIN (verify_work_shifts_pin), незалежно від ролей.
    function isDispatcherSession() {
        return isDispatcherStaffSession(staffSession);
    }

    // Вкладки, доступні сантехніку/двірнику/електрику: тільки власний графік
    // (перегляд) і власні заявки — жодного доступу до журналу, диспетчера,
    // графіків, сміття, чату чи графіка змін інших людей.
    // Єдине джерело правди про доступність таба для поточної staff-сесії —
    // використовується і для приховування кнопок, і для блокування прямого
    // виклику setTab/requestTab (щоб hidden-клас не був єдиним захистом).
    function isTabAllowedForSession(tab) {
        if (tab === 'my-tickets' && !jiraAccessEnabled) return false;
        return isStaffTabAllowed(tab, staffSession);
    }

    // Приховує/показує вкладки залежно від ролі сесії і перемикає користувача
    // на дозволений таб, якщо поточний йому недоступний.
    function applyRoleGating() {
        const dispatcherOnly = isDispatcherSession();
        ALL_TABS.forEach(tab => {
            const visible = isTabAllowedForSession(tab);
            [document.getElementById('tab-' + tab), document.getElementById('tab-' + tab + '-m')].forEach(el => {
                if (el) el.classList.toggle('hidden', !visible);
            });
        });
        if (!isTabAllowedForSession(currentTab)) setTab('garbage');
        const attNote = document.getElementById('att-view-note');
        if (attNote) attNote.classList.toggle('hidden', dispatcherOnly);
        if (currentTab === 'tabel') attRender();
    }

    // ==========================================
    // REALTIME: живі оновлення без ручного "Оновити"
    // ==========================================
    // Окремий клієнт лише для підписки на зміни — основний REST-шар (db вище)
    // не чіпаємо, щоб не ризикувати вже робочою логікою.
    function realtimeSafeRefresh(tab, fn) {
        return runtimeController.safeRealtimeRefresh(tab, fn);
        const active = document.activeElement;
        // Не перебивати активне редагування коментаря/поля вводу realtime-рефрешем.
        if (!shouldApplyRealtimeRefresh(currentTab, tab, active?.tagName)) return;
        fn();
    }
    function initRealtime() {
        return runtimeController.initRealtime();
        if (IS_PREVIEW || typeof supabase === 'undefined') return;
        try {
            const rt = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            rt.channel('osbb-live')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'garbage' }, () => realtimeSafeRefresh('garbage', gInitTab))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'elevator_visits' }, () => realtimeSafeRefresh('completed-work', elevatorInitTab))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'work_shifts' }, () => realtimeSafeRefresh('shifts', shiftLoadMonth))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'work_shift_settings' }, () => realtimeSafeRefresh('shift-settings', shiftLoadSettings))
                .subscribe();
        } catch (e) { console.warn('osbb realtime init failed:', e); }
    }

    const monthNames = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
    const roles = ['electrician', 'janitor', 'plumber'];
    const roleNames = { electrician: 'Електрик', janitor: 'Двірник', plumber: 'Сантехнік' };

    let currentYear, currentMonth;
    let currentTab = 'garbage';
    let runtimeController;

    // Дані журналу сміття (оголошено заздалегідь, щоб уникнути race condition при ранньому виклику gInitDashboard)
    let gMonthlyTotals = {}; // { "2026-0": 12, "2026-1": 8, ... } для графіку

    const gMonths = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
    const gWorkerNames = {
        'serhiy':    'Сергій Ш.',
        'maksym':    'Максим А.',
        'oleksandr': 'Олександр Б.'
    };
    // Типи сміття — тепер незалежні один від одного, в один день можна вказати кілька з власною кількістю
    const gTypeLabels = {
        'plastic': 'Пластик',
        'glass':   'Скло',
        'bins':    'Баки'
    };
    const gTypeMeta = {
        plastic: { icon: 'recycling', description: 'Окремий вивіз пластику' },
        glass: { icon: 'local_drink', description: 'Окремий вивіз скла' },
        bins: { icon: 'delete', description: 'Звичайні сміттєві баки' }
    };

    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const now = new Date();
    // Явні локальні значення поточного дня — щоб уникнути UTC/local плутанини
    const todayDay   = now.getDate();
    const todayMonth = now.getMonth();
    const todayYear  = now.getFullYear();

    for (let y = 2025; y <= 2030; y++) { const o = document.createElement('option'); o.value = y; o.innerText = y; if (y === now.getFullYear()) o.selected = true; yearSelect.appendChild(o); }
    monthNames.forEach((name, idx) => { const o = document.createElement('option'); o.value = idx; o.innerText = name; if (idx === now.getMonth()) o.selected = true; monthSelect.appendChild(o); });

    // Кастомний select підключено зі shared/enhance-select.js.
    enhanceSelect(yearSelect);
    enhanceSelect(monthSelect);
    enhanceSelect(document.getElementById('completed-work-role'));
    enhanceSelect(document.getElementById('completed-work-filter'));
    window.enhanceDateInput?.(document.getElementById('completed-work-date'));

    function stepMonth(dir) {
        const next = shiftCalendarMonth(parseInt(yearSelect.value), parseInt(monthSelect.value), dir, 2025, 2030);
        if (!next) return;
        yearSelect.value  = next.year;
        monthSelect.value = next.month;
        refreshEnhancedSelect(yearSelect);
        refreshEnhancedSelect(monthSelect);
        initCalendar();
    }

    function goToday() {
        yearSelect.value  = now.getFullYear();
        monthSelect.value = now.getMonth();
        refreshEnhancedSelect(yearSelect);
        refreshEnhancedSelect(monthSelect);
        initCalendar();
    }

    function updateTodayBtn() {
        const onTodayMonth = isCalendarMonth(parseInt(yearSelect.value), parseInt(monthSelect.value), now);
        document.getElementById('btn-today').classList.toggle('hidden', onTodayMonth);
    }

    const ALL_TABS = ['my-tickets','completed-work','garbage','shifts','tabel'];

    function requestTab(tab) {
        return runtimeController.requestTab(tab);
        if (!isTabAllowedForSession(tab)) { showToast('Цей розділ вам недоступний'); return; }
        if (tab === 'dispatcher' && !isDispatcherSession()) { showToast('Цей розділ доступний лише Диспетчеру/Адміну'); return; }
        if (tab !== 'shifts') { setTab(tab); return; }
        showPinModal('PIN розділу «Зміни»', 'Введіть окремий PIN для доступу', () => setTab('shifts'), false, 'verify_work_shifts_pin');
    }

    function setTab(tab, { load = true } = {}) {
        return runtimeController.setTab(tab, { load });
        currentTab = tab;
        document.getElementById('section-garbage').classList.toggle('hidden', tab !== 'garbage');
        document.getElementById('section-shifts').classList.toggle('hidden', tab !== 'shifts');
        document.getElementById('section-tabel').classList.toggle('hidden', tab !== 'tabel');
        document.getElementById('section-my-tickets').classList.toggle('hidden', tab !== 'my-tickets');

        // Десктоп таби
        ALL_TABS.forEach(t => {
            const el = document.getElementById('tab-' + t);
            if (el) {
                el.classList.toggle('active', t === tab);
                el.toggleAttribute('aria-current', t === tab);
                el.setAttribute('aria-selected', String(t === tab));
            }
        });
        // Мобільний bottom nav
        ALL_TABS.forEach(t => {
            const el = document.getElementById('tab-' + t + '-m');
            if (el) {
                el.classList.toggle('mob-active', t === tab);
                el.toggleAttribute('aria-current', t === tab);
                el.setAttribute('aria-selected', String(t === tab));
            }
        });

        if (!load) return;
        if (tab === 'garbage') gInitTab();
        if (tab === 'shifts') shiftInitTab();
        if (tab === 'tabel') attInitTab();
        if (tab === 'my-tickets') myTicketsInitTab();
    }

    // ==========================================
    // ГРАФІК ЗМІН (Supabase)
    // ==========================================
    let shiftNames = { sergiy:'Сергій', oleksandr:'Олександр' };
    let shiftCalendarController;

    const shiftSettingsController = createOsbbShiftSettingsController({
        document,
        loadSettings: () => db.from('work_shift_settings').select('employee_one_name,employee_two_name').eq('id', 1).maybeSingle(),
        saveNames: (first, second, attempt) => db.rpc('update_work_shift_names', {
            p_employee_one_name:first, p_employee_two_name:second, attempt,
        }),
        requestPin: showPinModal,
        showToast: (message, icon) => showToast(message, icon === 'error' ? TOAST_ICON_ERROR : TOAST_ICON_CHECK),
        onNamesChanged: names => { shiftNames = names; shiftCalendarController?.render(); },
    });
    shiftCalendarController = createOsbbShiftCalendarController({
        document,
        loadRows: monthKey => db.from('work_shifts').select('*').eq('month_key', monthKey).order('shift_date',{ascending:true}),
        getNames: () => shiftNames,
        showToast: (message, icon) => showToast(message, icon === 'error' ? TOAST_ICON_ERROR : TOAST_ICON_CHECK),
        requestPin: showPinModal,
        saveDay: (date, first, second, attempt) => db.rpc('save_work_shift_day', { p_shift_date:date, p_sergiy:first, p_oleksandr:second, attempt }),
        resetMonth: (monthKey, attempt) => db.rpc('reset_work_shifts_month', { p_month_key:monthKey, attempt }),
    });
    const shiftLoadSettings = () => shiftSettingsController.load();
    const shiftOpenNameEditor = () => shiftSettingsController.open();
    const shiftCloseNameEditor = () => shiftSettingsController.close();
    const shiftTrapNameEditorFocus = event => shiftSettingsController.trapFocus(event);
    const shiftSaveNames = () => shiftSettingsController.save();
    async function shiftLoadMonth() {
        return shiftCalendarController.load();
    }

    function shiftInitTab() {
        return shiftCalendarController.init(shiftLoadSettings);
    }

    function shiftRenderChips(person) {
        return shiftCalendarController.renderChips(person);
    }

    function shiftOpenEditor(dateKey) {
        return shiftCalendarController.openEditor(dateKey);
    }

    function shiftCloseEditor() {
        return shiftCalendarController.closeEditor();
    }

    function shiftTrapEditorFocus(event) {
        return shiftCalendarController.trapEditorFocus(event);
    }

    function shiftToggleChip(person, type) {
        return shiftCalendarController.toggleChip(person, type);
    }

    function shiftSaveDay() {
        return shiftCalendarController.submitDay();
    }

    function shiftChangeMonth(direction) {
        return shiftCalendarController.changeMonth(direction);
    }

    function shiftResetMonth() {
        return shiftCalendarController.reset();
    }

    // ==========================================
    // ТАБЕЛЬ: точний час приходу/відходу для 3 ролей (сантехнік/двірник/електрик).
    // На явний запит власника Табель редагується без staff-PIN; серверна RPC
    // усе одно перевіряє місяць, день, роль і формат кожного значення часу.
    // Автопідрахунок годин/днів рахується локально з checkIn/checkOut.
    // ==========================================

    const attendanceController = createOsbbAttendanceController({
        document, storage:localStorage, isPreview:IS_PREVIEW, roles, roleNames,
        getMonth: () => ({ year:currentYear, month:currentMonth, days:calendarMonthDays(currentYear, currentMonth) }),
        getSession: () => staffSession, isWorker:()=>false,
        readOffline:readOsbbOfflineValue, writeOffline:writeOsbbOfflineValue,
        loadCloud: monthKey => db.from('osbb_attendance').select('data').eq('month_key', monthKey).single(),
        saveCloud: args => db.rpc('save_attendance_day', args), showToast,
        render:attRender,
    });
    async function attInitTab() {
        return attendanceController.init();
    }

    function attGetCell(d, role) {
        return attendanceController.getCell(d, role);
    }

    function attVisibleRoles() {
        return attendanceController.visibleRoles();
    }

    function attCellState(cell) {
        return attendanceController.cellState(cell);
    }

    function attDayState(d, visibleRoles = attVisibleRoles()) {
        return attendanceController.dayState(d, visibleRoles);
    }

    async function attSaveDay(d, role, cell) {
        return attendanceController.saveDay(d, role, cell);
    }

    function attRenderStats() {
        return attendanceController.renderStats();
    }

    function attExportExcel() {
        if (!window.XLSX) {
            showToast('Модуль Excel ще не завантажився. Оновіть сторінку.');
            return;
        }
        const daysInMonth = calendarMonthDays(currentYear, currentMonth);
        const data = attendanceController.getData();
        const details = buildAttendanceExportRows(data, roles, roleNames, currentYear, currentMonth, daysInMonth);
        const summary = buildAttendanceSummaryRows(data, roles, roleNames, daysInMonth);
        const workbook = window.XLSX.utils.book_new();
        const detailsSheet = window.XLSX.utils.json_to_sheet(details);
        detailsSheet['!cols'] = [{wch:12},{wch:14},{wch:18},{wch:10},{wch:10},{wch:12},{wch:10},{wch:20},{wch:16}];
        const summarySheet = window.XLSX.utils.json_to_sheet(summary);
        summarySheet['!cols'] = [{wch:20},{wch:20},{wch:22}];
        window.XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Табель');
        window.XLSX.utils.book_append_sheet(workbook, summarySheet, 'Підсумки');
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        window.XLSX.writeFile(workbook, `Табель_${monthKey}.xlsx`);
        showToast('Табель Excel завантажено!', 'success');
    }

    function attRender() {
        const body = document.getElementById('att-body');
        const calendar = document.getElementById('att-calendar');
        const mobileList = document.getElementById('att-mobile-list');
        if (!body || !calendar || !mobileList) return;
        const editable = true;
        const visibleRoles = attVisibleRoles();
        const viewNote = document.getElementById('att-view-note');
        if (viewNote) {
            viewNote.classList.add('hidden');
            viewNote.textContent = 'Перегляд графіку. Редагувати час може лише профіль керування.';
        }
        document.querySelectorAll('[data-att-role-header]').forEach(header => {
            header.classList.toggle('hidden', !visibleRoles.includes(header.dataset.attRoleHeader));
        });
        const daysInMonth = calendarMonthDays(currentYear, currentMonth);
        let html = '';
        let calendarHtml = '';
        let mobileHtml = '';
        const adjacentDays = adjacentCalendarDays(currentYear, currentMonth);
        const renderAdjacentDay = ({ year, month, day }) => {
            const monthName = new Date(year, month, day).toLocaleDateString('uk-UA', { month:'short' });
            return `<article class="att-calendar-day is-adjacent-month" aria-disabled="true">
                <header><strong>${day}</strong><span>${monthName}</span></header>
                <div class="att-calendar-adjacent-copy">Інший місяць</div>
            </article>`;
        };
        calendarHtml += adjacentDays.leading.map(renderAdjacentDay).join('');
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentYear, currentMonth, d);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isToday = d === todayDay && currentMonth === todayMonth && currentYear === todayYear;
            const dayState = attDayState(d, visibleRoles);
            html += `<tr class="${isWeekend ? 'is-weekend ' : ''}${dayState}" data-att-day-card="${d}"><td class="att-col-date">${d}</td>`;
            const dayName = dateObj.toLocaleDateString('uk-UA', { weekday:'short' });
            let mobileRolesHtml = '';
            let calendarRolesHtml = '';
            visibleRoles.forEach(role => {
                const cell = attGetCell(d, role);
                const cellState = attCellState(cell);
                const hasAbsence = Boolean(cell.breakStart || cell.breakEnd);
                const absenceHidden = hasAbsence ? '' : ' hidden';
                const absenceAction = `<button type="button" class="att-absence-action md-state-layer" data-att-absence-action="${hasAbsence ? 'clear' : 'add'}">${hasAbsence ? 'Прибрати відсутність' : '+ Додати відсутність'}</button>`;
                if (editable) {
                    html += `<td class="is-${role} ${cellState}" data-att-cell="${d}-${role}">
                        <div class="att-table-times">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Прихід" data-time-mask class="att-time-input" value="${escapeAttr(cell.checkIn)}" data-att-day="${d}" data-att-role="${role}" data-att-field="checkIn" aria-label="Прихід ${roleNames[role]} ${d}">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Відхід" data-time-mask class="att-time-input" value="${escapeAttr(cell.checkOut)}" data-att-day="${d}" data-att-role="${role}" data-att-field="checkOut" aria-label="Відхід ${roleNames[role]} ${d}">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Вийшов" data-time-mask class="att-time-input att-absence-field${absenceHidden}" value="${escapeAttr(cell.breakStart)}" data-att-day="${d}" data-att-role="${role}" data-att-field="breakStart" aria-label="Вийшов ${roleNames[role]} ${d}">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Повернувся" data-time-mask class="att-time-input att-absence-field${absenceHidden}" value="${escapeAttr(cell.breakEnd)}" data-att-day="${d}" data-att-role="${role}" data-att-field="breakEnd" aria-label="Повернувся ${roleNames[role]} ${d}">
                        </div>
                        ${absenceAction}
                    </td>`;
                    mobileRolesHtml += `<div class="att-mobile-role role-${role} ${cellState}" data-att-cell="${d}-${role}">
                        <div class="att-mobile-role-name"><span class="att-mobile-role-dot" aria-hidden="true"></span>${roleNames[role]}</div>
                        <label><span>Прихід</span><input type="text" inputmode="numeric" maxlength="5" placeholder="ГГ:ХХ" data-time-mask class="att-time-input" value="${escapeAttr(cell.checkIn)}" data-att-day="${d}" data-att-role="${role}" data-att-field="checkIn" aria-label="Прихід ${roleNames[role]} ${d}"></label>
                        <label><span>Відхід</span><input type="text" inputmode="numeric" maxlength="5" placeholder="ГГ:ХХ" data-time-mask class="att-time-input" value="${escapeAttr(cell.checkOut)}" data-att-day="${d}" data-att-role="${role}" data-att-field="checkOut" aria-label="Відхід ${roleNames[role]} ${d}"></label>
                        <label class="att-absence-field${absenceHidden}"><span>Вийшов</span><input type="text" inputmode="numeric" maxlength="5" placeholder="ГГ:ХХ" data-time-mask class="att-time-input" value="${escapeAttr(cell.breakStart)}" data-att-day="${d}" data-att-role="${role}" data-att-field="breakStart" aria-label="Вийшов ${roleNames[role]} ${d}"></label>
                        <label class="att-absence-field${absenceHidden}"><span>Повернувся</span><input type="text" inputmode="numeric" maxlength="5" placeholder="ГГ:ХХ" data-time-mask class="att-time-input" value="${escapeAttr(cell.breakEnd)}" data-att-day="${d}" data-att-role="${role}" data-att-field="breakEnd" aria-label="Повернувся ${roleNames[role]} ${d}"></label>
                        ${absenceAction}
                    </div>`;
                    calendarRolesHtml += `<div class="att-calendar-role role-${role} ${cellState}" data-att-cell="${d}-${role}">
                        <div class="att-calendar-role-name"><span class="att-mobile-role-dot" aria-hidden="true"></span>${roleNames[role]}</div>
                        <div class="att-calendar-times">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Прихід" data-time-mask class="att-time-input" value="${escapeAttr(cell.checkIn)}" data-att-day="${d}" data-att-role="${role}" data-att-field="checkIn" aria-label="Прихід ${roleNames[role]} ${d}">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Відхід" data-time-mask class="att-time-input" value="${escapeAttr(cell.checkOut)}" data-att-day="${d}" data-att-role="${role}" data-att-field="checkOut" aria-label="Відхід ${roleNames[role]} ${d}">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Вийшов" data-time-mask class="att-time-input att-absence-field${absenceHidden}" value="${escapeAttr(cell.breakStart)}" data-att-day="${d}" data-att-role="${role}" data-att-field="breakStart" aria-label="Вийшов ${roleNames[role]} ${d}">
                            <input type="text" inputmode="numeric" maxlength="5" placeholder="Повернувся" data-time-mask class="att-time-input att-absence-field${absenceHidden}" value="${escapeAttr(cell.breakEnd)}" data-att-day="${d}" data-att-role="${role}" data-att-field="breakEnd" aria-label="Повернувся ${roleNames[role]} ${d}">
                        </div>
                        ${absenceAction}
                    </div>`;
                } else {
                    const breakText = cell.breakStart || cell.breakEnd ? ` · відсутність ${cell.breakStart || '—'}–${cell.breakEnd || '—'}` : '';
                    const text = (cell.checkIn || cell.checkOut) ? `${cell.checkIn || '—'}–${cell.checkOut || '—'}${breakText}` : '—';
                    html += `<td class="is-${role} att-readonly ${cellState}" data-att-cell="${d}-${role}">${text}</td>`;
                    mobileRolesHtml += `<div class="att-mobile-role role-${role} is-readonly ${cellState}" data-att-cell="${d}-${role}">
                        <div class="att-mobile-role-name"><span class="att-mobile-role-dot" aria-hidden="true"></span>${roleNames[role]}</div>
                        <strong>${text}</strong>
                    </div>`;
                    calendarRolesHtml += `<div class="att-calendar-role role-${role} is-readonly ${cellState}" data-att-cell="${d}-${role}">
                        <div class="att-calendar-role-name"><span class="att-mobile-role-dot" aria-hidden="true"></span>${roleNames[role]}</div>
                        <strong>${text}</strong>
                    </div>`;
                }
            });
            html += '</tr>';
            calendarHtml += `<article class="att-calendar-day ${dayState} ${isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}" data-att-day-card="${d}" ${isToday ? 'aria-current="date"' : ''}>
                <header><strong>${d}</strong><span>${isToday ? 'Сьогодні' : dayName}</span></header>
                <div class="att-calendar-roles">${calendarRolesHtml}</div>
            </article>`;
            mobileHtml += `<article class="att-mobile-day ${dayState} ${isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}" data-att-day-card="${d}" ${isToday ? 'aria-current="date"' : ''}>
                <header><strong>${d}</strong><span>${isToday ? 'Сьогодні' : dayName}</span></header>
                <div class="att-mobile-roles">${mobileRolesHtml}</div>
            </article>`;
        }
        calendarHtml += adjacentDays.trailing.map(renderAdjacentDay).join('');
        body.innerHTML = html;
        calendar.innerHTML = calendarHtml;
        mobileList.innerHTML = mobileHtml;
        if (editable) {
            document.querySelectorAll('#att-body [data-att-day], #att-calendar [data-att-day], #att-mobile-list [data-att-day]').forEach(input => {
                input.addEventListener('change', () => {
                    const d = input.dataset.attDay, role = input.dataset.attRole;
                    const rowCell = attGetCell(d, role);
                    const root = input.closest('[data-att-cell]');
                    const next = { ...rowCell };
                    root?.querySelectorAll('[data-att-field]').forEach(field => { next[field.dataset.attField] = field.value; });
                    if (Boolean(next.breakStart) !== Boolean(next.breakEnd)) return;
                    attSaveDay(d, role, next);
                });
            });
            document.querySelectorAll('[data-att-absence-action]').forEach(button => {
                button.addEventListener('click', () => {
                    const root = button.closest('[data-att-cell]');
                    if (!root) return;
                    if (button.dataset.attAbsenceAction === 'add') {
                        root.querySelectorAll('.att-absence-field').forEach(field => field.classList.remove('hidden'));
                        button.textContent = 'Прибрати відсутність';
                        button.dataset.attAbsenceAction = 'clear';
                        root.querySelector('[data-att-field="breakStart"]')?.focus();
                        return;
                    }
                    const first = root.querySelector('[data-att-field="breakStart"]');
                    const last = root.querySelector('[data-att-field="breakEnd"]');
                    if (!first || !last) return;
                    first.value = '';
                    last.value = '';
                    attSaveDay(first.dataset.attDay, first.dataset.attRole, { ...attGetCell(first.dataset.attDay, first.dataset.attRole), breakStart:'', breakEnd:'' });
                });
            });
        }
        attRenderStats();
    }

    function animateStatCards() {
        document.querySelectorAll('.stat-card').forEach((el, i) => {
            setTimeout(() => { el.classList.add('animate-pop'); setTimeout(() => el.classList.remove('animate-pop'), 400); }, i * 100);
        });
    }

    const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Плавно "перемотує" число від поточного значення до нового замість миттєвої
    // заміни тексту — і на першому завантаженні (0 → 94), і на маленьких дельтах
    // (6 → 7 після тогл), однаково коротка (380мс) відчутна анімація.
    function animateNumber(el, target, { prefix = '', suffix = '' } = {}) {
        if (!el) return;
        const targetNum = Number(target) || 0;
        const startNum = Number(el.dataset.animRaw ?? String(el.textContent || '').replace(/[^\d.-]/g, '')) || 0;
        if (prefersReducedMotion() || startNum === targetNum) {
            el.textContent = prefix + targetNum + suffix;
            el.dataset.animRaw = String(targetNum);
            return;
        }
        const t0 = performance.now();
        const dur = 380;
        function step(now) {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            const val = Math.round(startNum + (targetNum - startNum) * eased);
            el.textContent = prefix + val + suffix;
            if (p < 1) requestAnimationFrame(step);
            else el.dataset.animRaw = String(targetNum);
        }
        requestAnimationFrame(step);
    }

    function setSyncStatus(type, text) {
        const el = document.getElementById('sync-status');
        const cls = { loading: 'is-loading', ok: 'is-ok', error: 'is-error' };
        el.className = `journal-status-chip ${cls[type] || cls.ok}`;
        el.innerHTML = text;
        // Оновлюємо колір favicon при синхронізації
        const faviconColors = { loading: '%23f59e0b', ok: '%2322c55e', error: '%23ef4444' };
        const fLink = document.getElementById('favicon-link');
        if (fLink) fLink.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='${faviconColors[type] || '%2322c55e'}'/><path d='M18 52 L50 24 L82 52' stroke='white' stroke-width='9' fill='none' stroke-linecap='round' stroke-linejoin='round'/><rect x='28' y='50' width='44' height='34' rx='5' fill='white'/><rect x='43' y='64' width='14' height='20' rx='2' fill='${faviconColors[type] || '%2322c55e'}'/></svg>`;
    }

    // Спільний "перехід на місяць" — раніше вантажив і рендерив журнал
    // чергувань (schedule), тепер лишає тільки те, що дійсно спільне для
    // всіх табів: рік/місяць, кеш фото на місяць і перерендер активного табу.
    async function initCalendar() {
        return runtimeController.initCalendar();
        currentYear = parseInt(yearSelect.value); currentMonth = parseInt(monthSelect.value);
        setSyncStatus('loading', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon is-spinning" aria-hidden="true">progress_activity</span> Завантаження...</span>');
        photosCache = null;
        if (!IS_PREVIEW) await loadAllPhotosForMonth();
        setSyncStatus('ok', '<span class="status-label"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>Синхронізовано</span>');
        updateTodayBtn();
        if (currentTab === 'garbage') gInitTab();
        if (currentTab === 'tabel') attInitTab();
        if (currentTab === 'my-tickets') myTicketsInitTab();
        gInitDashboard();
    }


    async function loadAllPhotosForMonth() {
        await photoController.load();
    }

    function getPhotosFromCache(day, role) {
        return photoController.get(day, role);
    }

    function compressImage(file, maxWidth = 1200, quality = 0.82) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    async function uploadPhotoMobile(day, role, file) {
        if (!file) return;
        await uploadPhoto(day, role, file);
    }

    async function uploadPhoto(day, role, file) {
        await photoController.upload(Number(day), role, file);
    }

    async function deletePhoto(id, url, day, role) {
        photoController.remove(id, url, Number(day), role);
    }

    function renderPhotoContainer(container, photos, day, role, isMobile = false) {
        container.innerHTML = photos.map(p => {
            const safeUrl = safeExternalUrl(p.url);
            if (!safeUrl) return '';
            return `
            <div class="relative group">
                <img src="${safeUrl}" alt="Фото запису за день ${day}" loading="lazy" class="photo-thumb tip-up" data-photo-action="open" data-photo-url="${safeUrl}" data-tip="Натисни для збільшення">
                <button type="button" data-photo-action="delete" data-photo-id="${escapeAttr(p.id)}" data-photo-url="${safeUrl}" data-photo-day="${day}" data-photo-role="${escapeAttr(role)}" data-tip="Видалити фото" aria-label="Видалити фото" class="tip-up absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded-full shadow-sm opacity-90 transition-opacity hover:opacity-100 hover:bg-red-600"><span class="material-symbols-rounded" aria-hidden="true">close</span></button>
            </div>`;
        }).join('');
    }

    function openLightbox(url) {
        lightboxController.open(url);
    }
    function closeLightbox() {
        lightboxController.close();
    }
    function lightboxPrev() {
        lightboxController.previous();
    }
    function lightboxNext() {
        lightboxController.next();
    }
    lightboxController.bind();

    function closeDayDetail() {
        document.getElementById('day-detail-modal')?.classList.remove('open');
    }

    // Спільний хелпер: якщо модалка деталізації дня зараз відкрита саме для цього
    // контексту/дня — перебудувати її вміст (щоб чекбокси/поля всередині модалки одразу
    // відображали ефект щойно зробленої зміни, а не лише після закриття й повторного відкриття).
    function refreshOpenDayDetail(context, day) {
        const modal = document.getElementById('day-detail-modal');
        if (!modal || !modal.classList.contains('open')) return;
        if (modal.dataset.context !== context || modal.dataset.day !== String(day)) return;
        if (context === 'garbage') gOpenDayDetail(day);
    }

    // СВАЙП-ЗАКРИТТЯ модалки дня — тягнеш за ручку або заголовок вниз, відпускаєш —
    // якщо протягнув достатньо (або досить швидко) — закривається, інакше повертається на місце.
    function bindDayDetailSwipe() {
        const sheet = document.querySelector('.day-detail-sheet');
        const body = document.querySelector('.day-detail-body');
        const handleZones = [document.querySelector('.day-detail-sheet-handle'), document.querySelector('.day-detail-header')].filter(Boolean);
        if (!sheet) return;
        let startY = 0, deltaY = 0, dragging = false, fromBody = false, startTime = 0;

        // Ручка/заголовок завжди тягнуться. .day-detail-body теж — але лише коли він
        // прокручений до самого верху (інакше свайп вниз означав би "прокрутити вміст",
        // а не "закрити день"): якщо перший рух пальця вгору (гортання вниз по списку),
        // перемикаємось назад на звичайний скрол замість закриття.
        function onStart(isBody) {
            return (e) => {
                if (isBody && body.scrollTop > 0) { dragging = false; return; }
                dragging = true;
                fromBody = isBody;
                startY = e.touches[0].clientY;
                deltaY = 0;
                startTime = Date.now();
                sheet.style.transition = 'none';
            };
        }
        function onMove(e) {
            if (!dragging) return;
            const rawDelta = e.touches[0].clientY - startY;
            if (fromBody && rawDelta < 0) { dragging = false; sheet.style.transform = ''; return; }
            deltaY = Math.max(0, rawDelta);
            if (deltaY > 0) {
                if (fromBody && e.cancelable) e.preventDefault();
                sheet.style.transform = `translateY(${deltaY}px)`;
            }
        }
        function onEnd() {
            if (!dragging) return;
            dragging = false;
            sheet.style.transition = '';
            const elapsed = Date.now() - startTime;
            const velocity = deltaY / Math.max(elapsed, 1);
            sheet.style.transform = '';
            if (deltaY > 110 || (deltaY > 24 && velocity > 0.55)) closeDayDetail();
        }
        handleZones.forEach((zone) => {
            zone.addEventListener('touchstart', onStart(false), { passive: true });
            zone.addEventListener('touchmove', onMove, { passive: true });
            zone.addEventListener('touchend', onEnd);
            zone.addEventListener('touchcancel', onEnd);
        });
        if (body) {
            body.addEventListener('touchstart', onStart(true), { passive: true });
            body.addEventListener('touchmove', onMove, { passive: false });
            body.addEventListener('touchend', onEnd);
            body.addEventListener('touchcancel', onEnd);
        }
    }

    function changeTheme(themeName) {
        themeName = saveOsbbTheme(localStorage, themeName);
        document.body.className = themeName + ' min-h-screen py-6 px-4 sm:px-6 lg:px-8';
        const isDark = themeName === 'theme-dark';
        document.getElementById('journalThemeLabel').textContent = isDark ? 'Темна' : 'Світла';
        // Оновлюємо колір рядка стану браузера/PWA
        const themeColors = { 'theme-light': '#22c55e', 'theme-dark': '#000000' };
        const metaColor = document.getElementById('meta-theme-color');
        if (metaColor) metaColor.setAttribute('content', themeColors[themeName] || '#22c55e');
    }
    function toggleTheme() {
        changeTheme(nextOsbbTheme(document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light'));
    }

    function bindOsbbStaticControls() {
        document.querySelectorAll('[data-lock-digit]').forEach((button) => {
            button.addEventListener('click', () => lockController.press(button.dataset.lockDigit));
        });
        document.querySelector('[data-lock-delete]')?.addEventListener('click', lockController.deleteDigit);

        document.querySelectorAll('[data-pin-modal-digit]').forEach((button) => {
            button.addEventListener('click', () => pinModalController.press(button.dataset.pinModalDigit));
        });
        document.querySelector('[data-pin-modal-cancel]')?.addEventListener('click', pinModalController.cancel);
        document.querySelector('[data-pin-modal-delete]')?.addEventListener('click', pinModalController.deleteDigit);
        document.getElementById('pin-modal')?.addEventListener('keydown', pinModalController.handleKeydown);

        document.querySelector('[data-theme-toggle]')?.addEventListener('click', toggleTheme);
        const pinToggle = document.querySelector('[data-security-pin]');
        const autoLockToggle = document.querySelector('[data-security-auto-lock]');
        const jiraAccessToggle = document.querySelector('[data-jira-access-toggle]');
        const readSecurityFlag = key => localStorage.getItem(key) !== '0';
        const notifySecurityChanged = () => window.parent?.postMessage({ type:'osbb:security-settings-changed' }, window.location.origin);
        if (pinToggle) {
            pinToggle.checked = readSecurityFlag('osbb_pin_enabled');
            pinToggle.addEventListener('change', () => {
                localStorage.setItem('osbb_pin_enabled', pinToggle.checked ? '1' : '0');
                if (!pinToggle.checked && autoLockToggle) {
                    autoLockToggle.checked = false;
                    localStorage.setItem('osbb_auto_lock_enabled', '0');
                }
                notifySecurityChanged();
            });
        }
        if (autoLockToggle) {
            autoLockToggle.checked = readSecurityFlag('osbb_auto_lock_enabled') && readSecurityFlag('osbb_pin_enabled');
            autoLockToggle.addEventListener('change', () => {
                localStorage.setItem('osbb_auto_lock_enabled', autoLockToggle.checked ? '1' : '0');
                notifySecurityChanged();
            });
        }
        if (jiraAccessToggle) {
            jiraAccessToggle.checked = false;
            jiraAccessToggle.addEventListener('change', () => {
                if (jiraAccessToggle.checked) void requestJiraAccess();
                else disableJiraAccess();
            });
        }
        document.querySelectorAll('[data-calendar-select]').forEach((select) => {
            select.addEventListener('change', initCalendar);
        });
        document.querySelectorAll('[data-month-step]').forEach((button) => {
            button.addEventListener('click', () => stepMonth(Number(button.dataset.monthStep)));
        });
        document.querySelectorAll('[data-osbb-tab]').forEach((button) => {
            button.addEventListener('click', () => requestTab(button.dataset.osbbTab));
        });
        document.querySelector('[data-attendance-export]')?.addEventListener('click', attExportExcel);
        document.querySelectorAll('[data-shift-action]').forEach((button) => {
            const handlers = {
                'previous-month': () => shiftChangeMonth(-1),
                'next-month': () => shiftChangeMonth(1),
                'close-editor': shiftCloseEditor,
                'save-day': shiftSaveDay,
                'reset-month': shiftResetMonth,
                'edit-names': shiftOpenNameEditor,
                'close-names': shiftCloseNameEditor,
                'save-names': shiftSaveNames,
            };
            const handler = handlers[button.dataset.shiftAction];
            if (handler) button.addEventListener('click', handler);
        });
        document.getElementById('shift-calendar')?.addEventListener('click', event => {
            const day = event.target.closest('[data-shift-date]');
            if (day) shiftOpenEditor(day.dataset.shiftDate);
        });
        document.getElementById('shift-name-editor')?.addEventListener('keydown', shiftTrapNameEditorFocus);
        document.querySelectorAll('.shift-chip-row').forEach(container => {
            container.addEventListener('click', event => {
                const chip = event.target.closest('[data-shift-person][data-shift-type]');
                if (chip) shiftToggleChip(chip.dataset.shiftPerson, chip.dataset.shiftType);
            });
        });
        document.getElementById('shift-editor')?.addEventListener('click', event => {
            if (event.target === event.currentTarget) shiftCloseEditor();
        });
        document.getElementById('shift-editor')?.addEventListener('keydown', shiftTrapEditorFocus);

        const actionHandlers = {
            'garbage-clear-month': gClearMonth,
            'go-today': goToday,
            'refresh-data': refreshData,
            'jira-refresh': myTicketsInitTab,
            'elevator-add': () => {
                const dayEl = document.getElementById('elevator-new-day');
                const textEl = document.getElementById('elevator-new-text');
                elevatorAdd(dayEl?.value, textEl?.value || '');
                if (textEl) textEl.value = '';
            },
        };
        document.getElementById('elevator-list')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action="elevator-delete"]');
            if (!button) return;
            elevatorDelete(button.dataset.elevatorId);
        });
        document.querySelectorAll('[data-action]').forEach((button) => {
            const handler = actionHandlers[button.dataset.action];
            if (handler) button.addEventListener('click', handler);
        });

        document.querySelector('[data-lightbox-backdrop]')?.addEventListener('click', (event) => {
            if (event.target === event.currentTarget || event.target.id === 'lightbox-img') closeLightbox();
        });
        document.querySelectorAll('[data-lightbox-action]').forEach((button) => {
            const handlers = { prev: lightboxPrev, next: lightboxNext, close: closeLightbox };
            const handler = handlers[button.dataset.lightboxAction];
            if (handler) button.addEventListener('click', handler);
        });
        document.querySelector('[data-day-detail-backdrop]')?.addEventListener('click', (event) => {
            if (event.target === event.currentTarget) closeDayDetail();
        });
        document.querySelector('[data-day-detail-close]')?.addEventListener('click', closeDayDetail);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && document.getElementById('day-detail-modal')?.classList.contains('open')) closeDayDetail();
            if (event.key === 'Escape' && document.getElementById('shift-editor')?.classList.contains('is-open')) shiftCloseEditor();
        });
    }

    function bindOsbbPhotoActions() {
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-photo-action]');
            if (!trigger) return;
            event.preventDefault();
            if (trigger.dataset.photoAction === 'open') {
                openLightbox(trigger.dataset.photoUrl || '');
                return;
            }
            if (trigger.dataset.photoAction === 'delete') {
                deletePhoto(
                    trigger.dataset.photoId,
                    trigger.dataset.photoUrl,
                    Number(trigger.dataset.photoDay),
                    trigger.dataset.photoRole
                );
            }
        });
        // Завантаження фото з day-detail-modal (диспетчер/сміття рендерять свої
        // поля <input type="file" data-journal-action="photo-upload-mobile"> всередині неї).
        document.getElementById('day-detail-body')?.addEventListener('change', (event) => {
            const field = event.target.closest('[data-journal-action="photo-upload-mobile"]');
            if (!field) return;
            const day = Number(field.dataset.day);
            const role = field.dataset.role;
            Array.from(field.files || []).forEach((file) => uploadPhotoMobile(day, role, file));
            field.value = '';
        });
    }

    function formatTimeMaskInput(input) {
        input.value = formatTimeMaskValue(input.value);
    }

    function bindGarbageEntryActions() {
        // att-body (Табель) теж використовує масковані ГГ:ХХ поля (data-time-mask) —
        // додано сюди лише заради спільного input/blur форматування, не g-специфічної логіки.
        ['g-days-list', 'day-detail-body', 'att-body', 'att-calendar', 'att-mobile-list'].forEach((id) => {
            const container = document.getElementById(id);
            if (!container) return;
            container.addEventListener('input', (event) => {
                if (event.target.matches('[data-time-mask]')) formatTimeMaskInput(event.target);
            });
            container.addEventListener('blur', (event) => {
                const field = event.target;
                if (!field.matches?.('[data-time-mask]')) return;
                if (field.value && !isCompleteTimeValue(field.value)) field.value = '';
            }, true);
            container.addEventListener('change', (event) => {
                const field = event.target.closest('[data-g-action]');
                if (!field) return;
                const day = field.dataset.gDay;
                const type = field.dataset.gType;
                if (field.dataset.gAction === 'row-update') {
                    gUpdateRow(day, field.dataset.gField, field.value);
                }
                if (field.dataset.gAction === 'type-toggle') {
                    const countInput = document.getElementById(`g-cnt-${day}-${type}`);
                    const nextValue = field.checked
                        ? (field.dataset.gHasCount === '1' ? (countInput?.value || 1) : 1)
                        : 0;
                    gUpdateType(day, type, nextValue);
                }
                if (field.dataset.gAction === 'type-count') {
                    gUpdateType(day, type, field.value);
                }
                refreshOpenDayDetail('garbage', day);
            });
        });
    }

    const savedTheme = loadOsbbTheme(localStorage);
    changeTheme(savedTheme);

    setTimeout(() => {
        const splash = document.getElementById('intro-splash');
        if(splash) splash.addEventListener('animationend', () => splash.classList.add('hidden'));
    }, 100);

    (function() {
        let sx = 0, sy = 0, moving = false;
        const hint = document.getElementById('swipe-hint');
        let hintTimer = null;

        function showHint(text) {
            hint.textContent = text;
            hint.classList.add('show');
            clearTimeout(hintTimer);
            hintTimer = setTimeout(() => hint.classList.remove('show'), 900);
        }

        document.addEventListener('touchstart', e => {
            if (document.getElementById('lightbox').classList.contains('open')) return;
            if (currentTab === 'tabel') { moving = false; return; }
            sx = e.touches[0].clientX;
            sy = e.touches[0].clientY;
            moving = false;
        }, { passive: true });

        document.addEventListener('touchmove', e => {
            if (document.getElementById('lightbox').classList.contains('open')) return;
            if (currentTab === 'tabel') return;
            const dx = e.touches[0].clientX - sx;
            const dy = e.touches[0].clientY - sy;
            if (!moving && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) moving = true;
        }, { passive: true });

        document.addEventListener('touchend', e => {
            if (document.getElementById('lightbox').classList.contains('open')) return;
            if (currentTab === 'tabel') return;
            if (!moving) return;
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
            if (dx < 0) { showHint('▶ Наступний місяць'); stepMonth(1); }
            else         { showHint('◀ Попередній місяць'); stepMonth(-1); }
        }, { passive: true });
    })();

    // Розреєструвати тільки SW журналу і не чіпати shell/склад.
    if ('serviceWorker' in navigator) {
        try {
            navigator.serviceWorker.register('/Osbb/sw.js?v=10', { scope: '/Osbb/', updateViaCache: 'none' })
                .then(registration => registration.update()).catch(() => {});
            navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(r => {
                    const scopePath = new URL(r.scope).pathname;
                    if (scopePath.startsWith('/Osbb/osbb/')) r.unregister();
                });
            }).catch(() => {});
            if ('caches' in window) {
                caches.keys().then(keys => keys
                    .filter(k => k.startsWith('osbb-journal'))
                    .forEach(k => caches.delete(k))
                ).catch(() => {});
            }
        } catch(e) {}
    }

    // ==========================================
    // ЖУРНАЛ ВИВОЗУ СМІТТЯ
    // Таблиця Supabase: garbage (month_key TEXT PK, data JSONB)
    // ==========================================


    const garbageController = createOsbbGarbageController({
        document, storage:localStorage, isPreview:IS_PREVIEW,
        getMonth:() => ({ year:currentYear, month:currentMonth }), getCurrentTab:() => currentTab,
        readOffline:readOsbbOfflineValue, writeOffline:writeOsbbOfflineValue, removeOffline:removeOsbbOfflineValue,
        fetchMonth:async monthKey => db.from('garbage').select('data').eq('month_key', monthKey).single(),
        upsertMonth:row => db.from('garbage').upsert(row), fetchYear:() => db.from('garbage').select('month_key,data'),
        resetMonth:args => db.rpc('reset_month', args),
        requestResetPin:callback => showPinModal('Скидання сміття', 'PIN для очищення місяця', callback, true),
        render:() => { gData = garbageController.getData(); gRender(); },
    });
    let gData = garbageController.getData();
    const gInitTab = () => garbageController.init();
    const gUpdateRow = (day, field, value) => garbageController.updateRow(day, field, value);
    const gUpdateType = (day, type, value) => garbageController.updateType(day, type, value);

    function gRender() {
        gRenderDaysList();
        gRenderStats();
        gRenderChart();
    }

    // Незалежне завантаження даних сміття для дашборду (без перемикання вкладки) —
    // прогріває gData заздалегідь, щоб вкладка "Сміття" відкривалась без затримки.
    const gInitDashboard = () => garbageController.initDashboard();

    function gBuildDayBodyHtml(day) {
        const row = gData[day] || { time:'', worker:'', types:{} };
        const types = row.types || {};
        return `
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div>
                    <div class="text-xs text-[var(--text-sub)] font-semibold mb-1 inline-flex items-center gap-1"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">schedule</span>Час</div>
                    <input type="text" inputmode="numeric" maxlength="5" placeholder="ГГ:ХХ" value="${escapeAttr(row.time||'')}" data-g-action="row-update" data-g-day="${day}" data-g-field="time" data-time-mask aria-label="Час вивозу сміття за день ${day}"
                        class="w-full text-sm p-2 rounded-lg border bg-[var(--bg-input)] border-[var(--border)] outline-none focus:ring-1 focus:ring-emerald-300">
                </div>
                <div>
                    <div class="text-xs text-[var(--text-sub)] font-semibold mb-1 inline-flex items-center gap-1"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">person</span>Працівник</div>
                    <select data-g-action="row-update" data-g-day="${day}" data-g-field="worker" aria-label="Працівник сміття за день ${day}"
                        class="w-full text-sm p-2 rounded-lg border bg-[var(--bg-input)] border-[var(--border)] outline-none">
                        <option value="">—</option>
                        ${Object.entries(gWorkerNames).map(([k,v]) => `<option value="${k}" ${row.worker===k?'selected':''}>${v}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="garbage-types-heading">
                <span>Що вивезли</span>
                <span class="garbage-types-support">Можна вибрати кілька типів</span>
            </div>
            <div class="garbage-type-grid">
                ${Object.entries(gTypeLabels).map(([k,label]) => {
                    const checked = (parseInt(types[k]) || 0) > 0;
                    const val = types[k] || '';
                    const hasCount = k === 'bins';
                    const meta = gTypeMeta[k];
                    return `
                    <div class="garbage-type-card">
                        <label class="garbage-type-select md-state-layer">
                            <input type="checkbox" ${checked?'checked':''} class="garbage-type-input sr-only"
                                data-g-action="type-toggle" data-g-day="${day}" data-g-type="${k}" data-g-has-count="${hasCount ? '1' : '0'}"
                                aria-label="${label}, відмітити вивіз за день ${day}">
                            <span class="garbage-type-icon" aria-hidden="true"><span class="material-symbols-rounded">${meta.icon}</span></span>
                            <span class="garbage-type-copy">
                                <strong>${label}</strong>
                                <small>${meta.description}</small>
                            </span>
                            <span class="garbage-type-indicator" aria-hidden="true"><span class="material-symbols-rounded">check</span></span>
                        </label>
                        ${hasCount ? `<label class="garbage-bin-count">
                            <span>Кількість баків</span>
                            <input id="g-cnt-${day}-${k}" type="number" min="1" max="99" placeholder="0" value="${escapeAttr(String(val))}"
                                data-g-action="type-count" data-g-day="${day}" data-g-type="${k}" aria-label="Кількість баків за день ${day}"
                                ${checked ? '' : 'disabled'}>
                        </label>` : ''}
                    </div>`;
                }).join('')}
            </div>`;
    }

    function gOpenDayDetail(day) {
        const modal = document.getElementById('day-detail-modal');
        const titleEl = document.getElementById('day-detail-title');
        const bodyEl = document.getElementById('day-detail-body');
        if (!modal || !titleEl || !bodyEl) return;
        const d = parseInt(day, 10);
        const dateObj = new Date(currentYear, currentMonth, d);
        const dayName = dateObj.toLocaleDateString('uk-UA', { weekday: 'long' });
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        titleEl.innerHTML = `${day} <span class="${isWeekend ? 'text-red-500' : ''}">${dayName}</span>`;
        bodyEl.innerHTML = gBuildDayBodyHtml(day);
        bodyEl.querySelectorAll('select[data-g-field="worker"]').forEach((sel) => enhanceSelect(sel));
        modal.dataset.day = day;
        modal.dataset.context = 'garbage';
        modal.classList.add('open');
    }

    // Календарна сітка сміття — той самий вигляд, що й у Журналі: квадрати днів,
    // клік відкриває day-detail-modal з часом/працівником/типами сміття за цей день.
    function gRenderDaysList() {
        const container = document.getElementById('g-days-list');
        if (!container) return;
        container.innerHTML = '';
        const daysInMonth = calendarMonthDays(currentYear, currentMonth);
        const firstDow = sundayFirstDayOffset(currentYear, currentMonth);
        const leadingBlanks = (firstDow + 6) % 7;

        const weekdayRow = document.createElement('div');
        weekdayRow.className = 'month-grid-weekdays';
        weekdayRow.innerHTML = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(w => `<span>${w}</span>`).join('');
        container.appendChild(weekdayRow);

        const grid = document.createElement('div');
        grid.className = 'month-grid';
        container.appendChild(grid);

        for (let i = 0; i < leadingBlanks; i++) {
            const blank = document.createElement('div');
            blank.className = 'month-grid-cell is-empty';
            blank.setAttribute('aria-hidden', 'true');
            grid.appendChild(blank);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const day = String(d).padStart(2,'0');
            const row = gData[day] || { time:'', worker:'', types:{} };
            const types = row.types || {};
            const dateObj = new Date(currentYear, currentMonth, d);
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isToday2 = d === todayDay && currentMonth === todayMonth && currentYear === todayYear;
            const activeTypes = Object.entries(types).filter(([, value]) => (parseInt(value) || 0) > 0);
            const hasAny = activeTypes.length > 0;
            const typeSummary = activeTypes.map(([type, value]) => {
                const count = parseInt(value) || 0;
                const label = gTypeLabels[type] || type;
                return type === 'bins' && count > 0 ? `${label}: ${count}` : label;
            }).join(', ');
            const typeDots = activeTypes.map(([type]) => `<span class="month-grid-dot month-grid-dot-garbage-${escapeAttr(type)}" aria-hidden="true"></span>`).join('');
            const dowLabel = dateObj.toLocaleDateString('uk-UA', { weekday: 'long' });

            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'month-grid-cell' + (isWeekend ? ' is-weekend' : '') + (isToday2 ? ' is-today' : '') + (hasAny ? ' has-shifts' : '');
            cell.setAttribute('aria-label', `${d} ${dowLabel}${hasAny ? `, є вивіз сміття: ${typeSummary}` : ', порожньо'} — відкрити день`);
            cell.setAttribute('aria-haspopup', 'dialog');
            cell.innerHTML = `<span class="month-grid-day">${d}</span><span class="month-grid-dots">${typeDots}</span>`;
            cell.addEventListener('click', () => gOpenDayDetail(day));
            grid.appendChild(cell);
        }
    }

    function gRenderStats() {
        const daysInMonth = calendarMonthDays(currentYear, currentMonth);
        let total = 0, days = 0, plasticDays = 0, glassDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = String(d).padStart(2,'0');
            const row = gData[day];
            if (!row || !row.types) continue;
            const dayTotal = parseInt(row.types.bins) || 0;
            if (dayTotal > 0) { total += dayTotal; days++; }
            if ((parseInt(row.types.plastic) || 0) > 0) plasticDays++;
            if ((parseInt(row.types.glass) || 0) > 0) glassDays++;
        }
        const totalEl = document.getElementById('g-total-month');
        const daysEl = document.getElementById('g-total-days');
        const plasticEl = document.getElementById('g-total-plastic');
        const glassEl = document.getElementById('g-total-glass');
        if (totalEl) totalEl.textContent = total;
        if (daysEl) daysEl.textContent = days;
        if (plasticEl) plasticEl.textContent = plasticDays;
        if (glassEl) glassEl.textContent = glassDays;
    }

    async function gRenderChart() {
        const container = document.getElementById('g-chart');
        if (!container) return;

        await garbageController.loadYear(currentYear);
        const monthlyTotals = garbageController.monthlyTotals(currentYear);

        const maxVal = Math.max(...monthlyTotals, 1);
        container.innerHTML = monthlyTotals.map((val, i) => {
            const h = Math.max(4, Math.round((val / maxVal) * 68));
            const isCur = i === currentMonth;
            return `<div class="flex flex-col items-center gap-1 flex-1">
                <div class="text-[10px] font-bold ${isCur ? 'text-amber-500' : 'text-[var(--text-sub)]'}">${val||''}</div>
                <div class="g-chart-bar${isCur ? ' is-current' : ''}" style="height:${h}px"></div>
                <div class="text-[9px] text-[var(--text-sub)]">${gMonths[i].slice(0,3)}</div>
            </div>`;
        }).join('');
    }

    const gClearMonth = () => garbageController.clearMonth();
    // ==========================================
    // PIN MODAL
    // ==========================================
    function showPinModal(title, sub, callback, danger = false, verifyRpc = 'verify_reset_pin') {
        pinModalController.show(callback, { title, subtitle: sub, danger, verifyRpc });
    }

    const defaultOperatorName = 'Керування';
    // ==========================================
    // МОЇ ЗАЯВКИ — відкриті заявки Jira проєкту MS.
    // ==========================================
    let jiraAssignmentFilter = 'all';
    let jiraStatusFilter = 'all';
    let jiraCategoryFilter = 'all';
    let jiraLoadFailed = false;

    async function jiraRequest(action, extra = {}) {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/jira-issues`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, staffId: staffSession?.id, pin: staffPinCache, ...extra })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `Jira HTTP ${response.status}`);
        return data;
    }

    async function myTicketsInitTab() {
        if (!staffSession) return;
        const statusEl = document.getElementById('my-tickets-sync-status');
        const listEl = document.getElementById('my-tickets-list');
        listEl?.setAttribute('aria-busy', 'true');
        if (statusEl) statusEl.innerHTML = '<span class="material-symbols-rounded journal-inline-icon is-spinning" aria-hidden="true">progress_activity</span><span class="sr-only">Завантаження заявок</span>';
        if (!staffPinCache && localStorage.getItem('osbb_pin_enabled') === '0') {
            if (statusEl) statusEl.innerHTML = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">lock_open</span>';
            if (listEl) listEl.innerHTML = '<div class="completed-work-empty"><span class="material-symbols-rounded" aria-hidden="true">key_off</span><p>Увімкніть PIN-код для завантаження заявок Jira</p></div>';
            listEl?.setAttribute('aria-busy', 'false');
            return;
        }
        if (!staffPinCache && !await requestStaffReauth()) {
            if (statusEl) statusEl.innerHTML = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">lock</span>';
            listEl?.setAttribute('aria-busy', 'false');
            return;
        }
        try {
            const data = await jiraRequest('list');
            jiraIssues = jiraIssuesFromResponse(data.issues);
            jiraLoadFailed = false;
            if (statusEl) statusEl.innerHTML = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>';
        } catch (error) {
            console.error('jira issues load error:', error);
            jiraIssues = [];
            jiraLoadFailed = true;
            if (statusEl) statusEl.innerHTML = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">error</span>';
            showToast('Не вдалося завантажити Jira-заявки');
        }
        listEl?.setAttribute('aria-busy', 'false');
        myTicketsRender();
    }

    function myTicketsRender() {
        const list = document.getElementById('my-tickets-list');
        if (!list || !staffSession) return;
        if (jiraLoadFailed) {
            list.innerHTML = '<div class="completed-work-empty"><span class="material-symbols-rounded" aria-hidden="true">cloud_off</span><p>Не вдалося завантажити заявки з Jira</p><button type="button" class="dispatcher-copy-btn md-state-layer" data-jira-retry><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">refresh</span>Спробувати ще раз</button></div>';
            list.querySelector('[data-jira-retry]')?.addEventListener('click', myTicketsInitTab);
            return;
        }
        const categories = [...new Set(jiraIssues.map(issue => issue.category || 'Без категорії'))].sort();
        const statusCounts = jiraIssues.reduce((counts, issue) => {
            const status = issue.status || 'Без статусу';
            counts[status] = (counts[status] || 0) + 1;
            return counts;
        }, {});
        const filteredIssues = jiraIssues.filter(issue => {
            const assignmentMatches = jiraAssignmentFilter === 'all'
                || (jiraAssignmentFilter === 'assigned' ? Boolean(issue.assignedRole) : !issue.assignedRole);
            return assignmentMatches
                && (jiraStatusFilter === 'all' || issue.status === jiraStatusFilter)
                && (jiraCategoryFilter === 'all' || (issue.category || 'Без категорії') === jiraCategoryFilter);
        });
        const countersHtml = `<div class="jira-status-counters" aria-label="Кількість Jira-заявок за статусом">
            <button type="button" class="jira-status-counter md-state-layer ${jiraStatusFilter === 'all' ? 'is-active' : ''}" data-jira-status-counter="all"><span>Усі</span><strong>${jiraIssues.length}</strong></button>
            ${Object.entries(statusCounts).map(([status, count]) => `<button type="button" class="jira-status-counter md-state-layer ${jiraStatusFilter === status ? 'is-active' : ''}" data-jira-status-counter="${escapeAttr(status)}"><span>${escapeHtml(status)}</span><strong>${count}</strong></button>`).join('')}
        </div>`;
        const filtersHtml = countersHtml + `<div class="dispatcher-filter-chips jira-ticket-filters" aria-label="Фільтри Jira-заявок">
            <select class="journal-select" data-jira-filter="assignment" aria-label="Фільтр за призначенням">
                <option value="all">Усі призначення</option><option value="assigned" ${jiraAssignmentFilter === 'assigned' ? 'selected' : ''}>Призначені</option><option value="unassigned" ${jiraAssignmentFilter === 'unassigned' ? 'selected' : ''}>Непризначені</option>
            </select>
            <select class="journal-select" data-jira-filter="category" aria-label="Фільтр за категорією">
                <option value="all">Усі категорії</option>${categories.map(category => `<option value="${escapeAttr(category)}" ${jiraCategoryFilter === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
            </select>
        </div>`;
        if (!jiraIssues.length) { list.innerHTML = '<div class="staff-login-loading">Відкритих Jira-заявок немає</div>'; return; }
        list.innerHTML = filtersHtml + (filteredIssues.length ? filteredIssues.map(issue => {
            const priority = jiraPriorityClass(issue.priority);
            const safeUrl = safeExternalUrl(issue.url);
            return `<div class="my-ticket-card priority-${priority}">
                <div class="ticket-item-head">
                    <span class="ticket-priority-badge"><i class="priority-dot" aria-hidden="true"></i>${escapeHtml(issue.priority || 'Без пріоритету')}</span>
                    <span class="ticket-role-badge">${escapeHtml(issue.status || 'Відкрита')}</span>
                </div>
                <div class="ticket-item-text">${escapeHtml(issue.summary)}</div>
                <div class="ticket-item-comment">${escapeHtml(issue.key)} · ${escapeHtml(issue.category || 'Без категорії')}${issue.assignedRole ? ` · ${escapeHtml(roleNames[issue.assignedRole] || issue.assignedRole)}` : ' · Не призначено'}</div>
                <div class="my-ticket-close-actions">
                    <button type="button" class="dispatcher-copy-btn md-state-layer" data-jira-action="copy" data-jira-key="${escapeAttr(issue.key)}"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">content_copy</span>Копіювати</button>
                    <button type="button" class="dispatcher-copy-btn md-state-layer" data-jira-action="share" data-jira-key="${escapeAttr(issue.key)}"><span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">send</span>Telegram</button>
                    ${safeUrl ? `<a class="dispatcher-copy-btn md-state-layer" href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">Відкрити в Jira</a>` : ''}
                </div>
            </div>`;
        }).join('') : '<div class="staff-login-loading">За вибраними фільтрами заявок немає</div>');

        list.querySelectorAll('[data-jira-filter]').forEach(select => {
            select.addEventListener('change', () => {
                if (select.dataset.jiraFilter === 'assignment') jiraAssignmentFilter = select.value;
                if (select.dataset.jiraFilter === 'category') jiraCategoryFilter = select.value;
                myTicketsRender();
            });
        });
        list.querySelectorAll('[data-jira-status-counter]').forEach(button => {
            button.addEventListener('click', () => {
                jiraStatusFilter = button.dataset.jiraStatusCounter || 'all';
                myTicketsRender();
            });
        });
        list.querySelectorAll('[data-jira-action]').forEach(button => {
            button.addEventListener('click', async () => {
                const issue = jiraIssues.find(item => item.key === button.dataset.jiraKey);
                if (!issue) return;
                const shareText = formatJiraShareText(issue);
                try {
                    if (button.dataset.jiraAction === 'copy') {
                        await navigator.clipboard.writeText(shareText);
                        showToast('Заявку скопійовано');
                        return;
                    }
                    if (navigator.share) {
                        await navigator.share({ title: issue.key || 'Заявка Jira', text: shareText });
                        return;
                    }
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(issue.url || '')}&text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
                } catch (error) {
                    if (error?.name !== 'AbortError') showToast('Не вдалося поділитися заявкою');
                }
            });
        });
        list.querySelectorAll('[data-jira-filter]').forEach(select => enhanceSelect(select));
    }

    // ЛІФТЕР: короткий журнал відміток у вкладці «Виконані роботи».
    // Один рядок на місяць у elevator_visits,
    // data — масив {id, day, text, createdAt, createdBy}.
    // ==========================================

    const elevatorController = createOsbbElevatorController({
        document, storage:localStorage, isPreview:IS_PREVIEW,
        getMonth:()=>({year:currentYear,month:currentMonth}), getAuthor:()=>staffSession?.name || defaultOperatorName,
        readOffline:readOsbbOfflineValue, writeOffline:writeOsbbOfflineValue,
        fetchMonth:async key=>db.from('elevator_visits').select('data').eq('month_key',key).single(),
        upsertMonth:row=>db.from('elevator_visits').upsert(row), render:elevatorRender, showToast,
        onEntriesChanged:value=>{elevatorData=value;},
    });

    function elevatorKey() { return zeroBasedMonthKey(currentYear, currentMonth); }
    function elevatorOfflineKey() { return osbbOfflineMonthKey('elevator', currentYear, currentMonth); }

    function elevatorSaveOffline() {
        writeOsbbOfflineValue(localStorage, elevatorOfflineKey(), elevatorData);
    }
    function elevatorLoadOffline() {
        return elevatorEntriesFromResponse(readOsbbOfflineValue(localStorage, elevatorOfflineKey()));
    }

    function elevatorSetStatus(type, text) {
        const el = document.getElementById('elevator-sync-status');
        if (!el) return;
        const cls = { loading: 'is-loading', ok: 'is-ok', error: 'is-error' };
        el.className = `journal-status-chip ${cls[type] || cls.ok}`;
        el.innerHTML = text;
    }

    async function elevatorInitTab() {
        return elevatorController.init();
        elevatorSetStatus('loading', '<span class="material-symbols-rounded journal-inline-icon is-spinning" aria-hidden="true">progress_activity</span>');
        const offline = elevatorLoadOffline();
        if (offline) { elevatorData = offline; elevatorRender(); }
        if (IS_PREVIEW) {
            elevatorData = offline || [];
            elevatorSetStatus('ok', '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">preview</span>');
            elevatorRender();
            return;
        }
        try {
            const res = await db.from('elevator_visits').select('data').eq('month_key', elevatorKey()).single();
            const { data, error } = res;
            if (error && error.code !== 'PGRST116') throw error;
            elevatorData = Array.isArray(data?.data) ? elevatorEntriesFromResponse(data.data) : offline;
            elevatorSaveOffline();
            elevatorSetStatus('ok', '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>');
        } catch(err) {
            console.error('elevator load error:', err);
            elevatorSetStatus('error', '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">error</span>');
            elevatorData = offline || [];
        }
        elevatorRender();
    }

    async function elevatorSaveCloud() {
        return elevatorController.saveCloud();
        if (IS_PREVIEW) return;
        try {
            const { error } = await db.from('elevator_visits').upsert({ month_key: elevatorKey(), data: elevatorData });
            if (error) throw error;
            elevatorSetStatus('ok', '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">check_circle</span>');
        } catch(err) {
            console.error('elevator save error:', err);
            elevatorSetStatus('error', '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">error</span>');
        }
    }

    function elevatorAdd(day, text) {
        return elevatorController.add(day, text);
        const entry = createElevatorEntry(day, text, staffSession?.name || defaultOperatorName);
        if (!entry) { showToast('Опишіть, що зробив ліфтер'); return; }
        elevatorData.push(entry);
        elevatorSaveOffline();
        elevatorSaveCloud();
        elevatorRender();
        showToast('Запис додано');
    }

    function elevatorDelete(id) {
        return elevatorController.remove(id);
        elevatorData = removeElevatorEntry(elevatorData, id);
        elevatorSaveOffline();
        elevatorSaveCloud();
        elevatorRender();
    }

    function elevatorRender() {
        const daySelect = document.getElementById('elevator-new-day');
        const list = document.getElementById('elevator-list');
        if (!daySelect || !list) return;
        const daysInMonth = calendarMonthDays(currentYear, currentMonth);
        const currentValue = daySelect.value;
        daySelect.innerHTML = Array.from({ length: daysInMonth }, (_, i) => i + 1)
            .map(d => `<option value="${d}" ${d === todayDay && currentMonth === todayMonth ? 'selected' : ''}>${d}</option>`).join('');
        if (currentValue && Number(currentValue) <= daysInMonth) daySelect.value = currentValue;
        if (daySelect.dataset.enhanced) refreshEnhancedSelect(daySelect); else enhanceSelect(daySelect);

        const sorted = sortElevatorEntries(elevatorData);
        list.innerHTML = sorted.length ? sorted.map(entry => `
            <div class="elevator-entry">
                <span class="elevator-entry-day">${String(entry.day).padStart(2, '0')}</span>
                <span class="elevator-entry-text">${escapeHtml(entry.text)}</span>
                <button type="button" class="ticket-delete-btn md-state-layer" data-action="elevator-delete" data-elevator-id="${escapeAttr(entry.id)}" aria-label="Видалити запис"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button>
            </div>
        `).join('') : '<div class="staff-login-loading">Записів цього місяця ще немає</div>';
    }

    // ==========================================
    // ОНОВИТИ ДАНІ (примусовий refresh)
    // ==========================================
    async function refreshData() {
        const btn = document.getElementById('btn-refresh');
        if (btn) { btn.style.animation = 'spin 0.6s linear'; btn.disabled = true; }
        garbageController.resetLoaded();
        await initCalendar();
        if (btn) { btn.style.animation = ''; btn.disabled = false; }
        showToast('Дані оновлено');
    }

    // ==========================================
    // ============================================================
    // iOS TOAST повідомлення
    // ============================================================
    let toastTimer = null;
    const TOAST_ICON_CHECK = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">done</span>';
    const TOAST_ICON_WARN  = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">warning</span>';
    const TOAST_ICON_TRASH = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">delete</span>';
    const TOAST_ICON_ERROR = '<span class="material-symbols-rounded journal-inline-icon" aria-hidden="true">close</span>';
    function showToast(msg, icon = TOAST_ICON_CHECK, duration = 2500) {
        const el = document.getElementById('ios-toast');
        if (!el) return;
        el.innerHTML = `<span class="toast-icon-badge">${icon}</span>${escapeHtml(msg)}`;
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(-50%) translateY(20px)';
        }, duration);
    }

    // Виклик toast при збереженні — перехопити setSyncStatus 'ok'
    const _origSetSyncStatus = setSyncStatus;
    setSyncStatus = function(type, text) {
        _origSetSyncStatus(type, text);
        if (type === 'ok' && text.includes('Синхронізовано')) showToast('Збережено', TOAST_ICON_CHECK);
    };

    // ============================================================
    // ВИКОНАНІ РОБОТИ — окремий факт виконання, без Jira та складу
    // ============================================================
    const completedWorkRoleLabels = { electrician:'Електрик', janitor:'Двірник', plumber:'Сантехнік' };
    const completedWorkStatus = type => {
        const el = document.getElementById('completed-work-status'); if (!el) return;
        const states = { loading:['is-loading','Синхронізація…'], ok:['is-ok','Синхронізовано'], error:['is-error','Помилка'] };
        const [className,label] = states[type] || states.ok; el.className = `journal-status-chip ${className}`; el.textContent = label;
    };
    function completedWorkMonthEntries(entries) {
        const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-`;
        return entries.filter(entry => entry.workDate.startsWith(prefix));
    }
    function completedWorkRender(entries = completedWorkController.getEntries()) {
        const list = document.getElementById('completed-work-list'); if (!list) return;
        const filtered = filterCompletedWork(completedWorkMonthEntries(entries), document.getElementById('completed-work-search')?.value, document.getElementById('completed-work-filter')?.value || 'all');
        if (!filtered.length) { list.innerHTML = '<div class="completed-work-empty"><span class="material-symbols-rounded" aria-hidden="true">task_alt</span><p>За цей місяць записів немає</p></div>'; return; }
        list.innerHTML = filtered.map(entry => `<article class="completed-work-card" data-completed-work-id="${escapeAttr(entry.id)}">
            <div class="completed-work-meta"><strong>${escapeHtml(new Date(`${entry.workDate}T00:00:00`).toLocaleDateString('uk-UA',{day:'2-digit',month:'short'}))}</strong><span>${escapeHtml(completedWorkRoleLabels[entry.workerRole])}</span></div>
            <div class="completed-work-copy"><h3>${escapeHtml(entry.description)}</h3>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}</div>
            <div class="completed-work-card-actions"><button type="button" class="journal-icon-btn md-state-layer" data-completed-work-action="edit" data-tip="Редагувати" aria-label="Редагувати запис"><span class="material-symbols-rounded" aria-hidden="true">edit</span></button><button type="button" class="journal-icon-btn md-state-layer" data-completed-work-action="delete" data-tip="Видалити" aria-label="Видалити запис"><span class="material-symbols-rounded" aria-hidden="true">delete</span></button></div>
        </article>`).join('');
    }
    const completedWorkController = createOsbbCompletedWorkController({
        loadRows:()=>{ const first=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`; const last=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(calendarMonthDays(currentYear,currentMonth)).padStart(2,'0')}`; return db.from('completed_work').select('id,work_date,worker_role,description,note').gte('work_date',first).lte('work_date',last).order('work_date',{ascending:false}); },
        saveRow:args=>db.rpc('save_completed_work',args), deleteRow:args=>db.rpc('delete_completed_work',args),
        getSession:()=>staffSession, getPin:()=>staffPinCache, clearPin:()=>{staffPinCache=null;}, requestReauth:requestStaffReauth,
        render:completedWorkRender, setStatus:completedWorkStatus, showToast,
    });
    const completedWorkInitTab = () => completedWorkController.load();
    function completedWorkResetForm() {
        document.getElementById('completed-work-form')?.reset();
        document.getElementById('completed-work-id').value = '';
        document.getElementById('completed-work-date').value = completedWorkDefaultDate(currentYear,currentMonth);
        document.getElementById('completed-work-submit-label').textContent = 'Зберегти роботу';
        document.getElementById('completed-work-cancel').classList.add('hidden');
        refreshEnhancedSelect(document.getElementById('completed-work-role'));
    }
    function bindCompletedWorkActions() {
        const form = document.getElementById('completed-work-form'); if (!form) return;
        completedWorkResetForm();
        form.addEventListener('submit', async event => { event.preventDefault(); const saved = await completedWorkController.save({
            id:document.getElementById('completed-work-id').value || null, workDate:document.getElementById('completed-work-date').value,
            workerRole:document.getElementById('completed-work-role').value, description:document.getElementById('completed-work-description').value, note:document.getElementById('completed-work-note').value,
        }); if (saved) { completedWorkResetForm(); showToast('Роботу збережено'); } });
        document.getElementById('completed-work-cancel').addEventListener('click', completedWorkResetForm);
        document.getElementById('completed-work-search').addEventListener('input',()=>completedWorkRender());
        document.getElementById('completed-work-filter').addEventListener('change',()=>completedWorkRender());
        document.getElementById('completed-work-list').addEventListener('click', async event => {
            const action = event.target.closest('[data-completed-work-action]'); if (!action) return;
            const card = action.closest('[data-completed-work-id]'); const entry = completedWorkController.getEntries().find(item=>item.id===card?.dataset.completedWorkId); if (!entry) return;
            if (action.dataset.completedWorkAction === 'delete') {
                if (action.dataset.confirmDelete !== '1') { action.dataset.confirmDelete='1'; action.setAttribute('aria-label','Підтвердити видалення'); action.innerHTML='<span class="material-symbols-rounded" aria-hidden="true">delete_forever</span>'; showToast('Натисніть видалити ще раз для підтвердження'); setTimeout(()=>{ if(action.isConnected){delete action.dataset.confirmDelete;action.setAttribute('aria-label','Видалити запис');action.innerHTML='<span class="material-symbols-rounded" aria-hidden="true">delete</span>';} },4000); return; }
                await completedWorkController.remove(entry.id); return;
            }
            document.getElementById('completed-work-id').value=entry.id; document.getElementById('completed-work-date').value=entry.workDate;
            document.getElementById('completed-work-role').value=entry.workerRole; refreshEnhancedSelect(document.getElementById('completed-work-role'));
            document.getElementById('completed-work-description').value=entry.description; document.getElementById('completed-work-note').value=entry.note;
            document.getElementById('completed-work-submit-label').textContent='Зберегти зміни'; document.getElementById('completed-work-cancel').classList.remove('hidden'); form.scrollIntoView({behavior:'smooth',block:'start'});
        });
    }

    // ============================================================
    // ONLINE / OFFLINE ІНДИКАТОР
    // ============================================================
    function updateNetworkBadge() {
        return runtimeController.updateNetworkBadge();
        const badge = document.getElementById('network-badge');
        if (!badge) return;
        if (navigator.onLine) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'flex';
        }
    }
    // ============================================================
    // AUTO-LOCK — блокування через 30 хвилин бездіяльності
    // ============================================================
    function triggerAutoLock() {
        lockController.show();
    }

    const autoLockController = createAutoLockController(triggerAutoLock);

    // Скидати таймер на будь-яку активність користувача
    ['click','touchstart','keydown','scroll','mousemove'].forEach(evt =>
        document.addEventListener(evt, () => {
            if (localStorage.getItem('osbb_pin_enabled') !== '0' && localStorage.getItem('osbb_auto_lock_enabled') !== '0') autoLockController.reset();
            else autoLockController.stop();
        }, { passive: true })
    );
    if (localStorage.getItem('osbb_pin_enabled') !== '0' && localStorage.getItem('osbb_auto_lock_enabled') !== '0') autoLockController.reset();

    // CSS для спін-анімації кнопки refresh
    const styleEl = document.createElement('style');
    styleEl.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(styleEl);

    function updateContextualJournalControls(tab) {
        const calendarRow = document.getElementById('journal-calendar-row');
        if (calendarRow) calendarRow.classList.toggle('hidden', tab === 'my-tickets' || tab === 'shifts');
    }

    // Запускаємо початкове завантаження лише після ініціалізації всіх
    // lexical state bindings, які читають активні вкладки.
    runtimeController = createOsbbRuntimeController({
        document, window, navigator, isPreview:IS_PREVIEW, tabs:ALL_TABS, initialTab:currentTab,
        isTabAllowed:isTabAllowedForSession, isDispatcher:isDispatcherSession,
        requestShiftPin:callback=>showPinModal('PIN розділу «Зміни»','Введіть окремий PIN для доступу',callback,false,'verify_work_shifts_pin'),
        getSelectedMonth:()=>({year:Number.parseInt(yearSelect.value,10),month:Number.parseInt(monthSelect.value,10)}),
        onMonthChanged:month=>{currentYear=month.year;currentMonth=month.month;},
        onTabChanged:tab=>{currentTab=tab;updateContextualJournalControls(tab);},
        loadPhotos:async()=>{photosCache=null;if(!IS_PREVIEW)await loadAllPhotosForMonth();}, updateToday:updateTodayBtn,
        loadDashboard:gInitDashboard,
        loaders:{garbage:gInitTab,'completed-work':async()=>{await completedWorkInitTab();await elevatorInitTab();},shifts:shiftInitTab,tabel:attInitTab,'my-tickets':myTicketsInitTab},
        setSyncStatus:type=>setSyncStatus(type,type==='loading'?'<span class="status-label">Завантаження...</span>':'<span class="status-label">Синхронізовано</span>'),
        createRealtimeClient:typeof supabase==='undefined'?null:()=>supabase.createClient(SUPABASE_URL,SUPABASE_KEY),
        subscriptions:[
            {tab:'garbage',filter:{event:'*',schema:'public',table:'garbage'},load:gInitTab},
            {tab:'completed-work',filter:{event:'*',schema:'public',table:'elevator_visits'},load:elevatorInitTab},
            {tab:'completed-work',filter:{event:'*',schema:'public',table:'completed_work'},load:completedWorkInitTab},
            {tab:'shifts',filter:{event:'*',schema:'public',table:'work_shifts'},load:shiftLoadMonth},
            {tab:'shifts',filter:{event:'*',schema:'public',table:'work_shift_settings'},load:shiftLoadSettings},
        ], showToast, onlineIcon:TOAST_ICON_CHECK, offlineIcon:TOAST_ICON_WARN,
    });
    runtimeController.bindNetwork();
    bindOsbbStaticControls();
    bindOsbbPhotoActions();
    bindGarbageEntryActions();
    bindCompletedWorkActions();
    bindDayDetailSwipe();
    setTab(currentTab, { load: false });
    initCalendar();
    initRealtime();
