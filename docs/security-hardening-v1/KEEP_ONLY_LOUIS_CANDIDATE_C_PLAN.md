# KEEP_ONLY_LOUIS Candidate C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the single protected legacy identity eligible for same-UID Google migration while excluding all retired legacy cohorts.

**Architecture:** Keep Candidate B's migration and retention mechanics. Change only the accepted policy cohort to `LEGACY_MIGRATION_KEEP_01`, the roster cardinality to one, and the Worker Cron to one UTC hourly `:15` trigger. Production target mapping remains in protected release evidence.

**Tech Stack:** React/Firebase client, Firestore Rules, Cloudflare Worker, Node tests, Firebase Emulator.

**Spec:** Owner's `LEGACY_ACCOUNT_POLICY=KEEP_ONLY_LOUIS` decision, recorded in the formal Product Mother. Candidate B parent: `998e9e39c9fc4159d681da5be0c91b282c05ae92`.

## Global Constraints

- Never put real target email, UID, credential or private training content in Git.
- Do not modify or move Candidate B, `main`, Production app, Rules, providers, email, or Worker traffic.
- Deadline remains `2026-12-31T15:59:59Z`; first deletion window remains `2026-12-31T16:15:00Z`.
- Owner and linked `google.com` provider remain absolute deletion vetoes.

## Review Focus

- An E2/E3 policy must no longer grant migration access or deletion eligibility.
- An extra MigrationPolicies document must fail closed rather than be silently ignored.
- Unknown Cron strings must do nothing.
- A stale policy state with `google.com` linked must never delete.
- The protected target must keep the same Firebase UID during migration.

### Task 1: Single target policy, UI and Rules

**Files:** `src/services/legacyMigrationPolicy.js`, `firestore.rules`, `test/legacy-policy.unit.test.mjs`, `test/legacy-migration.unit.test.mjs`, `test/firestore.rules.test.mjs`.

**Interfaces:** `isLegacyTargetPolicy(policy, uid, ownerUid)` accepts only cohort `LEGACY_MIGRATION_KEEP_01`; all callers keep the same signature.

- [ ] Add failing unit and emulator examples for protected cohort acceptance and E2/E3 rejection.
- [ ] Run focused tests to observe RED.
- [ ] Restrict JS policy and Firestore Rules to the protected cohort.
- [ ] Run focused tests to observe GREEN.

### Task 2: Single-target retention Worker

**Files:** `retention/src/api.js`, `retention/src/index.js`, `retention/wrangler.jsonc`, Worker and retention tests under `test/`.

**Interfaces:** `listTargets()` returns exactly one protected policy or throws `roster_ambiguous`; scheduled Worker invokes retention only for `15 * * * *` and the protected cohort.

- [ ] Add failing tests for one roster, extra roster veto, one Cron, and unknown Cron no-op.
- [ ] Run focused tests to observe RED.
- [ ] Update roster and Cron code/config; preserve Free-plan subrequest cap and provider veto.
- [ ] Run focused tests to observe GREEN.

### Task 3: Release contract and freeze

**Files:** new Candidate C design/cutover/rollback addenda and existing test records as needed; no private mapping.

- [ ] Document single-target seed, same-UID migration, delayed deletion, rollback, and one-time cleanup evidence.
- [ ] Run fresh `npm test`, Rules emulator, lint, build, Worker tests and `wrangler deploy --dry-run`.
- [ ] Review public diff for secrets/private identities and verify Candidate B/main unchanged.
- [ ] Commit Candidate C once and record exact SHA/hashes; stop at Final Release Human Gate.
