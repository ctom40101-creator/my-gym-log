// Render the real JSX with React. SDK and database imports stay behind synthetic boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transform } from 'esbuild';

const require = createRequire(import.meta.url);
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../src/components/AuthScreen.jsx', import.meta.url), 'utf8');
const [appCode, screenCode] = await Promise.all([appSource, screenSource].map(source =>
  transform(source, { loader: 'jsx', format: 'cjs', jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' })));
const ready = Object.freeze({ phase: 'ready', errorCode: null, reloadRequired: false });
const conflictMessage = '偵測到既有帳號與 Google 登入身分衝突。為保護原有 UID 與資料，請停止操作並聯絡管理員。';

function compile(code, imports) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: imports, React, console, URL, Date, Set, Map, Math }, { timeout: 1000 });
  return module.exports.default;
}

function render(snapshot = ready, app = false, loginPending = false) {
  const service = {
    loginWithGoogle: () => Promise.resolve(),
    logoutUser: () => Promise.resolve(),
    reauthenticateWithGoogle: () => Promise.resolve(),
    initializeGoogleRedirect: () => Promise.resolve(),
    getGoogleRedirectSnapshot: () => snapshot,
    subscribeGoogleRedirect: () => () => {},
    reloadGoogleRedirect: () => true,
  };
  let hookIndex = 0;
  const screenReact = loginPending ? { ...React, useState: initial => React.useState(hookIndex++ === 0 ? true : initial) } : React;
  const AuthScreen = compile(screenCode.code, name => {
    if (name === 'react') return screenReact;
    if (name === 'lucide-react') return require(name);
    if (name.endsWith('/authService')) return service;
    if (name.endsWith('/legacyMigrationClient')) return {};
    throw new Error('Unexpected AuthScreen dependency: ' + name);
  });
  if (!app) return renderToStaticMarkup(React.createElement(AuthScreen, { googleRedirectState: snapshot }));
  const unusedDependency = new Proxy({}, {
    get: (_target, name) => name === '__esModule' ? false : () => null,
  });
  const App = compile(appCode.code, name => {
    if (name === 'react') return React;
    if (name === 'lucide-react') return require(name);
    if (name.endsWith('/authService')) return service;
    if (name.endsWith('/AuthScreen')) return AuthScreen;
    if (name === './firebase') return { auth: { currentUser: null }, db: {}, firebaseEnvironment: {} };
    // SSR does not run effects. Other screens, auth and data SDKs are not exercised here.
    return unusedDependency;
  });
  return renderToStaticMarkup(React.createElement(App));
}

test('recovery disables Google login and hides other sign-in interactions', () => {
  const html = render({ phase: 'recovering', errorCode: null, reloadRequired: false });
  assert.match(html, /正在確認 Google 登入結果/);
  assert.match(html, /<button[^>]*\sdisabled(?:=|\s|>)/);
  assert.doesNotMatch(html, /既有 Email\/Password 帳號遷移/);
});

test('navigation stays visibly busy until redirect departure or bounded recovery', () => {
  const html = render({ phase: 'redirecting', errorCode: null, reloadRequired: false });
  assert.match(html, /正在開啟 Google 登入/);
  assert.match(html, /<button[^>]*\sdisabled(?:=|\s|>)/);
});

test('reload-required state offers an enabled reload action instead of sign-in', () => {
  const html = render({ phase: 'reload-required', errorCode: 'auth/redirect-timeout', reloadRequired: true });
  assert.match(html, /重新載入並重試/);
  assert.doesNotMatch(html, /<button[^>]*\sdisabled(?:=|\s|>)/);
  assert.doesNotMatch(html, /使用 Google 登入|既有 Email\/Password 帳號遷移/);
});

test('a never-resolving login does not disable the reload action after its deadline', () => {
  const html = render({ phase: 'reload-required', errorCode: 'auth/redirect-timeout', reloadRequired: true }, false, true);
  assert.match(html, /重新載入並重試/);
  assert.doesNotMatch(html, /<button[^>]*\sdisabled(?:=|\s|>)/);
});

test('a recovery identity conflict retains the existing UID protection message', () => {
  const html = render({ phase: 'ready', errorCode: 'auth/account-exists-with-different-credential', reloadRequired: false });
  assert.ok(html.includes(conflictMessage));
  assert.match(html, /role="alert"/);
});

test('ordinary ready sign-in preserves Google and legacy entry points', () => {
  const html = render();
  assert.match(html, /使用 Google 登入/);
  assert.match(html, /既有 Email\/Password 帳號遷移/);
  assert.doesNotMatch(html, /重新載入並重試|正在確認 Google 登入結果/);
});

test('App presents recovery before its auth observer has resolved', () => {
  const html = render({ phase: 'recovering', errorCode: null, reloadRequired: false }, true);
  assert.match(html, /正在確認 Google 登入結果/);
  assert.doesNotMatch(html, /Loading\.\.\./);
});

test('App exposes reload after a recovery deadline before auth is ready', () => {
  const html = render({ phase: 'reload-required', errorCode: 'auth/redirect-timeout', reloadRequired: true }, true);
  assert.match(html, /重新載入並重試/);
});

test('ineligible ready App retains its existing auth startup screen', () => {
  const html = render(ready, true);
  assert.match(html, /Loading\.\.\./);
  assert.doesNotMatch(html, /正在確認 Google 登入結果|重新載入並重試/);
});
