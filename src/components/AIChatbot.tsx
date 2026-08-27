import React, { lazy, Suspense, useState } from 'react';
import { Brain, FileText, Loader2 } from 'lucide-react';

const TeacherDocumentAssistant = lazy(() => import('./ai/TeacherDocumentAssistant'));
const SchoolCounselingAssistant = lazy(() => import('./ai/SchoolCounselingAssistant'));

type AiArea = 'documents' | 'counseling';

function ModuleLoading() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        Đang tải mô-đun AI cần dùng...
      </div>
    </div>
  );
}

export default function AIChatbot() {
  const [activeArea, setActiveArea] = useState<AiArea>('documents');

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="mb-5 rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-blue-700 p-5 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/15 p-3"><Brain className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl font-extrabold">AI Trợ lý giáo viên</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-100">
              Kiến trúc mô-đun: chỉ tải đúng chức năng giáo viên đang sử dụng. Hồ sơ chuyên môn, Document Engine và tư vấn học đường không còn bị đóng gói chung.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveArea('documents')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeArea === 'documents' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <FileText className="h-4 w-4" />Hồ sơ chuyên môn
          </button>
          <button type="button" onClick={() => setActiveArea('counseling')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeArea === 'counseling' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <Brain className="h-4 w-4" />Tư vấn học đường
          </button>
        </div>
      </div>

      <Suspense fallback={<ModuleLoading />}>
        {activeArea === 'documents' ? <TeacherDocumentAssistant /> : <SchoolCounselingAssistant />}
      </Suspense>
    </div>
  );
}
