import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlickerDisplayScreen, {
  calculatePlickerDisplayProgress,
  formatPlickerDisplayQuestion,
  PlickerDisplayMath,
  type PlickerDisplayQuestion,
  type PlickerDisplayResponse,
  type PlickerDisplayStudent,
} from '../src/components/PlickerDisplayScreen';
import {
  createPlickerLiveSession,
  getPlickerDisplayActivationKey,
  movePlickerLiveQuestion,
  recordPlickerLiveResponse,
} from '../src/lib/plickerLive';

let checks = 0;

assert.equal(formatPlickerDisplayQuestion('Trong các biểu thức sau, biểu thức nào là đơn thức?', 0),
  'Câu 1. Trong các biểu thức sau, biểu thức nào là đơn thức?');
assert.equal(formatPlickerDisplayQuestion('  Hai đơn thức đồng dạng là  ', 3), 'Câu 4. Hai đơn thức đồng dạng là');
assert.equal(formatPlickerDisplayQuestion('Câu 8. Câu hỏi đã đánh số', 0), 'Câu 8. Câu hỏi đã đánh số');
assert.equal(formatPlickerDisplayQuestion('Question 2: Example', 0), 'Question 2: Example');
assert.equal(formatPlickerDisplayQuestion('   ', 0), '');
assert.equal(calculatePlickerDisplayProgress(0, 0), 0);
assert.equal(calculatePlickerDisplayProgress(2, 4), 50);
assert.equal(calculatePlickerDisplayProgress(2, 3), 67);
assert.equal(calculatePlickerDisplayProgress(8, 4), 100);
assert.equal(calculatePlickerDisplayProgress(-1, 4), 0);
assert.equal(calculatePlickerDisplayProgress(Number.NaN, 4), 0);
checks += 11;

const exponent = renderToStaticMarkup(createElement(PlickerDisplayMath, { text: '-7x^2y' }));
assert.match(exponent, /-7x<sup[^>]*>2<\/sup>y/);
const multipleExponents = renderToStaticMarkup(createElement(PlickerDisplayMath, { text: 'x^2-y^{12}' }));
assert.match(multipleExponents, /x<sup[^>]*>2<\/sup>-y<sup[^>]*>12<\/sup>/);
const plainFraction = renderToStaticMarkup(createElement(PlickerDisplayMath, { text: '2/x' }));
assert.match(plainFraction, /aria-label="2 phần x"/);
const latexFraction = renderToStaticMarkup(createElement(PlickerDisplayMath, { text: '\\frac{7}{y}' }));
assert.match(latexFraction, /aria-label="7 phần y"/);
assert.equal(renderToStaticMarkup(createElement(PlickerDisplayMath, { text: '3x+5' })), '3x+5');
checks += 5;

const students: PlickerDisplayStudent[] = [
  { id: 'an', name: 'An', cardId: 1 },
  { id: 'binh', name: 'Bình', cardId: 2 },
  { id: 'chi', name: 'Chi', cardId: 3 },
  { id: 'dung', name: 'Dung', cardId: 4 },
];
const question: PlickerDisplayQuestion = {
  text: 'Trong các biểu thức sau, biểu thức nào là đơn thức?',
  options: { A: '3x+5', B: '-7x^2y', C: 'x^2-y^2', D: '2/x' },
  correctAnswer: 'B',
};
const responses: PlickerDisplayResponse[] = [
  { studentId: 'an', answer: 'B' },
  { studentId: 'binh', answer: 'A' },
  { studentId: 'chi', answer: 'B' },
];
const distribution = { A: 1, B: 2, C: 0, D: 0 };
const noop = () => {};
const props = {
  className: '8. Kim Lư',
  setTitle: 'Bộ không tên',
  question,
  questionIndex: 0,
  questionCount: 5,
  students,
  responses,
  distribution,
  phase: 'scanning' as const,
  showCorrect: false,
  showGraph: false,
  scannerConnected: true,
  connected: true,
  scannerUrl: 'https://trungtuyen.github.io/4.0/?app=plicker&role=scanner',
  onToggleCorrect: noop,
  onToggleGraph: noop,
  onClose: noop,
};

const playing = renderToStaticMarkup(createElement(PlickerDisplayScreen, props));
assert.match(playing, /MÀN HÌNH LỚP HỌC đang trình chiếu câu hỏi/);
assert.match(playing, />LIVE</);
assert.match(playing, /8\. Kim Lư/);
assert.match(playing, /Đang quét/);
assert.match(playing, /Bài đang chơi trên màn hình lớp học/);
assert.match(playing, /Câu 1\. Trong các biểu thức sau, biểu thức nào là đơn thức\?/);
assert.match(playing, /3x\+5/);
assert.match(playing, /-7x<sup[^>]*>2<\/sup>y/);
assert.match(playing, /aria-label="2 phần x"/);
assert.match(playing, /Bộ không tên/);
assert.match(playing, /3 trên 4 học sinh đã trả lời/);
assert.match(playing, /width:75%/);
assert.match(playing, /Hiện biểu đồ/);
assert.match(playing, /Tiết lộ câu trả lời/);
assert.match(playing, /Mở toàn màn hình trình chiếu/);
assert.match(playing, /Hiện danh sách học sinh/);
assert.doesNotMatch(playing, /A: 1 học sinh, 33%/);
checks += 17;

const graph = renderToStaticMarkup(createElement(PlickerDisplayScreen, {
  ...props,
  showGraph: true,
}));
assert.match(graph, /Ẩn biểu đồ/);
assert.match(graph, /A: 1 học sinh, 33%/);
assert.match(graph, /B: 2 học sinh, 67%/);
assert.match(graph, /width:33%/);
assert.match(graph, /width:67%/);
checks += 5;

const revealed = renderToStaticMarkup(createElement(PlickerDisplayScreen, {
  ...props,
  showCorrect: true,
}));
assert.match(revealed, /Ẩn câu trả lời đúng/);
assert.match(revealed, /border-\[#61b990\] bg-\[#61b990\] text-white/);
checks += 2;

const waiting = renderToStaticMarkup(createElement(PlickerDisplayScreen, {
  ...props,
  className: '',
  question: null,
  phase: null,
  connected: false,
  scannerConnected: false,
}));
assert.match(waiting, />CHỜ</);
assert.match(waiting, /Sẵn sàng nhận bài từ điện thoại/);
assert.match(waiting, /bấm bắt đầu bài hoặc quét thẻ/);
assert.match(waiting, /role=scanner/);
assert.doesNotMatch(waiting, /Bài đang chơi trên màn hình lớp học/);
checks += 5;

const set = {
  id: 'math-8',
  title: 'Bộ không tên',
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
  questions: [
    { id: 1, ...question },
    { id: 2, text: 'Câu hỏi tiếp theo', options: { A: 'Đúng', B: 'Sai' }, correctAnswer: 'A' as const },
  ],
};
const sessionStudents = students.map(student => ({ ...student, classId: 'class-8' }));
let phone = createPlickerLiveSession({
  sessionId: 'session-phone',
  ownerUid: 'teacher',
  classId: 'class-8',
  className: '8. Kim Lư',
  students: sessionStudents,
  questionSet: set,
  controllerDeviceId: 'android-phone',
  now: 10,
});
const seenActivations = new Set<string>();
const openComputerScreen = () => {
  const key = getPlickerDisplayActivationKey('display', phone, 'windows-computer');
  if (!key || seenActivations.has(key)) return false;
  seenActivations.add(key);
  return true;
};

assert.equal(openComputerScreen(), true, 'Pressing play on the phone opens the computer presentation.');
assert.equal(openComputerScreen(), false, 'Ordinary repeated snapshots do not reopen a closed presentation.');
phone = { ...phone, phase: 'scanning', updatedAt: 20 };
assert.equal(openComputerScreen(), true, 'Pressing scan on the phone opens the computer presentation.');
phone = recordPlickerLiveResponse(phone, {
  studentId: 'an', studentName: 'An', cardId: 1, answer: 'B', confidence: 0.99, timestamp: 25, source: 'camera',
});
assert.equal(openComputerScreen(), false, 'Receiving student cards updates content without repeatedly reopening the screen.');
phone = { ...phone, phase: 'results', updatedAt: 30 };
assert.equal(openComputerScreen(), false, 'Stopping the scan preserves the current presentation without reopening it.');
phone = movePlickerLiveQuestion(phone, 1, 40);
assert.equal(openComputerScreen(), true, 'Changing question on the phone opens the new question on the computer.');
phone = { ...phone, phase: 'scanning', updatedAt: 45 };
assert.equal(openComputerScreen(), true, 'Scanning the next question reopens the computer presentation.');
phone = { ...phone, phase: 'finished', updatedAt: 50 };
assert.equal(openComputerScreen(), false, 'Finished lessons do not reopen the presentation.');
assert.equal(getPlickerDisplayActivationKey('scanner', phone, 'android-phone'), null);
checks += 9;

const classroomSource = readFileSync(new URL('../src/components/PlickerClassroom.tsx', import.meta.url), 'utf8');
const displaySource = readFileSync(new URL('../src/components/PlickerDisplayScreen.tsx', import.meta.url), 'utf8');
assert.match(classroomSource, /displayedActivationKeysRef/);
assert.match(classroomSource, /getPlickerDisplayActivationKey/);
assert.match(classroomSource, /setShowProjector\(true\)/);
assert.match(classroomSource, /<PlickerDisplayScreen/);
assert.match(displaySource, /requestFullscreen/);
assert.match(displaySource, /fixed inset-0 z-50/);
assert.match(displaySource, /Học sinh đã trả lời/);
assert.match(displaySource, /formatPlickerDisplayQuestion/);
checks += 8;

console.info(`Plicker automatic phone-to-computer fullscreen: ${checks} checks passed.`);
