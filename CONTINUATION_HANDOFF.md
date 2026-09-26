# My Gym Log Security Hardening V1 — Candidate C KEEP_ONLY_LOUIS continuation

This section supersedes earlier E1/E2/E3/Anonymous preservation instructions below. Current Gate: `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE = OPEN`. Read Candidate C exact local HEAD and parent fresh; parent must be frozen Candidate B `998e9e39c9fc4159d681da5be0c91b282c05ae92`. Frozen Candidate B and remote `main` `69823504dd6424fc12568d95fc56046e90e35939` must remain unchanged. Candidate C was created only because Candidate B's client, Rules and Worker contract cannot support the one protected alias without code changes.

Owner policy is `LEGACY_ACCOUNT_POLICY=KEEP_ONLY_LOUIS`; public code uses `LEGACY_MIGRATION_KEEP_01` only. Exact email/UID mapping, deletion manifest, journal, rollback snapshot and postcheck stay in protected `%LOCALAPPDATA%/MyGymLogPrecheck/` evidence. The protected account is not permanent allowlist: same-UID Google migration by `2026-12-31 23:59:59 Asia/Taipei` cancels deletion eligibility; otherwise retention may begin at `2027-01-01 00:15 Asia/Taipei` after the authorized release.

Under separate Owner authorization, one-time Production cleanup completed 184/184 exact retired legacy targets: 53 with data and 131 Auth-only. Independent read-back found zero target Auth, zero target-owned/nested Firestore documents, 184 minimal receipts, no leftover cleanup lock, unchanged protected-account data and unchanged shared public MovementDB. Owner's one document value change predates the cleanup; Owner Auth and path set remained stable. One additional password identity is unclassified, excluded and untouched. The pre-cleanup 796-document snapshot remains a bounded rollback artifact with hard purge by 2026-10-26 19:16:15 Asia/Taipei; no Vault copy was made.

Candidate C unit 93/93, Rules emulator 27/27, Worker 30/30, lint, build and Wrangler 4.137.0 dry run passed. Read [Candidate C design](docs/security-hardening-v1/KEEP_ONLY_LOUIS_CANDIDATE_C_DESIGN.md), [Cutover](docs/security-hardening-v1/KEEP_ONLY_LOUIS_CANDIDATE_C_CUTOVER.md), [Rollback](docs/security-hardening-v1/KEEP_ONLY_LOUIS_CANDIDATE_C_ROLLBACK.md), [IAM](docs/security-hardening-v1/KEEP_ONLY_LOUIS_CANDIDATE_C_IAM.md), and [Test Record](docs/security-hardening-v1/KEEP_ONLY_LOUIS_CANDIDATE_C_TEST_RECORD.md). Formal Product Mother must be read and brought into sync before any release decision.

Final Release readiness cannot claim `NO_VALID_USER_LOCKOUT` until the unclassified password account is classified. No Candidate C Production deploy, Rules publish, provider link/unlink, migration email, Cron activation, paid upgrade or `main` merge is authorized. The separately authorized retired-cohort cleanup does not authorize Production cutover.

Copyable continuation: 接續 My Gym Log Candidate C `KEEP_ONLY_LOUIS`。先讀此 Handoff、Candidate C Design/Cutover/Rollback/IAM/Test Record 與正式 Product Mother；fresh read Candidate C exact SHA、Candidate B parent、remote main、Production app/Rules/Worker、Spark/Workers Free。受保護清理名冊已逐 UID 完成 184/184，留有 1 個未分類 password 帳號例外；先核對該帳號的有效使用者分類與 Product Mother 同步，再做 Final Release Readiness。維持 `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE=OPEN`；不得因清理完成而部署或啟動 Cron。

---

# My Gym Log Security Hardening V1 — Candidate B continuation

Current Gate: `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE` (OPEN). Owner approved `LEGACY_ACCOUNT_SUNSET_2026` as Candidate B scope. The frozen Candidate A remains `d098f9048d0b2b362cca4c061cc449d08c19105c`; Candidate B branch `security-hardening-v1-legacy-sunset-2026` starts exactly there. The verified Candidate B freeze is this handoff's committed HEAD; read its exact SHA and integrity evidence from Git and the formal Product Mother. Production, `main`, Rules, Auth, emails, Firestore, and Workers traffic were not changed.

## Candidate B implementation and evidence

- The branch adds E2/E3-only migration policy, same-UID Google link flow, persistent notice, Firebase password reset entry, deadline enforcement, and separate Free-plan retention Worker. Exact target UID/email mapping remains only in protected local evidence; source and Product Mother must use E2/E3 aliases only.
- Read the branch HEAD fresh; the recovered WIP checkpoint was `ebd6136d72bb52c1f1d676fceea6493b6f3b8887`. The 2026-09-26 final local rerun after the recovery-path repair passed 90/90 unit, 30/30 Worker, 26/26 Firestore Rules emulator, lint, build, and Wrangler dry-run. Final read-only security review found no remaining Critical or Important code issue. The freeze SHA is recorded only after Git commit readback, without making this handoff self-referential.
- The Firestore emulator's former Windows Java loopback startup error did not recur. With portable Java 21 and `TEMP/TMP=C:\Windows\Temp`, the demo-project Rules suite passed 26/26. Do not revert to the stale blocked status.
- Fresh read-only Production Auth lookup matched the protected E2/E3 original UIDs and showed valid `providerUserInfo` arrays with `password` only, no Google provider, and no `recoveryEmail`. Both original Auth emails are unverified. Exact target identities remain only in protected local evidence; no Production record was changed. The retention parser matches the observed provider response shape.
- Read-only security review found an unnecessary same-email restriction in the Google-link check. The branch now accepts a different Google provider email while still requiring original UID, unchanged original Auth email, verified Google token, and unchanged private data. An isolated demo Auth emulator confirmed that a different Google email leaves the original Auth email unverified until Firebase's built-in verification action succeeds. The client offers that action and defers post-link Firestore reads until verification; a linked Google provider still vetoes deletion. Final read-only review found no remaining Critical or Important code issue.
- Review `docs/security-hardening-v1/LEGACY_ACCOUNT_SUNSET_2026_DESIGN.md`, `_CUTOVER.md`, `_IAM.md`, and `_ROLLBACK.md`. The Final Release Gate still needs an exact frozen B SHA, Rules/Worker hashes, protected E2/E3 status, zero-cost readback, and explicit Owner approval before any Production side effect.

## Copyable Candidate B continuation command

> 接續 My Gym Log Security Hardening V1 Candidate B `LEGACY_ACCOUNT_SUNSET_2026`。先讀本 Handoff、Candidate B 設計／Cutover／IAM／Rollback 與正式 Product Mother，核對 Candidate B branch 的 parent 必須是 frozen Candidate A `d098f9048d0b2b362cca4c061cc449d08c19105c`，main／Production 不變。Firestore emulator 26/26、E2/E3 Auth provider 回應唯讀預檢、最終安全複核與 fresh checks 已通過；核對 Candidate B freeze exact SHA、hash、runbook 與正式 Product Mother 後停在 Final Release Human Gate。未得新的 Final Release 授權，不得 merge、部署、寄信、連結／刪除 Production 帳號或啟動 Cron。

---

## Frozen Candidate A historical handoff

Current Gate: `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE` (OPEN). This is a continuation of the Owner-approved Zero-Cost execution, not a new Gate. The candidate is the latest verified `origin/security-hardening-v1` HEAD; read its exact SHA fresh before any next action.

## Baseline and state

- Canonical repository: `ctom40101-creator/my-gym-log`.
- Formal Production/main baseline: `69823504dd6424fc12568d95fc56046e90e35939`.
- Isolated worktree: `C:\Users\YongLeptop\Desktop\本機開發\My Gym Log\security-hardening-v1`.
- Production was read back as Live from the baseline, Firebase Spark, and Cloudflare Workers Free. No Production mutation, paid activation, Worker deploy, Rules publish, Auth provider migration, Auth disable/delete, or `main` merge was performed.
- Implementation, integrated validation, review, and candidate freeze are complete. The code/review ledger is [PROGRESS.md](docs/security-hardening-v1/PROGRESS.md); release decision and rollback are [FINAL_RELEASE_GATE.md](docs/security-hardening-v1/FINAL_RELEASE_GATE.md); deletion procedure is [DELETION_CLEARANCE_RUNBOOK.md](docs/security-hardening-v1/DELETION_CLEARANCE_RUNBOOK.md).
- The formal Google Drive Product Mother `02_Current State` and `08_Handoffs` tabs were updated and read back at candidate freeze. Check their latest revision again before a Production Gate decision.

## Verified candidate checks

- Unit tests: 42/42.
- Firestore emulator tests: 22/22, using the isolated `demo-mygym-security-v1` project.
- ESLint and Vite build: pass. Vite retains the existing large-chunk warning.
- Wrangler 4.137.0 `deploy --dry-run`: pass. No Worker deployed.
- Independent read-only review: no remaining Critical or Important code finding.
- `git diff main...HEAD --check`: pass; worktree clean after push. Recheck on recovery.

## Release-time checks still open

- Protected full Auth/UserIndex/Firestore inventory and retained-user UID-preserving migration roster, including Email and Anonymous users.
- Owner's unique original UID, Google linkage and `SecurityConfig/owner` privileged seed/read-back before Rules or Worker cutover.
- Complete UID-linked data inventory, including any path outside the tool-checked user root.
- Auth-only Worker IAM/Secret provisioning, Free-plan read-back, and staged Production validation after explicit Owner Final Release Gate approval.
- Owner acceptance of manual Admin cleanup and privileged deletion-clearance issuance before permanent Auth deletion.

Do not infer Production release authorization from candidate tests or this handoff. On an Owner UID collision, possible data loss/split, paid prompt, unsafe Production state, or out-of-scope irreversible action, stop safely.

## Copyable continuation command

> 接續 My Gym Log Security Hardening V1 Zero-Cost Native Continuous Execution。這是 Final Release Human Gate 候選封存後的接續，不是新 Gate。先讀 `CONTINUATION_HANDOFF.md`、`docs/security-hardening-v1/PROGRESS.md`、`docs/security-hardening-v1/FINAL_RELEASE_GATE.md` 和正式 Product Mother；fresh read `origin/main` 與 `origin/security-hardening-v1` 並確認乾淨 worktree、Spark、Workers Free、Production baseline。以最新遠端候選 SHA 為唯一候選，不重做已完成實作。未經 Owner 明確核准 Final Release Gate，不得 merge main、部署 Render/Worker、發布 Rules、遷移 Production Auth、停用或刪除 Production 使用者或啟用 Paid。

Rollback before release: stop using the isolated branch/worktree; `main` and Production remain at the baseline. After release, follow the explicit conditions in `FINAL_RELEASE_GATE.md`; do not republish permissive legacy Rules without an incident decision.
