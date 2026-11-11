# Security

This is a client-side tool for trusted users and trusted test-suite code. It is not
a credential vault, a sandbox for hostile JavaScript, or a shared authenticated service.

Provider keys are stored unencrypted in IndexedDB. Custom test suites execute in a
same-origin Web Worker and can access that database and the network. Remote sync excludes
provider profiles, API keys, and connection settings in both directions, but still includes
executable test-suite source. Connection settings can contain database credentials in the
sync URL. Previously synced credentials remain in remote revisions/backups; rotate affected
provider keys and database passwords if older versions synced them.
Review synced or copied code before running it.

Host the app over HTTPS on a dedicated origin, with no unrelated scripts or applications
sharing that origin. Each visitor should supply their own key. Never embed a shared
provider key in source files, build-time environment variables, or static assets.

An origin is a scheme, host and port: another app on the same host under a different
path can access the same IndexedDB. Use a separate host for this app. Serve only `dist/`,
including its generated license notices; never serve the repository or `.git` directory.
At the host, set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and
an HTTP Content-Security-Policy with `frame-ancestors 'none'`, `base-uri 'self'`, and
`object-src 'none'`. A stricter script/connect policy must account for custom providers,
optional CouchDB sync, and trusted worker suites using `new Function()`.

The optional demo proxy is separate infrastructure and is not included in this repository.
Browser limits and dummy demo keys do not protect its owner key or spending balance.
The server must independently enforce allowed operations/models, authenticated upstream
destinations, quotas, payload/output limits, concurrency limits and a global spending cap.
See [demo backend requirements](docs/demo-backend-requirements.md). Requests already sent
may be billed even after a disconnect; this app has no batch Stop control, and navigating
away does not cancel queued batch calls. Configure provider-side spending limits.

For a security issue, use GitHub's private **Report a vulnerability** option if it is
enabled. Otherwise, open an issue asking the maintainer for a private reporting channel
without publishing exploit details, credentials, or personal data. Reports should include
the affected commit, reproduction steps, and impact using dummy credentials.

Before a release, run `yarn lint`, `yarn test`, `yarn build`, and `yarn audit`. Review
dependency overrides when upgrading PouchDB. Do not publish browser database exports,
real provider keys, or screenshots containing credentials.

The [2026-11-11 release review](docs/security-review.md) records fixes, verification,
and remaining trust boundaries. A passing audit or secret scan cannot prove absence of issues.
