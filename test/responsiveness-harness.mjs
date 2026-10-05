// V2026.10-05.2: actual App callback and cleanup lifecycle; synthetic SDK, no real Auth/user state.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { decideAccess } from '../src/services/accessService.js';
import { isLegacyTargetPolicy, legacyProductAccess } from '../src/services/legacyMigrationPolicy.js';
import { calculateTotalVolume } from '../src/utils/calculations.js';
import { discoverDraftSubmission, reconcileDraftSubmission } from '../src/services/draftStorage.js';

export const syntheticOwner = () => ({ uid: 'synthetic-owner', email: 'ctom40101@gmail.com', providerData: [{ providerId: 'google.com' }] });
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export async function flushAsync() { for (let i = 0; i < 20; i++) await Promise.resolve(); }

export function authHarness(source, options = {}) {
  const user = options.user || syntheticOwner();
  const clock = options.clock || { value: 0 };
  const costs = { token: 0, policy: 0, owner: 0, ...options.costs };
  const events = [], calls = [], access = [];
  const record = name => events.push({ name, atMs: clock.value });
  const dependency = async (name, value) => {
    calls.push(name); record(`${name}:started`);
    const result = await value;
    clock.value += costs[name] || 0; record(`${name}:settled`); return result;
  };
  const claims = options.claims || { email: user.email, email_verified: true, sub: user.uid, firebase: { sign_in_provider: 'google.com' } };
  user.getIdTokenResult = () => dependency('token', options.token || { claims });
  let callback, requestCallback, requestError;
  const migrationPolicies = [], selfDeleteRequested = [];
  const noStateChange = () => {};
  const context = {
    auth: { currentUser: user }, db: {}, localStorage: {}, firebaseEnvironment: { appEnvironment: options.appEnvironment || 'production' },
    onAuthStateChanged: (_auth, listener) => { callback = listener; return () => calls.push('auth-unsubscribe'); },
    loadDraftSession: (_storage, uid) => ({ uid, log: [] }), draftStateRef: { current: null },
    markPerformance: record, decideAccess, isLegacyTargetPolicy, legacyProductAccess,
    readLegacyPolicy: () => dependency('policy', options.policy === undefined ? null : options.policy),
    loadOriginalOwnerUid: () => dependency('owner', options.ownerUid === undefined ? user.uid : options.ownerUid),
    bootstrapStagingOwnerConfig: async () => { calls.push('bootstrap'); return options.bootstrapUid || user.uid; },
    observeAccessRequest: (_db, _user, onChange, onError) => { calls.push('request-listener'); requestCallback = onChange; requestError = onError; return () => calls.push('request-unsubscribe'); },
    setAccessState: value => { access.push(value); record(`access:${value}`); },
    setUserId: noStateChange, setCurrentUser: noStateChange, setClaims: noStateChange, setMigrationPolicy: value => migrationPolicies.push(value),
    setSignInKey: noStateChange, setAdminViewUser: noStateChange, setSelfDeleteRequested: value => selfDeleteRequested.push(value),
    setIsAuthReady: noStateChange, setMovementDB: noStateChange, setPlansDB: noStateChange, setLogDB: noStateChange,
    setBodyMetricsDB: noStateChange, setDraftState: noStateChange, setDraftHydratedUid: noStateChange,
    setScreenState: noStateChange, setLoadedUserId: noStateChange, setDataLoadErrorUid: noStateChange,
  };
  const start = source.indexOf('const unsub = onAuthStateChanged(auth, async (u) => {');
  const end = source.indexOf('\n        });', start);
  assert.ok(start >= 0 && end > start, 'Actual App auth callback must be locatable');
  const cleanup = 'return () => { active = false; unsubscribeRequest?.(); unsub(); };';
  assert.ok(source.indexOf(cleanup, end) > end, 'Actual App observer cleanup must be locatable');
  const stop = vm.runInNewContext(`let active = true; let unsubscribeRequest = null; ${source.slice(start, end + '\n        });'.length)}\n${cleanup.slice('return '.length)}`, context);
  return { user, context, clock, events, calls, access, migrationPolicies, selfDeleteRequested, stop,
    run: () => callback(user), receiveRequest: value => requestCallback(value), failRequest: () => requestError() };
}

export function submitHarness(source, options = {}) {
  const clock = options.clock || { value: 0 }, events = [], calls = [], states = [];
  const state = { cleared: false, retained: true };
  const uid = 'synthetic-owner';
  const sessionId = 'synthetic-session';
  const initialPayload = options.initialPayload || null;
  let serverPayload = initialPayload;
  const context = {
    submittingRef: { current: false }, currentLog: [{ movementName: 'synthetic', sets: [{ weight: 40, reps: 10 }] }],
    draftSessionId: sessionId, draftRevision: options.revision || 1, selectedDate: '2026-10-05', userId: uid,
    selectedDailyPlanId: '', sessionPhoto: null, db: {}, APP_ID: 'synthetic-app',
    calculateTotalVolume, discoverDraftSubmission, reconcileDraftSubmission,
    markPerformance: name => events.push({ name, atMs: clock.value }),
    setIsSubmitting: value => states.push(value),
    prepareDraftSubmission: () => { calls.push('persist'); clock.value += options.persistMs || 0; return 'session'; },
    collection: () => ({}), query: () => ({}), where: () => ({}), doc: (_ref, id) => ({ id }),
    getDocsFromServer: async () => {
      calls.push('server-lookup'); await options.lookupWait;
      clock.value += options.lookupMs || 0;
      if (options.lookupError) throw options.lookupError;
      return { docs: serverPayload ? [{ id: `session-${sessionId}`, data: () => serverPayload }] : [] };
    },
    runTransaction: async (_db, work) => {
      calls.push('transaction');
      await work({ get: async () => { calls.push('transaction-read'); return { exists: () => !!serverPayload, data: () => serverPayload }; },
        set: (_ref, payload) => { calls.push('transaction-write'); serverPayload = payload; } });
      await options.commitWait; clock.value += options.commitMs || 0;
      if (options.commitError) throw options.commitError;
      calls.push('commit-acknowledged');
    },
    completeDraftSubmission: () => { calls.push('complete-local'); clock.value += options.completeMs || 0; if (options.stale) return false; state.cleared = true; state.retained = false; return true; },
    setSessionPhoto: () => {}, setScreen: () => {},
    alert: () => { calls.push('user-feedback'); clock.value += options.feedbackMs || 0; },
    console: { error: () => {} },
  };
  const start = source.indexOf('const handleLogSubmit = async () => {');
  const end = source.indexOf('\n    };', start);
  assert.ok(start >= 0 && end > start, 'Actual App submission handler must be locatable');
  const run = vm.runInNewContext(`${source.slice(start, end + '\n    };'.length)}; handleLogSubmit;`, context);
  return { context, clock, events, calls, states, state, run, get serverPayload() { return serverPayload; } };
}
