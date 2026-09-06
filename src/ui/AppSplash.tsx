import { useEffect, useRef, useState } from 'react';
import { AppBrandMark } from './AppBrandMark';

export const APP_SPLASH_MIN_VISIBLE_MS = 750;
const APP_SPLASH_EXIT_MS = 180;

export function getSplashWaitMs(elapsedMs: number, skipRequested: boolean, minimumMs = APP_SPLASH_MIN_VISIBLE_MS): number {
  if (skipRequested) return 0;
  return Math.max(0, minimumMs - Math.max(0, elapsedMs));
}

interface AppSplashProps {
  ready: boolean;
  onComplete: () => void;
}

export function AppSplash({ ready, onComplete }: AppSplashProps) {
  const mountedAtRef = useRef(performance.now());
  const readyRef = useRef(ready);
  const skipRequestedRef = useRef(false);
  const completeStartedRef = useRef(false);
  const waitTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const reducedMotionRef = useRef(false);
  const [exiting, setExiting] = useState(false);

  onCompleteRef.current = onComplete;
  readyRef.current = ready;

  function clearWaitTimer() {
    if (waitTimerRef.current === null) return;
    window.clearTimeout(waitTimerRef.current);
    waitTimerRef.current = null;
  }

  function clearExitTimer() {
    if (exitTimerRef.current === null) return;
    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }

  function completeSplash() {
    if (completeStartedRef.current || !readyRef.current) return;
    completeStartedRef.current = true;
    clearWaitTimer();
    setExiting(true);
    const exitDelay = reducedMotionRef.current ? 0 : APP_SPLASH_EXIT_MS;
    exitTimerRef.current = window.setTimeout(() => onCompleteRef.current(), exitDelay);
  }

  function scheduleCompletion() {
    if (!readyRef.current || completeStartedRef.current) return;
    clearWaitTimer();
    const elapsed = performance.now() - mountedAtRef.current;
    const waitMs = getSplashWaitMs(elapsed, skipRequestedRef.current);
    if (waitMs <= 0) {
      completeSplash();
      return;
    }
    waitTimerRef.current = window.setTimeout(completeSplash, waitMs);
  }

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = media?.matches ?? false;

    const updateReducedMotion = () => {
      reducedMotionRef.current = media?.matches ?? false;
    };
    media?.addEventListener?.('change', updateReducedMotion);

    const requestSkip = () => {
      skipRequestedRef.current = true;
      if (readyRef.current) completeSplash();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') requestSkip();
    };

    window.addEventListener('pointerdown', requestSkip, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      media?.removeEventListener?.('change', updateReducedMotion);
      window.removeEventListener('pointerdown', requestSkip);
      window.removeEventListener('keydown', handleKeyDown);
      clearWaitTimer();
      clearExitTimer();
    };
  }, []);

  useEffect(() => {
    scheduleCompletion();
  }, [ready]);

  return (
    <main
      className={`app-splash${exiting ? ' app-splash-exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Uruchamianie Inteligentnego Kalendarza"
      data-ready={ready ? 'true' : 'false'}
    >
      <div className="app-splash-content">
        <AppBrandMark className="app-splash-mark" size={116} />
        <h1 className="app-splash-title">Inteligentny Kalendarz</h1>
      </div>
    </main>
  );
}
