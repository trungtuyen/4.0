import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { wallUploadHandlers } from './handlers.mjs';

initializeApp();
const database = 'ai-studio-51fdfd5e-caf8-4640-bdd8-404753ba685e';
const bucketName = 'gen-lang-client-0870957273.firebasestorage.app';
const origin = 'https://trungtuyen.github.io';
const db = getFirestore(database);
const bucket = getStorage().bucket(bucketName);
const sessions = db.collection('wall_upload_sessions');
const options = { region: 'asia-southeast1', cors: [origin], maxInstances: 5, concurrency: 20, timeoutSeconds: 60 };
const guarded = handler => async request => {
  try { return await handler(request.data); }
  catch (error) {
    // Do not log capability tokens, upload URLs, content, or student names.
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('failed-precondition', error.code ? 'Kho lưu trữ chưa sẵn sàng. Hãy báo giáo viên kiểm tra.' : error.message);
  }
};

const handlers = wallUploadHandlers({ db, bucket, bucketName, origin, serverTimestamp: () => FieldValue.serverTimestamp() });
export const startWallUpload = onCall(options, guarded(handlers.start));
export const submitWallUpload = onCall(options, guarded(handlers.submit));

// Remove abandoned uploads; keep accepted work and prevent late orphan uploads.
export const cleanWallUploads = onSchedule({ schedule: 'every 24 hours', region: options.region, maxInstances: 1 }, async () => {
  const expired = await sessions.where('expiresAt', '<', Date.now()).limit(200).get();
  for (const snapshot of expired.docs) {
    if (snapshot.data().submissionId) continue;
    await bucket.file(snapshot.data().objectPath).delete({ ignoreNotFound: true });
    await snapshot.ref.delete();
  }
});
export const removeLateWallUpload = onObjectFinalized({ bucket: bucketName, region: options.region, maxInstances: 2 }, async event => {
  const match = /^wall-uploads\/[a-f0-9]{48}\/([a-f0-9]{64})\/file$/.exec(event.data.name || '');
  if (!match) return;
  const session = (await sessions.doc(match[1]).get()).data();
  if (!session || (!session.submissionId && session.expiresAt < Date.now())) await bucket.file(event.data.name).delete({ ifGenerationMatch: event.data.generation, ignoreNotFound: true });
});
export const removeRejectedWallFiles = onDocumentDeleted({ database, document: 'shared_learning_walls/{shareId}/submissions/{submissionId}', region: options.region, maxInstances: 2 }, async event => {
  if ((await db.doc(`wall_posts/shared-${event.params.submissionId}`).get()).exists) return;
  for (const item of event.data?.data()?.attachments || []) {
    if (!/^[a-f0-9]{64}$/.test(item.id || '')) continue;
    const ref = sessions.doc(item.id); const session = (await ref.get()).data();
    if (session?.shareId === event.params.shareId && session.submissionId === event.params.submissionId) {
      await bucket.file(session.objectPath).delete({ ignoreNotFound: true }); await ref.delete();
    }
  }
});
