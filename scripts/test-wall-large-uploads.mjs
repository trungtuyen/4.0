import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { wallUploadHandlers } from '../functions/wall-uploads/handlers.mjs';
import { digest, validateFile, PROVIDER_MAX_BYTES } from '../functions/wall-uploads/policy.mjs';
import { uploadWallChunks } from '../src/lib/wallResumableUpload.ts';
import { rememberWallFile, forgetWallFile } from '../src/lib/wallFileDrafts.ts';
import { wallSubmissionData, submissionPostAttachments, sharedWallPost, submissionFiles } from '../src/lib/learningWall.ts';

const shareId = 'a'.repeat(48), otherShare = 'b'.repeat(48);
const records = new Map();
const objects = new Map();
function doc(path) {
  const ref = { path, get: async () => snapshot(ref), collection: name => ({ doc: id => doc(`${path}/${name}/${id}`) }) };
  return ref;
}
function snapshot(ref) { return { exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)), ref }; }
const db = {
  doc, collection: name => ({ doc: id => doc(`${name}/${id}`) }),
  async runTransaction(fn) {
    const writes = [];
    const result = await fn({ get: async ref => snapshot(ref), set: (ref, value) => writes.push(['set', ref, value]), create: (ref, value) => writes.push(['create', ref, value]), update: (ref, value) => writes.push(['update', ref, value]) });
    for (const [kind, ref] of writes) if (kind === 'create' && records.has(ref.path)) throw new Error('Already exists');
    for (const [kind, ref, value] of writes) records.set(ref.path, kind === 'update' ? { ...records.get(ref.path), ...value } : value);
    return result;
  },
};
const bucketName = 'gen-lang-client-0870957273.firebasestorage.app';
const bucket = { file: path => ({
  async createResumableUpload(options) {
    assert.equal(options.preconditionOpts.ifGenerationMatch, 0);
    assert.equal(options.metadata.contentType, 'application/octet-stream');
    assert.ok(options.metadata.contentLength > 0);
    assert.ok(options.metadata.contentDisposition.startsWith('attachment;'));
    objects.set(path, { ...options.metadata, size: 0 });
    return ['https://storage.googleapis.com/upload/storage/v1/b/test/o?upload_id=test'];
  },
  async getMetadata() { return [objects.get(path)]; },
}) };
const handlers = wallUploadHandlers({ db, bucket, bucketName, origin: 'https://trungtuyen.github.io', serverTimestamp: () => new Date() });
const wallPath = `shared_learning_walls/${shareId}`;
const wall = { enabled: true, permission: 'write', authorId: 'teacher-one', sectionIds: ['class-one'] };
const content = { title: '', text: '', studentName: 'An', categoryId: 'class-one', imageSrc: '', link: '' };
records.set(wallPath, wall);
const start = await handlers.start({ shareId, name: 'Bài tập.DOCX', size: 20 * 1024 * 1024 });
const sessionPath = `wall_upload_sessions/${start.uploadId}`;
const session = records.get(sessionPath);
assert.equal(session.claimHash, digest(start.claimToken));
assert.equal(JSON.stringify(session).includes(start.claimToken), false);
const data = { shareId, submissionId: randomUUID(), content, files: [{ uploadId: start.uploadId, claimToken: start.claimToken }] };
const inbox = `${wallPath}/submissions/${data.submissionId}`;
await assert.rejects(handlers.submit(data), /chưa tải xong/);
objects.get(session.objectPath).size = session.size;
await assert.rejects(handlers.submit({ ...data, files: [{ ...data.files[0], claimToken: 'c'.repeat(64) }] }), /quyền/);
records.set(`shared_learning_walls/${otherShare}`, wall);
await assert.rejects(handlers.submit({ ...data, shareId: otherShare }), /lớp khác/);
await assert.rejects(handlers.submit({ ...data, content: { ...content, score: 10 } }), /chưa hợp lệ/);
await assert.rejects(handlers.submit({ ...data, content: { ...content, categoryId: 'other-class' } }), /cột/);
await assert.rejects(handlers.submit({ ...data, files: [data.files[0], data.files[0]] }), /2 tệp/);
records.set(wallPath, { ...wall, enabled: false });
await assert.rejects(handlers.start({ shareId, name: 'x.xlsx', size: 1024 }), /tắt nhận/);
await assert.rejects(handlers.submit(data), /tắt nhận/);
records.set(wallPath, wall);
await handlers.submit(data);
assert.ok(records.has(inbox));
assert.equal(records.get(inbox).attachments[0].size, 20 * 1024 * 1024);
assert.ok(JSON.stringify(records.get(inbox)).length < 2000);
assert.equal(records.get(sessionPath).expiresAt, 253402300799000);
await handlers.submit(data);
assert.equal([...records.keys()].filter(path => path.includes('/submissions/')).length, 1);
records.delete(inbox); // Approval removes inbox record; retry cannot recreate it.
await handlers.submit(data); assert.equal(records.has(inbox), false);
await assert.rejects(handlers.submit({ ...data, submissionId: randomUUID() }), /đã được gửi/);
const approved = submissionPostAttachments({ ...content, attachments: records.get(sessionPath) ? [
  { id: start.uploadId, kind: 'file', name: session.name, size: session.size, url: `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(session.objectPath)}?alt=media&token=${session.downloadToken}` },
] : [] });
const publicPost = sharedWallPost({ id: 'post', categoryId: 'class-one', studentName: 'An', attachments: approved });
assert.equal(publicPost.attachments[0].url, approved[0].url);
assert.equal(publicPost.attachments[0].name, session.name);
assert.throws(() => submissionFiles([{ ...approved[0], url: approved[0].url.replace(bucketName, 'attacker-bucket') }]));
assert.throws(() => validateFile('attack.html', 1024));
assert.throws(() => validateFile('../work.docx', 1024));
assert.throws(() => validateFile('work.docx', PROVIDER_MAX_BYTES + 1));
validateFile('work.docx', 1024 ** 3); // No arbitrary 1 MB/10 MB/100 MB cap.
validateFile('work.xlsx', PROVIDER_MAX_BYTES);
const largeFile = new File([new Uint8Array(20 * 1024 * 1024)], 'Large.xlsx');
const pending = rememberWallFile(largeFile);
assert.throws(() => wallSubmissionData({ ...content, attachments: [pending] }));
assert.ok(JSON.stringify(wallSubmissionData({ ...content, attachments: [pending] }, true)).length < 1000);
forgetWallFile(pending.id);
assert.throws(() => wallSubmissionData({ ...content, attachments: [pending] }, true));

// Exercise real byte slicing with a 20 MB binary payload, interrupted and resumed.
const source = Buffer.alloc(20 * 1024 * 1024 + 17);
for (let i = 0; i < source.length; i++) source[i] = i % 251;
const blob = new Blob([source]);
let offset = 0, interrupted = false, chunks = [], probes = 0;
const request = async (body, range) => {
  if (range.startsWith('bytes */')) { probes++; return { status: offset === blob.size ? 200 : 308, range: offset ? `bytes=0-${offset - 1}` : null }; }
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
  assert.ok(match); assert.equal(Number(match[1]), offset); assert.equal(Number(match[3]), blob.size);
  if (offset && !interrupted) { interrupted = true; throw new Error('Disconnected'); }
  const bytes = Buffer.from(await body.arrayBuffer());
  assert.equal(bytes.length, Number(match[2]) - offset + 1);
  assert.ok(bytes.length <= 8 * 1024 * 1024);
  chunks.push(bytes); offset += bytes.length;
  return { status: offset === blob.size ? 200 : 308, range: `bytes=0-${offset - 1}` };
};
const progress = [];
await assert.rejects(uploadWallChunks(blob, request, bytes => progress.push(bytes)), /Disconnected/);
await uploadWallChunks(blob, request, bytes => progress.push(bytes));
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(Buffer.concat(chunks)), hash(source));
assert.equal(offset, source.length); assert.equal(chunks.length, 3); assert.equal(probes, 2);
await uploadWallChunks(blob, request, bytes => progress.push(bytes));
assert.equal(chunks.length, 3); // Retry after lost final response does not upload again.
assert.equal(progress.at(-1), blob.size);
await assert.rejects(uploadWallChunks(blob, async () => ({ status: 403, range: null }), () => {}));
await assert.rejects(uploadWallChunks(blob, async () => ({ status: 308, range: 'bytes=9-10' }), () => {}));
console.info('Large student uploads: 20 MB exact-byte resume, idempotent submit/review, class-bound capabilities, rejected/closed boards, metadata verification, inert downloads and provider boundary passed.');
