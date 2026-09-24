# SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE

Status: **OPEN — no release approval has been given in this runtime.**

Owner: 世詠. Resource Owner: `ctom40101@gmail.com`.

This is the reviewable release gate for the approved Security Hardening V1 scope. The implementation branch is `security-hardening-v1`; the formal `main` starting baseline remains `69823504dd6424fc12568d95fc56046e90e35939`. No step below authorizes action before Owner approval at this gate.

## Candidate evidence

| Requirement | Candidate evidence | Release-time proof still required |
| --- | --- | --- |
| Firebase Spark and Workers Free | Firebase and Cloudflare dashboards read back as free; Worker `wrangler deploy --dry-run` packaged | Recheck both plans immediately before deployment; stop on billing prompt |
| Admin verified Firebase identity | Worker JWT, Owner lookup, collision and self-target tests; Rules emulator admin tests | Verify Owner original UID and Google provider linkage in Production |
| `AccessRequests/{uid}.status` authorization | Rules and client state tests; integrated emulator transition | Migrate active existing users to stable UIDs and approved request documents before Rules cutover |
| Google-only product entry | Local browser read-back of candidate sign-in page; legacy sign-in removed from production bundle | Owner and retained existing users must prove Google sign-in returns their original UID |
| Privileged account operations | Worker Auth-only scope; staged cleanup, protected clearance and local full-root inventory tests; no secret in repository | Provision least-privilege Auth-only Worker secret after approval; Owner reviews the separate clearance operator step before any permanent deletion |
| Member-initiated deletion | Recent Google reauthentication locks `AccessRequests` as disabled; Admin cleans data, independent operator inventories, then member or Admin finalizes Auth | Owner accepts that permanent deletion requires an Admin/operator step and is not immediate |
| No Production changes before gate | Branch/worktree commits and remote `main` read-back; Firebase audit strictly read-only | Fresh release baseline read-back and Owner authorization |

## Known Production facts from 2026-09-24 read-only audit

- Firebase remains Spark. The Auth table search for the Owner email showed one row, labeled Email; the existing UserIndex matched its UID. Do not place that UID into a public release note.
- Google, Email/Password, and Anonymous providers are currently enabled. One account per email is selected. Provider settings were not changed.
- The Firestore root showed `artifacts` and no `AccessRequests` collection. Published Rules still allow unconditional read/write of `artifacts/{appId}/public/{document=**}` and private self/admin-email access without an email verification requirement. No Rules were published in this task.
- The Owner private document showed five subcollections: `BodyMetricsDB`, `LogDB`, `MovementDB`, `PlansDB`, `Settings`. This is a sample, not a full account inventory.
- Production Auth contains legacy Email and Anonymous users. Direct release of the Google-only client or strict Rules without a UID-preserving migration/authorization roster can make existing data inaccessible.

## Blocking release checks

1. Freshly read Product Mother Current State, accepted spec/decision, Production identity, rollback, and the exact candidate commit. Re-read `origin/main`; it must be the expected baseline or the diff must be explicitly reviewed before proceeding.
2. Export or otherwise obtain a protected, recoverable Auth/UserIndex/Firestore inventory without putting personal data or credentials in Git. Map each retained account's original UID, provider(s), and private subcollections. Check duplicate Owner email/UID and mismatched UserIndex identity. Stop if ownership cannot be resolved without data split or loss.
3. Decide the disposition of existing Email and Anonymous users. Retained users need a UID-preserving Google linkage or a documented data retention/migration path. The candidate does not auto-merge accounts. Do not approve new UID accounts against old data paths. Preserve any existing browser-local `gym_log_draft` separately if it matters to the Owner: its original UID cannot be proven, so this candidate never attaches it to a new account automatically.
4. Owner personally uses the **local-only** `/owner-migration.html` page after gate approval, with the existing Firebase password, original UID read from the Auth console, and the same Google account. The page verifies the UID before linking and after a fresh Google sign-in. If UID/provider email differs, stop; do not delete or relink automatically. [Firebase account-linking procedure](https://firebase.google.com/docs/auth/web/account-linking).
5. Verify least-privilege service account permissions for Auth lookup/update/delete **only**, Cloudflare Workers Free status, and intended Worker name/URL. Do not grant this Worker account Firestore read/list IAM. Provision the service account credential only as the Cloudflare `SERVICE_ACCOUNT_JSON` Secret after approval. No value belongs in Git, docs, frontend, logs, or ordinary config. `wrangler secret put` can deploy a Worker and is therefore a post-gate action. [Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
6. Confirm every private collection that account deletion must cover. The client enumerates five known collections; the separate Owner-operated [deletion clearance procedure](DELETION_CLEARANCE_RUNBOOK.md) must inspect the complete Firestore user root, including orphaned nested collections, before creating each protected proof. This manual step is a review item at this Gate. If any retained path exists, stop permanent Auth deletion and resolve it with a tested cleanup method.
7. Define a verified migration roster for `AccessRequests/{uid}`. Create/approve request documents for retained, Google-linked original UIDs **before** strict Rules publication, using an approved privileged migration method. Record counts and read back without publishing identities. Do not use the current permissive Rules as evidence that a request is authorized.
8. After confirming the Owner's original Auth UID and Google linkage, create `SecurityConfig/owner` with exactly that original UID through the approved privileged method. Read the document back and compare it to Auth and UserIndex before Worker verification or Rules cutover. Stop on any mismatch; do not seed a newly created UID.

## Post-approval release sequence

1. Capture a fresh, protected read-back of current Render deploy, Firestore Rules, Auth provider state, Owner UID, UserIndex, and free billing plans. Record restoration artifacts outside public Git.
2. Complete Owner and retained-user UID-preserving provider migration; verify old UID and private data paths. Stop on collision, duplicate Owner UID, unexpected new UID, or missing data.
3. Create the approved AccessRequests roster and the protected `SecurityConfig/owner` original-UID document, then read back every retained UID/status and the Owner UID. Verify a pending-account denial in the emulator or a separately approved test environment before Rules cutover.
4. Provision the Auth-only Worker binding, deploy the candidate Worker on Workers Free, and verify unauthorized requests are rejected. Do not configure paid resources or Firestore IAM for the Worker service account.
5. Publish the tested Firestore Rules to Production only after roster verification; read back the published text and test approved, pending, disabled, and Admin behavior. Stop on any mismatch.
6. Set Render's build-time `VITE_SECURITY_WORKER_URL` to the verified Worker HTTPS origin, deploy the frozen client candidate, and test Google login, pending request, Admin decision, private data access, and revocation. Verify no UID changed and no old data path became orphaned.
7. Before any account's permanent Auth deletion, run the read-only full-root inventory and explicit clearance issuance from the approved local operator procedure. Review any UID-linked data outside the checked root separately; a passing tool result does not prove the entire database is empty for that UID. Verify stale or missing proof blocks deletion and complete cleanup of Auth, request, and clearance for a test account in an approved environment.
8. Monitor Render, Worker, Firebase Auth/Firestore errors and free-tier consumption. Close the release gate and consider merging `main` only after Owner accepts the observed Production behavior.

## Abort and rollback

- Before Production mutation: stop and leave the branch/worktree untouched; `main` and Production remain at baseline.
- After a failed provider link or UID mismatch: stop all subsequent steps and preserve both Auth records and Firestore data for manual resolution. No Auth user deletion is an automatic rollback.
- After a failed Rules/client cutover: restore the prior Render deployment if safe, stop Worker traffic, and keep data protected. Re-publishing the old permissive Rules would reopen the known public-write exposure and therefore requires an explicit incident decision; the default response is fail closed.
- A Worker/IAM incident requires immediate secret revocation and access review. Revoke/deactivate only under the approved incident path; retain read-back evidence without credential values.
- If the Owner's Firebase ID token may be compromised, disabling Auth alone does not instantly invalidate an already issued token for Firestore Rules. The privileged incident operator must remove or change `SecurityConfig/owner` to stop the Rules Admin match immediately, then read back denial and follow the approved identity restoration path. The Worker independently checks the Owner Auth record's disabled and `validSince` state. [Firebase session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).
- Never switch Firebase to Blaze or Workers to Paid as a workaround. A billing prompt is a stop condition.

## Human decision

Owner approval must identify the frozen commit, Production baseline read-back, account migration roster/disposition, cost boundary, acceptance of the separate deletion-clearance operator step, staged release order, and rollback owner. Until that decision, no merge, Render Production deploy, Production Rules publication, Production provider migration, Auth disable/delete, deletion-clearance issuance, or Worker traffic cutover is allowed.
