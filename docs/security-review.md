# Public-source release review — 2026-11-11

Reviewed the current working tree, including pre-existing uncommitted changes, against
the local Git baseline `1ecf568`. The review covered provider/key flows, all SDK operations,
local persistence and replication, JSON/form parsing, response/image rendering, trusted
worker execution, batch limits/pacing, dependencies, build output, CI and release docs.
Existing architecture and the PolyForm Noncommercial license were preserved. No changes
were committed, deployed, or published as part of this review.

## Findings fixed

| Finding | Impact and fix | Evidence |
| --- | --- | --- |
| Connection settings replicated to CouchDB | `app-settings` includes `syncRemoteURL`, which can contain a database username/password. Uploading it exposed credentials to database readers/backups; pulling it could replace local connection settings. Both directions now exclude settings by ID/type and documents with top-level connection/credential fields, including settings deletion tombstones. | Real two-way PouchDB replication regression reproduced the leak before the fix; verifies separate local/remote settings, no conflict revisions, and no remote settings deletion. Existing record/model sync and provider isolation tests remain. |
| Malformed chat JSON accepted as a typed payload | `messages: [null]` and malformed tool-call structures passed parsing and could crash Form mode or submission. Message fields and optional tool arrays now receive shape validation before use. | Regressions cover null/primitive messages, missing roles, unsupported content objects, malformed tool calls and non-array tools; valid assistant/tool messages and provider-specific tools survive. |
| Advanced tool schemas silently lost constraints in Form mode | The structured editor reconstructs a limited schema. Editing a tool containing `enum`, `strict`, `additionalProperties` or other unsupported fields could discard them. These schemas now remain available in the JSON editor with a visible Form-mode explanation, rather than entering the limited editor. | Guard regressions and a component test verify advanced schemas remain intact when messages are edited. |
| User-defined `__proto__` keys changed dictionary prototypes | Question names, choice keys and tool property names were assigned into `{}`. Such keys altered those dictionaries' prototypes or vanished from JSON. These dictionaries now have null prototypes. This was local prototype mutation/data loss; no global `Object.prototype` pollution or code-execution path was established. | Question/choice serialization and tool-editor regressions preserve the key as ordinary data. |
| Vulnerable minimatch in lint dependencies | Registry audit reported GHSA-g3hv-75wg-m249 through five dependency paths, all sharing version 10.2.6. Added a resolution for patched 11.0.1. This affects development tooling, not the shipped browser bundle. | Follow-up registry audit reports zero advisories. Lint/build/tests check compatibility of the major-version override. Revisit it when ESLint/typescript-eslint update their requirements. |
| Distribution omitted dependency notices | Static output previously lacked the collected dependency license texts. Vite now generates `THIRD_PARTY_LICENSES.md` and the build also copies the project's `LICENSE`. | Production artifact inspection confirms both files alongside browser/worker assets. Keep them when hosting or redistributing builds. |
| Release maintenance gaps | Added audit enforcement and a weekly CI schedule, plus Dependabot updates for npm and GitHub Actions. Deployment now requires an explicit `DEPLOY_TARGET` instead of containing a personal SSH destination. | Local release checks pass; hosted GitHub settings and CI execution were not changed or verified. |
| Test teardown race | Mounted provider queries could write to PouchDB during database cleanup and outlive jsdom's `localStorage`, producing an unhandled error after passing assertions. Shared teardown now unmounts components before deleting documents and closes the database after the file finishes. | The final full suite and an independent clean-install run both complete without unhandled errors. |

The minimatch finding and patched version were checked against the
[maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).
License generation uses Vite's built-in
[build.license option](https://vite.dev/config/build-options#build-license).

## Verification

- Full Vitest suite: **480 tests in 57 files**, including 46 added regression/transport
  cases. ESLint and production TypeScript/Vite build pass.
- Independent clean release snapshot: `yarn install --frozen-lockfile --non-interactive`,
  lint, all 480 tests and production build pass without using the workspace's existing
  `node_modules`. The bundled UI kit requires no private repository access.
- Real SDK with a fake fetch transport: all nine adapter operations send authorization
  only to the configured OpenRouter, demo or custom origin; no billable requests were made.
- `yarn audit --json`: zero reported vulnerabilities after the minimatch change.
- Checksum-verified official Gitleaks v8.30.1: no findings in the 37 commits reachable
  through local refs or in the current tracked/unignored release files. Additional
  redacted pattern checks covered 357 historical file blobs. Scans do not prove absence
  of secrets and do not cover other clones, unreachable objects or deleted remote refs.
- Production artifact inspection: application and worker build successfully, license
  notices are emitted, and no source maps are emitted with the current configuration.

## Important remaining boundaries

1. **Stored keys and worker suites.** Keys are unencrypted in IndexedDB. Trusted suites
   run as same-origin JavaScript with database/network access. Anyone who can persuade a
   user to run a malicious copied/synced suite can steal that user's keys. The existing
   warnings remain essential; the worker timeout is availability protection, not a sandbox.
   Use restricted, low-budget keys. Isolating hostile code or adding a password-protected
   credential store would require an architectural change and separate review.
2. **Previously synced credentials.** The new filter does not purge earlier remote
   revisions or backups. If an older version synced a URL containing a password, rotate
   that database password. Also revoke provider keys if a version that synced profiles
   was used. Configure connection settings separately on each device from now on.
3. **Deployment isolation.** Use a dedicated HTTPS origin and the headers in SECURITY.md.
   `/ai-test/` alone is not a boundary from other apps on the same origin. Only deploy
   `dist/`; never expose repository files, `.git`, development servers or shared API keys.
4. **Demo backend.** Its code, hosting, credentials, quotas, data retention and deployed
   CORS/security headers were outside this repository review. Frontend limits and dummy
   demo keys are bypassable. Independently test server-side allowlists, atomic quotas and
   global budget enforcement before operating a public paid demo. Current UI copy discloses
   indefinite retention of demo prompts/images/outputs/IPs; choose the intended policy
   before promoting the service and keep that disclosure accurate.
5. **Paid requests and cancellation.** There is no batch Stop control. Navigating away
   does not cancel queued batch requests. SDK retries can produce more attempts than
   visible jobs. Client controls are not spending enforcement; set provider-side budgets.
6. **Public repository setup.** Enable private vulnerability reporting, secret scanning/
   push protection and dependency alerts where available. Protect the main branch and
   require CI for contributions. These account/repository settings were not changed.
7. **License terminology.** The maintainer chose to retain PolyForm Noncommercial. Call
   this source-available, rather than OSI open source: the
   [Open Source Definition](https://opensource.org/osd) requires permitting business use.

The production build still reports a large JavaScript chunk (about 2.29 MB before gzip).
Route/SDK code splitting is a performance improvement, not a release security blocker.
No live provider compatibility tests, production penetration test, or external backend
audit was performed. Passing tests and scanners do not certify the absence of vulnerabilities.
