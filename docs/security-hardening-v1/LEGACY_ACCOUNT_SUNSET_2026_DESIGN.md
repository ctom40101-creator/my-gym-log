# LEGACY_ACCOUNT_SUNSET_2026 — Candidate B design

Status: Owner approved 2026-09-25. Implementation only; Final Release Human Gate remains open.

## Baseline and invariant

Candidate B starts at frozen Candidate A `d098f9048d0b2b362cca4c061cc449d08c19105c`. The only target cohort is the protected local E2/E3 mapping. No UID, target email, credential, or personal training content belongs in Git or the Product Mother. Owner and other accounts are outside this policy. Production and `main` remain unchanged.

Deadline is the instant `2026-12-31T15:59:59Z` (2026-12-31 23:59:59 Asia/Taipei). Eligibility starts no earlier than `2026-12-31T16:15:00Z`. All time comparisons use UTC instants. Existing Firebase UID and data paths are immutable during provider migration.

## Policy and access

Protected `MigrationPolicies/{uid}` documents are the only target roster. A document must have `program=LEGACY_ACCOUNT_SUNSET_2026`, `cohort=E2|E3`, `originalUid=uid`, exact deadline, `state`, and `deletionHold`. A privileged post-gate operator seeds the two documents from protected evidence; the public repository never contains the mapping. Client access is restricted to the authenticated document owner and verified Owner. Client writes are limited to a pending → verifying intent and a verified same-UID Google completion. The retention service uses IAM and always re-reads Auth `providerUserInfo` and policy; Firestore state alone never authorizes deletion.

The policy states are `LEGACY_PASSWORD_PENDING`, `GOOGLE_LINKED_VERIFYING`, `MIGRATED_GOOGLE_ONLY`, `DELETION_HOLD`, `DELETION_ELIGIBLE`, `DELETION_IN_PROGRESS`, and `DELETED`. `DELETION_HOLD` and `deletionHold=true` block deletion. Missing/malformed policy, Owner match, non-target cohort, Google provider, or uncertain Auth state all stop deletion. A bounded verifying intent blocks a racing deletion lock; stale intent may be reconsidered only after fresh Auth still proves Google absent.

Before the deadline, a password-authenticated roster member can access their own existing private product data, UserIndex, and migration policy. No other password user gains access. At the deadline, the product closes the legacy data view and clears loaded private data. Self-service intent renewal and linking end at the deadline; any later recovery needs a separate approved administrative hold and review. General new Google users retain Candidate A's access-request path. The UI offers legacy password login and reset only to account holders; Firebase Auth still determines identity and Firestore policy determines cohort. The product never claims target identity from an email typed into the page.

## Migration sequence

Sign in to the existing Firebase user with email/password, load the protected policy, and show the modal and persistent banner. Acquire a policy intent before calling `linkWithPopup(currentUser, GoogleAuthProvider)`. Check returned UID and Google provider, re-read Log/Plan/Settings presence on the original paths, sign out, sign in with Google, and verify UID and token. Only then unlink `password` and set `MIGRATED_GOOGLE_ONLY`. On any mismatch or uncertain data, stop and preserve both Auth and Firestore data. A linked Google provider permanently blocks retention deletion even if the policy write fails.

Password reset uses Firebase Auth `sendPasswordResetEmail` with a production-domain continue URL. Candidate tests mock the SDK; no Production email is sent. The cutover runbook has one post-gate notice per protected target Auth email.

## Retention service

`my-gym-log-retention` is a separate Cloudflare Worker on Workers Free. Its UTC hourly `:15` Cron always checks the eligibility instant; a deployed trigger must remain inactive until Final Release authorization. The Worker uses its own service account credential in Worker Secrets, never source or logs. A custom role requires only Auth get/update/delete and Firestore entity get/list/create/update/delete, subject to actual API preflight. It reads the protected roster, takes a Firestore update-time compare-and-swap lock, disables Auth, then re-reads Auth and policy. Google linkage cancels deletion and restores Auth; failure to restore is a Safe Stop. Recursive Firestore traversal enumerates subcollections (including missing-parent paths), deletes leaf documents in bounded chunks, and resumes safely on the next Cron. It excludes the shared public MovementDB. Only after the private root is empty does it delete UserIndex and AccessRequest, recheck Auth and policy once more, delete Auth, and write a minimal private receipt / `DELETED` state. Any API error fails closed. Duplicate Cron work observes the lock and never starts a second deletion.

## Release and rollback

Candidate verification is local tests, Firestore emulator, mocked Worker tests, lint, build, dry-run packaging, and read-only security review. No Production write occurs in Candidate B. The post-gate cutover must first capture protected Auth/Firestore/Rules/Render backups and verify two exact target UIDs, recovery emails (if any), IAM, Free plans, and reversible restore points. Provider collision, ownership uncertainty, missing nested inventory, or a cost prompt blocks cutover. Before release, rollback is abandoning Candidate B. After release, disable the Cron and restore the prior client/Rules only through the reviewed incident path; irreversible deletions require restoring the protected backup and may not be rolled back by recreating a new UID.

## Candidate freeze blockers

The packaged Windows runtime currently cannot start Firestore emulator Java: its loopback Unix-domain socket initialization fails before Rules tests run. The new Rules therefore remain unverified. The retention Auth parser deliberately rejects a missing or malformed `providerUserInfo` list. A fresh read-only lookup of actual password-only E2/E3 Auth responses is required to confirm whether the REST API returns an explicit empty list; if it omits the list, the deletion path remains safely stopped until a separately reviewed parser contract is proven. Neither issue may be treated as a passing check or waived by the Candidate unit suite.
