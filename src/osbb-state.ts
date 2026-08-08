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

function optionalString(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return text && text.length <= maxLength ? text : undefined;
}

export function jiraIssuesFromResponse(value: unknown): JiraIssue[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        const key = optionalString(row.key, 100);
        const summary = optionalString(row.summary, 1000);
        if (!key || !summary) return [];
        return [{
            key,
            summary,
            priority: optionalString(row.priority, 100),
            status: optionalString(row.status, 100),
            category: optionalString(row.category, 200),
            assignedRole: row.assignedRole === 'plumber' || row.assignedRole === 'janitor' || row.assignedRole === 'electrician'
                ? row.assignedRole
                : undefined,
            url: optionalString(row.url, 2000),
        }];
    });
}
