import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, Search, LayoutGrid, Columns3, AlignJustify, Star, Archive, Settings2, Share2, X, MoreHorizontal, Heart, MessageCircle, ImagePlus, Link2, Paperclip, Camera, Send, Pin, Pencil, Trash2, Download, Play, ChevronLeft, ChevronRight, LockKeyhole, Globe, Check, Copy, LayoutDashboard, FolderOpen, MapPin, Grip, Inbox, LoaderCircle, ExternalLink } from 'lucide-react';
import {
  WALL_LAYOUTS, WALL_BACKGROUNDS, WALL_POST_COLORS, assertWallSize, boardPosts, exportWallCsv,
  orderWallPosts, reactionCount, safeWallAttachment, safeWallImage, safeWallUrl, readWallFile,
  validWallLocation, wallBackground, wallLayout, wallTimestamp, youtubeEmbed,
  type WallAttachment, type WallCategory, type WallPost, type WallSort, type WallSubmission,
} from '../../lib/learningWall';
import './learning-wall.css';

const WallMap = lazy(() => import('./WallMap'));

export interface WallBoardActions {
  createBoard: (input: Partial<WallCategory>) => Promise<void>;
  updateBoard: (board: WallCategory, input: Partial<WallCategory>) => Promise<void>;
  createSection: (board: WallCategory, title: string) => Promise<void>;
  renameSection: (section: WallCategory, title: string) => Promise<void>;
  savePost: (board: WallCategory, input: Partial<WallPost>, existing?: WallPost) => Promise<void>;
  removePost: (post: WallPost) => Promise<void>;
  react: (post: WallPost) => Promise<void>;
  comment: (post: WallPost, text: string) => Promise<void>;
  grade: (post: WallPost, score: number) => Promise<void>;
  share: (board: WallCategory, permission: 'read' | 'write') => Promise<void>;
  revoke: (board: WallCategory) => Promise<void>;
  review: (submission: WallSubmission, approve: boolean) => Promise<void>;
}
interface Props {
  categories: WallCategory[];
  posts: WallPost[];
  boardId: string | null;
  onOpen: (id: string | null) => void;
  onBack: () => void;
  displayName: string;
  ownerUid: string;
  administrator?: boolean;
  guest?: boolean;
  guestCanPost?: boolean;
  loading?: boolean;
  error?: string;
  offline?: boolean;
  submissions?: WallSubmission[];
  shareUrl?: string;
  sharePermission?: 'read' | 'write';
  actions: WallBoardActions;
}

export function WallModal({ title, children, onClose, wide = false, error = '' }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; error?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const parent = ref.current;
    parent?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab' && parent) {
        const nodes = Array.from(parent.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'));
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="lw-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`lw-modal ${wide ? 'lw-modal-wide' : ''}`}>
      <div className="lw-modal-heading"><h2>{title}</h2><button type="button" className="lw-icon" onClick={onClose} aria-label="Đóng"><X size={21} /></button></div>
      {error && <p className="lw-inline-error" role="alert">{error}</p>}
      {children}
    </div>
  </div>;
}

function Attachment({ attachment }: { attachment: WallAttachment }) {
  const url = safeWallAttachment(attachment);
  const [play, setPlay] = useState(false);
  if (!url) return <p className="lw-muted">Tệp hoặc liên kết không hợp lệ.</p>;
  if (attachment.kind === 'image') return <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><img className="lw-post-image" src={url} alt={attachment.name || 'Ảnh bài đăng'} loading="lazy" referrerPolicy="no-referrer" /></a>;
  const youtube = youtubeEmbed(url);
  if (youtube) return play
    ? <iframe className="lw-video" src={youtube} title={attachment.name || 'Video YouTube'} loading="lazy" allowFullScreen referrerPolicy="no-referrer" />
    : <button type="button" className="lw-video-launch" onClick={() => setPlay(true)}><Play size={28} /><span>Phát video YouTube</span><small>Chỉ kết nối YouTube khi nhấn phát</small></button>;
  if (attachment.kind === 'video') return <video className="lw-video" src={url} controls preload="none" />;
  if (attachment.kind === 'audio') return <audio className="lw-audio" src={url} controls preload="none" />;
  return <a className="lw-attachment" href={url} download={attachment.kind === 'file' && url.startsWith('data:') ? attachment.name : undefined} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><Paperclip size={19} /><span>{attachment.name || 'Mở liên kết'}</span><ExternalLink size={15} /></a>;
}

function PostContent({ post }: { post: WallPost }) {
  return <>
    {post.title && <h3 className="lw-post-title">{post.title}</h3>}
    {post.text && <p className="lw-post-text">{post.text}</p>}
    {safeWallImage(post.imageSrc) && <img className="lw-post-image" src={safeWallImage(post.imageSrc)} alt={`Bài làm của ${post.studentName}`} loading="lazy" referrerPolicy="no-referrer" />}
    {(post.attachments || []).map(attachment => <React.Fragment key={attachment.id}><Attachment attachment={attachment} /></React.Fragment>)}
    {post.location && <p className="lw-location"><MapPin size={14} />{post.location.label || `${post.location.lat}, ${post.location.lng}`}</p>}
  </>;
}

function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera cần HTTPS và trình duyệt có hỗ trợ.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(value => {
      if (cancelled) { value.getTracks().forEach(track => track.stop()); return; }
      stream = value;
      if (ref.current) ref.current.srcObject = value;
    }).catch(() => setError('Không mở được camera. Hãy cấp quyền hoặc chọn tải ảnh từ thiết bị.'));
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()); };
  }, []);
  return <div className="lw-camera"><video ref={ref} autoPlay playsInline muted onLoadedData={() => setReady(true)} />{error && <p role="alert">{error}</p>}<div className="lw-row"><button type="button" className="lw-button" onClick={onClose}>Hủy</button><button type="button" className="lw-button lw-primary" disabled={!ready} onClick={() => {
    const video = ref.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (blob) onCapture(new File([blob], 'anh-bai-lam.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.85);
  }}><Camera size={18} />Chụp ảnh</button></div></div>;
}

function QrCode({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => { let cancelled = false; import('qrcode').then(module => {
    if (!cancelled && ref.current) return module.toCanvas(ref.current, value, { width: 180, margin: 2, errorCorrectionLevel: 'M' });
  }).catch(() => { if (!cancelled) setError(true); }); return () => { cancelled = true; }; }, [value]);
  return error ? <p>Mã QR chưa tải được. Thầy vẫn có thể sao chép liên kết.</p> : <canvas ref={ref} aria-label="Mã QR tham gia bảng" role="img" />;
}

function defaultDraft(board: WallCategory, categories: WallCategory[], displayName: string): Partial<WallPost> {
  return { title: '', text: '', studentName: displayName, categoryId: categories.find(item => item.parentId === board.id)?.id || board.id, color: '#ffffff', attachments: [] };
}

export default function WallBoardSurface(props: Props) {
  const { categories, posts, boardId, onOpen, onBack, displayName, ownerUid, guest = false, actions } = props;
  const board = categories.find(item => item.id === boardId);
  const sections = categories.filter(item => item.parentId === boardId);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'archived'>('all');
  const [sort, setSort] = useState<WallSort>('newest');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [panel, setPanel] = useState<'' | 'create' | 'settings' | 'post' | 'detail' | 'share' | 'section' | 'inbox' | 'present'>('');
  const [boardDraft, setBoardDraft] = useState<Partial<WallCategory>>({ title: '', wallIcon: '📚', wallLayout: 'wall', wallBackground: 'sage', wallDescription: '' });
  const [draft, setDraft] = useState<Partial<WallPost>>({});
  const [editing, setEditing] = useState<WallPost | undefined>();
  const [detailId, setDetailId] = useState('');
  const [sectionEditing, setSectionEditing] = useState<WallCategory | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [comment, setComment] = useState('');
  const [score, setScore] = useState('');
  const [link, setLink] = useState('');
  const [linkKind, setLinkKind] = useState<WallAttachment['kind']>('link');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [slide, setSlide] = useState(0);
  const [mapEnabled, setMapEnabled] = useState(false);
  const [menuPost, setMenuPost] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setPanel(''); setSearch(''); setNotice(''); setActionError(''); setMapEnabled(false); setBusy(false); setDraft({}); setEditing(undefined);
  }, [ownerUid, boardId]);
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(`learning-wall-favorites::${ownerUid || 'guest'}`) || '[]'); setFavorites(Array.isArray(saved) ? saved.filter(item => typeof item === 'string') : []); }
    catch { setFavorites([]); }
  }, [ownerUid]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  const close = React.useCallback(() => { setPanel(''); setCamera(false); setActionError(''); }, []);
  const run = async (action: () => Promise<void>, message = '', shouldClose = true) => {
    if (busy) return;
    const currentGeneration = generation.current;
    setBusy(true); setActionError('');
    try { await action(); if (generation.current !== currentGeneration) return; if (shouldClose) close(); if (message) setNotice(message); }
    catch (error) { if (generation.current === currentGeneration) setActionError(error instanceof Error ? error.message : 'Không lưu được. Vui lòng thử lại.'); }
    finally { if (generation.current === currentGeneration) setBusy(false); }
  };
  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]; setFavorites(next);
    try { sessionStorage.setItem(`learning-wall-favorites::${ownerUid || 'guest'}`, JSON.stringify(next)); } catch { setNotice('Dấu sao được lưu trong phiên hiện tại.'); }
  };
  const roots = categories.filter(item => !item.parentId && (filter === 'archived' ? item.wallArchived : !item.wallArchived)
    && (filter !== 'favorites' || favorites.includes(item.id)) && (!search || `${item.title} ${item.wallDescription || ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))));
  const currentPosts = useMemo(() => board ? boardPosts(board, categories, posts) : [], [board, categories, posts]);
  const visiblePosts = orderWallPosts(currentPosts, sort, search);
  const detail = posts.find(post => post.id === detailId);
  const layout = wallLayout(board?.wallLayout);
  const background = wallBackground(board?.wallBackground);
  const canPost = Boolean(board && !board.wallArchived && (!guest || props.guestCanPost));
  const openPost = (post?: WallPost, sectionId?: string) => {
    if (!board) return;
    setDraft(post ? { ...post, attachments: [...(post.attachments || [])] } : { ...defaultDraft(board, categories, guest ? '' : displayName), ...(sectionId ? { categoryId: sectionId } : {}) });
    setEditing(post); setLink(''); setCamera(false); setPanel('post'); setActionError('');
  };
  const attachFile = async (file?: File) => {
    if (!file) return;
    await run(async () => {
      const item = await readWallFile(file);
      if (guest && item.kind !== 'image') throw new Error('Khách có thể gửi ảnh và liên kết tài liệu.');
      const attachments = [...(draft.attachments || []), item];
      if (attachments.length > (guest ? 2 : 4)) throw new Error('Đã đủ số tệp cho một bài đăng.');
      if (guest && attachments.filter(item => item.kind === 'image').length > 1) throw new Error('Mỗi bài gửi duyệt nhận một ảnh; tài liệu khác có thể gửi bằng liên kết.');
      assertWallSize({ ...draft, attachments }); setDraft(previous => ({ ...previous, attachments })); setCamera(false);
    }, '', false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const card = (post: WallPost, canvas = false) => <article key={post.id} className={`lw-post ${canvas ? 'lw-canvas-post' : ''}`} style={{ backgroundColor: WALL_POST_COLORS.includes(post.color || '') ? post.color : '#fff', ...(canvas ? { left: post.position?.x ?? (visiblePosts.indexOf(post) % 4) * 320 + 20, top: post.position?.y ?? Math.floor(visiblePosts.indexOf(post) / 4) * 420 + 20 } : {}) }}>
    {canvas && !guest && <button type="button" className="lw-drag" aria-label={`Di chuyển ${post.title || 'bài đăng'} bằng kéo hoặc phím mũi tên`} onKeyDown={event => {
      const deltas: Record<string, number[]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
      if (!deltas[event.key] || !board) return; event.preventDefault();
      const element = event.currentTarget.parentElement!; const [dx, dy] = deltas[event.key];
      void run(() => actions.savePost(board, { position: { x: Math.max(0, element.offsetLeft + dx), y: Math.max(0, element.offsetTop + dy) } }, post), '', false);
    }} onPointerDown={event => {
      if (!board || busy) return;
      event.preventDefault(); const handle = event.currentTarget; const element = handle.parentElement!;
      const start = { x: event.clientX, y: event.clientY, left: element.offsetLeft, top: element.offsetTop };
      handle.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => { element.style.left = `${Math.max(0, Math.min(3000, start.left + e.clientX - start.x))}px`; element.style.top = `${Math.max(0, Math.min(5000, start.top + e.clientY - start.y))}px`; };
      const finish = (e: PointerEvent) => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel); if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        const destination = { x: element.offsetLeft, y: element.offsetTop };
        void run(async () => { try { await actions.savePost(board, { position: destination }, post); } catch (error) { element.style.left = `${start.left}px`; element.style.top = `${start.top}px`; throw error; } }, '', false); };
      const cancel = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel); element.style.left = `${start.left}px`; element.style.top = `${start.top}px`; };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', cancel);
    }}><Grip size={16} />Kéo để sắp xếp</button>}
    <div className="lw-post-meta"><span className="lw-avatar">{(post.studentName || '?').slice(0, 1)}</span><div><strong>{post.studentName || 'Chưa có tên'}</strong><small>{wallTimestamp(post.createdAt) ? new Date(wallTimestamp(post.createdAt)).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Đang đồng bộ'}</small></div>{post.pinned && <Pin size={15} aria-label="Đã ghim" />}
      {!guest && <div className="lw-post-menu"><button className="lw-icon" type="button" aria-label={`Tùy chọn bài ${post.title || post.studentName}`} onClick={() => setMenuPost(menuPost === post.id ? '' : post.id)}><MoreHorizontal size={20} /></button>
        {menuPost === post.id && <div className="lw-menu"><button onClick={() => { setMenuPost(''); openPost(post); }}><Pencil size={15} />Chỉnh sửa</button><button disabled={busy} onClick={() => { setMenuPost(''); void run(() => actions.savePost(board!, { pinned: !post.pinned }, post), '', false); }}><Pin size={15} />{post.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}</button><button className="lw-danger" disabled={busy} onClick={() => { setMenuPost(''); if (window.confirm('Xóa bài đăng này? Bài và các nhận xét sẽ bị xóa.')) void run(() => actions.removePost(post), 'Đã xóa bài đăng.', false); }}><Trash2 size={15} />Xóa bài</button></div>}
      </div>}
    </div>
    <PostContent post={post} />
    {!guest && <div className="lw-post-footer">{board?.wallReactions !== false && <button disabled={busy} className={post.likedBy?.includes(ownerUid) ? 'lw-liked' : ''} onClick={() => void run(() => actions.react(post), '', false)} aria-label={`Thích bài ${post.title || post.studentName}`}><Heart size={17} fill={post.likedBy?.includes(ownerUid) ? 'currentColor' : 'none'} />{reactionCount(post)}</button>}
      {board?.wallComments !== false && <button onClick={() => { setDetailId(post.id); setScore(String(post.score ?? '')); setComment(''); setPanel('detail'); }}><MessageCircle size={17} />{post.comments?.length || 0}<span>Nhận xét</span></button>}
      {post.score !== undefined && <span className="lw-score">{post.score}/10</span>}
    </div>}
  </article>;

  const boardForm = <form className="lw-form" onSubmit={event => { event.preventDefault(); if (!boardDraft.title?.trim()) return;
    void run(() => panel === 'create' ? actions.createBoard(boardDraft) : actions.updateBoard(board!, boardDraft), panel === 'create' ? 'Đã tạo bảng.' : 'Đã lưu cài đặt.');
  }}><label>Tên bảng<input required maxLength={180} value={boardDraft.title || ''} onChange={event => setBoardDraft({ ...boardDraft, title: event.target.value })} placeholder="Ví dụ: Góc sáng tạo lớp 8A" /></label>
    <label>Mô tả<textarea maxLength={2000} rows={3} value={boardDraft.wallDescription || ''} onChange={event => setBoardDraft({ ...boardDraft, wallDescription: event.target.value })} placeholder="Nhiệm vụ hoặc lời chào dành cho học sinh…" /></label>
    <label>Biểu tượng<input maxLength={8} value={boardDraft.wallIcon || ''} onChange={event => setBoardDraft({ ...boardDraft, wallIcon: event.target.value })} /></label>
    <fieldset><legend>Bố cục bảng</legend><div className="lw-layout-options">{WALL_LAYOUTS.map(item => <button key={item.id} type="button" aria-pressed={wallLayout(boardDraft.wallLayout) === item.id} className={wallLayout(boardDraft.wallLayout) === item.id ? 'selected' : ''} onClick={() => setBoardDraft({ ...boardDraft, wallLayout: item.id })}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></fieldset>
    <fieldset><legend>Hình nền</legend><div className="lw-swatches">{WALL_BACKGROUNDS.map(item => <button key={item.id} type="button" title={item.label} aria-label={item.label} aria-pressed={boardDraft.wallBackground === item.id} className={boardDraft.wallBackground === item.id ? 'selected' : ''} style={{ background: item.color }} onClick={() => setBoardDraft({ ...boardDraft, wallBackground: item.id })}>{boardDraft.wallBackground === item.id && <Check size={18} />}</button>)}</div></fieldset>
    {panel === 'settings' && <><label className="lw-checkbox"><input type="checkbox" checked={boardDraft.wallComments !== false} onChange={e => setBoardDraft({ ...boardDraft, wallComments: e.target.checked })} />Bật nhận xét riêng của giáo viên</label><label className="lw-checkbox"><input type="checkbox" checked={boardDraft.wallReactions !== false} onChange={e => setBoardDraft({ ...boardDraft, wallReactions: e.target.checked })} />Bật lượt thích trong không gian giáo viên</label><button type="button" className="lw-button" disabled={busy} onClick={() => void run(() => actions.updateBoard(board!, { wallArchived: !board?.wallArchived }), board?.wallArchived ? 'Đã khôi phục bảng.' : 'Đã lưu trữ bảng; dữ liệu được giữ nguyên.')}><Archive size={17} />{board?.wallArchived ? 'Khôi phục bảng' : 'Lưu trữ bảng'}</button></>}
    <button className="lw-button lw-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : panel === 'create' ? 'Tạo bảng' : 'Lưu thay đổi'}</button>
  </form>;

  return <div className={`lw-app ${board ? 'lw-board-open' : ''}`}>
    {!board && <aside className="lw-sidebar"><button className="lw-brand" onClick={() => { setFilter('all'); setSearch(''); }}><span className="lw-brand-mark">t</span><span>tường học tập<small>Không gian cùng học</small></span></button><button className="lw-button lw-primary lw-create" onClick={() => { setBoardDraft({ title: '', wallIcon: '📚', wallLayout: 'wall', wallBackground: 'sage', wallDescription: '' }); setPanel('create'); }}><Plus size={20} />Tạo bảng mới</button>
      <nav aria-label="Danh mục bảng"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><LayoutDashboard size={19} />Bảng của tôi</button><button className={filter === 'favorites' ? 'active' : ''} onClick={() => setFilter('favorites')}><Star size={19} />Đã đánh dấu</button><button className={filter === 'archived' ? 'active' : ''} onClick={() => setFilter('archived')}><Archive size={19} />Đã lưu trữ</button></nav>
      <div className="lw-sidebar-note"><LockKeyhole size={18} /><p>Bảng mặc định riêng tư.<br />Thầy cô quyết định nội dung nào được chia sẻ.</p></div><div className="lw-account"><span className="lw-avatar">{displayName.slice(0, 1)}</span><div><strong>{displayName}</strong><small>{props.administrator ? 'Quản trị toàn hệ thống' : 'Không gian giáo viên'}</small></div></div><button className="lw-back" onClick={onBack}><ArrowLeft size={17} />Về hệ sinh thái</button>
    </aside>}
    <main className="lw-main" style={board ? { backgroundColor: background.color, backgroundImage: background.pattern, backgroundSize: background.pattern.startsWith('radial') ? '18px 18px' : 'cover' } : undefined}>
      <header className="lw-topbar">{board ? <><div className="lw-row"><button className="lw-icon" onClick={() => guest ? onBack() : onOpen(null)} aria-label="Về danh sách bảng"><ArrowLeft size={21} /></button><span className="lw-mini-brand">tường học tập</span><span className="lw-badge">{guest ? 'Bảng được chia sẻ' : 'Không gian riêng'}</span></div><div className="lw-row"><button className="lw-button lw-soft" onClick={() => { setSlide(0); setPanel('present'); }} disabled={!currentPosts.length}><Play size={17} /><span className="lw-hide-mobile">Trình chiếu</span></button>{!guest && <><button className="lw-button lw-soft" onClick={() => setPanel('share')}><Share2 size={17} />Chia sẻ</button><button className="lw-icon" aria-label="Cài đặt bảng" onClick={() => { setBoardDraft({ title: board.title, wallDescription: board.wallDescription || '', wallIcon: board.wallIcon || '📚', wallLayout: layout, wallBackground: board.wallBackground || 'sage', wallComments: board.wallComments !== false, wallReactions: board.wallReactions !== false }); setPanel('settings'); }}><Settings2 size={21} /></button></>}</div></>
        : <><span className="lw-breadcrumb">Không gian làm việc <span>/</span> {props.administrator ? 'Toàn hệ thống' : 'Của tôi'}</span><span className="lw-badge"><LockKeyhole size={13} />Riêng tư</span></>}
      </header>
      {(props.error || props.offline) && <div className="lw-banner" role="alert">{props.error || 'Đang mất mạng. Nội dung đang xem được giữ lại; kết nối lại để lưu thay đổi.'}</div>}
      {notice && <div className="lw-toast" role="status"><Check size={17} />{notice}</div>}
      {actionError && <div className="lw-banner lw-error" role="alert">{actionError}</div>}
      {board ? <><section className="lw-board-heading"><span className="lw-board-emoji">{board.wallIcon || '📚'}</span><div><p className="lw-eyebrow">{guest ? 'CÙNG CHIA SẺ VÀ KHÁM PHÁ' : board.author || displayName}</p><h1>{board.title}</h1>{board.wallDescription && <p className="lw-description">{board.wallDescription}</p>}<p className="lw-board-count">{currentPosts.length} bài đăng · {sections.length} cột{board.wallArchived ? ' · Đã lưu trữ' : ''}</p></div></section>
        <div className="lw-board-toolbar"><label className="lw-search"><Search size={17} /><input aria-label="Tìm bài đăng" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm bài đăng, học sinh…" /></label><div className="lw-row"><select aria-label="Sắp xếp bài đăng" value={sort} onChange={e => setSort(e.target.value as WallSort)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="name">Tên học sinh</option>{!guest && <option value="likes">Nhiều lượt thích</option>}</select>{!guest && <><select aria-label="Bố cục bảng" value={layout} disabled={busy} onChange={e => void run(() => actions.updateBoard(board, { wallLayout: e.target.value as WallCategory['wallLayout'] }), '', false)}>{WALL_LAYOUTS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button className="lw-button lw-soft" onClick={() => setPanel('inbox')}><Inbox size={17} />Chờ duyệt{Boolean(props.submissions?.length) && <b className="lw-count">{props.submissions?.length}</b>}</button></>}</div></div>
        {props.loading ? <div className="lw-empty"><LoaderCircle className="lw-spin" /><p>Đang tải bài đăng…</p></div> : layout === 'columns' ? <div className="lw-columns">{[{ ...board, title: 'Bài chung' }, ...sections].filter(section => section.id !== board.id || visiblePosts.some(post => post.categoryId === board.id) || !sections.length).map(section => <section className="lw-column" key={section.id}><div className="lw-column-heading"><h2>{section.title}</h2><span>{visiblePosts.filter(post => post.categoryId === section.id).length}</span>{!guest && section.id !== board.id && <button className="lw-icon" aria-label={`Đổi tên cột ${section.title}`} onClick={() => { setSectionEditing(section); setSectionTitle(section.title); setPanel('section'); }}><Pencil size={15} /></button>}</div>{visiblePosts.filter(post => post.categoryId === section.id).map(post => card(post))}{canPost && <button className="lw-add-column-post" onClick={() => openPost(undefined, section.id)}><Plus size={19} />Thêm bài</button>}</section>)}{!guest && !board.wallArchived && <button className="lw-add-section" onClick={() => { setSectionEditing(null); setSectionTitle(''); setPanel('section'); }}><Plus size={20} />Thêm cột</button>}</div>
          : layout === 'map' ? <div className="lw-map-layout"><div className="lw-map-panel">{mapEnabled ? <Suspense fallback={<div className="lw-empty">Đang tải bản đồ…</div>}><WallMap posts={visiblePosts} onSelect={id => { setDetailId(id); setPanel('detail'); }} /></Suspense> : <div className="lw-empty"><MapPin size={38} /><h2>Khám phá theo địa điểm</h2><p>Bật bản đồ sẽ kết nối máy chủ OpenStreetMap.<br />Chỉ các bài có tọa độ được đặt lên bản đồ.</p><button className="lw-button" onClick={() => setMapEnabled(true)}>Hiện bản đồ</button></div>}</div><div className="lw-map-posts">{visiblePosts.map(post => card(post))}</div></div>
          : layout === 'canvas' ? <div className="lw-canvas-scroll"><div className="lw-canvas" style={{ minHeight: Math.max(900, ...visiblePosts.map(post => (post.position?.y || 0) + 650)) }}>{visiblePosts.map(post => card(post, true))}</div></div>
          : <div className={`lw-posts lw-layout-${layout}`}>{visiblePosts.map(post => <div key={post.id} className="lw-post-wrap">{layout === 'timeline' && <time>{wallTimestamp(post.createdAt) ? new Date(wallTimestamp(post.createdAt)).toLocaleDateString('vi-VN') : 'Bài mới'}</time>}{card(post)}</div>)}</div>}
        {!visiblePosts.length && layout !== 'columns' && layout !== 'map' && <div className="lw-empty"><MessageCircle size={38} /><h2>{search ? 'Chưa có bài phù hợp' : 'Bắt đầu bằng một ý tưởng'}</h2><p>{search ? 'Thử một từ khóa khác.' : 'Thêm câu hỏi, hình ảnh hoặc chia sẻ sản phẩm học tập đầu tiên.'}</p>{canPost && <button className="lw-button" onClick={() => openPost()}><Plus size={18} />Thêm bài đầu tiên</button>}</div>}
        {canPost && <button className="lw-fab" aria-label="Thêm bài đăng" onClick={() => openPost()}><Plus size={30} /></button>}
      </> : <section className="lw-dashboard"><div className="lw-dashboard-heading"><div><p className="lw-eyebrow">MỖI Ý TƯỞNG ĐỀU CÓ MỘT CHỖ</p><h1>{filter === 'favorites' ? 'Bảng đã đánh dấu' : filter === 'archived' ? 'Bảng đã lưu trữ' : props.administrator ? 'Bảng toàn hệ thống' : 'Bảng của tôi'}</h1><p>Tập hợp ý tưởng. Chia sẻ bài làm. Cùng nhau khám phá.</p></div><button className="lw-button lw-primary" onClick={() => { setBoardDraft({ title: '', wallIcon: '📚', wallLayout: 'wall', wallBackground: 'sage', wallDescription: '' }); setPanel('create'); }}><Plus size={18} />Tạo bảng</button></div><div className="lw-dashboard-tools"><label className="lw-search"><Search size={18} /><input aria-label="Tìm bảng" placeholder="Tìm bảng theo tên…" value={search} onChange={event => setSearch(event.target.value)} /></label><span>{roots.length} bảng</span></div>
        {props.loading ? <div className="lw-empty"><LoaderCircle className="lw-spin" />Đang tải bảng…</div> : <div className="lw-board-grid">{roots.map(item => { const bg = wallBackground(item.wallBackground); const count = boardPosts(item, categories, posts).length; return <article className="lw-board-card" key={item.id}><button className="lw-board-cover" style={{ backgroundColor: bg.color, backgroundImage: bg.pattern }} onClick={() => onOpen(item.id)} aria-label={`Mở bảng ${item.title}`}><span className="lw-card-emoji">{item.wallIcon || '📚'}</span><span className="lw-mini-cards"><i /><i /><i /></span></button><button className={`lw-favorite ${favorites.includes(item.id) ? 'active' : ''}`} aria-pressed={favorites.includes(item.id)} aria-label={`Đánh dấu ${item.title}`} onClick={() => toggleFavorite(item.id)}><Star size={18} fill={favorites.includes(item.id) ? 'currentColor' : 'none'} /></button><div className="lw-board-card-body"><button className="lw-board-card-title" onClick={() => onOpen(item.id)}>{item.title}</button><p>{item.wallDescription || `${categories.filter(child => child.parentId === item.id).length} cột · ${count} bài đăng`}</p><div><span><LockKeyhole size={12} />{item.author || displayName}</span><span>{WALL_LAYOUTS.find(layout => layout.id === wallLayout(item.wallLayout))?.label}</span></div></div></article>; })}</div>}
        {!props.loading && !roots.length && <div className="lw-empty"><FolderOpen size={44} /><h2>{search ? 'Không tìm thấy bảng' : filter === 'all' ? 'Một không gian mới để cùng học' : 'Chưa có bảng trong mục này'}</h2><p>{filter === 'all' ? 'Tạo bảng đầu tiên hoặc mở lại bảng lớp học đã có.' : 'Các bảng phù hợp sẽ xuất hiện tại đây.'}</p></div>}
      </section>}
    </main>

    {(panel === 'create' || panel === 'settings') && <WallModal title={panel === 'create' ? 'Tạo bảng học tập' : 'Cài đặt bảng'} onClose={close} error={actionError}>{boardForm}</WallModal>}
    {panel === 'section' && board && <WallModal title={sectionEditing ? 'Đổi tên cột' : 'Thêm cột'} onClose={close} error={actionError}><form className="lw-form" onSubmit={event => { event.preventDefault(); if (sectionTitle.trim()) void run(() => sectionEditing ? actions.renameSection(sectionEditing, sectionTitle.trim()) : actions.createSection(board, sectionTitle.trim()), 'Đã lưu cột.'); }}><label>Tên cột<input required maxLength={180} value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} placeholder="Ví dụ: Nhóm 1" /></label><button type="submit" disabled={busy} className="lw-button lw-primary">Lưu cột</button></form></WallModal>}
    {panel === 'post' && board && <WallModal title={editing ? 'Chỉnh sửa bài đăng' : guest ? 'Gửi bài cho giáo viên duyệt' : 'Thêm bài đăng'} onClose={close} error={actionError} wide><form className="lw-form" onSubmit={event => { event.preventDefault(); if (busy) return;
      void run(async () => {
        if (!draft.studentName?.trim()) throw new Error('Vui lòng nhập tên hiển thị.');
        if (!draft.title?.trim() && !draft.text?.trim() && !draft.imageSrc && !draft.attachments?.length) throw new Error('Hãy thêm nội dung hoặc tệp cho bài đăng.');
        if (draft.location && !validWallLocation(draft.location.lat, draft.location.lng)) throw new Error('Tọa độ chưa hợp lệ.');
        assertWallSize(draft); await actions.savePost(board, draft, editing);
      }, guest ? 'Đã gửi bài. Giáo viên sẽ duyệt trước khi bài xuất hiện.' : 'Đã lưu bài đăng.');
    }}><div className="lw-form-grid"><label>{guest ? 'Tên hiển thị của em (tự khai)' : 'Người đăng / học sinh'}<input required maxLength={120} value={draft.studentName || ''} onChange={e => setDraft({ ...draft, studentName: e.target.value })} placeholder="Họ và tên" /></label><label>Cột<select value={draft.categoryId || board.id} onChange={e => setDraft({ ...draft, categoryId: e.target.value })}><option value={board.id}>Bài chung</option>{sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div>
      <input className="lw-title-input" aria-label="Tiêu đề bài đăng" placeholder="Tiêu đề bài đăng" maxLength={200} value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} />
      <textarea aria-label="Nội dung bài đăng" placeholder="Viết điều em muốn chia sẻ…" maxLength={12000} rows={5} value={draft.text || ''} onChange={e => setDraft({ ...draft, text: e.target.value })} />
      {draft.imageSrc && <div className="lw-draft-attachment"><img src={safeWallImage(draft.imageSrc)} alt="Ảnh hiện có" /><button type="button" className="lw-icon" aria-label="Bỏ ảnh cũ" onClick={() => setDraft({ ...draft, imageSrc: '' })}><X size={18} /></button></div>}
      {(draft.attachments || []).map(item => <div className="lw-draft-attachment" key={item.id}>{item.kind === 'image' ? <img src={safeWallImage(item.url)} alt={item.name} /> : <Paperclip size={20} />}<span>{item.name}</span><button type="button" className="lw-icon" aria-label={`Bỏ ${item.name}`} onClick={() => setDraft({ ...draft, attachments: draft.attachments?.filter(attachment => attachment.id !== item.id) })}><X size={18} /></button></div>)}
      {camera ? <CameraCapture onClose={() => setCamera(false)} onCapture={file => void attachFile(file)} /> : <div className="lw-attachment-tools"><input ref={fileRef} hidden type="file" accept={guest ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.sb3'} onChange={event => void attachFile(event.target.files?.[0])} /><button className="lw-button" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={18} />Ảnh / tệp</button><button className="lw-button" type="button" disabled={busy} onClick={() => setCamera(true)}><Camera size={18} />Máy ảnh</button></div>}
      <div className="lw-link-input"><select aria-label="Loại liên kết" value={linkKind} onChange={e => setLinkKind(e.target.value as WallAttachment['kind'])}><option value="link">Liên kết</option>{!guest && <><option value="video">Video trực tiếp</option><option value="audio">Âm thanh trực tiếp</option></>}</select><input aria-label="Liên kết đính kèm" type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://… (YouTube, Drive, tài liệu)" /><button className="lw-icon" type="button" aria-label="Thêm liên kết" onClick={() => { const url = safeWallUrl(link); if (!url) { setActionError('Liên kết phải bắt đầu bằng https:// hoặc http://.'); return; } if ((draft.attachments?.length || 0) >= (guest ? 2 : 4) || (guest && draft.attachments?.some(item => item.kind !== 'image'))) { setActionError('Đã đủ số liên kết hoặc tệp cho bài này.'); return; } setDraft({ ...draft, attachments: [...(draft.attachments || []), { id: crypto.randomUUID(), kind: linkKind, url, name: new URL(url).hostname }] }); setLink(''); setActionError(''); }}><Plus size={20} /></button></div>
      <p className="lw-help">Ảnh tự nén trước khi gửi. Tệp trực tiếp tối đa 320 KB; video, âm thanh và tài liệu lớn dùng liên kết. {guest && 'Không gửi số điện thoại, địa chỉ hoặc thông tin riêng tư.'}</p>
      {!guest && <><fieldset><legend>Màu thẻ</legend><div className="lw-swatches">{WALL_POST_COLORS.map(color => <button key={color} type="button" className={draft.color === color ? 'selected' : ''} aria-label={`Màu thẻ ${color}`} aria-pressed={draft.color === color} style={{ background: color }} onClick={() => setDraft({ ...draft, color })}>{draft.color === color && <Check size={17} />}</button>)}</div></fieldset><details><summary><MapPin size={15} />Thêm địa điểm cho bản đồ</summary><div className="lw-form-grid"><label>Vĩ độ<input type="number" min="-90" max="90" step="any" value={draft.location?.lat ?? ''} onChange={e => setDraft({ ...draft, location: { lat: Number(e.target.value), lng: draft.location?.lng ?? 0, label: draft.location?.label || '' } })} /></label><label>Kinh độ<input type="number" min="-180" max="180" step="any" value={draft.location?.lng ?? ''} onChange={e => setDraft({ ...draft, location: { lat: draft.location?.lat ?? 0, lng: Number(e.target.value), label: draft.location?.label || '' } })} /></label></div><label>Tên địa điểm<input maxLength={180} value={draft.location?.label || ''} onChange={e => setDraft({ ...draft, location: { lat: draft.location?.lat ?? 0, lng: draft.location?.lng ?? 0, label: e.target.value } })} /></label></details></>}
      {actionError && <p className="lw-inline-error" role="alert">{actionError}</p>}<button type="submit" className="lw-button lw-primary" disabled={busy || props.offline}><Send size={18} />{busy ? 'Đang lưu…' : guest ? 'Gửi bài chờ duyệt' : editing ? 'Lưu bài đăng' : 'Đăng bài'}</button>
    </form></WallModal>}
    {panel === 'detail' && detail && <WallModal title={detail.title || 'Chi tiết bài đăng'} onClose={close} error={actionError} wide><div className="lw-form"><p className="lw-muted">{detail.studentName}</p><PostContent post={detail} />{!guest && <><h3>Nhận xét riêng của giáo viên</h3><p className="lw-help">Nhận xét và điểm số không xuất hiện ở liên kết chia sẻ.</p><div className="lw-comments">{(detail.comments || []).map(item => <div key={item.id}><strong>{item.authorName || 'Giáo viên'}</strong><p>{item.text}</p></div>)}</div><form onSubmit={e => { e.preventDefault(); if (comment.trim()) void run(async () => { await actions.comment(detail, comment.trim()); setComment(''); }, 'Đã thêm nhận xét.', false); }}><label>Viết nhận xét<textarea required maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} /></label><button className="lw-button" disabled={busy}>Gửi nhận xét</button></form><form className="lw-row" onSubmit={e => { e.preventDefault(); if (score !== '') void run(() => actions.grade(detail, Number(score)), 'Đã lưu điểm.', false); }}><label>Điểm / 10<input type="number" min="0" max="10" step="0.25" value={score} onChange={e => setScore(e.target.value)} required /></label><button className="lw-button" disabled={busy}>Lưu điểm</button></form></>}</div></WallModal>}
    {panel === 'share' && board && <WallModal title="Chia sẻ và xuất bảng" onClose={close} error={actionError}><div className="lw-form"><div className="lw-share-intro"><Globe size={23} /><div><h3>Ai có liên kết đều có thể xem</h3><p>Chỉ công bố bài của bảng này. Điểm, nhận xét riêng và danh sách lớp không được đưa lên liên kết.</p></div></div><p className="lw-help">Tên hiển thị, nội dung bài và tệp sẽ được chia sẻ. Chỉ bật khi có sự đồng ý phù hợp. Tối đa 150 bài / lần công bố.</p>
      <div className="lw-row"><button className="lw-button" disabled={busy} onClick={() => void run(() => actions.share(board, 'read'), 'Đã công bố bảng chỉ xem.', false)}>Chỉ xem</button><button className="lw-button lw-primary" disabled={busy} onClick={() => void run(() => actions.share(board, 'write'), 'Đã mở nhận bài; bài mới luôn cần duyệt.', false)}>Xem và gửi bài</button></div>
      {props.shareUrl && <><div className="lw-qr"><QrCode value={props.shareUrl} /><p>{props.sharePermission === 'write' ? 'Đang nhận bài chờ duyệt' : 'Đang chia sẻ chỉ xem'}</p></div><label>Liên kết tham gia<input readOnly value={props.shareUrl} onFocus={event => event.target.select()} /></label><button className="lw-button" onClick={() => void run(() => navigator.clipboard.writeText(props.shareUrl!), 'Đã sao chép liên kết.', false)}><Copy size={17} />Sao chép liên kết</button><button className="lw-button lw-danger" disabled={busy} onClick={() => void run(() => actions.revoke(board), 'Đã tắt truy cập liên kết.', false)}><LockKeyhole size={17} />Tắt chia sẻ</button></>}
      {actionError && <p className="lw-inline-error" role="alert">{actionError}</p>}
      <hr /><h3>Xuất dữ liệu trên thiết bị</h3><button className="lw-button" onClick={() => { const url = URL.createObjectURL(new Blob([exportWallCsv(currentPosts)], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Tuong_hoc_tap_${board.id}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Download size={17} />Tải bảng CSV mở bằng Excel</button><button className="lw-button" onClick={() => { close(); setTimeout(() => window.print(), 100); }}><Download size={17} />In / lưu PDF</button><p className="lw-help">Bản xuất riêng gồm dữ liệu của giáo viên. Kiểm tra trước khi gửi cho người khác.</p>
    </div></WallModal>}
    {panel === 'inbox' && <WallModal title="Bài học sinh gửi chờ duyệt" onClose={close} error={actionError} wide><div className="lw-form"><p className="lw-help">Tên người gửi là tự khai. Kiểm tra nội dung trước khi công bố. Hiển thị tối đa 100 bài chờ, theo thứ tự gửi.</p>{!(props.submissions || []).length && <div className="lw-empty"><Inbox size={35} /><p>Chưa có bài cần duyệt.</p></div>}{props.submissions?.map(item => <article className="lw-review" key={item.id}><strong>{item.studentName}</strong><h3>{item.title}</h3><p>{item.text}</p>{safeWallImage(item.imageSrc) && <img src={safeWallImage(item.imageSrc)} alt="Ảnh gửi duyệt" />}{safeWallUrl(item.link) && <a href={safeWallUrl(item.link)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Xem liên kết đính kèm</a>}<div className="lw-row"><button className="lw-button lw-primary" disabled={busy} onClick={() => void run(() => actions.review(item, true), 'Đã duyệt bài.', false)}><Check size={17} />Duyệt và đăng</button><button className="lw-button lw-danger" disabled={busy} onClick={() => { if (window.confirm('Từ chối và xóa bài gửi này?')) void run(() => actions.review(item, false), 'Đã từ chối bài.', false); }}>Từ chối</button></div></article>)}{actionError && <p role="alert">{actionError}</p>}</div></WallModal>}
    {panel === 'present' && <WallModal title={`${board?.title || 'Trình chiếu'} · ${Math.min(slide + 1, currentPosts.length)}/${currentPosts.length}`} onClose={close} error={actionError} wide><div className="lw-slideshow">{currentPosts[slide] ? <><p className="lw-muted">{currentPosts[slide].studentName}</p><PostContent post={currentPosts[slide]} /></> : <p>Không có bài để trình chiếu.</p>}<div className="lw-row"><button className="lw-button" aria-label="Bài trước" disabled={slide === 0} onClick={() => setSlide(slide - 1)}><ChevronLeft /></button><span>{slide + 1} / {currentPosts.length}</span><button className="lw-button" aria-label="Bài tiếp" disabled={slide >= currentPosts.length - 1} onClick={() => setSlide(slide + 1)}><ChevronRight /></button></div></div></WallModal>}
    {board && <div className="lw-print"><h1>{board.title}</h1><p>{board.wallDescription}</p>{currentPosts.map(post => <section key={post.id}><h2>{post.title || 'Bài đăng'}</h2><p>{post.studentName}</p><PostContent post={post} />{!guest && post.score !== undefined && <p>Điểm: {post.score}/10</p>}</section>)}</div>}
  </div>;
}
