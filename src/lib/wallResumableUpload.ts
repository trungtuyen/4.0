export interface UploadResponse { status: number; range: string | null }
export type UploadRequest = (body: Blob, contentRange: string) => Promise<UploadResponse>;
const CHUNK_BYTES = 8 * 1024 * 1024;

function nextOffset(range: string | null): number {
  if (!range) return 0;
  const match = /^bytes=0-(\d+)$/.exec(range);
  if (!match) throw new Error('Máy chủ trả về vị trí tải tệp không hợp lệ.');
  return Number(match[1]) + 1;
}

// Probe server state on every attempt, including retry after a lost final response.
export async function uploadWallChunks(file: Blob, request: UploadRequest, progress: (bytes: number) => void) {
  let response = await request(new Blob(), `bytes */${file.size}`);
  if (response.status === 200 || response.status === 201) { progress(file.size); return; }
  if (response.status !== 308) throw new Error('Phiên tải tệp đã hết hạn hoặc chưa được mở. Hãy chọn lại tệp.');
  let offset = nextOffset(response.range);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= file.size) throw new Error('Vị trí tải tệp chưa hợp lệ.');
  progress(offset);
  while (offset < file.size) {
    const end = Math.min(file.size, offset + CHUNK_BYTES);
    response = await request(file.slice(offset, end), `bytes ${offset}-${end - 1}/${file.size}`);
    if (response.status === 200 || response.status === 201) {
      if (end !== file.size) throw new Error('Máy chủ kết thúc tải trước khi nhận đủ tệp.');
      progress(file.size); return;
    }
    if (response.status !== 308) throw new Error('Chưa tải được tệp. Giữ cửa sổ này và bấm gửi lại để tiếp tục.');
    const next = nextOffset(response.range);
    if (!Number.isSafeInteger(next) || next <= offset || next > end) throw new Error('Máy chủ chưa xác nhận phần tệp vừa tải.');
    offset = next; progress(offset);
  }
  throw new Error('Tệp chưa được máy chủ xác nhận hoàn tất. Hãy bấm gửi lại.');
}
