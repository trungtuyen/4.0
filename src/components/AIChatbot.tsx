import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Brain,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Send,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { auth } from '../firebase';
import { getConfiguredApiServer, saveApiServer } from '../lib/api';
import { GOOGLE_AI_MODEL, requestSchoolCounseling, type SchoolCounselingSource } from '../lib/aiService';
import type { SchoolCounselingMessage } from '../lib/schoolCounselor';
import { analyzeTeacherDocument } from '../lib/teacherAssistantAi';
import {
  buildIntegratedFileName,
  createIntegratedTeacherDocx,
  downloadBlob,
  parseTeacherDocx,
  type TeacherDocumentAnalysis,
  type TeacherIntegrationMode,
  type TeacherIntegrationSuggestion,
} from '../lib/teacherDocument';

const TRIAL_STORAGE_KEY = 'teacher_ai_assistant_trial_v1';
const GUEST_TRIAL_LIMIT = 2;

const COUNSELING_SOURCE_LABELS: Record<SchoolCounselingSource, string> = {
  'google-gemini': 'Google Gemini · Firebase AI',
  'private-server': 'Máy chủ AI riêng',
  'browser-ai': 'AI ngay trên thiết bị',
  'on-device': 'Tư vấn tích hợp trên thiết bị',
  'safety-support': 'Ưu tiên an toàn khẩn cấp',
};

const INTEGRATION_MODES: Array<{ id: TeacherIntegrationMode; label: string; description: string }> = [
  { id: 'digital-competency', label: 'Năng lực số', description: 'Phân tích bài học và đề xuất vị trí tích hợp NLS.' },
  { id: 'ai-competency', label: 'Năng lực AI', description: 'Đề xuất nội dung phát triển năng lực AI phù hợp.' },
  { id: 'digital-ai', label: 'NLS + AI', description: 'Phân tích đồng thời NLS và năng lực AI.' },
  { id: 'inclusive-education', label: 'Giáo dục hòa nhập', description: 'Điều chỉnh hoạt động để tăng khả năng tiếp cận.' },
  { id: 'integrated', label: 'Tích hợp tổng hợp', description: 'Đề xuất nội dung tích hợp phù hợp với từng bài.' },
  { id: 'ai-lesson-plan', label: 'Chuyên đề AI', description: 'Xác định bài có thể phát triển thành hoạt động AI.' },
];

function readGuestTrialCount(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(TRIAL_STORAGE_KEY) || 0) || 0);
  } catch {
    return 0;
  }
}

function writeGuestTrialCount(value: number): void {
  try {
    localStorage.setItem(TRIAL_STORAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable in private browser modes. The app still works.
  }
}

function navigateToRegistration(): void {
  sessionStorage.setItem('currentView', JSON.stringify('auth'));
  window.location.reload();
}

function TeacherDocumentAssistant() {
  const [mode, setMode] = useState<TeacherIntegrationMode>('digital-competency');
  const [book, setBook] = useState('Kết nối tri thức với cuộc sống');
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState('8');
  const [documentType, setDocumentType] = useState('KHGD / Phụ lục III');
  const [referenceFramework, setReferenceFramework] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<TeacherDocumentAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<TeacherIntegrationSuggestion[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [guestTrialCount, setGuestTrialCount] = useState(readGuestTrialCount);

  const isSignedIn = Boolean(auth.currentUser);
  const guestTrialExhausted = !isSignedIn && guestTrialCount >= GUEST_TRIAL_LIMIT;

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setDocumentAnalysis(null);
    setSuggestions([]);
    setMessage('');
    setError('');
    setSourceLabel('');
    if (!selected) return;

    setIsReading(true);
    try {
      const parsed = await parseTeacherDocx(selected);
      setDocumentAnalysis(parsed);
      setMessage(`Đã đọc ${parsed.rows.length} hàng dữ liệu trong các bảng của tệp Word. Tệp gốc chưa bị thay đổi.`);
    } catch (err) {
      setFile(null);
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp Word.');
    } finally {
      setIsReading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !documentAnalysis) {
      setError('Hãy tải tệp DOCX trước khi phân tích.');
      return;
    }
    if (guestTrialExhausted) {
      setError(`Bạn đã dùng hết ${GUEST_TRIAL_LIMIT} lượt thử AI trên trình duyệt này. Đăng ký/đăng nhập để tiếp tục.`);
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setMessage('');
    try {
      const result = await analyzeTeacherDocument({
        mode,
        book,
        subject,
        grade,
        documentType,
        rows: documentAnalysis.rows,
        referenceFramework,
      });
      setSuggestions(result.suggestions);
      setSourceLabel(result.source === 'google-gemini'
        ? `Google Gemini · ${result.model || GOOGLE_AI_MODEL}`
        : 'Phân tích cục bộ dự phòng');

      if (!auth.currentUser) {
        const nextCount = guestTrialCount + 1;
        writeGuestTrialCount(nextCount);
        setGuestTrialCount(nextCount);
      }

      if (result.suggestions.length === 0) {
        setMessage('AI chưa tìm thấy hàng nào đủ phù hợp để đề xuất tích hợp. Điều này tốt hơn việc tích hợp gượng ép.');
      } else {
        setMessage(`Đã tạo ${result.suggestions.length} đề xuất. Hãy duyệt, sửa hoặc bỏ từng nội dung trước khi xuất Word.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể phân tích tài liệu.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateSuggestion = (id: string, patch: Partial<TeacherIntegrationSuggestion>) => {
    setSuggestions(previous => previous.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const handleExport = async () => {
    if (!file) return;
    setIsExporting(true);
    setError('');
    try {
      const blob = await createIntegratedTeacherDocx(file, suggestions);
      downloadBlob(blob, buildIntegratedFileName(file.name));
      setMessage('Đã tạo file Word từ bản gốc và chèn các đề xuất được duyệt vào ô cuối của từng hàng tương ứng.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo file Word kết quả.');
    } finally {
      setIsExporting(false);
    }
  };

  const approvedCount = suggestions.filter(item => item.approved).length;

  return (
    <div className="space-y-5">
      {!isSignedIn && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-amber-900">Dùng thử AI: {Math.max(0, GUEST_TRIAL_LIMIT - guestTrialCount)}/{GUEST_TRIAL_LIMIT} lượt còn lại</p>
            <p className="mt-1 text-sm text-amber-800">Đăng ký để tiếp tục sử dụng sau khi hết lượt thử.</p>
          </div>
          <button type="button" onClick={navigateToRegistration} className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-950">
            Đăng ký / Đăng nhập
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            AI tích hợp hồ sơ chuyên môn
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Chọn loại tích hợp → tải DOCX → AI phân tích → giáo viên duyệt → tải lại file Word. Tệp gốc được xử lý trên trình duyệt; phần văn bản cần phân tích mới được gửi tới AI.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {INTEGRATION_MODES.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setMode(item.id); setSuggestions([]); }}
              className={`rounded-2xl border p-4 text-left transition ${mode === item.id ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
            >
              <p className="font-bold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Bộ sách
            <select value={book} onChange={event => setBook(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500">
              <option>Kết nối tri thức với cuộc sống</option>
              <option>Cánh Diều</option>
              <option>Chân trời sáng tạo</option>
              <option>Khác</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Môn học
            <input value={subject} onChange={event => setSubject(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" placeholder="Toán, Tin học..." />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Lớp
            <select value={grade} onChange={event => setGrade(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500">
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Loại tài liệu
            <select value={documentType} onChange={event => setDocumentType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500">
              <option>KHGD / Phụ lục III</option>
              <option>PPCT</option>
              <option>Kế hoạch bài dạy</option>
              <option>Phụ lục I / II</option>
              <option>Tài liệu khác dạng bảng</option>
            </select>
          </label>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Khung/mã năng lực chính thức (khuyến nghị)</summary>
          <p className="mt-2 text-xs leading-5 text-slate-600">Dán đoạn văn bản chứa các mã được phép sử dụng. AI chỉ giữ lại mã xuất hiện nguyên văn tại đây; nếu không cung cấp, hệ thống để trống mã để tránh bịa mã.</p>
          <textarea value={referenceFramework} onChange={event => setReferenceFramework(event.target.value)} rows={5} className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500" placeholder="Ví dụ: dán khung NLS/NL AI đã được đơn vị phê duyệt..." />
        </details>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
          {isReading ? <Loader2 className="h-6 w-6 animate-spin text-indigo-600" /> : <Upload className="h-6 w-6 text-indigo-600" />}
          <span>
            <span className="block font-semibold text-slate-800">{file ? file.name : 'Chọn file Word .DOCX'}</span>
            <span className="mt-1 block text-xs text-slate-500">Ưu tiên KHGD/PPCT/Phụ lục trình bày bằng bảng.</span>
          </span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => void handleFile(event.target.files?.[0] || null)} />
        </label>

        {documentAnalysis && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Đã nhận diện {documentAnalysis.rows.length} hàng trong bảng Word.</span>
            <button type="button" disabled={isAnalyzing || guestTrialExhausted} onClick={() => void handleAnalyze()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isAnalyzing ? 'AI đang phân tích...' : 'Phân tích bằng AI'}
            </button>
          </div>
        )}
      </section>

      {(message || error || sourceLabel) && (
        <div className={`rounded-xl border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
          {error ? <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : <p>{message}</p>}
          {sourceLabel && !error && <p className="mt-2 text-xs font-medium">Nguồn phân tích: {sourceLabel}</p>}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Duyệt đề xuất trước khi chèn</h3>
              <p className="mt-1 text-sm text-slate-600">Đã chọn {approvedCount}/{suggestions.length}. Có thể sửa mã và nội dung trực tiếp.</p>
            </div>
            <button type="button" onClick={() => void handleExport()} disabled={isExporting || approvedCount === 0} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Tạo Word hoàn chỉnh
            </button>
          </div>

          <div className="space-y-3">
            {suggestions.map((item, index) => (
              <article key={item.id} className={`rounded-2xl border p-4 ${item.approved ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50 opacity-75'}`}>
                <div className="flex gap-3">
                  <input type="checkbox" checked={item.approved} onChange={event => updateSuggestion(item.id, { approved: event.target.checked })} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">#{index + 1}</span>
                      <h4 className="font-bold text-slate-900">{item.lesson}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : item.confidence === 'low' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.confidence}</span>
                    </div>
                    {item.reason && <p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>}
                    <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                      <label className="text-xs font-semibold text-slate-600">Mã năng lực
                        <input value={item.code} onChange={event => updateSuggestion(item.id, { code: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-indigo-500" placeholder="Để trống nếu chưa xác minh" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Nội dung tích hợp
                        <textarea value={item.content} onChange={event => updateSuggestion(item.id, { content: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-900 outline-none focus:border-indigo-500" />
                      </label>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SchoolCounselingAssistant() {
  const [messages, setMessages] = useState<SchoolCounselingMessage[]>([
    { role: 'model', text: 'Xin chào! Tôi là trợ lý tư vấn học đường. Tôi có thể hỗ trợ về bắt nạt, bạo lực học đường, áp lực thi cử, cảm xúc hoặc các tình huống giữa gia đình và nhà trường.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAddress, setServerAddress] = useState(() => getConfiguredApiServer());
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [activeSource, setActiveSource] = useState<SchoolCounselingSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(previous => [...previous, { role: 'user', text: userMessage }]);
    setIsLoading(true);
    setError(null);
    try {
      const response = await requestSchoolCounseling(userMessage, messages);
      setActiveSource(response.source);
      setMessages(previous => [...previous, { role: 'model', text: response.text }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xử lý tình huống lúc này.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServer = () => {
    try {
      const normalized = saveApiServer(serverAddress);
      setServerAddress(normalized);
      setServerMessage(normalized ? 'Đã lưu máy chủ AI riêng.' : 'Đã trở lại chế độ AI tự động.');
      setError(null);
    } catch (err) {
      setServerMessage('');
      setError(err instanceof Error ? err.message : 'Không thể lưu địa chỉ máy chủ AI.');
    }
  };

  return (
    <div className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setShowServerSettings(value => !value)} className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900">
            {serverAddress ? <ServerCog className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {serverAddress ? 'Máy chủ riêng · có AI dự phòng' : 'Google Gemini · tự động tối ưu'}
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {activeSource ? COUNSELING_SOURCE_LABELS[activeSource] : 'Sẵn sàng hỗ trợ'}
          </span>
        </div>
        {showServerSettings && (
          <div className="mt-3 space-y-2">
            <p className="text-xs leading-5 text-slate-600">Mặc định ưu tiên Google Gemini ({GOOGLE_AI_MODEL}); máy chủ HTTPS riêng là tùy chọn nâng cao. Không nhập khóa API tại đây.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input type="url" value={serverAddress} onChange={event => setServerAddress(event.target.value)} placeholder="https://may-chu-ai.example.com" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              <button type="button" onClick={handleSaveServer} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Lưu tùy chọn</button>
            </div>
            {serverMessage && <p className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />{serverMessage}</p>}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
        {messages.map((message, index) => (
          <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${message.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[85%] rounded-2xl p-4 ${message.role === 'user' ? 'rounded-tr-none bg-indigo-600 text-white' : 'rounded-tl-none bg-slate-100 text-slate-800'}`}>
              {message.role === 'user' ? <div className="whitespace-pre-wrap">{message.text}</div> : <div className="prose prose-sm max-w-none prose-slate"><Markdown>{message.text}</Markdown></div>}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />AI đang phân tích...</div>}
        {error && <div className="flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="relative">
          <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} rows={2} placeholder="Nhập câu hỏi hoặc tình huống..." className="w-full resize-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-14 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          <button type="button" onClick={() => void handleSend()} disabled={!input.trim() || isLoading} className="absolute bottom-2 right-2 rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Không nhập họ tên, địa chỉ hoặc dữ liệu nhạy cảm của học sinh. Trường hợp nguy hiểm: gọi 111, 113 hoặc 115.</p>
      </div>
    </div>
  );
}

export default function AIChatbot() {
  const [activeArea, setActiveArea] = useState<'documents' | 'counseling'>('documents');

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="mb-5 rounded-2xl bg-gradient-to-r from-indigo-700 via-violet-700 to-blue-700 p-5 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/15 p-3"><Brain className="h-7 w-7" /></div>
          <div>
            <h1 className="text-2xl font-extrabold">AI Trợ lý giáo viên</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-100">Trợ lý chuyên biệt cho hồ sơ chuyên môn: NLS, năng lực AI, giáo dục hòa nhập, tích hợp tổng hợp và hỗ trợ tư vấn học đường.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveArea('documents')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeArea === 'documents' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}><FileText className="h-4 w-4" />Hồ sơ chuyên môn</button>
          <button type="button" onClick={() => setActiveArea('counseling')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeArea === 'counseling' ? 'bg-white text-indigo-700' : 'bg-white/10 text-white hover:bg-white/20'}`}><Brain className="h-4 w-4" />Tư vấn học đường</button>
        </div>
      </div>

      {activeArea === 'documents' ? <TeacherDocumentAssistant /> : <SchoolCounselingAssistant />}
    </div>
  );
}
