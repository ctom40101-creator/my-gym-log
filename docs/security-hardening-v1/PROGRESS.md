# Security Hardening V1 progress ledger

## 2026-09-24 — preflight

- Gate: `AUTH CHANNEL RECOVERY`.
- Remote `main` fresh read-back: `69823504dd6424fc12568d95fc56046e90e35939`.
- Starting folder contained review/evidence only and no Git repository. Fresh clone created at `repo`; linked worktree created at `security-hardening-v1` from exact main SHA. Worktree initially clean.
- Prior-runtime commit `8d5d65d52fc383604887179972a19cce864e979c` is not present in this clone; do not reuse its SHA or imply the rebuilt commit is byte-identical.
- GitHub CLI 2.101.0 browser/device authentication completed as `tprichsmart-ops`. `gh repo view` reports `WRITE`. Remote `security-hardening-v1` push and read-back succeeded. Remote `main` remained unchanged.
- Wrangler 4.137.0 OAuth session identifies `tp.richsmart@gmail.com`, account `2f3147fb33b158efb46c189d0c6ef4e9`. Cloudflare dashboard Workers Plans shows Free as the current plan. No Worker deployed or paid resource created for this task.
- Baseline `npm ci` passed. Baseline `npm run build` passed with the existing large-chunk warning. Baseline `npm run lint` failed with 7,340 errors, dominated by irregular whitespace in the preexisting `src/App.jsx`; this is a baseline condition, not a new regression.
- Firebase Production, Render Production, Auth providers, Firestore Rules/data, and billing were not changed.
- Decision: use the Product Mother's approved Zero-Cost Revision plus the Owner's latest explicit continuation limits as current execution scope. Earlier Product Mother status prose is historical and requires a later formal state sync.

## Pending

- TDD implementation, integrated validation, candidate freeze, and Final Release Human Gate.
- Production state must be freshly read back at Final Release Gate; current no-mutation statement records only this task's actions.

## 2026-09-24 — Firestore Rules candidate

- Added an isolated Firestore emulator test harness using a `demo-` project ID; no Production Rules were published.
- Confirmed red phase against the original permissive rules: 6 of 9 security cases failed. Added a staged request-deletion case and confirmed red at 9 of 10.
- Hardened `AccessRequests`, `UserIndex`, and private data rules. The latest emulator run passed 10 of 10 cases. Approved status is the normal member authorization source; the verified owner token is the explicit admin bootstrap exception.
- Emulator on this Windows runtime requires Java 21 and `TEMP`/`TMP`/`java.io.tmpdir` set to `C:\Windows\Temp` because the default temporary directory caused a Java loopback socket error.
- Next: Worker unit contracts and implementation, then Google-only frontend flow. The Rules candidate remains local to this branch until the Final Release Gate.

## 2026-09-24 — Worker candidate

- Added local tests for signed Firebase ID tokens, verified owner identity, duplicate owner email / UID mismatch, owner self-protection, target lookup, disable, and delete only after disable plus explicit cleanup confirmation.
- Worker exchanges its service account assertion for Google OAuth only after verified admin authorization. The service account is a required Cloudflare Secret binding; no value is stored in this repository or provided to the Worker yet.
- Worker source and Wrangler config are branch artifacts only. No Cloudflare deployment, secret provision, traffic cutover, or Production Auth mutation occurred.
- Local Worker tests passed 8 of 8 after the initial red phase. Remaining validation includes Wrangler dry run, frontend integration, and full regression checks.

## 2026-09-24 — Google-only client candidate

- Replaced anonymous/email/password UI and service calls with Google sign-in. Provider collisions show a safe-stop message; no automatic account linking or UID migration runs.
- Added live `AccessRequests/{uid}` observation and explicit request, pending, approved, rejected, disabled, and invalid-identity views. Private data listeners and default-data seeding start only after approval or verified Admin identity.
- Replaced the legacy admin screen with live request decisions, user data viewing, and staged deletion: disabled request → Worker Auth disable → known private collection cleanup → UserIndex cleanup → Worker Auth delete → request cleanup. The Owner account is excluded from self-delete and admin-delete UI, with a second Owner UID/email guard in Worker.
- Self-delete requires a fresh Google reauthentication before data cleanup. Its orphaned request record must be cleaned by the admin after Auth deletion because Firebase client Auth and Firestore operations are not atomic.
- Local browser read-back displayed the Google-only entry screen with no immediate runtime error. No Google sign-in against Production Firebase was attempted.
- Full `npm run lint` now passes; the baseline had 7,340 errors. Client `npm run build` passes with the inherited large-chunk warning. Latest unit suite passed 15 of 15; Firestore emulator passed 11 of 11; Wrangler dry run packaged without deployment.
- Known release checks: verify Owner's original UID and provider collision state in Production before any provider migration; verify target collection inventory and Worker/IAM configuration. The client can enumerate only the five known private collections, so unknown private collections require a separate inventory before allowing permanent deletion.
