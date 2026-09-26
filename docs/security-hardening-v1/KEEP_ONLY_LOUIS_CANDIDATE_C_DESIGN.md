# Candidate C — KEEP_ONLY_LOUIS design and decision

Status: implementation candidate; `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE` remains OPEN. Candidate C starts from frozen Candidate B `998e9e39c9fc4159d681da5be0c91b282c05ae92`. The earlier E1/E2/E3/Anonymous preservation decisions are superseded by Owner's `LEGACY_ACCOUNT_POLICY=KEEP_ONLY_LOUIS` decision. Candidate B and `main` stay unchanged.

The only legacy migration cohort is `LEGACY_MIGRATION_KEEP_01`. The exact Auth email and UID mapping is held only in protected local release evidence. Public code and documentation contain the alias only. It is a time-limited migration opportunity, not a permanent deletion exception. The Owner is independently excluded by the original UID and verified identity; ordinary valid Google users are outside the legacy roster.

One admin-only `MigrationPolicies/{originalUid}` document must have `program=LEGACY_ACCOUNT_SUNSET_2026`, `cohort=LEGACY_MIGRATION_KEEP_01`, `originalUid` equal to the document ID, `deadlineAt=2026-12-31T15:59:59Z`, pending state and `deletionHold=false`. The policy is the exact private roster. The client, Rules, and retention service reject retired E2/E3 cohorts. Retention requires exactly one policy document and one UTC hourly `:15` Cron; any extra or malformed roster stops cleanup. First eligibility is `2026-12-31T16:15:00Z`, after the Taipei deadline. A linked `google.com` provider on the original Auth UID vetoes deletion even when policy state is stale. Owner UID, a hold, changed UID, missing Auth, or uncertain provider data also veto.

The existing Candidate B same-UID flow remains: original Email/Password sign-in, reset/verification if needed, link Google to the current Firebase user, verify original UID and private data, sign in again with Google, unlink password, and mark `MIGRATED_GOOGLE_ONLY`. Pending users see a modal on each sign-in and a persistent deadline banner; completion clears both. No new UID/data copy is permitted.

## One-time Production cleanup evidence

Owner separately authorized one-time deletion of the verified retired legacy cohort. The protected manifest identified 184 exact targets: 53 with Firestore data and 131 Auth-only. One Owner and one protected migration account were excluded; one additional password identity remained unclassified and was excluded. Snapshot SHA-256 `380b92b895fa3476f7f38d139bafbb85f6091ced1df32ecf7cc003e7ac5aad82` covered every target path and target value. All 184 targets passed dry run, then per-UID locked deletion completed with no execution exception. Independent read-back found zero target Auth accounts, zero target-owned documents including nested descendants, 184 minimal receipts, zero remaining cleanup locks, unchanged shared public MovementDB and unchanged protected migration data. The Owner had one unrelated document update before cleanup began; its path set and Auth identity remained unchanged.

The snapshot is a bounded rollback artifact, including retired personal data. The release owner must purge all local and any Owner-controlled Vault copies by `2026-10-26T11:16:15.349Z` (2026-10-26 19:16:15 Asia/Taipei), or earlier if the incident rollback window is formally closed. A purge must be read back and recorded. No Vault copy was made during the earlier backup drill. Never commit the snapshot, manifest, journal, or actual identity mapping.

## Remaining safety condition

The one unclassified password identity was never in the deletion manifest and was not changed. Its valid-user status must be resolved before claiming `NO_VALID_USER_LOCKOUT` at final release. Candidate C's restrictive Rules do not grant it legacy migration access. This is a Final Release readiness exception, not permission to delete it.
