import { createHash, timingSafeEqual } from 'node:crypto';

export const PROVIDER_MAX_BYTES = 5 * 1024 ** 4;
const extensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp', 'zip', 'rar', '7z', 'sb3'];
export const digest = value => createHash('sha256').update(value).digest('hex');
export function validateFile(name, size) {
  if (typeof name !== 'string' || name.length > 180 || /[\\/\u0000-\u001f]/.test(name) || !extensions.includes(name.split('.').pop()?.toLowerCase()) || !Number.isSafeInteger(size) || size <= 0 || size > PROVIDER_MAX_BYTES) throw new Error('Tên, định dạng hoặc dung lượng tệp chưa hợp lệ.');
}
export function validateShareId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{48}$/.test(value)) throw new Error('Liên kết nhận bài chưa hợp lệ.');
}
export function validateOpenWall(wall, categoryId) {
  if (!wall || !wall.enabled || wall.permission !== 'write' || typeof wall.authorId !== 'string' || !wall.authorId || (categoryId !== undefined && !wall.sectionIds?.includes(categoryId))) throw new Error('Giáo viên đã tắt nhận bài hoặc cột nhận bài chưa hợp lệ.');
}
export function validateContent(data, wall) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['title', 'text', 'studentName', 'categoryId', 'imageSrc', 'link'].includes(key))) throw new Error('Nội dung bài nộp chưa hợp lệ.');
  for (const [key, max] of [['title', 200], ['text', 12000], ['studentName', 120], ['categoryId', 128], ['imageSrc', 500000], ['link', 2048]]) {
    if (typeof data[key] !== 'string' || data[key].length > max) throw new Error('Nội dung bài nộp quá dài hoặc chưa hợp lệ.');
  }
  if (!data.studentName.trim()) throw new Error('Hãy nhập tên học sinh.');
  if (data.imageSrc && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.imageSrc)) throw new Error('Ảnh chưa hợp lệ.');
  if (data.link) {
    const url = new URL(data.link);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Liên kết chưa hợp lệ.');
  }
  validateOpenWall(wall, data.categoryId);
  return { ...data, studentName: data.studentName.trim() };
}
export function validateReceipts(files) {
  if (!Array.isArray(files) || !files.length || files.length > 2 || new Set(files.map(item => item?.uploadId)).size !== files.length) throw new Error('Mỗi bài nhận tối đa 2 tệp tài liệu.');
  for (const item of files) {
    if (!item || Object.keys(item).some(key => !['uploadId', 'claimToken'].includes(key)) || !/^[a-f0-9]{64}$/.test(item.uploadId) || !/^[a-f0-9]{64}$/.test(item.claimToken)) throw new Error('Phiếu tải tệp chưa hợp lệ.');
  }
}
export function validateSession(session, receipt, shareId, ownerUid, now, submissionId) {
  if (!session || session.shareId !== shareId || session.ownerUid !== ownerUid || (session.submissionId && session.submissionId !== submissionId) || (!session.submissionId && session.expiresAt < now)) throw new Error('Tệp thuộc lớp khác, đã được gửi hoặc phiên tải đã hết hạn.');
  const expected = Buffer.from(session.claimHash || '', 'hex');
  const actual = Buffer.from(digest(receipt.claimToken), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Không có quyền sử dụng tệp này.');
}
export function validateStoredFile(session, metadata) {
  validateFile(session.name, session.size);
  if (Number(metadata.size) !== session.size || metadata.contentType !== 'application/octet-stream' || metadata.metadata?.firebaseStorageDownloadTokens !== session.downloadToken) throw new Error('Tệp chưa tải xong hoặc không khớp thông tin đã khai báo.');
}
export function fileAttachment(session, uploadId, bucket) {
  return { id: uploadId, kind: 'file', name: session.name, size: session.size, url: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(session.objectPath)}?alt=media&token=${session.downloadToken}` };
}
