import type { AttendanceMonth } from './osbb-attendance.ts';
import type { DispatcherMonth } from './osbb-dispatcher.ts';
import type { GarbageMonthData } from './osbb-garbage.ts';

export interface OsbbMonthState {
    garbage: GarbageMonthData;
    attendance: AttendanceMonth;
    dispatcher: DispatcherMonth;
}

export function createOsbbMonthState(): OsbbMonthState {
    return {
        garbage: {},
        attendance: {},
        dispatcher: {},
    };
}
