import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, Plus, X, Monitor, Image as ImageIcon, Send, MessageCircle, Heart, User, CheckSquare, Settings } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

interface Category {
  id: string;
  title: string;
  color?: string;
  parentId?: string;
  author?: string;
}

interface Post {
  id: string;
  categoryId: string;
  imageSrc: string;
  studentName: string;
  createdAt: any;
  score?: number;
  comments?: { id: string, text: string, createdAt: any }[];
  likes?: number;
}

interface LearningWallProps {
  onBack: () => void;
}

export default function LearningWall({ onBack }: LearningWallProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [openedClassId, setOpenedClassId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [pendingPostImage, setPendingPostImage] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [wallBgColor, setWallBgColor] = useState('#FFD524');

  const videoRef = useRef<HTMLVideoElement>(null);

  // Listen to categories (classes)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });
    return unsub;
  }, []);

  // Listen to posts
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'wall_posts'), orderBy('createdAt', 'desc')), (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
    });
    return unsub;
  }, []);

  const openCamera = () => {
    setIsCameraOpen(true);
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => console.error("Error accessing camera:", err));
  };

  const closeCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setPendingPostImage(canvas.toDataURL('image/jpeg'));
        setIsPostModalOpen(true);
        closeCamera();
      }
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPostImage || !studentName || !selectedCategoryId) return;

    try {
      await addDoc(collection(db, 'wall_posts'), {
        categoryId: selectedCategoryId,
        imageSrc: pendingPostImage,
        studentName: studentName,
        createdAt: serverTimestamp(),
        comments: [],
        likes: 0
      });
      setIsPostModalOpen(false);
      setPendingPostImage(null);
      setStudentName('');
      setSelectedCategoryId('');
    } catch (error) {
      console.error("Error posting:", error);
    }
  };

  const mainClasses = categories.filter(c => !c.parentId);
  const activeSubCategories = categories.filter(c => c.parentId === openedClassId);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: wallBgColor }}>
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (openedClassId) setOpenedClassId(null);
              else onBack();
            }}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-800" />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 font-serif">
            {openedClassId ? categories.find(c => c.id === openedClassId)?.title : 'Tường học tập'}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={openCamera}
            className="flex items-center gap-2 px-4 py-2 bg-white/40 hover:bg-white/60 text-slate-800 rounded-lg transition-colors font-medium shadow-sm border border-black/5"
          >
            <Camera className="w-5 h-5" />
            Đăng bài mới
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {!openedClassId ? (
          /* Class Selection */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
            {mainClasses.map(c => (
              <div 
                key={c.id}
                onClick={() => setOpenedClassId(c.id)}
                className="bg-white/40 backdrop-blur-md rounded-2xl p-6 border border-black/5 hover:scale-105 transition-all cursor-pointer group shadow-sm"
              >
                <div className="w-12 h-12 bg-white/60 rounded-xl flex items-center justify-center mb-4 text-indigo-600 group-hover:rotate-12 transition-transform">
                  <Monitor className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{c.title}</h3>
                <p className="text-slate-600 text-sm">Gồm {categories.filter(sub => sub.parentId === c.id).length} hạng mục</p>
              </div>
            ))}
            {mainClasses.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-slate-600 font-medium italic">Chưa có lớp học nào được tạo. Vui lòng liên hệ giáo viên.</p>
              </div>
            )}
          </div>
        ) : (
          /* Columns for categories */
          <div className="flex gap-6 h-full items-start overflow-x-auto pb-4 custom-scrollbar">
            {activeSubCategories.map(category => (
              <div key={category.id} className="w-80 flex-shrink-0 flex flex-col max-h-full">
                <div className={`flex items-center justify-between mb-4 p-3 rounded-xl shadow-sm`} style={{ backgroundColor: category.color || '#fff' }}>
                  <h2 className="font-bold text-slate-900 text-sm">{category.title}</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2">
                  {posts.filter(p => p.categoryId === category.id).map(post => (
                    <div key={post.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                            {post.studentName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{post.studentName}</div>
                            <div className="text-[10px] text-slate-400">Vừa mới đăng</div>
                          </div>
                        </div>

                        <div className="rounded-lg overflow-hidden bg-slate-50 mb-3 border border-slate-100">
                          <img src={post.imageSrc} alt="Post" className="w-full h-auto" />
                        </div>

                        {post.comments && post.comments.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            {post.comments.map((comment: any) => (
                              <div key={comment.id} className="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-600 border border-slate-100/50">
                                <span className="font-bold text-indigo-600 mr-1">GV:</span>
                                {comment.text}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckSquare className="w-3 h-3" />
                              {post.score ? `${post.score}/10` : 'Đợi chấm'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Heart className="w-3.5 h-3.5" />
                              {post.likes || 0}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {post.comments?.length || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera UI */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg aspect-video bg-black rounded-3xl overflow-hidden mb-8 border-4 border-white/20">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <button 
              onClick={closeCamera}
              className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex gap-6">
            <button 
              onClick={closeCamera}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all"
            >
              Hủy
            </button>
            <button 
              onClick={captureImage}
              className="px-12 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 transition-all hover:-translate-y-1"
            >
              Chụp ảnh bài làm
            </button>
          </div>
        </div>
      )}

      {/* Post Modal */}
      {isPostModalOpen && pendingPostImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Đăng bài lên tường</h3>
              <button onClick={() => setIsPostModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handlePost} className="p-8 space-y-6">
              <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden border-2 border-slate-100 flex items-center justify-center">
                <img src={pendingPostImage} alt="Preview" className="w-full h-full object-contain" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Hạng mục nộp bài</label>
                  <select 
                    required
                    value={selectedCategoryId}
                    onChange={e => setSelectedCategoryId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">Chọn một hạng mục...</option>
                    {categories.filter(c => openedClassId ? c.parentId === openedClassId : true && c.parentId).map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({categories.find(parent => parent.id === c.parentId)?.title})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Họ và tên học sinh</label>
                  <input 
                    type="text"
                    required
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="Nhập tên của bạn..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Đăng bài lên tường
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
