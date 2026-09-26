# Candidate C — rollback and recovery

Status: review procedure only. No Candidate C Production cutover has occurred.

Before cutover, leave `main`, Render, published Rules and the non-serving Worker unchanged; Candidate B remains frozen. Do not reverse the separately authorized retired-cohort cleanup by automatically restoring deleted Auth accounts.

After policy seeding, set `deletionHold=true` on the one protected policy and read back before any rollback. Preserve the original UID and all private data. Restore any changed global Firebase email template from its captured values.

After client/Rules cutover, stop the single Cron and verify no scheduled invocation, then use the saved Render deploy if it does not create a user lockout under current Rules. Keep restrictive Rules unless a separate incident decision authorizes republishing the prior permissive Rules. Recheck Owner and protected Auth providers, original UIDs, UserIndex, AccessRequest, policy and private paths. Provider-link failure must retain both Auth and data; do not auto-delete a newly created UID.

If a retention lock or partial data removal exists, stop Cron, set the protected policy hold, preserve cursor and minimal receipt, and fresh-read Auth providerData. Linked Google requires restoring Auth enabled state and cancelling deletion. Any data restoration uses the protected typed logical snapshot and the **same original UID** only after separate Owner Production-restore authorization and Spark write-quota check; use controlled multi-day restore if the free daily quota is insufficient. Never use managed import, Blaze or a new UID.

After Auth deletion, do not assume password unlink or Auth deletion is reversible. Preserve audit evidence, stop Cron, verify the original UID can be restored without collision, and obtain a separate incident decision before replay. Purge all copies of the pre-cleanup snapshot by its documented deadline; rollback artifacts are not permanent archives of deleted legacy data.
