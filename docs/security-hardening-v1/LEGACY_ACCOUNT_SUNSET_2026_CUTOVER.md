# Candidate B — Production Cutover Runbook

Status: **NOT AUTHORIZED**. `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE` remains OPEN. Every numbered action below is post-approval only. No Production action was executed while preparing Candidate B.

## Exact scope and protected inputs

- Candidate parent: frozen Candidate A `d098f9048d0b2b362cca4c061cc449d08c19105c`.
- `main` / Production baseline before cutover: `69823504dd6424fc12568d95fc56046e90e35939`; read back again at release.
- Target aliases: **E2 and E3 only**. Exact UID and Auth email remain solely in protected local `%LOCALAPPDATA%/MyGymLogPrecheck/email-decision-private.md` and fresh protected preflight evidence. Never copy them into Git, Product Mother, logs, or chat.
- Owner `ctom40101@gmail.com` and E1, all Anonymous accounts, and ordinary new Google users are outside this sunset policy.
- Deadline `2026-12-31 23:59:59 Asia/Taipei` = `2026-12-31T15:59:59Z`. First deletion window `2027-01-01 00:15 Asia/Taipei` = `2026-12-31T16:15:00Z`.
- Release must still resolve Candidate A's unrelated Anonymous retention/access and shared public catalog decision; Candidate B does not silently grant, migrate, or delete them.

## Gate packet required before any write

1. Record exact Candidate B SHA, frozen parent SHA, `main` SHA, Rules SHA-256, retention source/build SHA-256, unit/emulator/lint/build/Worker dry-run evidence, Product Mother revision, and approved rollback owner. Stop if any gate check is not fresh PASS.
2. Fresh read-only Production Auth lookup for E2/E3 and Owner: original UID, actual provider data, Auth email, disabled flag, collisions, and whether `recoveryEmail` exists. Use a recovery address only if that field is actually observed and independently verified. Otherwise send to the existing Firebase Auth email only. Keep the mapping protected.
3. Fresh recursive Firestore inventory for each target root `artifacts/mygymlog-604bc/users/{uid}` using `listCollectionIds` and `listDocuments?showMissing=true` through every level; include absent parent documents, Settings/profile, UserIndex, AccessRequests, MigrationPolicies, DeletionClearances, and any other UID-linked path. Record counts and path classes outside Git. The shared `artifacts/mygymlog-604bc/public/data/MovementDB` is excluded from per-user deletion. Stop on unexpected ownership or an unaccounted path.
4. Obtain protected Auth/Firestore export and restoration test, prior Rules text/hash, prior Render deploy ID, prior Firebase Auth password reset template, current provider settings, IAM role list, Firebase Spark and Workers Free read-back. Free-tier quota exhaustion must fail closed; no paid upgrade.
5. Confirm a distinct retention service account exists with the custom role in `LEGACY_ACCOUNT_SUNSET_2026_IAM.md`. Provision the key **only** as `SERVICE_ACCOUNT_JSON` in the separate Cloudflare `my-gym-log-retention` Worker Secrets after approval. Never export or paste its value into review artifacts.

## Ordered release

1. Apply Candidate A's Owner UID-preserving Google link using the existing local-only Owner tool, verify original UID and data, then seed/read back `SecurityConfig/owner`. Stop on a new UID, collision, or missing private data. This is outside the E2/E3 sunset roster.
2. From the protected mapping, create exactly two admin-only `MigrationPolicies/{originalUid}` documents, one `cohort=E2`, one `cohort=E3`, with fields: `program=LEGACY_ACCOUNT_SUNSET_2026`, `cohort`, `originalUid`, `deadlineAt=2026-12-31T15:59:59Z`, `state=LEGACY_PASSWORD_PENDING`, `deletionHold=false`. No target email belongs in the policy. Read each UID and field back privately. Reject any extra or duplicate document.
3. Seed/read back `AccessRequests/{originalUid}` with `status=approved` for E2/E3 under the approved existing-user roster procedure so the same UID retains access after Google sign-in. Do not fabricate a new user or UID. Confirm each target's original Log/Plan/Settings and other private paths remain available. Resolve the separate Anonymous roster before publishing restrictive Rules.
4. Publish the exact Candidate B Rules and read back the published hash. Verify: E2/E3 password identity reads only its own policy/data before deadline; non-target password users and pending Google users cannot read product data; Owner remains Admin only at original UID. Stop on a mismatch.
5. Deploy the Candidate B client from the frozen SHA to Render after confirming the prior deploy restore point. Verify the Google path for ordinary users, E2/E3 password path, visible modal/banner and reset continue URL. No provider is linked automatically by deployment.
6. Update Firebase Auth's **global** password-reset template only after saving its old values. Suggested subject: `My Gym Log：請於 2026/12/31 前完成 Google 帳號連結`. Suggested body: `請於 2026/12/31 前完成 Google 帳號連結。期限後仍未完成，本帳號及 My Gym Log 個人資料將永久刪除。若忘記原密碼，請使用本信的 Firebase 重設連結，重設後回到 My Gym Log，以原帳號登入並連結本人 Google 帳號。` Keep Firebase's mandatory reset-link placeholder intact. Use the released forgot-password action with `https://my-gym-log.onrender.com/?legacyMigration=1` as continue URL to send **one** Firebase reset/notice email to each target's existing Auth email from protected mapping. Record per-alias sent/failed status only in protected evidence. Restore and read back the prior global template immediately. Do not use `recoveryEmail` without the fresh proof in step 2. Do not use a paid SMTP provider.
7. Each target signs in with the original Email/Password, begins policy intent, links Google to **the current Firebase user**, compares original data paths, signs out, signs in with Google, verifies original UID and fresh Google token, rechecks data, unlinks `password`, and writes `MIGRATED_GOOGLE_ONLY`. Verify Auth provider data and policy independently. A provider collision, changed UID, missing data, or unverified identity is a Safe Stop. Never make a new Google UID and move data.
8. Only after all preflight/rollback records exist, deploy `my-gym-log-retention` on Workers Free from `retention/wrangler.jsonc`. The hourly UTC `:15` E2 trigger and `:30` E3 trigger have no deletion before `2026-12-31T16:15:00Z` (E3 first window `16:30:00Z`); verify Cron, Worker source hash, Free plan, separate service account and Secrets binding name. An HTTP request cannot invoke deletion. If any target has Google linked, Worker must report NO DELETE regardless of Firestore state.
9. Monitor Auth provider status, policy state, data paths, AccessRequest, Rules denials, Render errors, Worker fixed-code error logs, and free quota. Close the Final Release Gate only after Owner accepts observed Production behavior. The deletion policy remains inactive for completed migrations.

## Safe Stop

Stop on a wrong/duplicate UID, unclear human ownership, missing or stale backup, missing nested inventory, recovery email ambiguity, unexpected Firestore path, failed Rules/emulator proof, paid prompt, IAM expansion request, email template restore failure, provider collision, partial unlink, stale Google verification, or any Production state drift. Keep Auth and data intact; `deletionHold=true` is an admin-only protective state if policy has already been seeded.

## Source notes

Firebase documents [in-place provider linking](https://firebase.google.com/docs/auth/web/account-linking), [password reset and template configuration](https://firebase.google.com/docs/auth/web/manage-users), [continue URLs](https://firebase.google.com/docs/auth/web/passing-state-in-email-actions), and the [Spark reset email limit of 150/day](https://firebase.google.com/docs/auth/limits). Cloudflare documents [UTC Cron execution](https://developers.cloudflare.com/workers/configuration/cron-triggers/) and [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/).
