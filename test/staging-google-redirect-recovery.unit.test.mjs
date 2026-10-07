import test from 'node:test';
import assert from 'node:assert/strict';
import { createStagingGoogleRedirect, isStagingGoogleRedirectEligible } from '../src/services/stagingGoogleRedirect.js';

const marker = 'mgl:staging-google-redirect:pending:v1';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const [label, overrides, expected] of [
  ['exact Stage iPhone standalone', {}, true],
  ['exact Stage iPadOS standalone', { platform: 'MacIntel', userAgent: 'Macintosh', maxTouchPoints: 5 }, true],
  ['exact Stage iOS display mode', { standalone: false, displayMode: true }, true],
  ['non-Staging environment alone', { appEnvironment: 'production' }, false],
  ['wrong expected Firebase project alone', { expectedProjectId: 'synthetic-other' }, false],
  ['wrong configured Firebase project alone', { projectId: 'synthetic-other' }, false],
  ['baseline Firebase authDomain alone', { authDomain: 'mygymlog-604bc-staging.firebaseapp.com' }, false],
  ['local preview origin alone', { origin: 'http://127.0.0.1:4173' }, false],
  ['Stage Safari tab', { standalone: false }, false],
  ['Stage Android standalone', { userAgent: 'Android', platform: 'Linux' }, false],
  ['Stage desktop standalone', { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }, false],
  ['unavailable display-mode query', { standalone: false, mediaThrows: true }, false],
]) {
  test('strict redirect scope: ' + label, () => {
    const environment = { appEnvironment: overrides.appEnvironment ?? 'staging', expectedProjectId: overrides.expectedProjectId ?? 'mygymlog-604bc-staging', firebaseConfig: { projectId: overrides.projectId ?? 'mygymlog-604bc-staging', authDomain: overrides.authDomain ?? 'my-gym-log-staging.onrender.com' } };
    const location = new URL(overrides.origin ?? 'https://my-gym-log-staging.onrender.com');
    const browser = { location, navigator: { userAgent: overrides.userAgent ?? 'iPhone', platform: overrides.platform ?? 'iPhone', maxTouchPoints: overrides.maxTouchPoints ?? 5, standalone: overrides.standalone ?? true }, matchMedia: () => { if (overrides.mediaThrows) throw Error('Synthetic unavailable media'); return { matches: !!overrides.displayMode }; } };
    assert.equal(isStagingGoogleRedirectEligible(environment, browser), expected);
  });
}
function harness(options = {}) {
  const recovery = deferred(), navigation = deferred(), calls = [], storageReads = [], listenerInstallations = [], listeners = new Map(), timers = new Map();
  let timerId = 0;
  const data = new Map(options.entries || [['unrelated-session', 'retain']]);
  const original = [...data].filter(([key]) => key !== marker);
  const browser = {
    location: { origin: 'https://my-gym-log-staging.onrender.com', reload: () => calls.push('reload') },
    sessionStorage: {
      getItem: key => { storageReads.push(key); if (options.readThrows) throw Error('Synthetic read failure'); return data.get(key) ?? null; },
      setItem: (key, value) => { if (options.writeThrows) throw Error('Synthetic write failure'); assert.equal(key, marker); data.set(key, value); calls.push('marker-write'); },
      removeItem: key => { assert.equal(key, marker); data.delete(key); calls.push('marker-remove'); },
    },
    localStorage: { setItem: () => assert.fail('Controller draft write'), removeItem: () => assert.fail('Controller draft deletion'), clear: () => assert.fail('Controller storage clear') },
    addEventListener: (name, callback) => { listenerInstallations.push(name); if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback),
  };
  const controller = createStagingGoogleRedirect({
    enabled: options.enabled ?? true, browser,
    recover: () => { calls.push('recover'); return recovery.promise; },
    redirect: () => { calls.push('redirect'); return navigation.promise; },
    schedule: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    cancel: id => timers.delete(id),
  });
  return { controller, recovery, navigation, calls, data, timers, storageReads, listenerInstallations,
    event: (name, detail = {}) => { for (const callback of listeners.get(name) || []) callback(detail); },
    deadline: () => { for (const callback of [...timers.values()]) callback(); },
    preserved: () => assert.deepEqual([...data].filter(([key]) => key !== marker), original),
  };
}

test('eligible first snapshot is recovering and one recovery serves repeated initialization/remounts', async () => {
  const h = harness();
  assert.equal(h.controller.getSnapshot().phase, 'recovering');
  assert.equal(h.controller.getSnapshot(), h.controller.getSnapshot(), 'snapshot must remain stable between changes');
  const first = h.controller.initialize(), second = h.controller.initialize();
  assert.equal(first, second);
  await tick(); assert.deepEqual(h.calls, ['recover']);
  h.recovery.resolve(null); await first;
  assert.equal(h.controller.getSnapshot().phase, 'ready');
  assert.equal(await h.controller.initialize(), undefined);
  assert.equal(h.calls.filter(call => call === 'recover').length, 1); h.preserved();
});

test('a subscriber reads current completion and its cleanup prevents late notification', async () => {
  const h = harness(); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  let snapshot, count = 0;
  const off = h.controller.subscribe(() => { count++; snapshot = h.controller.getSnapshot(); });
  assert.equal(snapshot.phase, 'ready', 'completion before subscribe cannot be missed');
  off(); const seen = count;
  const attempt = h.controller.login(); attempt.catch(() => {}); await tick();
  assert.equal(count, seen); h.controller.dispose(); h.preserved();
});

test('null with a pending marker is retryable cancellation and touches only own marker', async () => {
  const h = harness({ entries: [[marker, JSON.stringify({ version: 1, pending: true })], ['unrelated-session', 'retain']] });
  const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  assert.equal(h.controller.getSnapshot().phase, 'ready');
  assert.equal(h.controller.getSnapshot().errorCode, 'auth/redirect-cancelled');
  assert.equal(h.data.has(marker), false); h.preserved();
});

test('SDK recovery success exposes no credential or authorization grant', async () => {
  const h = harness(); const first = h.controller.initialize();
  h.recovery.resolve({ user: { uid: 'synthetic-other-user' }, credential: 'synthetic-only' });
  assert.equal(await first, undefined);
  assert.deepEqual(Object.keys(h.controller.getSnapshot()).sort(), ['errorCode', 'phase', 'reloadRequired']);
  assert.equal(h.controller.getSnapshot().phase, 'ready'); h.preserved();
});

test('SDK recovery rejection becomes useful retry state without another SDK recovery', async () => {
  const h = harness(); const first = h.controller.initialize();
  h.recovery.reject(Object.assign(Error('Synthetic offline'), { code: 'auth/network-request-failed' }));
  await first;
  assert.equal(h.controller.getSnapshot().phase, 'ready');
  assert.equal(h.controller.getSnapshot().errorCode, 'auth/network-request-failed');
  await h.controller.initialize(); assert.equal(h.calls.filter(call => call === 'recover').length, 1); h.preserved();
});

for (const [label, options] of [['corrupt', { entries: [[marker, '{broken'], ['unrelated-session', 'retain']] }], ['inaccessible', { readThrows: true }]]) {
  test(label + ' pending marker cannot crash recovery or erase unrelated storage', async () => {
    const h = harness(options); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
    assert.equal(h.controller.getSnapshot().phase, 'ready'); h.preserved();
  });
}

test('marker write failure prevents navigation and preserves a useful retry', async () => {
  const h = harness({ writeThrows: true }); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  h.navigation.resolve(); // A wrongly invoked navigation must fail this test rather than hang it.
  await assert.rejects(h.controller.login(), error => error.code === 'auth/redirect-storage-unavailable');
  assert.equal(h.calls.includes('redirect'), false); assert.equal(h.controller.getSnapshot().phase, 'ready'); h.preserved();
});

test('rapid clicks share one navigation and pre-navigation rejection releases it', async () => {
  const h = harness(); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  const a = h.controller.login(), b = h.controller.login(); assert.equal(a, b); a.catch(() => {});
  await tick(); assert.equal(h.calls.filter(call => call === 'redirect').length, 1);
  h.navigation.reject(Object.assign(Error('Synthetic failure'), { code: 'auth/network-request-failed' }));
  await assert.rejects(a, error => error.code === 'auth/network-request-failed');
  assert.equal(h.controller.getSnapshot().phase, 'ready'); assert.equal(h.data.has(marker), false); h.preserved();
});

test('Back/BFCache restores require a fresh document and never duplicate SDK operations', async () => {
  const h = harness(); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  h.controller.login().catch(() => {}); await tick();
  assert.equal(h.controller.getSnapshot().phase, 'redirecting');
  h.event('pagehide'); h.event('pageshow', { persisted: true });
  assert.equal(h.controller.getSnapshot().phase, 'reload-required');
  assert.equal(h.controller.getSnapshot().reloadRequired, true);
  assert.equal(h.data.has(marker), true, 'preserve pending marker for fresh document');
  h.event('pageshow', { persisted: true }); h.event('pagehide'); h.event('pageshow', { persisted: true });
  await assert.rejects(h.controller.login(), error => error.code === 'auth/redirect-reload-required');
  await h.controller.initialize();
  assert.equal(h.calls.filter(call => call === 'recover').length, 1);
  assert.equal(h.calls.filter(call => call === 'redirect').length, 1);
  assert.equal(h.calls.includes('reload'), false, 'no automatic reload');
  h.controller.reload(); assert.equal(h.calls.filter(call => call === 'reload').length, 1); h.preserved();
});

test('SDK rejection after departure cannot erase unknown outcome or permit old-document retry', async () => {
  const h = harness(); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  const attempt = h.controller.login(); attempt.catch(() => {}); await tick(); h.event('pagehide');
  h.navigation.reject(Object.assign(Error('Synthetic late failure'), { code: 'auth/network-request-failed' }));
  await assert.rejects(attempt, error => error.code === 'auth/network-request-failed');
  assert.equal(h.controller.getSnapshot().phase, 'reload-required');
  assert.equal(h.data.has(marker), true, 'departure makes the outcome unknown; preserve marker');
  h.event('pageshow', { persisted: true });
  await assert.rejects(h.controller.login(), error => error.code === 'auth/redirect-reload-required');
  assert.equal(h.calls.filter(call => call === 'redirect').length, 1); h.preserved();
});

test('startup deadline releases spinner; late completion cannot reopen an old document', async () => {
  const h = harness(); const first = h.controller.initialize(); await tick(); h.deadline();
  assert.equal(h.controller.getSnapshot().phase, 'reload-required');
  h.recovery.resolve({ user: { uid: 'synthetic' } }); await first;
  assert.equal(h.controller.getSnapshot().phase, 'reload-required');
  await assert.rejects(h.controller.login(), error => error.code === 'auth/redirect-reload-required');
  assert.equal(h.calls.filter(call => call === 'recover').length, 1);
  assert.equal(h.calls.includes('redirect'), false); h.preserved();
});

test('navigation deadline preserves unknown outcome and requires fresh recovery before retry', async () => {
  const h = harness(); const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  h.controller.login().catch(() => {}); await tick(); h.deadline();
  assert.equal(h.controller.getSnapshot().phase, 'reload-required');
  assert.equal(h.data.has(marker), true);
  await assert.rejects(h.controller.login(), error => error.code === 'auth/redirect-reload-required');
  h.navigation.resolve(); await tick();
  assert.equal(h.controller.getSnapshot().phase, 'reload-required');
  assert.equal(h.calls.filter(call => call === 'redirect').length, 1); h.preserved();
});

test('initial pageshow and recovery-only pagehide do not invalidate a ready document', async () => {
  const h = harness(); h.event('pageshow', { persisted: true }); h.event('pagehide');
  const first = h.controller.initialize(); h.recovery.resolve(null); await first;
  h.event('pageshow', { persisted: false }); assert.equal(h.controller.getSnapshot().phase, 'ready'); h.preserved();
});

test('noneligible controller does not recover, access marker, or install lifecycle behavior', async () => {
  const h = harness({ enabled: false, readThrows: true }); h.recovery.resolve(null); await h.controller.initialize();
  h.event('pagehide'); h.event('pageshow', { persisted: true }); h.deadline();
  assert.equal(h.controller.getSnapshot().phase, 'ready'); assert.deepEqual(h.calls, []); h.preserved();
  assert.deepEqual(h.storageReads, [], 'noneligible scope must not even read its pending marker');
  assert.deepEqual(h.listenerInstallations, [], 'noneligible scope must not install document lifecycle listeners');
});
