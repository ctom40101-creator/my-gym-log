# LEGACY_ACCOUNT_SUNSET_2026 Implementation Plan

> **For agentic workers:** Implement inline in this session. Use test-driven development task by task; do not delegate.

**Goal:** Add UID-preserving E2/E3 migration and fail-closed, zero-cost post-deadline retention deletion to Candidate A.

**Architecture:** A protected Firestore policy identifies targets, the client performs in-place Firebase provider linkage, and an independent scheduled Worker owns destructive retention. Firebase Auth provider data is an authoritative deletion veto.

**Tech Stack:** React/Vite, Firebase Auth/Firestore/Rules emulator, Cloudflare Workers Free, Node test runner.

**Spec:** `docs/security-hardening-v1/LEGACY_ACCOUNT_SUNSET_2026_DESIGN.md` and the Owner's 2026-09-25 approved request.

## Global constraints

- Parent SHA `d098f9048d0b2b362cca4c061cc449d08c19105c`; no changes to frozen Candidate A or `main`.
- No private target mapping in Git. No Production mutation or notice before the Final Release Human Gate.
- Firebase Spark and Workers Free only. Secrets only in Cloudflare Worker Secrets.
- Deadline `2026-12-31T15:59:59Z`; first deletion window `2026-12-31T16:15:00Z`.
- Google linkage, data verification, Google sign-in and password unlink preserve the original UID.

## Review focus

- Stale migration state but linked Google provider must block deletion.
- Lock, client intent, duplicate Cron, and partial data deletion must not race into Auth deletion.
- Missing-parent nested Firestore documents must be found and deleted under the target root only.
- Password login must not grant any non-target account product access.
- Missing IAM permission or Free quota exhaustion must stop with data/identity preserved.

### Task 1: Policy contract and Rules

Files: `src/services/legacyMigrationPolicy.js`, `firestore.rules`, `test/legacy-policy.unit.test.mjs`, `test/firestore.rules.test.mjs`.

- [ ] Add tests for exact UTC boundaries, target/Owner exclusions, all seven states, and policy read/write restrictions. Run RED.
- [ ] Add pure policy decisions and Rules for owner-only policy read, constrained client transitions, and pre-deadline targeted password access. Run GREEN.

### Task 2: Client migration

Files: `src/services/authService.js`, `src/services/legacyMigration.js`, `src/components/AuthScreen.jsx`, `src/components/LegacyMigrationNotice.jsx`, `src/App.jsx`, `test/legacy-migration.unit.test.mjs`.

- [ ] Add tests for login-specific modal/banner visibility, reset URL and no-new-UID link flow. Run RED.
- [ ] Implement target detection from protected policy, in-place Google link, data check, fresh Google sign-in, password unlink, completion state, and persistent notice. Run GREEN.

### Task 3: Retention Worker

Files: `retention/wrangler.jsonc`, `retention/src/{index,policy,firestore,auth}.js`, `test/retention.unit.test.mjs`.

- [ ] Add tests for every deletion veto, UTC boundary, lock race, duplicate Cron, nested deletion, partial retry, shared public exclusion, no secret in logs. Run RED.
- [ ] Implement separate scheduled Worker, protected roster reads, Auth veto, CAS lock, recursive bounded cleanup, audit receipt. Run GREEN.

### Task 4: Verification and cutover record

Files: `docs/security-hardening-v1/*`, `CONTINUATION_HANDOFF.md`, Product Mother tabs.

- [ ] Run `npm test`, `npm run test:rules`, `npm run lint`, `npm run build`, Worker tests and `wrangler deploy --dry-run` with fresh output.
- [ ] Review diff, secret scan, hashes, IAM matrix, Production cutover and rollback. Update formal Product Mother; read back.
- [ ] Commit Candidate B, verify exact parent/SHA and clean branch, leave Final Release Human Gate open.
