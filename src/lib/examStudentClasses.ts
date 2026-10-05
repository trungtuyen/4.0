import { isValidTeacherUid } from './teacherIsolation';

export function getExamStudentClasses(exam: { classNames?: Record<string, string> }): { id: string; name: string }[] {
  return Object.entries(exam.classNames || {})
    .filter(([id, name]) => isValidTeacherUid(id) && typeof name === 'string' && Boolean(name.trim()))
    .map(([id, name]) => ({ id, name: name.trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
}
