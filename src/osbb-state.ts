import type { AttendanceMonth } from './osbb-attendance.ts';
import type { ElevatorEntry } from './osbb-elevator.ts';
import type { GarbageMonthData } from './osbb-garbage.ts';
import type { PhotoCache } from './osbb-photos.ts';
import type { WorkShiftRows } from './osbb-shifts.ts';
import type { StaffListEntry } from './osbb-staff.ts';

export interface OsbbRuntimeState {
    staffLoginList: StaffListEntry[];
    garbage: GarbageMonthData;
    attendance: AttendanceMonth;
    shiftRows: WorkShiftRows;
    photosCache: PhotoCache | null;
    lightboxPhotos: string[];
    elevatorData: ElevatorEntry[];
}

export function createOsbbRuntimeState(): OsbbRuntimeState {
    return {
        staffLoginList: [],
        garbage: {},
        attendance: {},
        shiftRows: {},
        photosCache: null,
        lightboxPhotos: [],
        elevatorData: [],
    };
}

