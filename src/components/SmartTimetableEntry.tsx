import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import type { EcosystemApplicationId } from '../ecosystem';
import TrialAccessGate from './TrialAccessGate';
import SmartTimetable from './SmartTimetable';

const APPLICATION_ID = 'smart-timetable' as EcosystemApplicationId;

function navigateToLanding(): void {
  sessionStorage.setItem('currentView', JSON.stringify('landing'));
  window.location.assign(import.meta.env.BASE_URL);
}

function navigateToLibrary(): void {
  sessionStorage.setItem('currentView', JSON.stringify('admin'));
  window.location.assign(import.meta.env.BASE_URL);
}

function navigateToAuth(mode: 'login' | 'register'): void {
  sessionStorage.setItem('currentView', JSON.stringify('landing'));
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('auth', mode);
  window.location.assign(url.toString());
}

export default function SmartTimetableEntry() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(Boolean(auth.currentUser));
  const [uid, setUid] = useState(auth.currentUser?.uid || 'guest');

  useEffect(() => onAuthStateChanged(auth, user => {
    setSignedIn(Boolean(user));
    setUid(user?.uid || 'guest');
    setReady(true);
  }), []);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Đang mở bộ xếp thời khóa biểu...</div>;
  }

  return (
    <TrialAccessGate
      applicationId={APPLICATION_ID}
      applicationName="Xếp thời khóa biểu thông minh"
      bypass={signedIn}
      onBack={navigateToLanding}
      onRegister={() => navigateToAuth('register')}
      onLogin={() => navigateToAuth('login')}
    >
      <SmartTimetable
        storageKey={`smartclass_timetable_v1:${uid}`}
        trialMode={!signedIn}
        onBack={signedIn ? navigateToLibrary : navigateToLanding}
      />
    </TrialAccessGate>
  );
}
