import { ArrowLeft, ExternalLink, Hand, ShieldCheck } from 'lucide-react';
import { auth } from '../firebase';

interface GestureClassProps {
  onBack: () => void;
}

export default function GestureClass({ onBack }: GestureClassProps) {
  const ownerUid = auth.currentUser?.uid || 'guest';
  const applicationUrl = `${import.meta.env.BASE_URL}gestureclass/index.html?owner=${encodeURIComponent(ownerUid)}&v=projector-readable-v1`;

  return (
    <section className="flex h-dvh min-h-screen w-full flex-col overflow-hidden bg-slate-50">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại hệ sinh thái"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Hand className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">GestureClass</h1>
            <p className="truncate text-xs text-slate-500">Lớp Học Thông Minh 4.0</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 md:inline-flex">
            <ShieldCheck className="h-4 w-4" />
            Camera xử lý trên thiết bị
          </span>
          <a
            href={applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:px-3"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Mở riêng</span>
          </a>
        </div>
      </header>

      <iframe
        title="GestureClass — Lớp học tương tác bằng cử chỉ"
        src={applicationUrl}
        allow="camera; fullscreen"
        allowFullScreen
        className="min-h-0 w-full flex-1 border-0 bg-[#f6f7fb]"
      />
    </section>
  );
}
