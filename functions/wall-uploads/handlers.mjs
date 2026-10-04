import { randomBytes, randomUUID } from 'node:crypto';
import { digest, validateFile, validateShareId, validateOpenWall, validateContent, validateReceipts, validateSession, validateStoredFile, fileAttachment } from './policy.mjs';

export function wallUploadHandlers({ db, bucket, bucketName, origin, serverTimestamp }) {
const sessions = db.collection('wall_upload_sessions');
const wallRef = shareId => db.doc(`shared_learning_walls/${shareId}`);
const start = async data => {
  validateShareId(data?.shareId); validateFile(data?.name, data?.size);
  const uploadId = randomBytes(32).toString('hex');
  const claimToken = randomBytes(32).toString('hex');
  const downloadToken = randomUUID();
  const ref = sessions.doc(uploadId);
  const now = Date.now();
  const objectPath = `wall-uploads/${data.shareId}/${uploadId}/file`;
  const rateRef = db.doc(`wall_upload_rates/${data.shareId}`);
  await db.runTransaction(async transaction => {
    const [wallSnapshot, rateSnapshot] = await Promise.all([transaction.get(wallRef(data.shareId)), transaction.get(rateRef)]);
    const wall = wallSnapshot.data(); validateOpenWall(wall);
    const rate = rateSnapshot.data();
    const count = rate?.minute === Math.floor(now / 60000) ? rate.count : 0;
    if (count >= 60) throw new Error('Lớp đang có nhiều tệp tải lên. Hãy chờ một phút rồi thử lại.');
    transaction.set(rateRef, { minute: Math.floor(now / 60000), count: count + 1 });
    transaction.create(ref, { shareId: data.shareId, ownerUid: wall.authorId, claimHash: digest(claimToken), name: data.name, size: data.size, objectPath, downloadToken, expiresAt: now + 48 * 3600000 });
  });
  // Only this service account can open uploads. Clients get a capability for one new object.
  const [sessionUrl] = await bucket.file(objectPath).createResumableUpload({
    origin, preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentLength: data.size, contentType: 'application/octet-stream', contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(data.name)}`, metadata: { firebaseStorageDownloadTokens: downloadToken } },
  });
  return { uploadId, claimToken, sessionUrl };
};

const submit = async data => {
  validateShareId(data?.shareId); validateReceipts(data?.files);
  if (!/^[a-f0-9-]{36}$/.test(data?.submissionId || '')) throw new Error('Mã bài nộp chưa hợp lệ.');
  const wall = (await wallRef(data.shareId).get()).data();
  const content = validateContent(data.content, wall);
  const refs = data.files.map(item => sessions.doc(item.uploadId));
  const snapshots = await Promise.all(refs.map(ref => ref.get()));
  const sessionData = snapshots.map(item => item.data());
  for (let i = 0; i < sessionData.length; i++) {
    const session = sessionData[i];
    validateSession(session, data.files[i], data.shareId, wall.authorId, Date.now(), data.submissionId);
    const [metadata] = await bucket.file(session.objectPath).getMetadata();
    validateStoredFile(session, metadata);
  }
  const inboxRef = wallRef(data.shareId).collection('submissions').doc(data.submissionId);
  await db.runTransaction(async transaction => {
    const [wallSnapshot, inboxSnapshot, ...freshSessions] = await Promise.all([transaction.get(wallRef(data.shareId)), transaction.get(inboxRef), ...refs.map(ref => transaction.get(ref))]);
    const currentWall = wallSnapshot.data(); validateContent(content, currentWall);
    freshSessions.forEach((snapshot, i) => validateSession(snapshot.data(), data.files[i], data.shareId, currentWall.authorId, Date.now(), data.submissionId));
    const used = freshSessions.filter(snapshot => snapshot.data().submissionId);
    if (used.length) {
      if (used.length !== refs.length) throw new Error('Một phần tệp đã được dùng ở bài khác.');
      return; // A lost final response is safe to retry, even after teacher review.
    }
    if (inboxSnapshot.exists) throw new Error('Mã bài đã được sử dụng. Hãy mở bài nộp mới.');
    transaction.create(inboxRef, { ...content, attachments: sessionData.map((session, i) => fileAttachment(session, data.files[i].uploadId, bucketName)), createdAt: serverTimestamp() });
    refs.forEach(ref => transaction.update(ref, { submissionId: data.submissionId, expiresAt: 253402300799000 }));
  });
  return { submissionId: data.submissionId };
};

return { start, submit };
}
