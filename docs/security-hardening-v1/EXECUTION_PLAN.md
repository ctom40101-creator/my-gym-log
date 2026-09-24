# My Gym Log Security Hardening V1 — execution plan reconstruction

Status: Owner-approved scope, reconstructed in this runtime from the Product Mother Zero-Cost Architecture Revision and the Owner's 2026-09-24 continuation instruction. This file is not a copy of the unavailable prior-runtime plan or commit `8d5d65d52fc383604887179972a19cce864e979c`.

## Baseline and boundaries

- Canonical repository: `ctom40101-creator/my-gym-log`.
- Production branch and immutable starting point: `main` at `69823504dd6424fc12568d95fc56046e90e35939`.
- All code work occurs in the `security-hardening-v1` linked worktree and branch.
- Firebase remains Spark. Cloudflare Workers remains Free. No paid resources or automatic paid fallback.
- `AccessRequests/{uid}.status` is the authorization source. States are `pending`, `approved`, `rejected`, `disabled`.
- Admin is the Firebase verified ID token with `email == ctom40101@gmail.com` and `email_verified == true`. Frontend email checks are display hints only.
- The existing Firebase UID and private data paths must be preserved. Provider collision, multiple UIDs for the owner email, ambiguous ownership, or data split requires safe stop.
- Service account credentials belong only in Cloudflare Worker Secrets. No credential value goes into Git, documentation, or frontend code.
- Until the Final Release Human Gate: do not merge `main`, deploy Render Production, publish Production Firestore Rules, migrate Production Google provider, disable/delete Production Auth users, or cut over Production Worker traffic.

## Execution order

1. Restore governance/preflight record; confirm GitHub branch write path and Cloudflare Workers Free account. Record the baseline build and lint result.
2. Add a test harness and write failing checks for authorization, identity, Google-only entry, Worker token validation and privileged operation contracts.
3. Implement and emulator-test Firestore Rules. Protect AccessRequests, UserIndex identity, private data, and default-deny public paths.
4. Implement Worker code with Firebase ID-token verification, least-privilege Google OAuth service-account flow, safe target UID checks, idempotent disable/delete endpoints, and bounded error behavior. Keep secrets unprovisioned until the final release gate.
5. Replace client auth with Google-only sign-in and explicit request/pending/rejected/disabled/approved views. Approved status gates every product subscription and `setupInitialData` call.
6. Repair admin operations: live pending list, status decisions, cross-user identity preservation, safe staged permanent deletion, and independent recent-auth self-delete handling. Remove legacy guest/password paths.
7. Run full lint/build/unit/Worker/Rules emulator/integration/regression checks. Inventory all touched paths and compare with approved acceptance requirements. Freeze exact candidate hashes and rollback plan.
8. Stop at `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE` with no Production mutation.

## Validation and rollback

- Baseline `npm run build`; record original lint state separately from new regression checks.
- Red/green tests for each new behavior; full suite and build before each relevant commit.
- Firestore emulator uses an isolated local project ID and never connects to Production.
- Worker tests use local fixtures and simulated upstream responses, with no live Firebase Auth mutation.
- Review `git diff` for credentials and scope before each push.
- Rollback before release is simply abandoning the isolated candidate branch/worktree. Production rollback instructions must be finalized against a read-back release identity at the Final Release Gate.

## Source pointers

- AI Mother: `https://drive.google.com/drive/folders/1YAdqh8GxXwneMnCLm8NhWic1Pvrox-JV`.
- My Gym Log Product Mother: `https://docs.google.com/document/d/10N3iCU2v23LonB1Vw1UqL-dajv-Z3v8yrbrECV4uje8/edit`.
- The Product Mother's prior `WRITTEN_SPEC_PENDING_OWNER_REVIEW` sentence is older than the Owner's current explicit approval; this execution record preserves the Owner's latest direction without rewriting the historical source text.
