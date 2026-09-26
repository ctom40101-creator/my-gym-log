# Candidate C — retention IAM and zero-cost inheritance

Candidate C changes no Google API operation or OAuth scope. The separate `my-gym-log-retention` service account keeps Candidate B's exact custom-role matrix: Firebase Auth `firebaseauth.users.get`, `firebaseauth.users.update`, `firebaseauth.users.delete`; Firestore `datastore.entities.get`, `datastore.entities.list`, `datastore.entities.create`, `datastore.entities.update`, `datastore.entities.delete`. No Owner, Editor, Firebase Admin, wildcard project admin or new IAM permission is authorized.

The existing encrypted `SERVICE_ACCOUNT_JSON` binding remains in a non-serving Cloudflare Worker version. The currently active resource has no Worker URL, preview URL, route or Cron. Candidate C requires fresh effective-permission and Secret-binding read-back before a final release. The Worker source changes its accepted roster from two retired cohorts to one protected alias and reduces Cron to a single UTC `:15` trigger. It does not require Workers Paid, Firebase Blaze, a paid email service, or new secrets.

Only after explicit Final Release authorization may the exact Candidate C Worker version replace the staged Candidate B version and activate the Cron. A Wrangler dry run is packaging evidence only; it never authorizes traffic.
