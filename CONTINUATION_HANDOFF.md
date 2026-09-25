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
