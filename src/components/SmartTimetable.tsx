import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Download,
  GraduationCap,
  Lock,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  WandSparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  TIMETABLE_DAYS,
  createDefaultTimetableScenario,
  optimizeTimetable,
  timetableSlotKey,
  type ScheduleEntry,
  type TeachingAssignment,
  type TimetableScenario,
  type TimetableSolution,
} from '../lib/smartTimetable';

interface SmartTimetableProps {
  onBack: () => void;
  storageKey: string;
  trialMode?: boolean;
}

type WorkspaceTab = 'overview' | 'assignments' | 'constraints' | 'schedule' | 'diagnostics';

interface PersistedWorkspace {
  scenario: TimetableScenario;
  solution: TimetableSolution | null;
  versions: TimetableSolution[];
}

function readWorkspace(storageKey: string): PersistedWorkspace {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null') as PersistedWorkspace | null;
    if (parsed?.scenario?.teachers && parsed?.scenario?.classes && parsed?.scenario?.assignments) {
      return {
        scenario: parsed.scenario,
        solution: parsed.solution || null,
        versions: Array.isArray(parsed.versions) ? parsed.versions.slice(0, 5) : [],
      };
    }
  } catch {
    // Fall back to the linked-school sample.
  }
  return { scenario: createDefaultTimetableScenario(), solution: null, versions: [] };
}

function classNameForEntry(entry: ScheduleEntry, scenario: TimetableScenario): string {
  const classroom = scenario.classes.find(item => item.id === entry.classId);
  return classroom?.level === 'Tiểu học' ? 'border-emerald-200 bg-emerald-50' : 'border-indigo-200 bg-indigo-50';
}

export default function SmartTimetable({ onBack, storageKey, trialMode = false }: SmartTimetableProps) {
  const initial = useMemo(() => readWorkspace(storageKey), [storageKey]);
  const [scenario, setScenario] = useState<TimetableScenario>(initial.scenario);
  const [solution, setSolution] = useState<TimetableSolution | null>(initial.solution);
  const [versions, setVersions] = useState<TimetableSolution[]>(initial.versions);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [selectedClassId, setSelectedClassId] = useState(initial.scenario.classes[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [constraintTeacherId, setConstraintTeacherId] = useState(initial.scenario.teachers[0]?.id || '');
  const [constraintDay, setConstraintDay] = useState(0);
  const [constraintPeriod, setConstraintPeriod] = useState(1);
  const [draft, setDraft] = useState<Partial<TeachingAssignment>>({
    classId: initial.scenario.classes[0]?.id,
    subjectId: initial.scenario.subjects[0]?.id,
    teacherId: initial.scenario.teachers[0]?.id,
    periodsPerWeek: 2,
    maxPerDay: 1,
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ scenario, solution, versions } satisfies PersistedWorkspace));
    } catch {
      // The workspace still works when browser storage is unavailable.
    }
  }, [scenario, solution, storageKey, versions]);

  useEffect(() => {
    if (!scenario.classes.some(item => item.id === selectedClassId)) {
      setSelectedClassId(scenario.classes[0]?.id || '');
    }
  }, [scenario.classes, selectedClassId]);

  const totalRequiredPeriods = useMemo(
    () => scenario.assignments.reduce((sum, item) => sum + item.periodsPerWeek, 0),
    [scenario.assignments],
  );
  const scheduledPeriods = solution?.entries.length || 0;
  const unscheduledPeriods = solution?.diagnostics.unscheduled.reduce((sum, item) => sum + item.remaining, 0) || 0;
  const lockedEntries = solution?.entries.filter(item => item.locked) || [];
  const selectedClass = scenario.classes.find(item => item.id === selectedClassId);

  const lookup = useMemo(() => ({
    teachers: new Map(scenario.teachers.map(item => [item.id, item])),
    subjects: new Map(scenario.subjects.map(item => [item.id, item])),
    rooms: new Map(scenario.rooms.map(item => [item.id, item])),
    assignments: new Map(scenario.assignments.map(item => [item.id, item])),
  }), [scenario]);

  const runOptimizer = () => {
    setBusy(true);
    window.setTimeout(() => {
      const next = optimizeTimetable(scenario, lockedEntries, trialMode ? 45 : 140);
      setSolution(next);
      setVersions(previous => [next, ...previous].slice(0, 5));
      setBusy(false);
      setActiveTab('schedule');
    }, 20);
  };

  const toggleEntryLock = (entryId: string) => {
    setSolution(previous => previous ? {
      ...previous,
      entries: previous.entries.map(entry => entry.id === entryId ? { ...entry, locked: !entry.locked } : entry),
    } : previous);
  };

  const addAssignment = () => {
    if (!draft.classId || !draft.subjectId || !draft.teacherId || !draft.periodsPerWeek) return;
    const item: TeachingAssignment = {
      id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      classId: draft.classId,
      subjectId: draft.subjectId,
      teacherId: draft.teacherId,
      ...(draft.roomId ? { roomId: draft.roomId } : {}),
      periodsPerWeek: Math.max(1, Number(draft.periodsPerWeek)),
      maxPerDay: Math.max(1, Number(draft.maxPerDay || 1)),
      avoidLastPeriod: Boolean(draft.avoidLastPeriod),
    };
    setScenario(previous => ({ ...previous, assignments: [...previous.assignments, item] }));
    setSolution(null);
  };

  const addTeacherUnavailableSlot = () => {
    if (!constraintTeacherId) return;
    const slot = timetableSlotKey(constraintDay, constraintPeriod);
    setScenario(previous => ({
      ...previous,
      teachers: previous.teachers.map(teacher => teacher.id === constraintTeacherId
        ? { ...teacher, unavailableSlots: [...new Set([...(teacher.unavailableSlots || []), slot])] }
        : teacher),
    }));
    setSolution(null);
  };

  const removeTeacherUnavailableSlot = (teacherId: string, slot: string) => {
    setScenario(previous => ({
      ...previous,
      teachers: previous.teachers.map(teacher => teacher.id === teacherId
        ? { ...teacher, unavailableSlots: (teacher.unavailableSlots || []).filter(item => item !== slot) }
        : teacher),
    }));
    setSolution(null);
  };

  const resetWorkspace = () => {
    const nextScenario = createDefaultTimetableScenario();
    setScenario(nextScenario);
    setSelectedClassId(nextScenario.classes[0]?.id || '');
    setConstraintTeacherId(nextScenario.teachers[0]?.id || '');
    setSolution(null);
    setVersions([]);
    setActiveTab('overview');
  };

  const exportExcel = () => {
    if (!solution) return;
    const workbook = XLSX.utils.book_new();
    for (const classroom of scenario.classes) {
      const rows: (string | number)[][] = [['Tiết', ...TIMETABLE_DAYS]];
      for (let period = 1; period <= scenario.periodsPerDay; period += 1) {
        const row: (string | number)[] = [period];
        for (let dayIndex = 0; dayIndex < TIMETABLE_DAYS.length; dayIndex += 1) {
          const entry = solution.entries.find(item => item.classId === classroom.id && item.dayIndex === dayIndex && item.period === period);
          if (!entry) {
            row.push('');
            continue;
          }
          const subject = lookup.subjects.get(entry.subjectId)?.name || entry.subjectId;
          const teacher = lookup.teachers.get(entry.teacherId)?.name || entry.teacherId;
          const room = entry.roomId ? lookup.rooms.get(entry.roomId)?.name || entry.roomId : '';
          row.push([subject, teacher, room].filter(Boolean).join(' - '));
        }
        rows.push(row);
      }
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = [{ wch: 8 }, ...TIMETABLE_DAYS.map(() => ({ wch: 28 }))];
      XLSX.utils.book_append_sheet(workbook, sheet, classroom.name.slice(0, 31));
    }
    XLSX.writeFile(workbook, `Thoi-khoa-bieu-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'assignments', label: 'Phân công' },
    { id: 'constraints', label: 'Ràng buộc' },
    { id: 'schedule', label: 'Thời khóa biểu' },
    { id: 'diagnostics', label: 'Chẩn đoán' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onBack} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Quay lại"><ArrowLeft className="h-5 w-5" /></button>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white"><CalendarRange className="h-6 w-6" /></div>
            <div className="min-w-0"><h1 className="truncate text-lg font-extrabold md:text-xl">Xếp thời khóa biểu thông minh</h1><p className="truncate text-xs text-slate-500">Liên cấp Tiểu học + THCS · Constraint scheduling</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportExcel} disabled={!solution} className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:flex"><Download className="h-4 w-4" />Excel</button>
            <button type="button" onClick={runOptimizer} disabled={busy || scenario.assignments.length === 0} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"><WandSparkles className="h-4 w-4" />{busy ? 'Đang tối ưu...' : 'Xếp tự động'}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
        <div className="mb-5 overflow-x-auto"><div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2">{tabs.map(tab => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{tab.label}</button>)}</div></div>

        {activeTab === 'overview' && (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Lớp học', scenario.classes.length, GraduationCap],
                ['Giáo viên', scenario.teachers.length, Users],
                ['Tiết yêu cầu', totalRequiredPeriods, CalendarRange],
                ['Đã xếp', scheduledPeriods, CheckCircle2],
              ].map(([label, value, Icon]) => {
                const CardIcon = Icon as typeof GraduationCap;
                return <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><CardIcon className="h-5 w-5" /></div><div className="text-3xl font-extrabold">{String(value)}</div><div className="mt-1 text-sm text-slate-500">{String(label)}</div></div>;
              })}
            </section>
            <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Mô hình liên cấp</p><h2 className="mt-1 text-2xl font-extrabold">{scenario.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Một bộ máy xếp dùng chung giáo viên, lớp và phòng học của cả hai cấp để ngăn trùng giờ xuyên cấp.</p></div><Sparkles className="h-7 w-7 text-amber-500" /></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-emerald-50 p-4"><div className="font-bold text-emerald-800">Tiểu học</div><div className="mt-1 text-sm text-emerald-700">{scenario.classes.filter(item => item.level === 'Tiểu học').map(item => item.name).join(', ') || 'Chưa có lớp'}</div></div><div className="rounded-2xl bg-indigo-50 p-4"><div className="font-bold text-indigo-800">THCS</div><div className="mt-1 text-sm text-indigo-700">{scenario.classes.filter(item => item.level === 'THCS').map(item => item.name).join(', ') || 'Chưa có lớp'}</div></div></div></div>
              <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white md:p-7"><h3 className="text-lg font-bold">Trạng thái bộ giải</h3><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-400">Tiết khóa cứng</span><b>{lockedEntries.length}</b></div><div className="flex justify-between"><span className="text-slate-400">Tiết chưa xếp</span><b className={unscheduledPeriods ? 'text-amber-300' : 'text-emerald-300'}>{unscheduledPeriods}</b></div><div className="flex justify-between"><span className="text-slate-400">Điểm phạt</span><b>{solution?.score ?? '—'}</b></div><div className="flex justify-between"><span className="text-slate-400">Khoảng trống GV</span><b>{solution?.diagnostics.teacherGaps ?? '—'}</b></div></div><button type="button" onClick={runOptimizer} className="mt-6 w-full rounded-xl bg-white px-4 py-3 font-bold text-slate-900 hover:bg-indigo-50">Tạo phương án tối ưu</button></div>
            </section>
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setActiveTab('assignments')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Chỉnh phân công</button><button type="button" onClick={() => setActiveTab('constraints')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Đặt giờ bận giáo viên</button><button type="button" onClick={resetWorkspace} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"><RefreshCcw className="h-4 w-4" />Khôi phục dữ liệu mẫu</button></div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-extrabold">Thêm phân công</h2><p className="mt-1 text-sm text-slate-500">Mỗi dòng là một yêu cầu số tiết/tuần.</p><div className="mt-5 space-y-3"><select value={draft.classId || ''} onChange={event => setDraft(previous => ({ ...previous, classId: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{scenario.classes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.level}</option>)}</select><select value={draft.subjectId || ''} onChange={event => setDraft(previous => ({ ...previous, subjectId: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{scenario.subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={draft.teacherId || ''} onChange={event => setDraft(previous => ({ ...previous, teacherId: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{scenario.teachers.map(item => <option key={item.id} value={item.id}>{item.name} · {item.level}</option>)}</select><select value={draft.roomId || ''} onChange={event => setDraft(previous => ({ ...previous, roomId: event.target.value || undefined }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Phòng học thường / không khóa phòng</option>{scenario.rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Tiết/tuần<input type="number" min={1} max={15} value={draft.periodsPerWeek || 1} onChange={event => setDraft(previous => ({ ...previous, periodsPerWeek: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Tối đa/ngày<input type="number" min={1} max={5} value={draft.maxPerDay || 1} onChange={event => setDraft(previous => ({ ...previous, maxPerDay: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label></div><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={Boolean(draft.avoidLastPeriod)} onChange={event => setDraft(previous => ({ ...previous, avoidLastPeriod: event.target.checked }))} />Hạn chế tiết cuối</label><button type="button" onClick={addAssignment} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" />Thêm phân công</button></div></section>
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-extrabold">Danh sách phân công</h2><p className="text-sm text-slate-500">{scenario.assignments.length} yêu cầu · {totalRequiredPeriods} tiết/tuần</p></div><div className="divide-y divide-slate-100">{scenario.assignments.map(item => <div key={item.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><div className="font-bold text-slate-800">{scenario.classes.find(value => value.id === item.classId)?.name} · {lookup.subjects.get(item.subjectId)?.name}</div><div className="mt-1 text-xs text-slate-500">{lookup.teachers.get(item.teacherId)?.name} · {item.roomId ? lookup.rooms.get(item.roomId)?.name : 'Phòng thường'} · {item.periodsPerWeek} tiết/tuần</div></div><button type="button" onClick={() => { setScenario(previous => ({ ...previous, assignments: previous.assignments.filter(value => value.id !== item.id) })); setSolution(null); }} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Xóa"><Trash2 className="h-4 w-4" /></button></div>)}</div></section>
          </div>
        )}

        {activeTab === 'constraints' && (
          <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-extrabold">Giáo viên bận / không thể dạy</h2><p className="mt-1 text-sm leading-6 text-slate-500">Đây là ràng buộc cứng: bộ giải tuyệt đối không xếp giáo viên vào ô đã đánh dấu.</p><div className="mt-5 space-y-3"><select value={constraintTeacherId} onChange={event => setConstraintTeacherId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{scenario.teachers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><select value={constraintDay} onChange={event => setConstraintDay(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{TIMETABLE_DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select><select value={constraintPeriod} onChange={event => setConstraintPeriod(Number(event.target.value))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{Array.from({ length: scenario.periodsPerDay }, (_, index) => index + 1).map(period => <option key={period} value={period}>Tiết {period}</option>)}</select></div><button type="button" onClick={addTeacherUnavailableSlot} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800">Khóa thời gian này</button></div></section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-extrabold">Ràng buộc đang áp dụng</h2><div className="mt-4 space-y-4">{scenario.teachers.map(teacher => <div key={teacher.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="font-bold">{teacher.name} <span className="text-xs font-medium text-slate-400">· {teacher.level}</span></div><div className="mt-3 flex flex-wrap gap-2">{(teacher.unavailableSlots || []).length === 0 ? <span className="text-sm text-slate-400">Chưa có giờ bận.</span> : (teacher.unavailableSlots || []).map(slot => { const [day, period] = slot.split(':').map(Number); return <button type="button" key={slot} onClick={() => removeTeacherUnavailableSlot(teacher.id, slot)} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200">{TIMETABLE_DAYS[day]} · tiết {period} ×</button>; })}</div></div>)}</div></section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"><div><h2 className="font-extrabold">Thời khóa biểu theo lớp</h2><p className="text-sm text-slate-500">Bấm ổ khóa trong một tiết để giữ nguyên khi tối ưu lại.</p></div><div className="flex gap-2"><select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{scenario.classes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.level}</option>)}</select><button type="button" onClick={exportExcel} disabled={!solution} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 sm:hidden"><Download className="h-4 w-4" />Excel</button></div></div>
            {!solution ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><CalendarRange className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-4 font-bold">Chưa có phương án</h3><p className="mt-1 text-sm text-slate-500">Hãy bấm “Xếp tự động” để chạy bộ tối ưu.</p></div> : <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white"><table className="min-w-[920px] w-full border-collapse text-sm"><thead><tr className="bg-slate-900 text-white"><th className="w-20 border-r border-slate-700 p-3">Tiết</th>{TIMETABLE_DAYS.map(day => <th key={day} className="border-r border-slate-700 p-3">{day}</th>)}</tr></thead><tbody>{Array.from({ length: scenario.periodsPerDay }, (_, index) => index + 1).map(period => <tr key={period}><th className="border-r border-t border-slate-200 bg-slate-50 p-3 text-slate-500">{period}</th>{TIMETABLE_DAYS.map((day, dayIndex) => { const entry = solution.entries.find(item => item.classId === selectedClassId && item.dayIndex === dayIndex && item.period === period); return <td key={day} className="h-28 border-r border-t border-slate-200 p-2 align-top">{entry ? <div className={`h-full rounded-xl border p-2.5 ${classNameForEntry(entry, scenario)}`}><div className="flex items-start justify-between gap-2"><b className="text-slate-900">{lookup.subjects.get(entry.subjectId)?.name}</b><button type="button" onClick={() => toggleEntryLock(entry.id)} className="rounded-md p-1 text-slate-500 hover:bg-white" title={entry.locked ? 'Bỏ khóa' : 'Khóa tiết'}>{entry.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button></div><div className="mt-2 text-xs text-slate-600">{lookup.teachers.get(entry.teacherId)?.name}</div>{entry.roomId && <div className="mt-1 text-[11px] text-slate-500">{lookup.rooms.get(entry.roomId)?.name}</div>}</div> : null}</td>; })}</tr>)}</tbody></table></div>}
            {selectedClass && <p className="text-xs text-slate-500">Đang xem: <b>{selectedClass.name}</b> · {selectedClass.level}</p>}
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-500" /><h2 className="font-extrabold">Chẩn đoán phương án</h2></div>{!solution ? <p className="mt-4 text-sm text-slate-500">Chưa có dữ liệu chẩn đoán. Hãy xếp thời khóa biểu trước.</p> : <div className="mt-5 space-y-3"><div className={`rounded-2xl p-4 ${solution.diagnostics.hardConflicts.length ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}><b>{solution.diagnostics.hardConflicts.length ? `${solution.diagnostics.hardConflicts.length} xung đột cứng` : 'Không có xung đột cứng'}</b>{solution.diagnostics.hardConflicts.map(item => <p key={item} className="mt-2 text-sm">• {item}</p>)}</div><div className="rounded-2xl bg-slate-50 p-4"><b>Khoảng trống giáo viên: {solution.diagnostics.teacherGaps}</b>{solution.diagnostics.warnings.map(item => <p key={item} className="mt-2 text-sm text-slate-600">• {item}</p>)}</div></div>}</section>
            <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-extrabold">Tiết chưa xếp được</h2>{!solution || solution.diagnostics.unscheduled.length === 0 ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><b>Đã xếp đủ các yêu cầu.</b><p className="mt-1">Có thể tiếp tục khóa các tiết tốt và tối ưu lại để giảm khoảng trống.</p></div> : <div className="mt-4 space-y-3">{solution.diagnostics.unscheduled.map(item => { const assignment = lookup.assignments.get(item.assignmentId); return <div key={item.assignmentId} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="font-bold text-amber-900">{scenario.classes.find(value => value.id === assignment?.classId)?.name} · {lookup.subjects.get(assignment?.subjectId || '')?.name}: còn {item.remaining} tiết</div><p className="mt-1 text-sm leading-6 text-amber-800">{item.reason}</p></div>; })}</div>}</section>
            {versions.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2"><h2 className="font-extrabold">Các phương án gần đây</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{versions.map((version, index) => <button type="button" key={`${version.generatedAt}-${index}`} onClick={() => { setSolution(version); setActiveTab('schedule'); }} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50"><div className="text-xs font-semibold text-slate-400">Phương án {index + 1}</div><div className="mt-1 text-xl font-extrabold">{version.score}</div><div className="mt-1 text-xs text-slate-500">{version.diagnostics.unscheduled.reduce((sum, item) => sum + item.remaining, 0)} tiết chưa xếp</div></button>)}</div></section>}
          </div>
        )}
      </main>
    </div>
  );
}
