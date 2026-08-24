export type TeacherAccessRole = 'administrator' | 'teacher' | 'guest';

export interface TeacherAccessScope {
  role: TeacherAccessRole;
  ownerUid: string;
}

export interface TeacherOwnedRecord {
  authorId?: unknown;
  ownerUid?: unknown;
  teacherId?: unknown;
}

export interface PrivateStudentRosterEntry {
  id: string;
  classId?: string;
}

export interface PrivateStudentRosterSource {
  id: string;
  name: string;
  classId?: string;
}

const TEACHER_UID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidTeacherUid(value: unknown): value is string {
  return typeof value === 'string' && TEACHER_UID_PATTERN.test(value);
}

export function resolveTeacherAccessScope(
  currentUser: { id?: unknown } | 'admin' | null | undefined,
  authenticatedUid: string | null | undefined,
): TeacherAccessScope {
  if (!isValidTeacherUid(authenticatedUid)) {
    return { role: 'guest', ownerUid: '' };
  }

  if (currentUser === 'admin') {
    return { role: 'administrator', ownerUid: authenticatedUid };
  }

  if (currentUser && currentUser.id === authenticatedUid) {
    return { role: 'teacher', ownerUid: authenticatedUid };
  }

  return { role: 'guest', ownerUid: '' };
}

export function createTeacherStorageKey(
  applicationKey: string,
  ownerUid: string | null | undefined,
): string {
  if (!applicationKey || applicationKey.includes('::')) {
    throw new RangeError('Khóa lưu dữ liệu ứng dụng không hợp lệ.');
  }

  if (ownerUid && !isValidTeacherUid(ownerUid)) {
    throw new RangeError('Mã tài khoản giáo viên không hợp lệ.');
  }

  return `${applicationKey}::${ownerUid || 'guest'}`;
}

export function canAccessTeacherOwnedRecord(
  scope: TeacherAccessScope,
  record: TeacherOwnedRecord | null | undefined,
): boolean {
  if (!record) return false;
  if (scope.role === 'administrator') return true;
  if (scope.role !== 'teacher') return false;

  const declaredOwners = [record.teacherId, record.authorId, record.ownerUid]
    .filter(owner => owner !== undefined && owner !== null && owner !== '');
  return declaredOwners.length > 0 && declaredOwners
    .every(owner => isValidTeacherUid(owner) && owner === scope.ownerUid);
}

export function createPlickerReportDocumentId(ownerUid: string, reportId: string): string {
  if (!isValidTeacherUid(ownerUid) || !isValidTeacherUid(reportId)) {
    throw new RangeError('Không thể đồng bộ báo cáo do mã giáo viên hoặc phiên học không hợp lệ.');
  }

  return `plicker-report-${ownerUid}-${reportId}`;
}

export function normalizeStudentRosterName(studentName: string): string {
  return studentName.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
}

export async function createStudentRosterLookupKey(
  teacherUid: string,
  examId: string,
  studentName: string,
): Promise<string> {
  const normalizedName = normalizeStudentRosterName(studentName);
  if (!isValidTeacherUid(teacherUid) || !isValidTeacherUid(examId) || !normalizedName) {
    throw new RangeError('Không thể xác định học sinh trong kỳ thi này.');
  }

  const input = new TextEncoder().encode(`${teacherUid}:${examId}:${normalizedName}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPrivateStudentRosterDirectory(
  teacherUid: string,
  examId: string,
  students: PrivateStudentRosterSource[],
): Promise<Record<string, PrivateStudentRosterEntry>> {
  const entries = await Promise.all(students
    .filter(student => isValidTeacherUid(student.id) && Boolean(student.name?.trim()))
    .map(async student => {
      const lookupKey = await createStudentRosterLookupKey(teacherUid, examId, student.name);
      return [lookupKey, {
        id: student.id,
        ...(student.classId ? { classId: student.classId } : {}),
      }] as const;
    }));

  return Object.fromEntries(entries);
}
