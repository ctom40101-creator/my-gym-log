const STAGE_ORIGIN = 'https://my-gym-log-staging.onrender.com';
const STAGE_PROJECT = 'mygymlog-604bc-staging';
const PENDING_KEY = 'mgl:staging-google-redirect:pending:v1';

export function isStagingGoogleRedirectEligible(environment, browser) {
  if (environment?.appEnvironment !== 'staging'
    || environment.expectedProjectId !== STAGE_PROJECT
    || environment.firebaseConfig?.projectId !== STAGE_PROJECT
    || environment.firebaseConfig.authDomain !== 'my-gym-log-staging.onrender.com'
    || browser?.location?.origin !== STAGE_ORIGIN) return false;
  try {
    const navigator = browser.navigator;
    const ios = /iPhone|iPad|iPod/.test(navigator?.userAgent || '')
      || (navigator?.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && (navigator.standalone === true
      || browser.matchMedia?.('(display-mode: standalone)')?.matches === true);
  } catch {
    return false;
  }
}

const failure = code => Object.assign(new Error(code), { code });
const errorCode = error => /^auth\/[a-z0-9-]+$/.test(error?.code || '') ? error.code : 'auth/redirect-failed';
const defaultSchedule = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  timer?.unref?.();
  return timer;
};

// A document owns this controller; React remounts share it. Credentials are never state.
export function createStagingGoogleRedirect({ enabled, browser, recover, redirect, schedule = defaultSchedule, cancel = clearTimeout, timeoutMs = 30000 }) {
  let snapshot = Object.freeze({ phase: enabled ? 'recovering' : 'ready', errorCode: null, reloadRequired: false });
  let recoveryPromise, attemptPromise, recoveryTimer, navigationTimer;
  let departed = false, terminal = false, disposed = false;
  const listeners = new Set();
  function publish(phase, code = null) {
    if (disposed || (snapshot.phase === phase && snapshot.errorCode === code)) return;
    snapshot = Object.freeze({ phase, errorCode: code, reloadRequired: phase === 'reload-required' });
    for (const callback of [...listeners]) callback();
  }
  function stopTimers() {
    if (recoveryTimer !== undefined) cancel(recoveryTimer);
    if (navigationTimer !== undefined) cancel(navigationTimer);
    recoveryTimer = navigationTimer = undefined;
  }
  function requireReload(code) {
    terminal = true;
    stopTimers();
    publish('reload-required', code);
  }
  function clearMarker() {
    try { browser.sessionStorage.removeItem(PENDING_KEY); return true; }
    catch { return false; }
  }
  function initialize() {
    if (recoveryPromise) return recoveryPromise;
    if (!enabled || disposed) return (recoveryPromise = Promise.resolve());
    let wasPending = false, readFailed = false;
    try {
      const value = browser.sessionStorage.getItem(PENDING_KEY);
      if (value) {
        try { const marker = JSON.parse(value); wasPending = marker?.version === 1 && marker.pending === true; }
        catch { /* Corrupt private marker is never identity or draft data. */ }
      }
    } catch { readFailed = true; }
    recoveryTimer = schedule(() => { if (!disposed && snapshot.phase === 'recovering') requireReload('auth/redirect-timeout'); }, timeoutMs);
    recoveryPromise = Promise.resolve().then(recover).then(result => {
      if (terminal || disposed) return;
      stopTimers();
      const cleared = clearMarker();
      publish('ready', result == null && wasPending ? 'auth/redirect-cancelled'
        : readFailed || !cleared ? 'auth/redirect-storage-unavailable' : null);
    }, error => {
      if (terminal || disposed) return;
      stopTimers();
      clearMarker();
      publish('ready', errorCode(error));
    });
    return recoveryPromise;
  }
  function login() {
    if (!enabled) return Promise.reject(failure('auth/redirect-unavailable'));
    if (terminal || disposed) return Promise.reject(failure('auth/redirect-reload-required'));
    if (attemptPromise) return attemptPromise;
    attemptPromise = initialize().then(() => {
      if (terminal || disposed) throw failure('auth/redirect-reload-required');
      try { browser.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ version: 1, pending: true })); }
      catch { throw failure('auth/redirect-storage-unavailable'); }
      departed = false;
      publish('redirecting');
      navigationTimer = schedule(() => { if (!disposed && !departed && snapshot.phase === 'redirecting') requireReload('auth/redirect-timeout'); }, timeoutMs);
      return redirect();
    }).then(() => {
      if (!terminal && !disposed && snapshot.phase === 'redirecting') requireReload('auth/redirect-navigation-returned');
    }).catch(error => {
      if (!terminal && !disposed) {
        if (departed) {
          requireReload(errorCode(error));
        } else {
          stopTimers();
          clearMarker();
          publish('ready', errorCode(error));
          attemptPromise = undefined;
        }
      }
      throw error;
    });
    return attemptPromise;
  }
  function pagehide() {
    if (snapshot.phase === 'redirecting') {
      departed = true;
      if (navigationTimer !== undefined) cancel(navigationTimer);
      navigationTimer = undefined;
    }
  }
  function pageshow(event) {
    if (event.persisted && departed && attemptPromise && snapshot.phase === 'redirecting') requireReload('auth/redirect-returned');
  }
  if (enabled) {
    browser?.addEventListener?.('pagehide', pagehide);
    browser?.addEventListener?.('pageshow', pageshow);
  }
  return {
    getSnapshot: () => snapshot,
    initialize, login,
    subscribe: callback => {
      if (disposed) return () => {};
      listeners.add(callback);
      callback(); // Recheck completion that happened between render and subscription.
      return () => listeners.delete(callback);
    },
    reload: () => {
      if (!enabled || !snapshot.reloadRequired || browser?.location?.origin !== STAGE_ORIGIN || typeof browser.location.reload !== 'function') return false;
      browser.location.reload();
      return true;
    },
    dispose: () => {
      disposed = terminal = true;
      stopTimers();
      listeners.clear();
      if (enabled) {
        browser?.removeEventListener?.('pagehide', pagehide);
        browser?.removeEventListener?.('pageshow', pageshow);
      }
    },
  };
}
