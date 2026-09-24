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

## 2026-09-24 — integrated validation and Production read-only audit

- Integrated Firestore emulator transition passed: self pending request, private write denied, Admin approval, private read/write allowed, Admin disable, private read denied, disabled request cleanup. Rules suite now passes 12 of 12.
- Production Firebase Console read-back was strictly read-only: project still shows Spark; Google, Email/Password, and Anonymous providers are enabled; one-account-per-email is selected; `ctom40101@gmail.com` search returned exactly one Auth row, currently labeled Email, with the same UID as the existing UserIndex. The Owner UserIndex identity fields are compatible with the candidate rule schema.
- The Production root currently showed `artifacts` and no `AccessRequests` collection. Published Rules still contain unconditional public read/write and private self/admin-email access, matching the 2026-09-23 evidence. These Rules were **not** changed in this run.
- The Owner private document showed exactly `BodyMetricsDB`, `LogDB`, `MovementDB`, `PlansDB`, and `Settings` subcollections. This is one sampled UID; a release-time inventory of all retained user data is still required before enabling permanent deletion.
- Production Auth has legacy Email and Anonymous users. UID-preserving Google linking for the Owner and disposition of other legacy accounts remain Final Release Gate checks. No provider link, sign-in, Auth record mutation, or Firestore write was performed during the audit.
- Added an Owner-only local migration page and pre/post UID guards. It is served by Vite dev on localhost, excluded from the Production build, and must not be used until the Final Release Human Gate approves the Production Auth migration. The page was visually read back locally without submitting credentials.

## 2026-09-24 — independent security review and repair

- A read-only reviewer found six material issues in the first candidate: self-deletion left an approved request, admin deletion trusted a client boolean and missed unknown nested data, Worker accepted password-provider Owner tokens, the Owner migration receipt did not check fresh Google claims, admin user switching could show the previous user's data, and Rules used email alone for Admin. The reviewer did not edit files or touch Production.
- Added a protected `SecurityConfig/owner` document contract. Rules now require its original UID together with verified Google Owner claims; a second UID using the Owner email fails the emulator checks. This config must be seeded with the original Owner UID **before** the Production Rules cutover, under the Final Release Gate.
- Worker now rejects password-provider tokens. The local-only Owner linking page re-reads a fresh Google ID token and checks UID, verified email and sign-in provider before it reports success.
- Admin user switching waits for all four target snapshots and displays a read-only viewer. The prior user's data cannot be paired with the new target UID for editing.
- Admin deletion no longer passes `cleanupComplete`. The Worker directly verifies a disabled request, absent UserIndex and user root documents, and no remaining private collection IDs before permanent Auth deletion. If an unknown or orphaned subcollection exists, Auth deletion stops and the account stays disabled.
- Self-deletion now requires recent Google reauthentication, deletes known data and index, transitions its own approved request to disabled under a narrow Rules clause, then asks the Worker to verify empty paths before Auth deletion. If cleanup is incomplete, the disabled request remains and the Admin must resolve the residual data. Old ID tokens cannot regain private access after the status transition.
- Emulator confirmed that Firebase ID tokens receive HTTP 403 for Firestore `listCollectionIds` metadata operations, while the privileged emulator token sees unknown nested collections beneath a missing user document. Therefore the Worker service account needs a post-gate custom read-only Firestore role with `datastore.entities.get` and `datastore.entities.list`, in addition to Auth lookup/update/delete permissions. No IAM role or secret has been provisioned. The Worker requests only Identity Toolkit and Datastore OAuth scopes. IAM API use is free, but Worker Free CPU/subrequest behavior still requires post-gate validation.
- Latest validation: 25/25 unit tests, 15/15 Firestore emulator tests, ESLint and Vite build pass. Wrangler dry-run and full release evidence must be repeated after candidate freeze. No Production mutation occurred.

## 2026-09-25 — shutdown recovery and architecture correction

- RECOVERY READBACK: `repo` remained clean on `main` at `69823504dd6424fc12568d95fc56046e90e35939`; isolated `security-hardening-v1` worktree and remote branch were both at `dc19ddfcfe49bc57b656fe0a504b8a88409652b4`. The prior uncommitted repair matched this ledger. No rebase, merge, cherry-pick, revert, Git lock, partial install, or unfinished build was found. No earlier completed commit was recreated.
- Read-only dashboards: Render `my-gym-log` was Live from `main` commit `69823504dd6424fc12568d95fc56046e90e35939`; Firebase showed Spark; Cloudflare showed Workers Free and no My Gym Log Worker. Production and `main` were not mutated.
- Formal Product Mother read-back exposed a conflict in the prior paragraph: its approved Zero-Cost Revision confines the Worker to Firebase Auth admin operations and its service account to Auth-only IAM. The proposed Worker Firestore service-account scope and read/list role were **not adopted**. This paragraph supersedes that proposed permission expansion.
- Replaced Worker-side privileged Firestore reads with a protected `DeletionClearances/{uid}` proof. The Worker uses the caller's verified Firebase ID token to read the disabled AccessRequest and clearance, and compares the target UID/email plus the request's exact `updateTime`. The service account OAuth scope is now only Identity Toolkit. Clients cannot create or alter clearances under candidate Rules.
- Added a local-only privileged inventory tool for use **after** Final Release Gate authorization. It verifies disabled request identity, absent UserIndex/root, and all collection IDs under the user root (including orphaned nested data), then can create a clearance with an explicit `--commit`. It uses the Owner's separate official `gcloud` browser credential at operation time; it does not expand the Worker service account. No Production clearance or credential was created in this run.
- Candidate Rules restrict future private writes to the five product collections and prevent new writes after a target is disabled. Admin and self-deletion now stage cleanup and access revocation, wait for independent complete inventory, then finalize Auth deletion. The self route still requires recent Google reauthentication. An old/stale clearance cannot authorize deletion after a request state change.
- The operator inventory protocol is a release-time manual step and an explicit operational deviation from an immediate one-click deletion experience. The Final Release Human Gate must review it along with the account migration roster and full existing-data inventory. Missing proof fails closed with Auth retained/disabled.
- Validation after this correction: 33/33 unit tests, 19/19 Firestore emulator tests (including unknown orphan detection through REST), ESLint, Vite build, and Wrangler 4.137.0 `deploy --dry-run` passed. Java 21 was restored only as a verified portable local test dependency. No Production mutation occurred.

## 2026-09-25 — independent candidate repair and integrated validation

- The prior paragraph's self-cleanup description is superseded. Member-initiated deletion now requires recent Google reauthentication and atomically locks the request as `disabled` with `selfDeleteRequestedAt` **before any data deletion**. Rules immediately deny that member's private reads and writes, including with an old token. The Admin then performs known-path cleanup; the independent operator issues clearance only after a full-root inventory. Auth deletion and request/clearance metadata cleanup are final steps. The member may finish Auth deletion after a second recent Google reauthentication; the Admin can finish if necessary. This Admin/operator dependency must be accepted at the Final Release Gate.
- Admin deletion uses a fresh Firestore transaction to lock `deletionStartedAt` and disabled status before Worker Auth disable. Rules prevent later reapproval or new private writes. The Worker validates the deletion marker, exact target identity, and protected clearance; no client boolean controls permanent deletion. A missing Auth `users` field is handled as an already-deleted retry only when the clearance remains valid.
- Worker verifies the Owner's current Auth record is unique, enabled and email-verified, and that its `validSince` precedes the Firebase token's `auth_time`. Missing or malformed revocation metadata fails closed. The same revocation check protects member self-finalization. Its service-account scope remains Identity Toolkit only; Firestore reads use the caller's Firebase token.
- Admin cleanup deletes the root user document as well as the five known subcollections and UserIndex. After Auth deletion, request and clearance are removed in one Firestore batch; Rules require the request to be absent in the batch's post-state. Emulator proved the batch behavior.
- Browser drafts are keyed by Firebase UID; the unowned legacy global draft is never automatically attached to a different account. Account switching clears in-memory draft, selected plan and derived weight history; a self-deletion request clears local draft data. Final Gate notes the legacy draft disposition.
- The separate local clearance procedure and Final Gate explicitly bound proof to the user root, UserIndex and request; any other UID-linked Production path requires independent inventory. The Final Gate also makes the original Owner UID's `SecurityConfig/owner` seed/read-back a blocking pre-cutover step and documents immediate Rules Admin cut-off during an Owner token incident.
- Latest integrated checks before candidate freeze: 42/42 unit tests, 22/22 Firestore emulator tests, ESLint and Vite build pass. Vite still reports the inherited large-chunk warning. No Production, `main`, provider, IAM, or billing mutation occurred.
- The verified implementation and test changes were committed on the isolated branch as `1748f9c` (`Harden account deletion and isolate user data`). Documentation and final read-back evidence follow in a separate commit; neither commit touches `main`.
