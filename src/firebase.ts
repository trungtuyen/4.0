import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
