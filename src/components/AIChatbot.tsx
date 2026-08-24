import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, ServerCog, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import { getConfiguredApiServer, saveApiServer } from '../lib/api';
import { GOOGLE_AI_MODEL, requestSchoolCounseling, type SchoolCounselingSource } from '../lib/aiService';
import type { SchoolCounselingMessage } from '../lib/schoolCounselor';

const COUNSELING_SOURCE_LABELS: Record<SchoolCounselingSource, string> = {
  'google-gemini': 'Google Gemini · Firebase AI',
  'private-server': 'Máy chủ AI riêng',
  'browser-ai': 'AI ngay trên thiết bị',
  'on-device': 'Tư vấn tích hợp trên thiết bị',
  'safety-support': 'Ưu tiên an toàn khẩn cấp',
};

export default function AIChatbot() {
  const [messages, setMessages] = useState<SchoolCounselingMessage[]>([
    { role: 'model', text: 'Xin chào! Tôi là trợ lý tư vấn học đường. Tôi có thể hỗ trợ về bắt nạt, bạo lực học đường, áp lực thi cử, cảm xúc hoặc các tình huống giữa gia đình và nhà trường.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverAddress, setServerAddress] = useState(() => getConfiguredApiServer());
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [activeSource, setActiveSource] = useState<SchoolCounselingSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await requestSchoolCounseling(userMessage, messages);
      setActiveSource(response.source);
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (err: any) {
      console.error("Chatbot error:", err);
      setError(err.message || "Không thể xử lý tình huống lúc này. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveServer = () => {
    try {
      const normalized = saveApiServer(serverAddress);
      setServerAddress(normalized);
      setServerMessage(normalized
        ? 'Đã lưu máy chủ riêng; Google Gemini và chế độ trên thiết bị vẫn được giữ làm dự phòng.'
        : 'Đã trở lại chế độ tự động: Google Gemini, AI trình duyệt hoặc tư vấn trên thiết bị.');
      setError(null);
    } catch (err) {
      setServerMessage('');
      setError(err instanceof Error ? err.message : 'Không thể lưu địa chỉ máy chủ AI.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowServerSettings(value => !value)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            {serverAddress ? <ServerCog className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {serverAddress ? 'Máy chủ riêng · có dự phòng AI' : 'Google Gemini · tự động tối ưu'}
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {activeSource ? COUNSELING_SOURCE_LABELS[activeSource] : 'Sẵn sàng hỗ trợ'}
          </span>
        </div>
        {showServerSettings && (
          <div className="mt-3 space-y-2">
            <p className="text-xs leading-5 text-slate-600">
              Mặc định ứng dụng ưu tiên Google Gemini ({GOOGLE_AI_MODEL}) qua Firebase AI Logic và tự chuyển sang chế độ trên thiết bị khi cần. Máy chủ HTTPS riêng là tùy chọn nâng cao; không nhập khóa API tại đây.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={serverAddress}
                onChange={event => setServerAddress(event.target.value)}
                placeholder="https://may-chu-ai.example.com"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button type="button" onClick={handleSaveServer} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Lưu tùy chọn
              </button>
            </div>
            {serverMessage && (
              <p className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />{serverMessage}</p>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              ) : (
                <div className="prose prose-sm md:prose-base max-w-none prose-slate">
                  <Markdown>{msg.text}</Markdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              <span className="text-slate-500">AI đang suy nghĩ...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-500 bg-red-50 p-4 rounded-xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi hoặc tình huống của bạn..."
            className="w-full pl-4 pr-14 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-4xl text-xs text-slate-500">
          Không nhập họ tên, địa chỉ hoặc dữ liệu nhạy cảm của học sinh. Trường hợp nguy hiểm: gọi 111, 113 hoặc 115.
        </p>
      </div>
    </div>
  );
}
