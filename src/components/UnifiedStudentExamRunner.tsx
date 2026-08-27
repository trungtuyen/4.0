import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, FileText, GraduationCap, ShieldCheck, X } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { buildStudentExamSchedule, canStudentEnterExam, formatExamScheduleDate, getExamScheduleState } from '../lib/examSchedule';
import {
  createExamAccessDocumentId,
  openProtectedExamAccess,
  PUBLIC_EXAM_ACCESS_COLLECTION,
  PUBLIC_EXAM_SCHEDULES_COLLECTION,
  type ProtectedExamAccess,
  type PublicExamSchedule,
} from '../lib/examPrivacy';
import { evaluateQuestion, type QuestionDefinition, type QuestionResponse } from '../lib/questionEngine';
import { isQuestionEngineExamQuestion } from '../lib/questionExamBridge';
import {
  createStudentRosterLookupKey,
  createTeacherStorageKey,
  isValidTeacherUid,
  type PrivateStudentRosterEntry,
} from '../lib/teacherIsolation';
import QuestionEngineStudentQuestion, { questionTypeLabel } from './QuestionEngineStudentQuestion';

interface LegacyMatchingPair {
  id: string;
  left: string;
  right: string;
}

interface UnifiedExamQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  type?: 'multiple_choice' | 'short_answer' | 'matching' | 'question_engine';
  correctTextAnswer?: string;
  matchingPairs?: LegacyMatchingPair[];
  shuffledRight?: { id: string; right: string }[];
  engineQuestion?: QuestionDefinition;
}

interface UnifiedExam {
  id: string;
  title: string;
  durationMinutes: number;
  questions: UnifiedExamQuestion[];
  status: 'draft' | 'published' | 'closed';
  createdAt: string;
  startTime?: string;
  teacherId?: string;
  studentDirectory?: Record<string, PrivateStudentRosterEntry>;
  accessVersionCode?: string;
  isShuffled?: boolean;
  shuffledVersions?: { code: string; questions: UnifiedExamQuestion[] }[];
}

interface StudentAccount {
  id: string;
  code: string;
  name: string;
  classId?: string;
  teacherId?: string;
  examId?: string;
}

interface UnifiedStudentExamRunnerProps {
  onBack: () => void;
}

const HEARTBEAT_MS = 60_000;

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

function engineQuestionForExam(question: UnifiedExamQuestion): QuestionDefinition | null {
  if (!isQuestionEngineExamQuestion(question) || !question.engineQuestion) return null;
  return {
    ...question.engineQuestion,
    id: question.id,
    prompt: question.text || question.engineQuestion.prompt,
  };
}

function legacyQuestionIsCorrect(question: UnifiedExamQuestion, answer: unknown): boolean {
  if (question.type === 'short_answer') {
    const actual = String(answer ?? '').trim().toLocaleLowerCase('vi-VN');
    const expected = String(question.correctTextAnswer || '').trim().toLocaleLowerCase('vi-VN');
    return Boolean(expected) && actual === expected;
  }
  if (question.type === 'matching') {
    const values = answer && typeof answer === 'object' ? answer as Record<string, string> : {};
    return Boolean(question.matchingPairs?.length) && question.matchingPairs!.every(pair => values[pair.id] === pair.id);
  }
  return answer === question.correctAnswer;
}

export default function UnifiedStudentExamRunner({ onBack }: UnifiedStudentExamRunnerProps) {
  const [studentName, setStudentName] = useState('');
  const [examCode, setExamCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [schedule, setSchedule] = useState<PublicExamSchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<UnifiedExam | null>(() => {
    try {
      const saved = sessionStorage.getItem('activeExam');
      return saved ? JSON.parse(saved) as UnifiedExam : null;
    } catch {
      return null;
    }
  });
  const [currentStudent, setCurrentStudent] = useState<StudentAccount | null>(() => {
    try {
      const saved = sessionStorage.getItem('currentStudent');
      return saved ? JSON.parse(saved) as StudentAccount : null;
    } catch {
      return null;
    }
  });
  const [examVersion, setExamVersion] = useState(() => sessionStorage.getItem('examVersion') || 'Gốc');
  const [status, setStatus] = useState<'login' | 'waiting' | 'taking' | 'finished'>(() => activeExam && currentStudent ? 'waiting' : 'login');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [cheatEvents, setCheatEvents] = useState({ rightClicks: 0, tabChanges: 0, windowResizes: 0 });
  const [cheatWarning, setCheatWarning] = useState('');
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'login') return;
    setScheduleLoading(true);
    const published = query(collection(db, PUBLIC_EXAM_SCHEDULES_COLLECTION), where('status', '==', 'published'));
    return onSnapshot(published, snapshot => {
      setSchedule(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as PublicExamSchedule)));
      setScheduleLoading(false);
    }, error => {
      console.error('Không thể tải lịch thi công khai:', error);
      setSchedule([]);
      setScheduleLoading(false);
    });
  }, [status]);

  useEffect(() => {
    if (status !== 'login') return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [status]);

  const visibleSchedule = useMemo(() => buildStudentExamSchedule(schedule, now), [schedule, now]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError('');
    const normalizedName = studentName.trim();
    const normalizedCode = examCode.trim();
    if (!normalizedName || !normalizedCode) {
      setLoginError('Vui lòng nhập đầy đủ họ tên và mã kỳ thi.');
      return;
    }

    try {
      const accessId = await createExamAccessDocumentId(normalizedCode);
      const encrypted = await getDoc(doc(db, PUBLIC_EXAM_ACCESS_COLLECTION, accessId));
      if (!encrypted.exists()) {
        setLoginError('Mã kỳ thi không hợp lệ hoặc bài kiểm tra chưa được giao.');
        return;
      }

      const exam = await openProtectedExamAccess<UnifiedExam>(encrypted.data() as ProtectedExamAccess, normalizedCode);
      if (!canStudentEnterExam(exam)) {
        setLoginError(`Bài kiểm tra chưa đến giờ mở. Thời gian dự kiến: ${formatExamScheduleDate(exam.startTime)}.`);
        return;
      }

      let selectedExam: UnifiedExam = { ...exam };
      let selectedVersion = exam.accessVersionCode || 'Gốc';
      if (exam.isShuffled && exam.shuffledVersions?.length && selectedVersion === 'Gốc') {
        const version = exam.shuffledVersions[Math.floor(Math.random() * exam.shuffledVersions.length)];
        selectedExam = { ...exam, questions: version.questions };
        selectedVersion = version.code;
      }

      selectedExam.questions = selectedExam.questions.map(question => {
        if (question.type === 'matching' && question.matchingPairs) {
          return {
            ...question,
            shuffledRight: [...question.matchingPairs]
              .map(pair => ({ id: pair.id, right: pair.right }))
              .sort(() => Math.random() - 0.5),
          };
        }
        return question;
      });

      if (!isValidTeacherUid(exam.teacherId)) {
        setLoginError('Bài kiểm tra chưa được gắn với tài khoản giáo viên hợp lệ.');
        return;
      }

      const lookupKey = await createStudentRosterLookupKey(exam.teacherId, exam.id, normalizedName);
      const roster = exam.studentDirectory?.[lookupKey];
      let student: StudentAccount | undefined = roster ? {
        id: roster.id,
        code: '',
        name: normalizedName,
        ...(roster.classId ? { classId: roster.classId } : {}),
        teacherId: exam.teacherId,
      } : undefined;

      if (!student) {
        student = {
          id: Math.random().toString(36).slice(2, 11),
          code: Math.floor(100000 + Math.random() * 900000).toString(),
          name: normalizedName,
          teacherId: exam.teacherId,
          examId: exam.id,
        };
        await setDoc(doc(db, 'students', student.id), student);
      }

      const submittedKey = createTeacherStorageKey(`submitted_exam_${student.id}_${exam.id}`, exam.teacherId);
      if (sessionStorage.getItem(submittedKey) === '1') {
        setLoginError('Em đã hoàn thành bài kiểm tra này rồi.');
        return;
      }

      setCurrentStudent(student);
      setActiveExam(selectedExam);
      setExamVersion(selectedVersion);
      setStatus('waiting');
      sessionStorage.setItem('currentStudent', JSON.stringify(student));
      sessionStorage.setItem('activeExam', JSON.stringify(selectedExam));
      sessionStorage.setItem('examVersion', selectedVersion);
    } catch (error) {
      console.error('Không thể mở bài kiểm tra:', error);
      setLoginError('Không thể mở bài kiểm tra. Hãy kiểm tra mã và kết nối mạng.');
    }
  };

  const startExam = async () => {
    if (!activeExam || !currentStudent) return;
    setAnswers({});
    setTimeRemaining(activeExam.durationMinutes * 60);
    setStatus('taking');
    const sessionId = `${currentStudent.id}_${activeExam.id}`;
    try {
      await setDoc(doc(db, 'exam_sessions', sessionId), {
        id: sessionId,
        examId: activeExam.id,
        studentId: currentStudent.id,
        startTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        status: 'taking',
        teacherId: activeExam.teacherId || '',
        examVersion,
      });
    } catch (error) {
      console.error('Không thể tạo phiên làm bài:', error);
      setLoginError('Không thể bắt đầu bài kiểm tra. Hãy thử lại.');
      setStatus('waiting');
    }
  };

  useEffect(() => {
    if (status !== 'taking' || timeRemaining === null) return;
    if (timeRemaining <= 0) {
      setAutoSubmitted(true);
      void submitExam();
      return;
    }
    const timer = window.setTimeout(() => setTimeRemaining(value => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [status, timeRemaining]);

  useEffect(() => {
    if (status !== 'taking' || !currentStudent || !activeExam) return;
    const timer = window.setInterval(() => {
      const sessionId = `${currentStudent.id}_${activeExam.id}`;
      void setDoc(doc(db, 'exam_sessions', sessionId), { lastActive: new Date().toISOString() }, { merge: true });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [status, currentStudent, activeExam]);

  useEffect(() => {
    if (status !== 'taking') return;
    const onContext = (event: MouseEvent) => {
      event.preventDefault();
      setCheatEvents(previous => ({ ...previous, rightClicks: previous.rightClicks + 1 }));
      setCheatWarning('Không được sử dụng chuột phải trong khi làm bài.');
    };
    const onVisibility = () => {
      if (!document.hidden) return;
      setCheatEvents(previous => ({ ...previous, tabChanges: previous.tabChanges + 1 }));
      setCheatWarning('Không được chuyển tab hoặc ẩn cửa sổ khi đang làm bài.');
    };
    const onResize = () => setCheatEvents(previous => ({ ...previous, windowResizes: previous.windowResizes + 1 }));
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
  }, [status]);

  const submitExam = async () => {
    if (!activeExam || !currentStudent || status !== 'taking') return;
    let correct = 0;
    for (const question of activeExam.questions) {
      const engine = engineQuestionForExam(question);
      if (engine) {
        const evaluation = evaluateQuestion(engine, answers[question.id] as QuestionResponse);
        if (evaluation.correct) correct += 1;
      } else if (legacyQuestionIsCorrect(question, answers[question.id])) {
        correct += 1;
      }
    }

    const resultId = `${currentStudent.id}_${activeExam.id}`;
    try {
      await setDoc(doc(db, 'results', resultId), {
        id: resultId,
        examId: activeExam.id,
        studentId: currentStudent.id,
        score: correct,
        totalQuestions: activeExam.questions.length,
        submittedAt: new Date().toISOString(),
        answers,
        cheatEvents,
        examVersion,
        teacherId: activeExam.teacherId || '',
      });
      await setDoc(doc(db, 'exam_sessions', resultId), { status: 'submitted', lastActive: new Date().toISOString() }, { merge: true });
      sessionStorage.setItem(createTeacherStorageKey(`submitted_exam_${currentStudent.id}_${activeExam.id}`, activeExam.teacherId), '1');
      setScore({ correct, total: activeExam.questions.length });
      setStatus('finished');
    } catch (error) {
      console.error('Không thể nộp bài:', error);
      setLoginError('Không thể nộp bài. Vui lòng kiểm tra kết nối và thử lại.');
    }
  };

  const reset = () => {
    setCurrentStudent(null);
    setActiveExam(null);
    setExamVersion('Gốc');
    setAnswers({});
    setScore(null);
    setStatus('login');
    setAutoSubmitted(false);
    sessionStorage.removeItem('currentStudent');
    sessionStorage.removeItem('activeExam');
    sessionStorage.removeItem('examVersion');
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          {status === 'login' && <button type="button" onClick={onBack} className="rounded-full p-2 text-slate-600 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><GraduationCap className="h-6 w-6" /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Lớp Học Thông Minh 4.0</p>
            <h1 className="text-base font-bold md:text-xl">Cổng làm bài học sinh</h1>
          </div>
        </div>
        {currentStudent && <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 sm:inline">{currentStudent.name}</span>}
      </header>

      {status === 'login' && (
        <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-4 lg:grid-cols-[420px_1fr] lg:p-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShieldCheck className="h-6 w-6" /></div>
              <div><h2 className="text-xl font-bold">Vào bài kiểm tra</h2><p className="text-sm text-slate-500">Nhập họ tên và mã giáo viên cung cấp.</p></div>
            </div>
            <form onSubmit={login} className="space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Họ và tên học sinh</span><input value={studentName} onChange={event => setStudentName(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Nguyễn Văn An" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Mã bài kiểm tra / kỳ thi</span><input value={examCode} onChange={event => setExamCode(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-lg tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="12 chữ số" /></label>
              {loginError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loginError}</div>}
              <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700">Mở bài kiểm tra</button>
            </form>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Thông báo lịch thi</p><h2 className="text-xl font-bold text-slate-900">Bài đang mở và sắp diễn ra</h2></div><FileText className="h-7 w-7 text-blue-500" /></div>
            {scheduleLoading ? <p className="text-sm text-slate-500">Đang tải lịch...</p> : visibleSchedule.length ? (
              <div className="space-y-3">
                {visibleSchedule.map(item => {
                  const upcoming = getExamScheduleState(item, now) === 'upcoming';
                  return <article key={item.id} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-800">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{formatExamScheduleDate(item.startTime)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${upcoming ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{upcoming ? 'Sắp diễn ra' : 'Đang mở'}</span></div><div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{item.durationMinutes} phút</span><span>{item.questionCount} câu</span></div></article>;
                })}
              </div>
            ) : <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500">Hiện chưa có bài kiểm tra nào được giáo viên mở.</p>}
            <p className="mt-5 border-t border-blue-100 pt-4 text-xs leading-5 text-slate-500">Danh sách được cập nhật tự động từ mục Tạo kỳ thi của giáo viên. Mã đăng nhập vẫn được giáo viên cung cấp riêng.</p>
          </section>
        </main>
      )}

      {status === 'waiting' && activeExam && (
        <main className="flex flex-1 items-center justify-center p-4"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600"><FileText className="h-10 w-10" /></div><h2 className="text-2xl font-bold">{activeExam.title}</h2><div className="my-6 flex justify-center gap-6 text-sm text-slate-600"><span>{activeExam.durationMinutes} phút</span><span>{activeExam.questions.length} câu</span></div><button type="button" onClick={startExam} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-lg font-bold text-white hover:bg-emerald-600">Bắt đầu làm bài</button>{loginError && <p className="mt-3 text-sm text-red-600">{loginError}</p>}</section></main>
      )}

      {status === 'taking' && activeExam && (
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4 md:p-6">
          <div className="sticky top-[65px] z-20 mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><h2 className="font-bold text-slate-800">{activeExam.title}</h2><p className="text-xs text-slate-500">Đã trả lời {Object.keys(answers).length}/{activeExam.questions.length} câu</p></div><div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xl font-bold ${timeRemaining !== null && timeRemaining < 300 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-700'}`}><Clock className="h-5 w-5" />{timeRemaining !== null ? formatTime(timeRemaining) : '00:00'}</div></div>
          <div className="space-y-5 pb-28">
            {activeExam.questions.map((question, index) => {
              const engine = engineQuestionForExam(question);
              return (
                <section key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">Câu {index + 1}</span>{engine && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{questionTypeLabel(engine)}</span>}</div>
                  <div className="mb-5 text-base font-medium leading-7 text-slate-800" dangerouslySetInnerHTML={{ __html: question.text }} />
                  {engine ? (
                    <QuestionEngineStudentQuestion question={engine} answer={answers[question.id] as QuestionResponse} onChange={value => setAnswers(previous => ({ ...previous, [question.id]: value }))} />
                  ) : question.type === 'short_answer' ? (
                    <input value={String(answers[question.id] ?? '')} onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Nhập câu trả lời..." />
                  ) : question.type === 'matching' ? (
                    <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><h4 className="font-semibold text-slate-700">Cột A</h4>{question.matchingPairs?.map((pair, pairIndex) => <div key={pair.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><b className="mr-2 text-blue-600">{pairIndex + 1}.</b>{pair.left}</div>)}</div><div className="space-y-2"><h4 className="font-semibold text-slate-700">Cột B</h4>{(question.shuffledRight || question.matchingPairs || []).map(item => { const current = answers[question.id] && typeof answers[question.id] === 'object' ? answers[question.id] as Record<string, string> : {}; return <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><select value={current[item.id] || ''} onChange={event => setAnswers(previous => ({ ...previous, [question.id]: { ...(current || {}), [item.id]: event.target.value } }))} className="rounded border border-slate-300 px-2 py-1"><option value="">-</option>{question.matchingPairs?.map((pair, idx) => <option key={pair.id} value={pair.id}>{idx + 1}</option>)}</select><span>{item.right}</span></div>; })}</div></div>
                  ) : (
                    <div className="space-y-3">{question.options.map((option, optionIndex) => <label key={optionIndex} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${answers[question.id] === optionIndex ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}><input type="radio" checked={answers[question.id] === optionIndex} onChange={() => setAnswers(previous => ({ ...previous, [question.id]: optionIndex }))} className="mt-0.5 h-5 w-5 text-blue-600" /><span dangerouslySetInnerHTML={{ __html: option }} /></label>)}</div>
                  )}
                </section>
              );
            })}
          </div>
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 p-4 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center justify-between"><span className="text-sm text-slate-500">Hãy kiểm tra các câu trước khi nộp.</span><button type="button" onClick={() => setShowSubmitConfirm(true)} className="rounded-xl bg-blue-600 px-7 py-3 font-bold text-white hover:bg-blue-700">Nộp bài</button></div></div>
        </main>
      )}

      {status === 'finished' && score && (
        <main className="flex flex-1 items-center justify-center p-4"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle className="h-12 w-12" /></div><h2 className="text-3xl font-bold">Hoàn thành!</h2><p className="mt-2 text-slate-500">{autoSubmitted ? 'Đã hết thời gian và hệ thống tự động nộp bài.' : 'Bài làm đã được ghi nhận thành công.'}</p><div className="my-7 rounded-2xl bg-slate-50 p-6"><div className="text-sm text-slate-500">Kết quả</div><div className="mt-1 text-5xl font-black text-blue-600">{Math.round((score.correct / score.total) * 100) / 10}<span className="text-2xl font-medium text-slate-400"> / 10</span></div><div className="mt-2 text-sm text-slate-500">{score.correct}/{score.total} câu đúng</div></div><button type="button" onClick={reset} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-black">Về cổng học sinh</button></section></main>
      )}

      {showSubmitConfirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"><h3 className="text-xl font-bold">Xác nhận nộp bài</h3><p className="my-4 text-sm text-slate-500">Sau khi nộp, em không thể thay đổi đáp án.</p><div className="flex justify-center gap-3"><button type="button" onClick={() => setShowSubmitConfirm(false)} className="rounded-lg px-5 py-2 text-slate-600 hover:bg-slate-100">Hủy</button><button type="button" onClick={() => { setShowSubmitConfirm(false); void submitExam(); }} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white">Nộp bài</button></div></div></div>}
      {cheatWarning && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-red-900/40 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border-2 border-red-400 bg-white p-6 text-center shadow-xl"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600"><X className="h-7 w-7" /></div><h3 className="text-lg font-bold">Cảnh báo</h3><p className="my-3 text-sm text-slate-600">{cheatWarning}</p><button type="button" onClick={() => setCheatWarning('')} className="w-full rounded-xl bg-red-600 px-4 py-2.5 font-bold text-white">Tôi đã hiểu</button></div></div>}
    </div>
  );
}
