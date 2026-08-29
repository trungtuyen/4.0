import assert from 'node:assert/strict';
import {
  createDefaultTimetableScenario,
  optimizeTimetable,
  timetableSlotKey,
} from '../src/lib/smartTimetable';

const scenario = createDefaultTimetableScenario();
const first = optimizeTimetable(scenario, [], 120);

assert.equal(
  first.diagnostics.unscheduled.reduce((sum, item) => sum + item.remaining, 0),
  0,
  'The linked-school sample should schedule every required lesson.',
);
assert.equal(first.diagnostics.hardConflicts.length, 0, 'The generated timetable must not contain hard conflicts.');

const classSlots = new Set<string>();
const teacherSlots = new Set<string>();
const roomSlots = new Set<string>();
for (const entry of first.entries) {
  const slot = timetableSlotKey(entry.dayIndex, entry.period);
  const classKey = `${entry.classId}:${slot}`;
  const teacherKey = `${entry.teacherId}:${slot}`;
  assert.ok(!classSlots.has(classKey), `Class collision at ${classKey}`);
  assert.ok(!teacherSlots.has(teacherKey), `Teacher collision at ${teacherKey}`);
  classSlots.add(classKey);
  teacherSlots.add(teacherKey);
  if (entry.roomId) {
    const roomKey = `${entry.roomId}:${slot}`;
    assert.ok(!roomSlots.has(roomKey), `Room collision at ${roomKey}`);
    roomSlots.add(roomKey);
  }
}

const locked = { ...first.entries[0], locked: true };
const second = optimizeTimetable(scenario, [locked], 80);
assert.ok(
  second.entries.some(entry =>
    entry.assignmentId === locked.assignmentId &&
    entry.classId === locked.classId &&
    entry.teacherId === locked.teacherId &&
    entry.dayIndex === locked.dayIndex &&
    entry.period === locked.period &&
    entry.locked === true,
  ),
  'A locked lesson must remain fixed after re-optimization.',
);

const constrainedScenario = createDefaultTimetableScenario();
const blockedTeacher = constrainedScenario.teachers.find(teacher => teacher.id === 'gv-tin');
assert.ok(blockedTeacher, 'Sample ICT teacher should exist.');
blockedTeacher.unavailableSlots = ['0:1', '0:2', '0:3'];
const constrained = optimizeTimetable(constrainedScenario, [], 120);
for (const entry of constrained.entries.filter(item => item.teacherId === 'gv-tin')) {
  assert.ok(!blockedTeacher.unavailableSlots.includes(timetableSlotKey(entry.dayIndex, entry.period)), 'Teacher must never be scheduled in an unavailable slot.');
}

console.info(`Smart timetable: ${first.entries.length} periods scheduled, score ${first.score}.`);
