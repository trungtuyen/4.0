import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Layers,
  Mail,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import {
  collection,
  doc,
  getCountFromServer,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ECOSYSTEM_APPLICATIONS, type EcosystemApplicationId } from '../ecosystem';
import {
  PLATFORM_CLOUD_VISIT_KEY,
  PLATFORM_COUNT_REFRESH_INTERVAL_MS,
  PLATFORM_HEARTBEAT_INTERVAL_MS,
  PLATFORM_PRESENCE_WINDOW_MS,
  cacheRegistrationMetrics,
  countRecentVisitors,
  formatPlatformCount,
  getOrCreateVisitorIdentifier,
  readCachedRegistrationMetrics,
  readNonNegativeInteger,
  readPublicRegistrationMetrics,
  recordLocalPresence,
  recordLocalVisit,
  summarizeTeacherRegistrations,
  type PublicPlatformMetrics,
  type RegisteredTeacherSummaryInput,
} from '../lib/platformMetrics';

interface PlatformFooterProps {
  onTeacherRegister: () => void;
  onTeacherLogin: () => void;
  onStudentLogin: () => void;
  onOpenProduct: (application: EcosystemApplicationId) => void;
}

interface MetricCard {
  label: string;
  detail: string;
  value: number | null;
  icon: LucideIcon;
  accent: string;
  isLive?: boolean;
}

const DEFAULT_METRICS: PublicPlatformMetrics = {
  totalVisits: 0,
  onlineVisitors: 0,
  registeredSchools: 0,
  registeredTeachers: 0,
  activeTeachers: 0,
  classrooms: null,
  students: null,
  exams: null,
  hasRegistrationData: false,
  isFirebaseConnected: false,
};

export async function publishPlatformRegistrationMetrics(
  teachers: readonly RegisteredTeacherSummaryInput[],
): Promise<void> {
  const summary = summarizeTeacherRegistrations(teachers);
  if (typeof window !== 'undefined') {
    cacheRegistrationMetrics(window.localStorage, summary);
  }

  await setDoc(doc(db, 'platform_stats', 'overview'), {
    ...summary,
    updatedAt: serverTimestamp(),
  });
}

function usePlatformMetrics(): PublicPlatformMetrics {
  const [metrics, setMetrics] = useState<PublicPlatformMetrics>(DEFAULT_METRICS);

  useEffect(() => {
    let mounted = true;
    let remotePresenceEnabled = true;
    const visitorId = getOrCreateVisitorIdentifier(window.localStorage);
    const localVisits = recordLocalVisit(window.localStorage, window.sessionStorage);
    const localRegistration = readCachedRegistrationMetrics(window.localStorage);

    const update = (changes: Partial<PublicPlatformMetrics>) => {
      if (mounted) setMetrics(current => ({ ...current, ...changes }));
    };

    const heartbeat = () => {
      const localOnline = navigator.onLine ? recordLocalPresence(window.localStorage, visitorId) : 0;
      update({ onlineVisitors: localOnline });

      if (!navigator.onLine || !remotePresenceEnabled) return;
      void setDoc(doc(db, 'platform_presence', visitorId), {
        visitorId,
        lastSeen: serverTimestamp(),
      }).catch(error => {
        remotePresenceEnabled = false;
        console.info('Chế độ trực tuyến đang sử dụng dữ liệu phiên trên thiết bị.', error);
      });
    };

    update({
      totalVisits: localVisits,
      onlineVisitors: navigator.onLine ? 1 : 0,
      ...(localRegistration ? { ...localRegistration, hasRegistrationData: true } : {}),
    });
    heartbeat();

    try {
      if (window.sessionStorage.getItem(PLATFORM_CLOUD_VISIT_KEY) !== '1') {
        const traffic = doc(db, 'platform_stats', 'traffic');
        void runTransaction(db, async transaction => {
          const snapshot = await transaction.get(traffic);
          if (snapshot.exists()) {
            transaction.update(traffic, { totalVisits: increment(1), updatedAt: serverTimestamp() });
          } else {
            transaction.set(traffic, { totalVisits: 1, updatedAt: serverTimestamp() });
          }
        }).then(() => {
          window.sessionStorage.setItem(PLATFORM_CLOUD_VISIT_KEY, '1');
        }).catch(error => {
          console.info('Lượt truy cập đang được ghi nhận trên thiết bị.', error);
        });
      }
    } catch (error) {
      console.info('Không thể truy cập bộ nhớ phiên; dùng thống kê cục bộ.', error);
    }

    const unsubscribeTraffic = onSnapshot(
      doc(db, 'platform_stats', 'traffic'),
      snapshot => {
        if (!snapshot.exists()) return;
        update({
          totalVisits: readNonNegativeInteger(snapshot.data().totalVisits, localVisits),
          isFirebaseConnected: true,
        });
      },
      () => undefined,
    );

    const unsubscribeOverview = onSnapshot(
      doc(db, 'platform_stats', 'overview'),
      snapshot => {
        if (!snapshot.exists()) return;
        const registration = readPublicRegistrationMetrics(snapshot.data());
        if (!registration) return;
        update({ ...registration, hasRegistrationData: true, isFirebaseConnected: true });
      },
      () => undefined,
    );

    const activeVisitors = query(
      collection(db, 'platform_presence'),
      where('lastSeen', '>=', Timestamp.fromMillis(Date.now() - PLATFORM_PRESENCE_WINDOW_MS)),
    );

    const unsubscribePresence = onSnapshot(
      activeVisitors,
      snapshot => {
        const visitors = countRecentVisitors(snapshot.docs.map(item => item.data()));
        update({
          onlineVisitors: Math.max(visitors, navigator.onLine ? 1 : 0),
          isFirebaseConnected: true,
        });
      },
      () => undefined,
    );

    const refreshEducationalCounts = async () => {
      const resources = ['classes', 'students', 'exams'] as const;
      const results = await Promise.allSettled(
        resources.map(resource => getCountFromServer(collection(db, resource))),
      );
      if (!mounted) return;

      const changes: Partial<PublicPlatformMetrics> = {};
      if (results[0].status === 'fulfilled') changes.classrooms = results[0].value.data().count;
      if (results[1].status === 'fulfilled') changes.students = results[1].value.data().count;
      if (results[2].status === 'fulfilled') changes.exams = results[2].value.data().count;
      if (results.some(result => result.status === 'fulfilled')) changes.isFirebaseConnected = true;
      update(changes);
    };

    void refreshEducationalCounts();
    const heartbeatInterval = window.setInterval(heartbeat, PLATFORM_HEARTBEAT_INTERVAL_MS);
    const countInterval = window.setInterval(refreshEducationalCounts, PLATFORM_COUNT_REFRESH_INTERVAL_MS);
    const handleConnectivityChange = () => heartbeat();
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);

    return () => {
      mounted = false;
      unsubscribeTraffic();
      unsubscribeOverview();
      unsubscribePresence();
      window.clearInterval(heartbeatInterval);
      window.clearInterval(countInterval);
      window.removeEventListener('online', handleConnectivityChange);
      window.removeEventListener('offline', handleConnectivityChange);
    };
  }, []);

  return metrics;
}

export default function PlatformFooter({
  onTeacherRegister,
  onTeacherLogin,
  onStudentLogin,
  onOpenProduct,
}: PlatformFooterProps) {
  const metrics = usePlatformMetrics();

  const cards: MetricCard[] = [
    {
      label: 'Lượt truy cập',
      detail: 'Phiên truy cập thực tế',
      value: metrics.totalVisits,
      icon: BarChart3,
      accent: 'from-sky-400 to-blue-500',
    },
    {
      label: 'Trường đăng ký',
      detail: 'Đơn vị giáo dục đồng hành',
      value: metrics.hasRegistrationData ? metrics.registeredSchools : null,
      icon: Building2,
      accent: 'from-violet-400 to-indigo-500',
    },
    {
      label: 'Giáo viên tham gia',
      detail: 'Tài khoản đã đăng ký',
      value: metrics.hasRegistrationData ? metrics.registeredTeachers : null,
      icon: GraduationCap,
      accent: 'from-amber-400 to-orange-500',
    },
    {
      label: 'Đang trực tuyến',
      detail: 'Cập nhật theo thời gian thực',
      value: metrics.onlineVisitors,
      icon: Activity,
      accent: 'from-emerald-400 to-teal-500',
      isLive: true,
    },
    {
      label: 'Lớp học số',
      detail: 'Lớp học đã được tạo',
      value: metrics.classrooms,
      icon: Layers,
      accent: 'from-cyan-400 to-sky-500',
    },
    {
      label: 'Học sinh tham gia',
      detail: 'Dữ liệu học sinh thực tế',
      value: metrics.students,
      icon: Users,
      accent: 'from-pink-400 to-rose-500',
    },
    {
      label: 'Kỳ thi đã tạo',
      detail: 'Kỳ thi trên hệ thống',
      value: metrics.exams,
      icon: ClipboardCheck,
      accent: 'from-fuchsia-400 to-purple-500',
    },
    {
      label: 'Ứng dụng giáo dục',
      detail: 'Sẵn sàng hỗ trợ dạy học',
      value: ECOSYSTEM_APPLICATIONS.length,
      icon: Sparkles,
      accent: 'from-lime-400 to-emerald-500',
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-slate-800 bg-slate-950 text-slate-300">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_85%_12%,rgba(16,185,129,0.12),transparent_30%)]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        <section aria-labelledby="platform-community-heading">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
                <Activity className="h-4 w-4" />
                Hệ sinh thái đang phát triển
              </div>
              <h2 id="platform-community-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Cộng đồng giáo dục chuyển đổi số
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                Mỗi lượt truy cập, lớp học và kỳ thi được thống kê từ dữ liệu thực tế; thông tin cá nhân của giáo viên và học sinh không được công khai.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              {metrics.isFirebaseConnected ? 'Dữ liệu hệ thống đang cập nhật' : 'Đang đồng bộ dữ liệu thực tế'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {cards.map(card => {
              const Icon = card.icon;

              return (
                <article
                  key={card.label}
                  className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-lg sm:h-11 sm:w-11`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {card.isLive && (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    {formatPlatformCount(card.value)}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-100">{card.label}</h3>
                  <p className="mt-1 hidden text-xs leading-5 text-slate-400 sm:block">{card.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="relative mt-12 overflow-hidden rounded-3xl border border-indigo-400/25 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-emerald-500/15 p-6 sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <HeartHandshake className="h-5 w-5" />
                Dành cho giáo viên và nhà trường Việt Nam
              </div>
              <h3 className="text-2xl font-bold text-white sm:text-3xl">Sẵn sàng tạo tiết học khiến học sinh hào hứng?</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Đăng ký để sử dụng lớp học tương tác, nhận diện cử chỉ, thẻ Plicker, quản lý kỳ thi và trợ lý học đường AI trên cùng một nền tảng.
              </p>
            </div>

            <button
              type="button"
              onClick={onTeacherRegister}
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-emerald-400 px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              Giáo viên đăng ký miễn phí
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <div className="mt-14 grid gap-10 border-t border-white/10 pt-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 p-2 text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="text-base font-bold text-white">Lớp Học Thông Minh 4.0</span>
            </div>
            <p className="text-sm leading-7 text-slate-400">
              Hệ sinh thái giáo dục số hỗ trợ giáo viên đổi mới phương pháp dạy học, tăng tương tác và quản lý lớp học hiệu quả.
            </p>
            <a
              href="mailto:tuyenthcskimhy@gmail.com"
              className="mt-4 inline-flex items-center gap-2 text-sm text-sky-200 transition hover:text-white"
            >
              <Mail className="h-4 w-4" />
              Hỗ trợ triển khai cho nhà trường
            </a>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-white">Giải pháp nổi bật</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><button type="button" onClick={() => onOpenProduct('gesture-core')} className="transition hover:text-white">Điều khiển lớp học bằng cử chỉ</button></li>
              <li><button type="button" onClick={() => onOpenProduct('plicker')} className="transition hover:text-white">Tương tác thẻ Plicker</button></li>
              <li><button type="button" onClick={() => onOpenProduct('exam-manager')} className="transition hover:text-white">Quản lý kỳ thi trực tuyến</button></li>
              <li><button type="button" onClick={() => onOpenProduct('chatbot')} className="transition hover:text-white">Tư vấn học đường AI</button></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-white">Dành cho giáo viên</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><button type="button" onClick={onTeacherRegister} className="transition hover:text-white">Đăng ký tài khoản miễn phí</button></li>
              <li><button type="button" onClick={onTeacherLogin} className="transition hover:text-white">Đăng nhập quản lý lớp học</button></li>
              <li><button type="button" onClick={onStudentLogin} className="transition hover:text-white">Cổng đăng nhập học sinh</button></li>
              <li><a href="#san-pham" className="transition hover:text-white">Khám phá toàn bộ ứng dụng</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-white">Cam kết nền tảng</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Bảo vệ dữ liệu cá nhân</li>
              <li className="flex items-center gap-2"><MonitorPlay className="h-4 w-4 shrink-0 text-sky-300" /> Chạy trên điện thoại và máy tính</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> Dữ liệu thống kê minh bạch</li>
              <li className="flex items-center gap-2"><Wifi className="h-4 w-4 shrink-0 text-indigo-300" /> Cập nhật trạng thái trực tuyến</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Lớp Học Thông Minh 4.0. Đồng hành cùng giáo viên Việt Nam.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Không công khai dữ liệu cá nhân</span>
            <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Hệ thống sẵn sàng phục vụ</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
