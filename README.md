# ai-test-agent

A browser-based workspace for testing LLM prompts, comparing models, generating images,
and extracting structured data. Built with React, TypeScript, Radix Themes, and PouchDB.
There is no application backend or account system. Saved records live in the current
browser profile, with optional sync to your own CouchDB-compatible server.

## Features

- **Chat:** edit messages and tools as JSON or a form; compare batches across models,
  temperature, reasoning effort, and token limits; keep timestamped run history.
- **Decisions:** run structured state and questions through a provider's decisions API.
- **Images:** generate images with optional image references and compare model results.
- **Extraction:** extract JSON matching a schema from text and images.
- **Response tests:** run trusted JavaScript checks in a Web Worker with per-job timeouts.
- **Provider profiles:** configure your own server URLs and API keys in Settings.

Chat supports OpenRouter and compatible chat-completion servers. Decisions, image
generation, structured outputs, and model discovery require the corresponding APIs
supported by the configured provider; not every OpenAI-compatible server supports them.

## Getting started

Use **Node.js 24.15 or newer in the 24.x line** (or Node.js 26+) and **Yarn Classic 1.22.22**.
With nvm, `nvm install` uses the checked-in `.nvmrc`.

```bash
npm install --global yarn@1.22.22
yarn install --frozen-lockfile
yarn dev
```

Open `http://localhost:5174/ai-test/`. The development server listens locally by default;
use `yarn dev --host 0.0.0.0` only when you intend to expose it to your network.

On first launch, an empty database gets an active OpenRouter profile **without an API key**
and a sample `prison` prompt containing fictitious names and PINs. Open **Settings** and
enter your key, or add and activate another provider. Requests remain disabled until a
key is configured. Existing profiles and records are preserved.

No `.env` file is required. `@untitled/ui-kit` is bundled in [packages/ui-kit](packages/ui-kit)
as a Yarn workspace, so installation does not require access to a private repository.

## Development

```bash
yarn typecheck    # check the application, bundled UI kit, and Vite configuration
yarn lint
yarn test         # all tests, including the bundled UI kit
yarn test:watch
yarn build        # type-check and generate dist/
yarn preview      # local preview of dist/
```

GitHub Actions runs installation, a dependency audit, lint, tests, and the production build on
pushes, pull requests, and a weekly schedule. Dependabot checks package and workflow updates.
The lockfile includes patched dependency versions. A scoped Yarn resolution
uses UUID 11.1.1 for PouchDB, replacing its vulnerable UUID 8 dependency; PouchDB uses the
compatible `v4()` API. A minimatch 11.0.1 override fixes the glob-pattern denial of service
reported in GHSA-g3hv-75wg-m249 in lint tooling. Yarn's version-range warnings for these
overrides are expected; recheck compatibility when updating their consumers.

## Hosting

The default base path is `/ai-test/`, for `https://devhub.lt/ai-test/`.
Upload the contents of `dist/` into the host's `/ai-test/` directory. Redirect `/ai-test`
to `/ai-test/`. Configure SPA fallback so routes such as `/ai-test/agent/records`,
`/ai-test/settings`, and `/ai-test/extract` serve `/ai-test/index.html` on direct navigation.
Serve `/ai-test/assets/` as static files; missing assets should return 404, not the SPA HTML.
The app has no server-side authentication; each visitor supplies their own provider key.
Provider servers must permit browser requests from the app's origin through CORS.
Use a dedicated HTTPS origin: other apps on the same host can access this app's browser
database even when served under different paths. See SECURITY.md for host response headers.
Keep the generated `LICENSE` and `THIRD_PARTY_LICENSES.md` with the deployed assets.

Build for devhub.lt with the defaults:

```bash
yarn build
yarn preview
```

To host at another path (or `/`), override the base for both build and preview:

```bash
APP_BASE_PATH=/llm-test/ yarn build
APP_BASE_PATH=/llm-test/ yarn preview
```

The same base path configures asset URLs and routing. For another subdirectory, use its
absolute path with a trailing slash and configure the host's fallback beneath that path.
`APP_BASE_PATH` is a build setting, not a secret. Use static hosting for production;
`yarn dev` and `yarn preview` are development tools.

The optional rsync helper requires an explicit destination:

```bash
DEPLOY_TARGET=user@host:/var/www/ai-test/ yarn build:deploy
```

It mirrors `dist/` and removes stale files from the destination; use a dedicated deployment
directory. No SSH destination or credentials are bundled in the app.

## Data and trust

- Prompts, images, results, provider profiles, and API keys are stored in the browser's
  IndexedDB. Keys are **not encrypted**. Masking a key in Settings only hides its display.
- Model and pricing discovery can contact the active provider automatically after a key
  is configured. Submitting requests sends the supplied prompts and images to that provider
  and may incur charges. Provider retention policies apply.
- Sync is off by default. It replicates records, model history, and test-suite code,
  but **provider profiles, API keys, and connection settings stay on this device**. Configure
  providers and sync separately on each device. Previously synced credentials are not removed
  from remote revisions or backups; rotate affected keys and database passwords if needed.
  Use a private, authenticated HTTPS server and trust everyone who can write to it.
- Run only test-suite code you trust, including code loaded through sync. A Web Worker
  keeps work off the UI thread, but **is not a security sandbox**: it can access IndexedDB
  and the network. It can therefore read stored keys. See
  [MDN's worker documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).
- Clearing browser site data deletes local records. Different browser profiles or origins
  have separate stores. There is no automatic backup unless you configure sync.

See [SECURITY.md](SECURITY.md) for security reporting and deployment boundaries, and the
[release review](docs/security-review.md) for findings and verification.

## License

[PolyForm Noncommercial License 1.0.0](LICENSE). The existing noncommercial license
applies to this repository, including its bundled UI kit.
This is a **source-available, noncommercial** project. Bundled third-party dependencies retain
their own licenses; production builds include their notices in `THIRD_PARTY_LICENSES.md`.

### Demo examples and limits

Each landing-page card lists local examples. Loading creates a fresh editable saved
copy, works without credentials, preserves the selected provider and existing drafts,
and never generates a response. Eight bundled examples cover chat, function calls,
the fictional prison prompt, Decisions, text/reference image generation, and receipt/
contact extraction. Startup adds missing example seeds on existing installations;
edited or deliberately deleted examples are preserved. Select a compatible model and
explicitly Submit/Start to run a loaded example.

The planned/deployed proxy must be verified separately; the frontend continues to
label demo access experimental. The implemented backend policy uses a shared $0.20
weekly allowance per IP, a $0.02 maximum request cost, and text rate ceilings of $0.50
input/$2.00 output per million tokens. Model discovery is refreshed after five minutes
and Decisions uses its own catalog. Demo image controls offer only supported 1K
settings/aspect ratios allowed by the proxy. Unknown prices are displayed as unknown.
Personal-key requests continue to go directly to OpenRouter.

Demo prompts, images, outputs and plain IP addresses are stored by the demo server
without automatic expiration. Local example inspection does not send these inputs
to that server. The server requires explicit model approval, verified cost bounds
where necessary and a configured global daily budget before generation is enabled.
