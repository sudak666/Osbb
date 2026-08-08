import { shiftErrorMessage, workShiftNamesFromResponse } from './osbb-shifts.js';
void shiftErrorMessage; void workShiftNamesFromResponse;

export type ShiftNames = { sergiy: string; oleksandr: string };
export declare function createOsbbShiftSettingsController(options: Record<string, unknown>): {
    apply(): void;
    close(): void;
    getNames(): ShiftNames;
    load(): Promise<void>;
    open(): void;
    save(): void;
    trapFocus(event: KeyboardEvent): void;
};
