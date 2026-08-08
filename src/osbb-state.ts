import type { AttendanceMonth } from './osbb-attendance.ts';
import type { DispatcherMonth } from './osbb-dispatcher.ts';
import type { ElevatorEntry } from './osbb-elevator.ts';
import type { GarbageMonthData } from './osbb-garbage.ts';
import type { PhotoCache } from './osbb-photos.ts';
import type { WorkShiftRows } from './osbb-shifts.ts';
import type { StaffListEntry } from './osbb-staff.ts';

export interface JiraIssue {
    key: string;
    summary: string;
    priority?: string;
    status?: string;
    category?: string;
    assignedRole?: string;
    url?: string;
}

export interface OsbbRuntimeState {
    staffLoginList: StaffListEntry[];
    garbage: GarbageMonthData;
    attendance: AttendanceMonth;
    dispatcher: DispatcherMonth;
    shiftRows: WorkShiftRows;
    photosCache: PhotoCache | null;
    lightboxPhotos: string[];
    jiraIssues: JiraIssue[];
    elevatorData: ElevatorEntry[];
}

export function createOsbbRuntimeState(): OsbbRuntimeState {
    return {
        staffLoginList: [],
        garbage: {},
        attendance: {},
        dispatcher: {},
        shiftRows: {},
        photosCache: null,
        lightboxPhotos: [],
        jiraIssues: [],
        elevatorData: [],
    };
}

function optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function jiraIssuesFromResponse(value: unknown): JiraIssue[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        const key = optionalString(row.key);
        const summary = optionalString(row.summary);
        if (!key || !summary) return [];
        return [{
            key,
            summary,
            priority: optionalString(row.priority),
            status: optionalString(row.status),
            category: optionalString(row.category),
            assignedRole: optionalString(row.assignedRole),
            url: optionalString(row.url),
        }];
    });
}
