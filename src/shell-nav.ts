import type { ShellTabName } from './shell-state.ts';

// Єдина навігація застосунку (листопад 2026): shell показує всі розділи журналу
// й складу в одному меню, а модулі в iframe лише відмальовують вибраний розділ.
export type ShellSection =
    | 'home'
    | 'completed-work' | 'garbage' | 'shifts' | 'tabel'
    | 'items' | 'log' | 'audit' | 'stats';

export interface ShellSectionInfo {
    module: ShellTabName | null;
    label: string;
    icon: string;
}

export const SHELL_SECTIONS: Readonly<Record<ShellSection, ShellSectionInfo>> = {
    home: { module: null, label: 'Головна', icon: 'home' },
    'completed-work': { module: 'journal', label: 'Виконані роботи', icon: 'task_alt' },
    garbage: { module: 'journal', label: 'Сміття', icon: 'delete' },
    shifts: { module: 'journal', label: 'Зміни', icon: 'calendar_clock' },
    tabel: { module: 'journal', label: 'Табель', icon: 'schedule' },
    items: { module: 'sklad', label: 'Запаси', icon: 'inventory_2' },
    log: { module: 'sklad', label: 'Рух товарів', icon: 'swap_vert' },
    audit: { module: 'sklad', label: 'Інвентаризація', icon: 'fact_check' },
    stats: { module: 'sklad', label: 'Статистика', icon: 'bar_chart' },
};

export const DEFAULT_SECTION: ShellSection = 'home';

/** Розділи, які на телефоні є в нижньому меню; решта — у листі «Ще». */
export const MOBILE_PRIMARY_SECTIONS: readonly ShellSection[] = ['home', 'garbage', 'tabel', 'items'];

export function isShellSection(value: unknown): value is ShellSection {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SHELL_SECTIONS, value);
}

export function sectionModule(section: ShellSection): ShellTabName | null {
    return SHELL_SECTIONS[section].module;
}

/** Внутрішні сторінки модулів, які не мають окремого пункту меню. */
const MODULE_PAGE_ALIASES: Readonly<Record<ShellTabName, Readonly<Record<string, ShellSection>>>> = {
    journal: {},
    sklad: { issue: 'items', add: 'items', receipts: 'log' },
};

/** Перекладає сторінку, про яку повідомив модуль, у пункт меню shell. */
export function sectionForModulePage(module: ShellTabName, page: unknown): ShellSection | null {
    if (typeof page !== 'string') return null;
    const aliases = MODULE_PAGE_ALIASES[module];
    if (Object.prototype.hasOwnProperty.call(aliases, page)) return aliases[page] ?? null;
    return isShellSection(page) && SHELL_SECTIONS[page].module === module ? page : null;
}

export function isMobilePrimarySection(section: ShellSection): boolean {
    return MOBILE_PRIMARY_SECTIONS.includes(section);
}

/** Місця всередині розділу, до яких можна перейти напряму (напр. блок ліфтера у «Виконаних роботах»). */
const SECTION_FOCUS_TARGETS: Readonly<Partial<Record<ShellSection, readonly string[]>>> = {
    'completed-work': ['elevator'],
};

export function isSectionFocus(section: ShellSection, focus: unknown): focus is string {
    return typeof focus === 'string' && (SECTION_FOCUS_TARGETS[section] ?? []).includes(focus);
}

export function defaultSectionFor(module: ShellTabName): ShellSection {
    return module === 'journal' ? 'garbage' : 'items';
}
