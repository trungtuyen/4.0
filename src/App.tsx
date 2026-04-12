import React, { useState, useEffect } from 'react';
import { BookOpen, MonitorPlay, Users, Zap, CheckCircle2, ArrowRight, X, User, Lock, Eye, Plus, Trash2, Key, LogOut, Search, Edit2, MoreVertical, ShieldCheck, Gamepad2, Library, Layers, Layout, Smile, Brain, FileEdit, Sparkles } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import ExamManager from './components/ExamManager';
import { Teacher } from './types';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'auth' | 'admin' | 'student_exam'>(() => {
    const saved = sessionStorage.getItem('currentView');
    return saved ? JSON.parse(saved) : 'landing';
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [currentUser, setCurrentUser] = useState<Teacher | 'admin' | null>(() => {
    const saved = sessionStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    });
    return () => unsubTeachers();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('currentView', JSON.stringify(currentView));
  }, [currentView]);

  useEffect(() => {
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
  }, [currentUser]);

  const navigateToAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setCurrentView('auth');
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const loginId = formData.get('loginId') as string;
    const password = formData.get('password');

    if ((loginId === 'admin@example.com' || loginId === 'Admin') && password === 'admin') {
      setCurrentUser('admin');
      setCurrentView('admin');
      return;
    } 
    
    // Find teacher by email or username
    const teacher = teachers.find(t => t.email === loginId || t.username === loginId);
    
    if (teacher) {
      if (teacher.status === 'inactive') {
        alert('Tài khoản của bạn chưa được duyệt hoặc đã bị khóa. Vui lòng liên hệ quản trị viên.');
      } else if (teacher.password && teacher.password !== password) {
        alert('Tên đăng nhập/Email hoặc mật khẩu không đúng! Vui lòng thử lại.');
      } else {
        alert('Đăng nhập thành công với tư cách giáo viên!');
        setCurrentUser(teacher);
        setCurrentView('admin');
      }
    } else {
      alert('Tên đăng nhập/Email hoặc mật khẩu không đúng! Vui lòng thử lại.');
    }
  };

  const handleForgotPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('resetEmail');
    
    // In a real app, this would send an API request
    alert(`Hướng dẫn đặt lại mật khẩu đã được gửi đến email: ${email}`);
    setIsForgotPasswordModalOpen(false);
  };

  if (currentView === 'admin') {
    return <AdminDashboard onLogout={() => {
      setCurrentUser(null);
      setCurrentView('landing');
    }} teachers={teachers} setTeachers={setTeachers} currentUser={currentUser} />;
  }

  if (currentView === 'student_exam') {
    return (
      <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50">
        <ExamManager initialMode="student" onBack={() => setCurrentView('landing')} />
      </div>
    );
  }

  if (currentView === 'auth') {
    return (
      <>
      <div className="min-h-screen flex font-sans text-slate-900 bg-white">
        {/* Left Panel - Teacher Focus */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between relative overflow-hidden p-12">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-b from-indigo-500/20 to-transparent rounded-full blur-3xl transform rotate-12"></div>
            <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-t from-blue-500/20 to-transparent rounded-full blur-3xl transform -rotate-12"></div>
          </div>

          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer relative z-10"
            onClick={() => setCurrentView('landing')}
          >
            <div className="bg-indigo-500 p-1.5 rounded text-white">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="font-bold text-2xl text-white">Lớp Học Thông Minh 4.0</span>
          </div>
          
          {/* Image Content */}
          <div className="relative z-10 w-full flex-grow flex items-center justify-center mt-8">
            <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              <img 
                src="https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=2070&auto=format&fit=crop" 
                alt="Giáo viên giảng dạy" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h2 className="text-2xl font-bold text-white mb-2">Nâng tầm giảng dạy</h2>
                <p className="text-slate-300">Công cụ thông minh giúp giáo viên tối ưu hóa thời gian và nâng cao chất lượng bài giảng.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-bold text-center mb-8 text-slate-800 uppercase">
              {authMode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </h2>

            {authMode === 'login' ? (
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="loginId" type="text" required className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Tên đăng nhập / Email đăng nhập" />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="password" type="password" required className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Mật khẩu" />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer">
                    <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-blue-500" />
                    <span className="text-sm text-slate-600">Ghi nhớ mật khẩu</span>
                  </label>
                </div>

                <button type="submit" className="w-full bg-[#3b82f6] text-white font-medium py-2.5 rounded-lg hover:bg-blue-600 transition-colors mt-2">
                  Đăng nhập
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={async (e) => { 
                e.preventDefault(); 
                const formData = new FormData(e.currentTarget);
                const newTeacher: Teacher = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: formData.get('name') as string,
                  username: formData.get('email') as string, // Using email as username for registration
                  email: formData.get('email') as string,
                  school: formData.get('school') as string,
                  level: formData.get('level') as string,
                  status: 'inactive',
                  password: formData.get('password') as string
                };
                try {
                  await setDoc(doc(db, 'teachers', newTeacher.id), newTeacher);
                  alert('Đăng ký thành công! Vui lòng chờ quản trị viên kích hoạt tài khoản của bạn để có thể đăng nhập.');
                  setAuthMode('login');
                } catch (error) {
                  console.error("Error registering teacher:", error);
                  alert('Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.');
                }
              }}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="name" type="text" required className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Họ và tên" />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="school" type="text" required className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Đơn vị công tác" />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <input type="text" required className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Địa chỉ: xã, tỉnh..." />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input type="tel" required className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Số điện thoại" />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input name="email" type="email" required className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Email" />
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-slate-400" />
                  </div>
                  <select name="level" required defaultValue="" className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-slate-600 bg-white appearance-none">
                    <option value="" disabled>Giáo viên cấp...</option>
                    <option value="Mầm non">Mầm non</option>
                    <option value="Tiểu học">Tiểu học</option>
                    <option value="THCS">THCS</option>
                    <option value="THPT">THPT</option>
                    <option value="Đại học/Cao đẳng">Đại học/Cao đẳng</option>
                    <option value="Khác">Khác</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input name="password" type="password" required className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Mật khẩu" />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer">
                    <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-[#3b82f6] text-white font-medium py-2.5 rounded-lg hover:bg-blue-600 transition-colors mt-2">
                  Đăng ký
                </button>
              </form>
            )}

            {authMode === 'login' && (
              <div className="mt-4 text-right">
                <button 
                  onClick={() => setIsForgotPasswordModalOpen(true)}
                  className="text-sm text-blue-500 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}

            <div className="mt-8 text-center text-sm text-slate-600">
              {authMode === 'login' ? (
                <>Bạn chưa có tài khoản? <button onClick={() => setAuthMode('register')} className="text-blue-500 hover:underline font-medium">Đăng ký</button></>
              ) : (
                <>Đã có tài khoản? <button onClick={() => setAuthMode('login')} className="text-blue-500 hover:underline font-medium">Đăng nhập</button></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Quên mật khẩu</h2>
              <button 
                onClick={() => setIsForgotPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6 text-sm">
                Vui lòng nhập địa chỉ email bạn đã sử dụng để đăng ký tài khoản. Chúng tôi sẽ gửi cho bạn một liên kết để đặt lại mật khẩu.
              </p>
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    name="resetEmail"
                    type="email" 
                    required 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                    placeholder="Nhập địa chỉ email của bạn" 
                  />
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsForgotPasswordModalOpen(false)}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Gửi yêu cầu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Registration Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Đăng ký tài khoản</h2>
              <button 
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIsRegisterModalOpen(false); }}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">1. Họ và tên</label>
                  <input type="text" required className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Nhập họ và tên của bạn" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">2. Đơn vị công tác</label>
                  <input type="text" required className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Trường học / Trung tâm / Tổ chức" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">3. Địa chỉ công tác</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" required className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Xã / Phường" />
                    <input type="text" required className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Tỉnh / Thành phố" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">4. Email đăng ký</label>
                  <input type="email" required className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="example@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">5. Số điện thoại liên hệ</label>
                  <input type="tel" required className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="09xx xxx xxx" />
                </div>
                <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                    Hoàn tất đăng ký
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="font-bold text-xl tracking-tight text-indigo-950">Lớp Học Thông Minh 4.0</span>
            </div>

            {/* Navigation and Auth */}
            <div className="flex items-center gap-8">
              <nav className="hidden md:flex items-center gap-6">
                <a href="#gioi-thieu" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Giới thiệu</a>
                <a href="#san-pham" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Sản phẩm</a>
                <a href="#bang-gia" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Bảng giá</a>
              </nav>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentView('student_exam')}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full transition-colors hidden sm:flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Học sinh đăng nhập
                </button>
                <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
                <button 
                  onClick={() => navigateToAuth('login')}
                  className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors hidden sm:block"
                >
                  Giáo viên
                </button>
                <button 
                  onClick={() => navigateToAuth('register')}
                  className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Đăng ký
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-slate-900">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-b from-indigo-500/20 to-transparent rounded-full blur-3xl transform rotate-12"></div>
            <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-t from-blue-500/20 to-transparent rounded-full blur-3xl transform -rotate-12"></div>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl mix-blend-screen"></div>
          </div>

          <div className="relative max-w-7xl mx-auto text-center z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-blue-200 text-sm font-medium mb-8 backdrop-blur-sm">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Cơ hội đầu tư phát triển cùng giáo dục Việt Nam</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 leading-tight">
              Định hình tương lai giáo dục <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400">Giơ tay là điều khiển, học là cuốn</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-10">
              Nền tảng tương tác trực tuyến tích hợp nhận diện cử chỉ (gesture recognition) — điều khiển nội dung bằng tay, tối ưu trải nghiệm dạy–học theo thời gian thực.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={() => setCurrentView('student_exam')}
                className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/30 transform hover:-translate-y-1"
              >
                <User className="w-5 h-5" />
                Học sinh đăng nhập
              </button>
              <button 
                onClick={() => navigateToAuth('register')}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/30 transform hover:-translate-y-1"
              >
                Giáo viên đăng ký <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Stats for investors */}
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto border-t border-white/10 pt-10">
              <div>
                <div className="text-4xl font-bold text-white mb-2">2M+</div>
                <div className="text-sm text-slate-400">Người dùng tích cực</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">300%</div>
                <div className="text-sm text-slate-400">Tăng trưởng doanh thu</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">95%</div>
                <div className="text-sm text-slate-400">Tỷ lệ giữ chân</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white mb-2">50+</div>
                <div className="text-sm text-slate-400">Đối tác chiến lược</div>
              </div>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section id="san-pham" className="py-24 bg-slate-50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Hệ sinh thái sản phẩm</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">Giải pháp giáo dục toàn diện, ứng dụng công nghệ tiên tiến giúp tối ưu hóa trải nghiệm dạy và học.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Product 1 */}
              <div 
                onClick={() => setCurrentView('auth')}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                    <Gamepad2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">Trò chơi liên kết thư viện</h3>
                  <p className="text-slate-600 leading-relaxed">Học tập thông qua các trò chơi tương tác sinh động, kết nối trực tiếp với kho học liệu phong phú giúp học sinh tiếp thu kiến thức tự nhiên.</p>
                </div>
              </div>

              {/* Product 2 */}
              <div 
                onClick={() => setCurrentView('auth')}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                    <Layers className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-emerald-600 transition-colors">Bốc thẻ (Flashcards)</h3>
                  <p className="text-slate-600 leading-relaxed">Hệ thống thẻ ghi nhớ thông minh với thuật toán lặp lại ngắt quãng, giúp ghi nhớ từ vựng và khái niệm nhanh chóng, hiệu quả lâu dài.</p>
                </div>
              </div>

              {/* Product 3 */}
              <div 
                onClick={() => setCurrentView('auth')}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                    <Layout className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-amber-600 transition-colors">Tường học tập</h3>
                  <p className="text-slate-600 leading-relaxed">Không gian thảo luận trực tuyến, nơi học sinh và giáo viên chia sẻ ý tưởng, tài liệu và tương tác đa chiều như một mạng xã hội thu nhỏ.</p>
                </div>
              </div>

              {/* Product 4 */}
              <div 
                onClick={() => setCurrentView('auth')}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-rose-500/50 hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-red-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                    <Smile className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-rose-600 transition-colors">Trò chơi lắc đầu chọn đáp án</h3>
                  <p className="text-slate-600 leading-relaxed">Ứng dụng công nghệ nhận diện chuyển động AI, cho phép học sinh trả lời câu hỏi bằng cử chỉ đầu, mang lại trải nghiệm học tập đầy thú vị.</p>
                </div>
              </div>

              {/* Product 5 */}
              <div 
                onClick={() => setCurrentView('auth')}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-violet-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                    <Brain className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-violet-600 transition-colors">AI phân tích tâm lý</h3>
                  <p className="text-slate-600 leading-relaxed">Trí tuệ nhân tạo phân tích biểu cảm và hành vi học tập, giúp giáo viên nắm bắt trạng thái tâm lý và mức độ tập trung của từng học sinh.</p>
                </div>
              </div>

              {/* Product 6 */}
              <div 
                onClick={() => setCurrentView('auth')}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300 overflow-hidden cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-100 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30 group-hover:-translate-y-1 transition-transform duration-300">
                    <FileEdit className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-cyan-600 transition-colors">Tạo kỳ thi thông minh</h3>
                  <p className="text-slate-600 leading-relaxed">Hệ thống tạo đề thi tự động từ ngân hàng câu hỏi, hỗ trợ trộn đề, giám sát chống gian lận và chấm điểm tức thì với báo cáo chi tiết.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="bang-gia" className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Bảng giá linh hoạt</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">Lựa chọn gói giải pháp phù hợp nhất với quy mô trường học hoặc trung tâm của bạn.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Basic Plan */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Cơ bản</h3>
                <p className="text-slate-500 text-sm mb-6">Dành cho giáo viên cá nhân</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">Miễn phí</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Tối đa 50 học sinh</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Lớp học ảo 40 phút</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Quản lý bài tập cơ bản</span>
                  </li>
                </ul>
                <button 
                  onClick={() => navigateToAuth('register')}
                  className="w-full py-3 px-4 bg-indigo-50 text-indigo-600 font-medium rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  Đăng ký ngay
                </button>
              </div>

              {/* Pro Plan */}
              <div className="bg-indigo-600 rounded-3xl p-8 border border-indigo-500 shadow-xl relative transform md:-translate-y-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-pink-500 to-violet-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Phổ biến nhất
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Chuyên nghiệp</h3>
                <p className="text-indigo-200 text-sm mb-6">Dành cho trung tâm đào tạo</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">499.000đ</span>
                  <span className="text-indigo-200">/tháng</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-indigo-50">
                    <CheckCircle2 className="w-5 h-5 text-indigo-300 flex-shrink-0" />
                    <span>Không giới hạn học sinh</span>
                  </li>
                  <li className="flex items-center gap-3 text-indigo-50">
                    <CheckCircle2 className="w-5 h-5 text-indigo-300 flex-shrink-0" />
                    <span>Lớp học ảo không giới hạn</span>
                  </li>
                  <li className="flex items-center gap-3 text-indigo-50">
                    <CheckCircle2 className="w-5 h-5 text-indigo-300 flex-shrink-0" />
                    <span>Trợ giảng AI cơ bản</span>
                  </li>
                </ul>
                <button 
                  onClick={() => navigateToAuth('register')}
                  className="w-full py-3 px-4 bg-white text-indigo-600 font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Dùng thử 14 ngày
                </button>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Doanh nghiệp</h3>
                <p className="text-slate-500 text-sm mb-6">Dành cho trường học, tổ chức</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">Liên hệ</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Mọi tính năng gói Pro</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Tên miền & Logo riêng</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Tích hợp API hệ thống khác</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span>Hỗ trợ kỹ thuật 24/7</span>
                  </li>
                </ul>
                <button 
                  onClick={() => navigateToAuth('register')}
                  className="w-full py-3 px-4 bg-indigo-50 text-indigo-600 font-medium rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  Nhận báo giá
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-500 p-1.5 rounded-md text-white">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg text-white">Lớp Học Thông Minh 4.0</span>
              </div>
              <p className="text-sm text-slate-400 max-w-sm">
                Giải pháp công nghệ giáo dục hàng đầu, mang đến trải nghiệm học tập và giảng dạy hiện đại, hiệu quả cho kỷ nguyên số.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Sản phẩm</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Lớp học ảo</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Trợ giảng AI</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Thi trực tuyến</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Công ty</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Về chúng tôi</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Liên hệ</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Điều khoản sử dụng</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800 text-sm text-slate-500 flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2026 Lớp Học Thông Minh 4.0. Tất cả các quyền được bảo lưu.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Facebook</a>
              <a href="#" className="hover:text-white transition-colors">YouTube</a>
              <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
