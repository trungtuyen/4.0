import type { TeacherOwnedRecord } from './teacherIsolation';

export type WallLayout = 'wall' | 'grid' | 'columns' | 'stream' | 'timeline' | 'canvas' | 'map';
export type WallSort = 'newest' | 'oldest' | 'name' | 'likes';
export interface WallCategory extends TeacherOwnedRecord {
  id: string;
  title: string;
  parentId?: string | null;
  authorId?: string;
  author?: string;
  color?: string;
  bgType?: 'color' | 'image';
  bgValue?: string;
  wallDescription?: string;
  wallIcon?: string;
  wallLayout?: WallLayout;
  wallBackground?: string;
  wallArchived?: boolean;
  wallComments?: boolean;
  wallReactions?: boolean;
  wallShareId?: string;
  createdAt?: unknown;
}
export interface WallAttachment {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'file' | 'link';
  name: string;
  url: string;
  mime?: string;
  size?: number;
}
export interface WallComment { id: string; text: string; authorName?: string; createdAt?: unknown }
export interface WallPost extends TeacherOwnedRecord {
  id: string;
  categoryId: string;
  boardId?: string;
  authorId?: string;
  teacherId?: string;
  studentName: string;
  title?: string;
  text?: string;
  imageSrc?: string;
  attachments?: WallAttachment[];
  comments?: WallComment[];
  likes?: number;
  likedBy?: string[];
  score?: number;
  color?: string;
  pinned?: boolean;
  createdAt?: unknown;
  position?: { x: number; y: number };
  location?: { lat: number; lng: number; label: string };
}
export interface SharedWall {
  authorId: string;
  title: string;
  description: string;
  icon: string;
  layout: WallLayout;
  background: string;
  sections: { id: string; title: string }[];
  sectionIds: string[];
  enabled: boolean;
  permission: 'read' | 'write';
  updatedAt?: unknown;
}
export interface WallSubmission {
  id: string;
  title: string;
  text: string;
  studentName: string;
  categoryId: string;
  imageSrc: string;
  link: string;
  createdAt?: unknown;
}

export const WALL_LAYOUTS: { id: WallLayout; label: string; description: string }[] = [
  { id: 'wall', label: 'Tường', description: 'Các thẻ tự xếp theo chiều cao' },
  { id: 'grid', label: 'Lưới', description: 'Các bài đăng thẳng hàng' },
  { id: 'columns', label: 'Cột', description: 'Chia nội dung theo nhóm hoặc chủ đề' },
  { id: 'stream', label: 'Dòng bài', description: 'Đọc lần lượt từng bài' },
  { id: 'timeline', label: 'Dòng thời gian', description: 'Sắp xếp các bài theo thời gian' },
  { id: 'canvas', label: 'Tự do', description: 'Kéo các thẻ đến vị trí mong muốn' },
  { id: 'map', label: 'Bản đồ', description: 'Gắn bài đăng với địa điểm' },
];
export const WALL_BACKGROUNDS = [
  { id: 'sage', label: 'Vườn xanh', color: '#e2ebdf', pattern: 'radial-gradient(#8aa68044 1px, transparent 1px)' },
  { id: 'cream', label: 'Giấy kem', color: '#f4efdf', pattern: 'radial-gradient(#bfae7b33 1px, transparent 1px)' },
  { id: 'blue', label: 'Bầu trời', color: '#dfeaf5', pattern: 'linear-gradient(135deg, #dfeaf5, #ecf4fb)' },
  { id: 'rose', label: 'Hồng phấn', color: '#f5e1e4', pattern: 'linear-gradient(135deg, #f5e1e4, #fdf3ed)' },
  { id: 'lavender', label: 'Tím nhạt', color: '#e9e3f3', pattern: 'radial-gradient(#a591c533 1px, transparent 1px)' },
  { id: 'white', label: 'Tối giản', color: '#f5f5f4', pattern: 'none' },
];
export const WALL_POST_COLORS = ['#ffffff', '#fff3cc', '#e5f2e4', '#e5eefb', '#fbe5e8', '#efe6fc'];
export const MAX_WALL_DOCUMENT_BYTES = 750_000;

export function wallTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}
export function wallLayout(value?: string): WallLayout {
  return WALL_LAYOUTS.find(layout => layout.id === value)?.id || 'columns';
}
export function wallBackground(value?: string) {
  return WALL_BACKGROUNDS.find(background => background.id === value) || WALL_BACKGROUNDS[0];
}
export function safeWallUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function safeWallImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 650_000
    ? value : safeWallUrl(value);
}
export function safeWallAttachment(value: WallAttachment): string {
  const remote = safeWallUrl(value.url);
  if (remote) return remote;
  if (value.kind === 'image') return safeWallImage(value.url);
  // Downloads use inert binary blobs, never navigate to uploaded HTML/SVG/script URLs.
  if (value.kind === 'file' && /^data:application\/octet-stream;base64,[A-Za-z0-9+/=]+$/.test(value.url) && value.url.length < 650_000) return value.url;
  return '';
}
export function youtubeEmbed(value: string): string {
  const safe = safeWallUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  const id = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)
    ? (url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1])
    : url.hostname === 'youtu.be' ? url.pathname.slice(1) : '';
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
}
export function boardPosts(board: WallCategory, categories: WallCategory[], posts: WallPost[]): WallPost[] {
  const sameOwner = (record: TeacherOwnedRecord) => !board.authorId ||
    record.authorId === board.authorId && [record.teacherId, record.ownerUid].every(owner => !owner || owner === board.authorId);
  const ids = new Set([board.id, ...categories.filter(item => item.parentId === board.id && sameOwner(item)).map(item => item.id)]);
  return posts.filter(post => ids.has(post.categoryId) && sameOwner(post));
}
export function orderWallPosts(posts: WallPost[], sort: WallSort, search = ''): WallPost[] {
  const needle = search.trim().toLocaleLowerCase('vi');
  return posts.filter(post => !needle || [post.title, post.text, post.studentName].join(' ').toLocaleLowerCase('vi').includes(needle))
    .slice().sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      if (sort === 'name') return a.studentName.localeCompare(b.studentName, 'vi');
      if (sort === 'likes') return reactionCount(b) - reactionCount(a);
      const difference = wallTimestamp(b.createdAt) - wallTimestamp(a.createdAt);
      return sort === 'oldest' ? -difference : difference;
    });
}
export function reactionCount(post: WallPost): number {
  return Math.max(0, Number(post.likes) || 0) + new Set(post.likedBy || []).size;
}
export function validWallLocation(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
export function assertWallSize(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_WALL_DOCUMENT_BYTES) {
    throw new Error('Bài đăng quá lớn. Hãy bớt tệp đính kèm hoặc dùng liên kết Drive/YouTube.');
  }
}
export function newWallShareId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function readWallShareId(hash: string): string {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('wall') || '';
  return /^[a-f0-9]{48}$/.test(token) ? token : '';
}
export function createWallLink(base: string, origin: string, token: string): string {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error('Mã chia sẻ không hợp lệ.');
  const url = new URL(base, origin);
  url.search = '?app=learning-wall';
  url.hash = `wall=${token}`;
  return url.toString();
}
export function sharedWallPost(post: WallPost) {
  // Explicit allowlist: scores, owner identifiers, private comments and reaction identities NEVER leave the workspace.
  const result = {
    categoryId: post.categoryId,
    title: (post.title || '').slice(0, 200),
    text: (post.text || '').slice(0, 12000),
    studentName: post.studentName.slice(0, 120),
    imageSrc: safeWallImage(post.imageSrc),
    attachments: (post.attachments || []).filter(item => safeWallAttachment(item)).slice(0, 4).map(item => ({
      id: item.id, kind: item.kind, name: item.name.slice(0, 180), url: safeWallAttachment(item),
    })),
    createdAt: wallTimestamp(post.createdAt),
    color: WALL_POST_COLORS.includes(post.color || '') ? post.color : '#ffffff',
    pinned: Boolean(post.pinned),
    ...(post.position ? { position: { x: Math.max(0, Math.min(3000, Number(post.position.x) || 0)), y: Math.max(0, Math.min(5000, Number(post.position.y) || 0)) } } : {}),
    ...(post.location && validWallLocation(post.location.lat, post.location.lng) ? { location: { lat: post.location.lat, lng: post.location.lng, label: post.location.label.slice(0, 180) } } : {}),
  };
  assertWallSize(result);
  return result;
}
export function wallCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function exportWallCsv(posts: WallPost[]): string {
  return '\uFEFF' + [
    ['Họ tên', 'Tiêu đề', 'Nội dung', 'Thời gian', 'Điểm', 'Lượt thích', 'Bình luận'],
    ...posts.map(post => [post.studentName, post.title || '', post.text || '', wallTimestamp(post.createdAt) ? new Date(wallTimestamp(post.createdAt)).toISOString() : '', post.score ?? '', reactionCount(post), post.comments?.length || 0]),
  ].map(row => row.map(wallCsvCell).join(',')).join('\r\n');
}

export async function readWallFile(file: File): Promise<WallAttachment> {
  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
    if (file.size > 12 * 1024 * 1024) throw new Error('Ảnh gốc tối đa 12 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let quality = 0.8;
      let url = canvas.toDataURL('image/jpeg', quality);
      while (url.length > 480_000 && quality > 0.25) { quality -= 0.1; url = canvas.toDataURL('image/jpeg', quality); }
      if (url.length > 480_000) throw new Error('Ảnh vẫn quá lớn sau khi nén. Hãy chọn ảnh nhỏ hơn.');
      return { id: crypto.randomUUID(), kind: 'image', name: file.name.slice(0, 180), url, mime: 'image/jpeg', size: Math.round(url.length * 0.75) };
    } finally { bitmap.close(); }
  }
  if (file.size > 320 * 1024) throw new Error('Tệp tải trực tiếp tối đa 320 KB. Với video, âm thanh hoặc tài liệu lớn, hãy dùng liên kết.');
  if (!/\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|sb3)$/i.test(file.name)) throw new Error('Chỉ nhận ảnh, PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP hoặc SB3.');
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(new Error('Không đọc được tệp.'));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, 'data:application/octet-stream;'));
    reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), kind: 'file', name: file.name.slice(0, 180), url, size: file.size };
}
