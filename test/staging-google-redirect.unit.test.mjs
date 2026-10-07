// UX-R1/S1 Phase 2: execute the real auth service with synthetic SDK/browser boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/authService.js', import.meta.url), 'utf8');
const helperUrl = new URL('../src/services/stagingGoogleRedirect.js', import.meta.url);
const helper = existsSync(helperUrl) ? await import(helperUrl.href) : {};
const stage = 'mygymlog-604bc-staging';
const stageOrigin = 'https://my-gym-log-staging.onrender.com';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
  const calls = [], data = new Map(), draftWrites = [];
  const draft = new Map([
    ['gym_log_draft:synthetic-owner', JSON.stringify({ version: 3, uid: 'synthetic-owner', sessionId: 'synthetic-session-a', revision: 2, log: [{ exercise: 'synthetic-a' }] })],
    ['gym_log_draft:synthetic-other', JSON.stringify({ version: 3, uid: 'synthetic-other', sessionId: 'synthetic-session-b', revision: 7, log: [{ exercise: 'synthetic-b' }] })],
    ['gym_log_draft', 'synthetic-legacy-draft'],
    ['synthetic-unrelated-key', 'preserve-me'],
  ]);
  const draftBefore = [...draft];
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
  const navigator = {
    userAgent: options.userAgent ?? iphone,
    platform: options.platform ?? 'iPhone',
    maxTouchPoints: options.maxTouchPoints ?? 5,
    standalone: options.standalone ?? true,
  };
  const location = new URL(options.origin ?? stageOrigin);
  const browser = {
    navigator,
    location: { origin: location.origin, protocol: location.protocol, hostname: location.hostname, href: location.href },
    matchMedia: query => ({ matches: query === '(display-mode: standalone)' && !!options.displayMode }),
    sessionStorage: storage,
    localStorage: {
      getItem: key => draft.get(key) ?? null,
      setItem: (key, value) => { draftWrites.push({ method: 'setItem', key }); draft.set(key, String(value)); },
      removeItem: key => { draftWrites.push({ method: 'removeItem', key }); draft.delete(key); },
      clear: () => { draftWrites.push({ method: 'clear' }); draft.clear(); },
      key: index => [...draft.keys()][index] ?? null,
      get length() { return draft.size; },
    },
  };
  class GoogleAuthProvider {
    setCustomParameters(parameters) { this.parameters = JSON.parse(JSON.stringify(parameters)); }
  }
  const record = (method, provider) => calls.push({ method, parameters: provider?.parameters });
  const context = vm.createContext({
    ...helper, window: browser, navigator, Promise, Date, console,
    firebaseEnvironment: {
      appEnvironment: options.appEnvironment ?? 'staging',
      expectedProjectId: options.projectId ?? stage,
      firebaseConfig: { projectId: options.projectId ?? stage, authDomain: options.authDomain ?? 'my-gym-log-staging.onrender.com' },
    },
    auth: { name: 'synthetic-auth', currentUser: null },
    GoogleAuthProvider,
    signInWithPopup: (_auth, provider) => { record('popup', provider); return Promise.resolve({ user: { uid: 'synthetic' } }); },
    signInWithRedirect: (_auth, provider) => { record('redirect', provider); return new Promise(() => {}); },
    getRedirectResult: () => { record('recover'); return Promise.resolve(null); },
    reauthenticateWithPopup: (_user, provider) => { record('reauth-popup', provider); return Promise.resolve(); },
    signOut: () => { record('sign-out'); return Promise.resolve(); },
  });
  const executable = source
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:const|function))/g, '');
  vm.runInContext(executable + '\n globalThis.api = { loginWithGoogle, reauthenticateWithGoogle, logoutUser, initializeGoogleRedirect: typeof initializeGoogleRedirect === "function" ? initializeGoogleRedirect : undefined, getGoogleRedirectSnapshot: typeof getGoogleRedirectSnapshot === "function" ? getGoogleRedirectSnapshot : undefined };', context);
  return { api: context.api, calls, draft, draftBefore, draftWrites };
}

function assertPreservedState(h) {
  assert.equal(h.calls.filter(call => call.method === 'sign-out').length, 0, 'Google routing and reauthentication must not sign out the existing user');
  assert.deepEqual(h.draftWrites, [], 'Google routing must not write or clear any localStorage key');
  assert.deepEqual([...h.draft], h.draftBefore, 'both UID drafts, legacy draft and unrelated data retain their bytes');
}

for (const [label, options, expected] of [
  ['exact Stage iPhone Home Screen', {}, 'redirect'],
  ['exact Stage iPadOS Home Screen', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }, 'redirect'],
  ['exact Stage iOS display-mode standalone', { standalone: false, displayMode: true }, 'redirect'],
  ['Production iPhone Home Screen', { appEnvironment: 'production', projectId: 'mygymlog-604bc', authDomain: 'mygymlog-604bc.firebaseapp.com' }, 'popup'],
  ['Production label with otherwise eligible Stage inputs', { appEnvironment: 'production' }, 'popup'],
  ['Stage label with a different Firebase project', { projectId: 'synthetic-other-project' }, 'popup'],
  ['Stage Safari tab', { standalone: false, displayMode: false }, 'popup'],
  ['Stage Android standalone', { userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux armv8l' }, 'popup'],
  ['Stage desktop standalone', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', platform: 'MacIntel', maxTouchPoints: 0 }, 'popup'],
  ['Stage baseline Firebase authDomain', { authDomain: stage + '.firebaseapp.com' }, 'popup'],
  ['Stage local preview origin', { origin: 'http://127.0.0.1:4173' }, 'popup'],
]) {
  test(label + ' chooses ' + expected + ' without touching a workout draft', async () => {
    const h = harness(options); let rejection = null;
    Promise.resolve(h.api.loginWithGoogle()).catch(error => { rejection = error; });
    await tick();
    assert.equal(rejection, null, 'login routing must not throw');
    const signInCalls = h.calls.filter(call => ['popup', 'redirect'].includes(call.method));
    assert.equal(signInCalls.length, 1, 'one user action starts one SDK sign-in');
    assert.equal(signInCalls[0].method, expected);
    assert.deepEqual(signInCalls[0].parameters, { prompt: 'select_account' });
    assertPreservedState(h);
  });
}

test('Stage Home Screen reauthentication remains popup and never starts redirect', async () => {
  const h = harness(); await h.api.reauthenticateWithGoogle({ uid: 'synthetic-current' });
  assert.deepEqual(h.calls.filter(call => ['popup', 'redirect', 'reauth-popup'].includes(call.method)).map(call => call.method), ['reauth-popup']);
  assertPreservedState(h);
});

test('eligible startup recovery is shared by consumers and exposes no credentials', async () => {
  const h = harness();
  assert.equal(typeof h.api.initializeGoogleRedirect, 'function', 'the app must be able to recover before showing authenticated content');
  const first = h.api.initializeGoogleRedirect();
  assert.equal(h.api.initializeGoogleRedirect(), first);
  await first;
  assert.equal(h.calls.filter(call => call.method === 'recover').length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.getGoogleRedirectSnapshot())), { phase: 'ready', errorCode: null, reloadRequired: false });
  assertPreservedState(h);
});

test('ineligible startup does not read an SDK redirect result', async () => {
  const h = harness({ appEnvironment: 'production' });
  assert.equal(typeof h.api.initializeGoogleRedirect, 'function');
  await h.api.initializeGoogleRedirect();
  assert.equal(h.calls.filter(call => call.method === 'recover').length, 0);
  assert.equal(h.api.getGoogleRedirectSnapshot().phase, 'ready');
  assertPreservedState(h);
});

test('duplicate eligible login actions share one SDK redirect navigation', async () => {
  const h = harness();
  const first = h.api.loginWithGoogle();
  assert.equal(h.api.loginWithGoogle(), first, 'a second action must share the in-flight redirect');
  await tick();
  assert.equal(h.calls.filter(call => call.method === 'redirect').length, 1);
  assert.equal(h.calls.filter(call => call.method === 'popup').length, 0);
  assertPreservedState(h);
});
