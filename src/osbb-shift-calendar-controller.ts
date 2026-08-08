import { calculateShiftMoney, shiftDateKey, shiftErrorMessage, shiftTypeDescription, workShiftRowsFromResponse } from './osbb-shifts.js';
void calculateShiftMoney; void shiftDateKey; void shiftErrorMessage; void shiftTypeDescription; void workShiftRowsFromResponse;
export declare function createOsbbShiftCalendarController(options: Record<string, unknown>): {
    changeMonth(direction: number): Promise<void>;
    closeEditor(): void;
    count(person: 'sergiy' | 'oleksandr'): { day: number; night: number; night_half2: number };
    dayData(dateKey: string): { sergiy: string[]; oleksandr: string[] };
    init(onFirstInit: () => void): Promise<void>;
    load(): Promise<void>;
    monthKey(): string;
    openEditor(dateKey: string): void;
    render(): void;
    renderStats(): void;
    reset(): void;
    submitDay(): void;
    toggleChip(person: 'sergiy' | 'oleksandr', type: string): void;
    trapEditorFocus(event: KeyboardEvent): void;
};
