# Candidate B retention IAM and cost matrix

Status: proposed custom role; **not provisioned** during Candidate build. The final grant must be tested with the actual APIs and re-read before Production Worker activation. The existing Candidate A Auth-only Worker retains its separate identity.

| Operation | API path / purpose | Proposed custom permission |
| --- | --- | --- |
| Read target Auth and Google provider | Identity Toolkit `accounts:lookup` | `firebaseauth.users.get` |
| Disable/recover target Auth | Identity Toolkit `accounts:update` | `firebaseauth.users.update` |
| Final Auth removal | Identity Toolkit `accounts:delete` | `firebaseauth.users.delete` |
| Read policy, Owner config, receipt, root, UserIndex, request | Firestore `get` | `datastore.entities.get` |
| List policy roster, nested collections/documents | Firestore `list`, `listCollectionIds` | `datastore.entities.list` plus `datastore.entities.get` for document data |
| Create minimal receipt | Firestore `patch` with `exists=false` | `datastore.entities.create` |
| CAS lock, migration cancellation, final state | Firestore `commit` update with `updateTime` | `datastore.entities.update` |
| Delete private descendants, root, UserIndex, AccessRequest | Firestore `delete` | `datastore.entities.delete` |

No Owner, Editor, Firebase Admin, project wildcard admin, or service-agent role is requested. The role is project-scoped because IAM does not use Firestore Security Rules for server OAuth calls; the Worker code and protected roster strictly bound target paths. OAuth scopes are `identitytoolkit` and `datastore` only. Custom-role API permission behavior must be verified in a non-Production target or a fresh read-only permission preflight before grant; a missing permission is a stop, not a reason to grant broad admin.

The service-account JSON is stored only in `my-gym-log-retention` Cloudflare Worker Secrets as `SERVICE_ACCOUNT_JSON`. No key value belongs in source, fixtures, docs, logs, chat, or frontend. The Worker logs only a fixed failure code.

Firebase stays Spark and Cloudflare stays Workers Free. Firebase Auth's built-in reset email has a current [Spark quota of 150/day](https://firebase.google.com/docs/auth/limits/); the two one-time target notices fit only if current quota is freshly checked. Workers Free currently lists [50 subrequests per invocation and 100,000 requests/day](https://developers.cloudflare.com/workers/platform/limits/). The implementation caps Google API subrequests and resumes partial cleanup on later Cron. Free exhaustion yields failure without paid fallback. [Cloud Firestore IAM mapping](https://cloud.google.com/firestore/docs/security/iam), [Firebase Auth permission reference](https://cloud.google.com/iam/docs/roles-permissions/firebaseauth).
