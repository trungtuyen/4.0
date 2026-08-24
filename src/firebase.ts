import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
if (appCheckSiteKey && typeof window !== 'undefined') {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn('Không thể khởi tạo Firebase App Check.', error);
  }
}

const usePersistentFirestoreCache =
  typeof window !== 'undefined' &&
  typeof indexedDB !== 'undefined' &&
  import.meta.env.VITE_FIRESTORE_CACHE_MODE !== 'memory';

export const db = initializeFirestore(app, {
  localCache: usePersistentFirestoreCache
    ? persistentLocalCache({
      cacheSizeBytes: 64 * 1024 * 1024,
      tabManager: persistentMultipleTabManager(),
    })
    : memoryLocalCache(),
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
