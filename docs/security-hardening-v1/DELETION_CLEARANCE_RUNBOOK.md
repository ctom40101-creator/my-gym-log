# Deletion clearance — post-gate operator runbook

Status: candidate procedure only. Do **not** run against Production until `SECURITY_HARDENING_FINAL_RELEASE_HUMAN_GATE` approval. The Worker service account remains limited to Firebase Auth lookup/update/delete; it has no Firestore IAM role or Datastore OAuth scope.

## Why this step exists

Firestore client credentials cannot enumerate all subcollection IDs. A deleted parent document may still have nested documents. The Worker therefore refuses permanent Auth deletion unless a privileged operator has verified the entire target data root and issued a protected `DeletionClearances/{uid}` document. Firestore Rules allow the target and verified Admin to read this proof, but no client may create or edit it.

## Preconditions

1. Confirm the exact approved candidate commit, the original UID-to-email mapping, a recoverable protected inventory/backup, Spark and Workers Free, and the deployed Rules/Worker version. Stop on a duplicate Owner UID, mismatched identity, missing backup, unexpected data path, billing prompt, or permission expansion request.
2. The target `AccessRequests/{uid}` is `disabled`. The Admin runs the staged cleanup, clearing the five known private collections and UserIndex. An Admin-initiated deletion also disables target Firebase Auth at staging. A member-initiated request first disables its own data access; the Admin performs cleanup while leaving Auth available for recent Google reauthentication and a possible member finalization. If the Admin finalizes instead, the Worker disables Auth immediately before permanent deletion. Self deletion requires the member's recent Google reauthentication at both staging and finalization.
3. Use the Owner's official Google Cloud CLI browser login as `ctom40101@gmail.com` on a trusted local machine. The CLI is a separate human operator credential. Never paste an access token, service account key, or target inventory into Git, docs, logs, or chat.

## Verify then issue

From the isolated candidate worktree, after installing project dependencies with `npm ci` and the official Google Cloud CLI:

```powershell
gcloud auth login ctom40101@gmail.com
node tools/deletion-clearance/main.js --uid TARGET_UID --email TARGET_EMAIL
```

The default invocation is read-only. It checks that the request UID/email/status match, UserIndex and user-root documents are absent, and Firestore `listCollectionIds` finds **no** collection beneath `artifacts/mygymlog-604bc/users/TARGET_UID`. This detects nested descendants even when their parent document is missing. A read or permission failure stops the operation.

The tool covers that user root, the single UserIndex document, and the AccessRequest. It does not search unrelated database paths. The protected Production inventory must separately identify and resolve any other UID-linked data before issuing proof; a passing tool result alone does not establish database-wide absence.

After independently checking the protected inventory/backup and dry-run result, issue a clearance for this exact request version:

```powershell
node tools/deletion-clearance/main.js --uid TARGET_UID --email TARGET_EMAIL --commit
```

`--commit` creates only `DeletionClearances/{uid}` with UID, email, and the disabled request's exact Firestore `updateTime`; it refuses to overwrite an existing clearance. The Worker compares these fields again before Auth deletion. If the request changes, the old proof becomes invalid. The script does not delete user data or Auth.

## Finalize and read back

- Admin deletion: select **盤點後完成永久刪除** for the disabled target. The Worker checks the clearance and disabled Auth state, deletes Auth, then the client removes the disabled request and clearance. Re-read Auth, request, clearance, UserIndex, and private root state. A partial failure requires inspection before retry.
- Self deletion: the member first locks their request as disabled. This immediately denies private reads and writes, including through an old token. The Admin then cleans the known paths; a partial cleanup remains disabled and can be resumed by the Admin. After inventory, the member may use **盤點完成後刪除 Auth 帳號** on the disabled screen with fresh Google reauthentication. If the Admin finishes instead, the Worker first disables Auth. The Admin must then clear the disabled request and clearance; do not claim full deletion until that metadata cleanup is read back.
- If proof is missing, stale, or any collection remains, keep Auth disabled or the request disabled and stop. Do not issue an unverified proof to make a test pass.

The account's original UID and data are never remapped during this procedure. The tool's write mode and all Production operations remain blocked before the Final Release Human Gate.
