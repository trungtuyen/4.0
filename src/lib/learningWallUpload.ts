import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';
import { forgetWallFile, pendingWallFile } from './wallFileDrafts';
import { uploadWallChunks } from './wallResumableUpload';
import type { WallAttachment, WallPost } from './learningWall';
import { wallSubmissionData } from './learningWall';

export const wallLargeUploadsEnabled = import.meta.env.VITE_WALL_LARGE_UPLOADS === 'true';
interface Receipt { uploadId: string; claimToken: string; sessionUrl: string; shareId: string; complete?: boolean }
const receipts = new Map<string, Receipt>();
const submissionIds = new Map<string, string>();
const functions = getFunctions(app, 'asia-southeast1');

function uploadRequest(sessionUrl: string, body: Blob, range: string) {
  const url = new URL(sessionUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com' || !url.pathname.startsWith('/upload/storage/v1/b/')) throw new Error('Địa chỉ tải tệp chưa hợp lệ.');
  return new Promise<{ status: number; range: string | null }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUrl);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('Content-Range', range);
    xhr.timeout = 120_000;
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader('Range') });
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Mạng bị gián đoạn. Giữ cửa sổ này và bấm gửi lại để tiếp tục tải.'));
    xhr.send(body);
  });
}

export async function submitWallFiles(shareId: string, input: Partial<WallPost>, progress: (text: string) => void) {
  const data = wallSubmissionData(input, true);
  const files = data.attachments || [];
  if (!wallLargeUploadsEnabled || !files.length || files.some(item => !pendingWallFile(item))) throw new Error('Kho tệp lớn chưa được kích hoạt.');
  const key = `${shareId}:${files.map(item => item.id).join(':')}`;
  if (!submissionIds.has(key)) submissionIds.set(key, crypto.randomUUID());
  for (const item of files) {
    const file = pendingWallFile(item)!;
    let receipt = receipts.get(item.id);
    if (!receipt || receipt.shareId !== shareId) {
      progress(`Đang mở phiên tải ${item.name}…`);
      const start = httpsCallable<{ shareId: string; name: string; size: number }, Omit<Receipt, 'shareId'>>(functions, 'startWallUpload');
      try { const result = await start({ shareId, name: item.name, size: file.size }); receipt = { ...result.data, shareId }; receipts.set(item.id, receipt); }
      catch { throw new Error('Chưa mở được kho tệp lớn. Giáo viên cần kiểm tra cấu hình Firebase Storage và máy chủ tải tệp.'); }
    }
    if (!receipt.complete) {
      await uploadWallChunks(file, (body, range) => uploadRequest(receipt!.sessionUrl, body, range), bytes => progress(`Đang tải ${item.name}: ${Math.floor(bytes * 100 / file.size)}%`));
      receipt.complete = true;
    }
  }
  progress('Đang gửi bài vào hộp chờ duyệt…');
  const finish = httpsCallable(functions, 'submitWallUpload');
  const { attachments: omitted, ...content } = data;
  await finish({ shareId, submissionId: submissionIds.get(key), content, files: files.map(item => {
    const receipt = receipts.get(item.id)!;
    return { uploadId: receipt.uploadId, claimToken: receipt.claimToken };
  }) });
  files.forEach(item => { forgetWallFile(item.id); receipts.delete(item.id); });
  submissionIds.delete(key);
}

export function discardWallFile(item: WallAttachment): void { forgetWallFile(item.id); receipts.delete(item.id); }
