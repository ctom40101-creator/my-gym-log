# Candidate B — rollback and recovery

Status: procedure for review at the Final Release Human Gate. No Production cutover has occurred.

## Before Production write

Stop using the Candidate B branch. Candidate A stays frozen, `main` and Production remain on their existing baseline; no restoration command is needed. Preserve failed test output and the protected identity mapping.

## After policy seed, before client/Rules cutover

Set `deletionHold=true` for both protected policy documents via the privileged operator and read back. Do not delete policy or data to hide an incomplete migration. Restore any changed Firebase reset template from the protected preflight snapshot. Do not send repeated emails.

## After client/Rules cutover

Stop the retention Cron first and verify zero scheduled invocations. Restore the previously captured Render deploy only if its auth UI does not expose users to newly hardened Rules lockout. Keep strict Rules by default; republishing old permissive Rules needs a separate incident decision. Restore the prior Auth template, then read back Auth providers, original UIDs, private paths, UserIndex, AccessRequests and migration policy. A failed Google link or changed UID must keep both Auth records and all Firestore data for manual resolution; never auto-delete a newly created account as a rollback.

## After retention lock or partial cleanup

An in-progress lock or disabled Auth is an incident, not a routine revert. Disable Cron, set `deletionHold=true` in protected policy, preserve logs/receipt metadata, and compare fresh Auth provider data. If Google is linked, restore Auth enabled state and cancel deletion; restore any already removed data from the protected backup to the **same original UID**. If Google is absent, do not re-enable product access until the exact private tree, index and AccessRequest are reconstructed and verified. Never recreate an Auth user with a new UID and call that a rollback.

## After Auth deletion

Auth deletion and password-provider unlink cannot be assumed reversible. Stop Cron, preserve the minimal receipt, restore protected Firestore data only to its original UID if a controlled Auth restoration path can preserve that UID, and obtain a separate incident decision before any replay. A generic new-user sign-up is prohibited because it creates a data split. Keep the Final Release Gate open until Owner accepts the recovery result.
