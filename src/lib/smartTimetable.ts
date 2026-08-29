export const TIMETABLE_DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'] as const;
export type TimetableDay = (typeof TIMETABLE_DAYS)[number];

export interface TimetableTeacher {
  id: string;
  name: string;
  level: 'Tiểu học' | 'THCS' | 'Liên cấp';
  unavailableSlots?: string[];
}

export interface TimetableClass {
  id: string;
  name: string;
  level: 'Tiểu học' | 'THCS';
}

export interface TimetableSubject {
  id: string;
  name: string;
  preferMorning?: boolean;
}

export interface TimetableRoom {
  id: string;
  name: string;
  unavailableSlots?: string[];
}

export interface TeachingAssignment {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string;
  periodsPerWeek: number;
  maxPerDay?: number;
  avoidLastPeriod?: boolean;
}

export interface TimetableScenario {
  name: string;
  periodsPerDay: number;
  teachers: TimetableTeacher[];
  classes: TimetableClass[];
  subjects: TimetableSubject[];
  rooms: TimetableRoom[];
  assignments: TeachingAssignment[];
}

export interface ScheduleEntry {
  id: string;
  assignmentId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string;
  dayIndex: number;
  period: number;
  locked?: boolean;
}

export interface UnscheduledLesson {
  assignmentId: string;
  remaining: number;
  reason: string;
}

export interface TimetableDiagnostics {
  hardConflicts: string[];
  warnings: string[];
  unscheduled: UnscheduledLesson[];
  teacherGaps: number;
}

export interface TimetableSolution {
  entries: ScheduleEntry[];
  score: number;
  diagnostics: TimetableDiagnostics;
  generatedAt: string;
}

export function timetableSlotKey(dayIndex: number, period: number): string {
  return `${dayIndex}:${period}`;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function countTeacherGaps(entries: ScheduleEntry[]): number {
  const groups = new Map<string, number[]>();
  for (const entry of entries) {
    const key = `${entry.teacherId}:${entry.dayIndex}`;
    const periods = groups.get(key) || [];
    periods.push(entry.period);
    groups.set(key, periods);
  }

  let gaps = 0;
  for (const periods of groups.values()) {
    const sorted = [...new Set(periods)].sort((a, b) => a - b);
    if (sorted.length < 2) continue;
    gaps += Math.max(0, sorted[sorted.length - 1] - sorted[0] + 1 - sorted.length);
  }
  return gaps;
}

function validateLockedEntries(scenario: TimetableScenario, lockedEntries: ScheduleEntry[]): string[] {
  const conflicts: string[] = [];
  const occupiedClasses = new Set<string>();
  const occupiedTeachers = new Set<string>();
  const occupiedRooms = new Set<string>();

  for (const entry of lockedEntries) {
    if (entry.dayIndex < 0 || entry.dayIndex >= TIMETABLE_DAYS.length || entry.period < 1 || entry.period > scenario.periodsPerDay) {
      conflicts.push(`Tiết khóa ${entry.id} nằm ngoài khung thời gian của trường.`);
      continue;
    }
    const slot = timetableSlotKey(entry.dayIndex, entry.period);
    const classKey = `${entry.classId}:${slot}`;
    const teacherKey = `${entry.teacherId}:${slot}`;
    const roomKey = entry.roomId ? `${entry.roomId}:${slot}` : '';
    if (occupiedClasses.has(classKey)) conflicts.push(`Lớp ${entry.classId} bị trùng ở ${TIMETABLE_DAYS[entry.dayIndex]} tiết ${entry.period}.`);
    if (occupiedTeachers.has(teacherKey)) conflicts.push(`Giáo viên ${entry.teacherId} bị trùng ở ${TIMETABLE_DAYS[entry.dayIndex]} tiết ${entry.period}.`);
    if (roomKey && occupiedRooms.has(roomKey)) conflicts.push(`Phòng ${entry.roomId} bị trùng ở ${TIMETABLE_DAYS[entry.dayIndex]} tiết ${entry.period}.`);
    occupiedClasses.add(classKey);
    occupiedTeachers.add(teacherKey);
    if (roomKey) occupiedRooms.add(roomKey);
  }
  return conflicts;
}

function buildCandidate(
  scenario: TimetableScenario,
  lockedEntries: ScheduleEntry[],
  seed: number,
): TimetableSolution {
  const random = mulberry32(seed);
  const entries: ScheduleEntry[] = lockedEntries.map(entry => ({ ...entry, locked: true }));
  const classBusy = new Set(entries.map(entry => `${entry.classId}:${timetableSlotKey(entry.dayIndex, entry.period)}`));
  const teacherBusy = new Set(entries.map(entry => `${entry.teacherId}:${timetableSlotKey(entry.dayIndex, entry.period)}`));
  const roomBusy = new Set(entries.filter(entry => entry.roomId).map(entry => `${entry.roomId}:${timetableSlotKey(entry.dayIndex, entry.period)}`));
  const assignmentDayCounts = new Map<string, number>();

  for (const entry of entries) {
    const key = `${entry.assignmentId}:${entry.dayIndex}`;
    assignmentDayCounts.set(key, (assignmentDayCounts.get(key) || 0) + 1);
  }

  const teacherById = new Map(scenario.teachers.map(item => [item.id, item]));
  const subjectById = new Map(scenario.subjects.map(item => [item.id, item]));
  const roomById = new Map(scenario.rooms.map(item => [item.id, item]));

  const lockedByAssignment = new Map<string, number>();
  for (const entry of entries) lockedByAssignment.set(entry.assignmentId, (lockedByAssignment.get(entry.assignmentId) || 0) + 1);

  const units: TeachingAssignment[] = [];
  for (const assignment of scenario.assignments) {
    const remaining = Math.max(0, assignment.periodsPerWeek - (lockedByAssignment.get(assignment.id) || 0));
    for (let count = 0; count < remaining; count += 1) units.push(assignment);
  }

  const scarcity = (assignment: TeachingAssignment): number => {
    const teacher = teacherById.get(assignment.teacherId);
    const unavailable = teacher?.unavailableSlots?.length || 0;
    const roomUnavailable = assignment.roomId ? roomById.get(assignment.roomId)?.unavailableSlots?.length || 0 : 0;
    return unavailable * 3 + roomUnavailable * 2 + assignment.periodsPerWeek;
  };

  const orderedUnits = shuffled(units, random).sort((a, b) => scarcity(b) - scarcity(a));
  const unscheduledCount = new Map<string, number>();
  let placementPenalty = 0;

  for (const assignment of orderedUnits) {
    const teacher = teacherById.get(assignment.teacherId);
    const subject = subjectById.get(assignment.subjectId);
    const room = assignment.roomId ? roomById.get(assignment.roomId) : undefined;
    const available: { dayIndex: number; period: number; penalty: number }[] = [];

    for (let dayIndex = 0; dayIndex < TIMETABLE_DAYS.length; dayIndex += 1) {
      const dailyKey = `${assignment.id}:${dayIndex}`;
      const dailyCount = assignmentDayCounts.get(dailyKey) || 0;
      if (dailyCount >= (assignment.maxPerDay || 1)) continue;

      for (let period = 1; period <= scenario.periodsPerDay; period += 1) {
        const slot = timetableSlotKey(dayIndex, period);
        if (classBusy.has(`${assignment.classId}:${slot}`)) continue;
        if (teacherBusy.has(`${assignment.teacherId}:${slot}`)) continue;
        if (assignment.roomId && roomBusy.has(`${assignment.roomId}:${slot}`)) continue;
        if (teacher?.unavailableSlots?.includes(slot)) continue;
        if (room?.unavailableSlots?.includes(slot)) continue;

        let penalty = 0;
        if (subject?.preferMorning && period > 4) penalty += 24 + (period - 4) * 5;
        if (assignment.avoidLastPeriod && period === scenario.periodsPerDay) penalty += 18;
        penalty += dailyCount * 12;

        const teacherPeriodsSameDay = entries
          .filter(entry => entry.teacherId === assignment.teacherId && entry.dayIndex === dayIndex)
          .map(entry => entry.period);
        if (teacherPeriodsSameDay.length > 0) {
          const min = Math.min(...teacherPeriodsSameDay);
          const max = Math.max(...teacherPeriodsSameDay);
          if (period > min && period < max) penalty -= 5;
          else if (period === min - 1 || period === max + 1) penalty -= 3;
          else penalty += 4;
        }

        const sameSubjectSameDay = entries.some(entry =>
          entry.classId === assignment.classId && entry.subjectId === assignment.subjectId && entry.dayIndex === dayIndex,
        );
        if (sameSubjectSameDay) penalty += 30;

        penalty += random() * 2;
        available.push({ dayIndex, period, penalty });
      }
    }

    available.sort((a, b) => a.penalty - b.penalty);
    const choice = available[0];
    if (!choice) {
      unscheduledCount.set(assignment.id, (unscheduledCount.get(assignment.id) || 0) + 1);
      continue;
    }

    const slot = timetableSlotKey(choice.dayIndex, choice.period);
    const entry: ScheduleEntry = {
      id: `${assignment.id}-${choice.dayIndex}-${choice.period}-${entries.length}`,
      assignmentId: assignment.id,
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      roomId: assignment.roomId,
      dayIndex: choice.dayIndex,
      period: choice.period,
    };
    entries.push(entry);
    classBusy.add(`${assignment.classId}:${slot}`);
    teacherBusy.add(`${assignment.teacherId}:${slot}`);
    if (assignment.roomId) roomBusy.add(`${assignment.roomId}:${slot}`);
    const dailyKey = `${assignment.id}:${choice.dayIndex}`;
    assignmentDayCounts.set(dailyKey, (assignmentDayCounts.get(dailyKey) || 0) + 1);
    placementPenalty += Math.max(0, choice.penalty);
  }

  const unscheduled: UnscheduledLesson[] = [...unscheduledCount.entries()].map(([assignmentId, remaining]) => ({
    assignmentId,
    remaining,
    reason: 'Không còn ô trống thỏa đồng thời giáo viên, lớp, phòng và giới hạn số tiết/ngày.',
  }));
  const teacherGaps = countTeacherGaps(entries);
  const warnings: string[] = [];
  if (teacherGaps > 0) warnings.push(`Còn ${teacherGaps} tiết trống xen kẽ trong lịch giáo viên.`);
  if (unscheduled.length > 0) warnings.push(`Còn ${unscheduled.reduce((sum, item) => sum + item.remaining, 0)} tiết chưa xếp được.`);

  const hardConflicts = validateLockedEntries(scenario, lockedEntries);
  const score = hardConflicts.length * 1_000_000 + unscheduled.reduce((sum, item) => sum + item.remaining, 0) * 100_000 + placementPenalty + teacherGaps * 12;

  return {
    entries: entries.sort((a, b) => a.dayIndex - b.dayIndex || a.period - b.period || a.classId.localeCompare(b.classId)),
    score: Math.round(score),
    diagnostics: { hardConflicts, warnings, unscheduled, teacherGaps },
    generatedAt: new Date().toISOString(),
  };
}

export function optimizeTimetable(
  scenario: TimetableScenario,
  lockedEntries: ScheduleEntry[] = [],
  iterations = 80,
): TimetableSolution {
  const safeIterations = Math.max(1, Math.min(500, Math.floor(iterations)));
  let best = buildCandidate(scenario, lockedEntries, 1);
  for (let index = 2; index <= safeIterations; index += 1) {
    const candidate = buildCandidate(scenario, lockedEntries, index * 104729);
    if (candidate.score < best.score) best = candidate;
  }
  return best;
}

export function createDefaultTimetableScenario(): TimetableScenario {
  return {
    name: 'Trường liên cấp Tiểu học & THCS',
    periodsPerDay: 7,
    teachers: [
      { id: 'gv-cn1', name: 'Cô Lan', level: 'Tiểu học' },
      { id: 'gv-cn5', name: 'Thầy Minh', level: 'Tiểu học' },
      { id: 'gv-toan', name: 'Thầy Nam', level: 'THCS' },
      { id: 'gv-van', name: 'Cô Hương', level: 'THCS' },
      { id: 'gv-tin', name: 'Thầy Tuấn', level: 'Liên cấp' },
      { id: 'gv-anh', name: 'Cô Mai', level: 'Liên cấp' },
    ],
    classes: [
      { id: '1a', name: '1A', level: 'Tiểu học' },
      { id: '3a', name: '3A', level: 'Tiểu học' },
      { id: '5a', name: '5A', level: 'Tiểu học' },
      { id: '6a', name: '6A', level: 'THCS' },
      { id: '7a', name: '7A', level: 'THCS' },
      { id: '9a', name: '9A', level: 'THCS' },
    ],
    subjects: [
      { id: 'tv', name: 'Tiếng Việt', preferMorning: true },
      { id: 'toan', name: 'Toán', preferMorning: true },
      { id: 'van', name: 'Ngữ văn', preferMorning: true },
      { id: 'tin', name: 'Tin học' },
      { id: 'anh', name: 'Tiếng Anh', preferMorning: true },
    ],
    rooms: [
      { id: 'phong-tin', name: 'Phòng Tin học' },
      { id: 'phong-ngoai-ngu', name: 'Phòng Ngoại ngữ' },
    ],
    assignments: [
      { id: 'a1', classId: '1a', subjectId: 'tv', teacherId: 'gv-cn1', periodsPerWeek: 5, maxPerDay: 1 },
      { id: 'a2', classId: '1a', subjectId: 'toan', teacherId: 'gv-cn1', periodsPerWeek: 4, maxPerDay: 1 },
      { id: 'a3', classId: '5a', subjectId: 'toan', teacherId: 'gv-cn5', periodsPerWeek: 4, maxPerDay: 1 },
      { id: 'a4', classId: '5a', subjectId: 'tin', teacherId: 'gv-tin', roomId: 'phong-tin', periodsPerWeek: 2, maxPerDay: 1 },
      { id: 'a5', classId: '5a', subjectId: 'anh', teacherId: 'gv-anh', roomId: 'phong-ngoai-ngu', periodsPerWeek: 3, maxPerDay: 1 },
      { id: 'a6', classId: '6a', subjectId: 'toan', teacherId: 'gv-toan', periodsPerWeek: 4, maxPerDay: 1 },
      { id: 'a7', classId: '6a', subjectId: 'van', teacherId: 'gv-van', periodsPerWeek: 4, maxPerDay: 1 },
      { id: 'a8', classId: '6a', subjectId: 'tin', teacherId: 'gv-tin', roomId: 'phong-tin', periodsPerWeek: 2, maxPerDay: 1 },
      { id: 'a9', classId: '7a', subjectId: 'toan', teacherId: 'gv-toan', periodsPerWeek: 4, maxPerDay: 1 },
      { id: 'a10', classId: '7a', subjectId: 'anh', teacherId: 'gv-anh', roomId: 'phong-ngoai-ngu', periodsPerWeek: 3, maxPerDay: 1 },
      { id: 'a11', classId: '9a', subjectId: 'van', teacherId: 'gv-van', periodsPerWeek: 4, maxPerDay: 1 },
      { id: 'a12', classId: '9a', subjectId: 'tin', teacherId: 'gv-tin', roomId: 'phong-tin', periodsPerWeek: 2, maxPerDay: 1 },
    ],
  };
}
