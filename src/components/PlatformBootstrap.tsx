import React, { lazy, Suspense, useEffect, useState } from 'react';
import type { EcosystemApplicationId } from '../ecosystem';
import FastLandingPage from './FastLandingPage';

const ProductTrialController = lazy(() => import('./ProductTrialController'));
const QuestionStudioLibraryPortal = lazy(() => import('./QuestionStudioLibraryPortal'));

function readStoredView(): string {
  try {
    const saved = sessionStorage.getItem('currentView');
    return saved ? String(JSON.parse(saved) || '') : '';
  } catch {
    return '';
  }
}

function runtimeRequiredImmediately(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has('auth') || params.has('app')) return true;
  const stored = readStoredView();
  return Boolean(stored && stored !== 'landing');
}

function hasFirebaseSessionHint(): boolean {
  try {
    return Object.keys(localStorage).some(key => key.startsWith('firebase:authUser:'));
  } catch {
    return false;
  }
}

function storeView(view: string): void {
  sessionStorage.setItem('currentView', JSON.stringify(view));
}

export default function PlatformBootstrap() {
  const [runtimeActive, setRuntimeActive] = useState(runtimeRequiredImmediately);

  useEffect(() => {
    if (runtimeActive || !hasFirebaseSessionHint()) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    const browser = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const inspectSession = async () => {
      try {
        const [{ auth }, { onAuthStateChanged }] = await Promise.all([
          import('../firebase'),
          import('firebase/auth'),
        ]);
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, user => {
          if (user && !cancelled) setRuntimeActive(true);
        });
      } catch (error) {
        console.info('Không thể khôi phục phiên Firebase trong Fast Landing.', error);
      }
    };

    let idleId: number | undefined;
    let timerId: number | undefined;
    if (browser.requestIdleCallback) idleId = browser.requestIdleCallback(() => void inspectSession(), { timeout: 1800 });
    else timerId = window.setTimeout(() => void inspectSession(), 900);

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (idleId !== undefined) browser.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [runtimeActive]);

  const activate = (view: string) => {
    storeView(view);
    setRuntimeActive(true);
  };

  const openProduct = (applicationId: EcosystemApplicationId) => {
    if (applicationId === 'exam-manager') {
      const url = new URL(import.meta.env.BASE_URL, window.location.origin);
      url.searchParams.set('auth', 'register');
      window.history.replaceState(window.history.state, '', url.toString());
      activate('landing');
      return;
    }
    activate(applicationId);
  };

  const openAuth = (mode: 'login' | 'register') => {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin);
    url.searchParams.set('auth', mode);
    window.history.replaceState(window.history.state, '', url.toString());
    activate('landing');
  };

  if (!runtimeActive) {
    return (
      <FastLandingPage
        onTeacherLogin={() => openAuth('login')}
        onTeacherRegister={() => openAuth('register')}
        onStudentLogin={() => activate('student_exam')}
        onOpenProduct={openProduct}
      />
    );
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Đang mở chức năng...</div>}>
      <ProductTrialController />
      <QuestionStudioLibraryPortal />
    </Suspense>
  );
}
