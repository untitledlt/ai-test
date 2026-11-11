# Source map

Date: 2026-10-30

First-party implementation inventory for the current working tree. Paired tests are linked beside their modules; standalone test suites appear separately. Styles are listed after the code. See the [codebase guide](codebase-guide.md) for cross-module behavior.

## packages/ui-kit/src

| File | Responsibility | Tests |
| --- | --- | --- |
| [dock-panel.tsx](../packages/ui-kit/src/dock-panel.tsx) | Bottom-fixed panel chrome and resize handle. | — |
| [entry.ts](../packages/ui-kit/src/entry.ts) | UI-kit alternative bundle entry including semantic token styles. | — |
| [index.ts](../packages/ui-kit/src/index.ts) | Public UI-kit exports. | — |
| [json-editor.tsx](../packages/ui-kit/src/json-editor.tsx) | JSON CodeMirror wrapper with wrapping, fold gutter, and read-only support. | — |
| [loading-overlay.tsx](../packages/ui-kit/src/loading-overlay.tsx) | Shared fullscreen spinner overlay. | — |
| [theme-tokens.ts](../packages/ui-kit/src/theme-tokens.ts) | Shared indigo/slate theme settings. | — |
| [theme.tsx](../packages/ui-kit/src/theme.tsx) | Radix theme and Sonner toast host. | — |
| [use-resizable-height.ts](../packages/ui-kit/src/use-resizable-height.ts) | Pointer-driven height adjustment with direction and size bounds. | [use-resizable-height.test.tsx](../packages/ui-kit/src/use-resizable-height.test.tsx) |

## src

| File | Responsibility | Tests |
| --- | --- | --- |
| [app.tsx](../src/app.tsx) | Theme, query cache, routing providers, startup seeding and sync. | — |
| [main.tsx](../src/main.tsx) | Browser entry point, stylesheet order, and StrictMode mounting. | — |
| [router.tsx](../src/router.tsx) | Current route table and base-path handling. | — |
| [types.ts](../src/types.ts) | Shared wire, result, task, history, and usage types. | — |

## src/components

| File | Responsibility | Tests |
| --- | --- | --- |
| [batch-run-controls.tsx](../src/components/batch-run-controls.tsx) | Editable call-count draft, clamping, optional add-task action, and Start. | [batch-run-controls.test.tsx](../src/components/batch-run-controls.test.tsx) |
| [bottom-panel.tsx](../src/components/bottom-panel.tsx) | Resizable chat suite editor and read-only raw batch response dock. | — |
| [confirm-dialog.tsx](../src/components/confirm-dialog.tsx) | Shared Radix alert-dialog wrapper. | — |
| [decision-tasks-table.tsx](../src/components/decision-tasks-table.tsx) | Decision task controls, aggregate statistics, and answer cells. | [decision-tasks-table.test.tsx](../src/components/decision-tasks-table.test.tsx) |
| [extract-tasks-table.tsx](../src/components/extract-tasks-table.tsx) | Vision task controls, price hints, statistics, and extracted JSON cells. | [extract-tasks-table.test.tsx](../src/components/extract-tasks-table.test.tsx) |
| [form-editor.tsx](../src/components/form-editor.tsx) | Chat message/function-tool editing and web-search toggle. | [form-editor.test.tsx](../src/components/form-editor.test.tsx) |
| [image-gen-tasks-table.tsx](../src/components/image-gen-tasks-table.tsx) | Image task controls, capability options, price hints, and image result cells. | [image-gen-tasks-table.test.tsx](../src/components/image-gen-tasks-table.test.tsx) |
| [image-picker.tsx](../src/components/image-picker.tsx) | Image upload/paste, reordering, removal, and thumbnails. | [image-picker.test.tsx](../src/components/image-picker.test.tsx) |
| [message-block.tsx](../src/components/message-block.tsx) | Message role/content editing and originating tool-call display. | [message-block.test.tsx](../src/components/message-block.test.tsx) |
| [model-autocomplete.tsx](../src/components/model-autocomplete.tsx) | Free-text model selection with provider suggestions or local history. | [model-autocomplete.test.tsx](../src/components/model-autocomplete.test.tsx) |
| [multiple-tasks-table.tsx](../src/components/multiple-tasks-table.tsx) | Chat task controls, comparisons, responses, reasoning, and check results. | — |
| [multiple-toolbar.tsx](../src/components/multiple-toolbar.tsx) | Shared batch controls composed with chat history selection. | — |
| [page-layout.tsx](../src/components/page-layout.tsx) | Centered heading/back-navigation shell for lists and settings. | — |
| [provider-settings-dialog.tsx](../src/components/provider-settings-dialog.tsx) | Provider label, URL, and key editor. | — |
| [provider-warning.tsx](../src/components/provider-warning.tsx) | Shared missing-provider guidance. | — |
| [question-card.tsx](../src/components/question-card.tsx) | Collapsible noul/choice/score question editor. | [question-card.test.tsx](../src/components/question-card.test.tsx) |
| [records-list.tsx](../src/components/records-list.tsx) | Shared filterable record table and delete confirmation. | [records-list.test.tsx](../src/components/records-list.test.tsx) |
| [result-panel.tsx](../src/components/result-panel.tsx) | Single chat response, usage statistics, raw view, and append action. | [result-panel.test.tsx](../src/components/result-panel.test.tsx) |
| [save-as-dialog.tsx](../src/components/save-as-dialog.tsx) | Named-record creation dialog. | [save-as-dialog.test.tsx](../src/components/save-as-dialog.test.tsx) |
| [state-list.tsx](../src/components/state-list.tsx) | Ordered decision text/image context editor. | [state-list.test.tsx](../src/components/state-list.test.tsx) |
| [submit-loading-overlay.tsx](../src/components/submit-loading-overlay.tsx) | Fullscreen single-call pending display with elapsed timer. | [submit-loading-overlay.test.tsx](../src/components/submit-loading-overlay.test.tsx) |
| [tool-card.tsx](../src/components/tool-card.tsx) | Collapsible function definition and property editor. | [tool-card.test.tsx](../src/components/tool-card.test.tsx) |
| [toolbar.tsx](../src/components/toolbar.tsx) | Record actions, navigation between tools/settings, and mobile menu. | [toolbar.test.tsx](../src/components/toolbar.test.tsx) |
| [zoomable-image.tsx](../src/components/zoomable-image.tsx) | Accessible thumbnail trigger and full-size image dialog. | [zoomable-image.test.tsx](../src/components/zoomable-image.test.tsx) |

## src/db

| File | Responsibility | Tests |
| --- | --- | --- |
| [sync-filter.ts](../src/db/sync-filter.ts) | Excludes provider profiles, credentials, and provider tombstones from both replication directions. | [sync-filter.test.ts](../src/db/sync-filter.test.ts) |
| [client.ts](../src/db/client.ts) | PouchDB instance and typed prefix/get/put/remove helpers. | — |
| [types.ts](../src/db/types.ts) | Persisted PouchDB document types. | — |

## src/hooks

| File | Responsibility | Tests |
| --- | --- | --- |
| [use-chat-models.ts](../src/hooks/use-chat-models.ts) | Provider-scoped text-model discovery cache. | — |
| [use-completion.ts](../src/hooks/use-completion.ts) | Single chat mutation using the active provider. | — |
| [use-decision-records.ts](../src/hooks/use-decision-records.ts) | Decisions configuration CRUD. | [use-decision-records.test.tsx](../src/hooks/use-decision-records.test.tsx) |
| [use-extract-records.ts](../src/hooks/use-extract-records.ts) | Extraction configuration CRUD. | [use-extract-records.test.tsx](../src/hooks/use-extract-records.test.tsx) |
| [use-image-gen-records.ts](../src/hooks/use-image-gen-records.ts) | Image-generation configuration CRUD. | [use-image-gen-records.test.tsx](../src/hooks/use-image-gen-records.test.tsx) |
| [use-image-models.ts](../src/hooks/use-image-models.ts) | Image model capabilities and endpoint pricing caches. | [use-image-models.test.tsx](../src/hooks/use-image-models.test.tsx) |
| [use-models.ts](../src/hooks/use-models.ts) | Local custom-model history CRUD. | [use-models.test.tsx](../src/hooks/use-models.test.tsx) |
| [use-providers.ts](../src/hooks/use-providers.ts) | Provider CRUD, selected provider, and singleton settings initialization. | [use-providers.test.tsx](../src/hooks/use-providers.test.tsx) |
| [use-records.ts](../src/hooks/use-records.ts) | Chat record CRUD and React Query invalidation. | [use-records.test.tsx](../src/hooks/use-records.test.tsx) |
| [use-sync-settings.ts](../src/hooks/use-sync-settings.ts) | Filtered live replication lifecycle and settings mutations; excludes provider credentials. | [use-sync-settings.test.ts](../src/hooks/use-sync-settings.test.ts) |
| [use-unsaved-changes.ts](../src/hooks/use-unsaved-changes.ts) | Shared route blocking and guarded in-page actions. | [use-unsaved-changes.test.tsx](../src/hooks/use-unsaved-changes.test.tsx) |
| [use-vision-models.ts](../src/hooks/use-vision-models.ts) | Provider-scoped image-input model discovery cache. | [use-vision-models.test.tsx](../src/hooks/use-vision-models.test.tsx) |

## src/lib

| File | Responsibility | Tests |
| --- | --- | --- |
| [batch-runner.ts](../src/lib/batch-runner.ts) | Concurrency-limited promise jobs with incremental settlement callback. | [batch-runner.test.ts](../src/lib/batch-runner.test.ts) |
| [decision-utils.ts](../src/lib/decision-utils.ts) | Decision task/draft types, typed-question serialization/parsing, defaults, and answer formatting. | [decision-utils.test.ts](../src/lib/decision-utils.test.ts) |
| [extract-utils.ts](../src/lib/extract-utils.ts) | Extraction task factory and default receipt JSON schema. | [extract-utils.test.ts](../src/lib/extract-utils.test.ts) |
| [format.ts](../src/lib/format.ts) | Tokens, cost, duration, timestamps, model price labels, and key display masking. | [format.test.ts](../src/lib/format.test.ts) |
| [image-gen-utils.ts](../src/lib/image-gen-utils.ts) | Image generation task and input-image types/factories. | [image-gen-utils.test.ts](../src/lib/image-gen-utils.test.ts) |
| [image-utils.ts](../src/lib/image-utils.ts) | Image sizing and browser JPEG resampling. | [image-utils.test.ts](../src/lib/image-utils.test.ts) |
| [models.ts](../src/lib/models.ts) | Empty default chat model constant. | — |
| [multiple-call-utils.ts](../src/lib/multiple-call-utils.ts) | Chat task defaults, default suite, and legacy result migration. | — |
| [openrouter-client.ts](../src/lib/openrouter-client.ts) | SDK request translation, provider operations, model catalogs, pricing, response normalization, and errors. | [openrouter-client.test.ts](../src/lib/openrouter-client.test.ts) |
| [payload-utils.ts](../src/lib/payload-utils.ts) | Chat payload parsing, function/web-search tool guards, append-message construction, and call formatting. | [payload-utils.test.ts](../src/lib/payload-utils.test.ts) |
| [reasoning-effort.ts](../src/lib/reasoning-effort.ts) | Shared reasoning-effort options. | — |
| [seed-data.ts](../src/lib/seed-data.ts) | First-run empty-key OpenRouter profile and fictitious prison sample. | [seed-data.test.ts](../src/lib/seed-data.test.ts) |
| [test-runner.ts](../src/lib/test-runner.ts) | Worker ownership, sequential response checks, request IDs, timeouts, cancellation. | [test-runner.test.ts](../src/lib/test-runner.test.ts) |
| [test-worker.ts](../src/lib/test-worker.ts) | Trusted dynamic JavaScript suite execution and small expect API. | [test-worker.test.ts](../src/lib/test-worker.test.ts) |
| [uuid.ts](../src/lib/uuid.ts) | Secure random UUID helper with getRandomValues fallback. | [uuid.test.ts](../src/lib/uuid.test.ts) |

## src/pages

| File | Responsibility | Tests |
| --- | --- | --- |
| [decision-page.tsx](../src/pages/decision-page.tsx) | Decisions form/JSON workspace, drafts, saves, and model batches. | [decision-page.test.tsx](../src/pages/decision-page.test.tsx) |
| [decision-records-page.tsx](../src/pages/decision-records-page.tsx) | Decisions hooks and route configuration for the shared saved-record list. | [decision-records-page.test.tsx](../src/pages/decision-records-page.test.tsx) |
| [extract-page.tsx](../src/pages/extract-page.tsx) | Image/schema extraction workspace, drafts, saves, and batches. | [extract-page.test.tsx](../src/pages/extract-page.test.tsx) |
| [extract-records-page.tsx](../src/pages/extract-records-page.tsx) | Extraction hooks and route configuration for the shared saved-record list. | — |
| [image-page.tsx](../src/pages/image-page.tsx) | Image-generation workspace, drafts, saves, and capability-aware batches. | [image-page.test.tsx](../src/pages/image-page.test.tsx) |
| [image-records-page.tsx](../src/pages/image-records-page.tsx) | Image hooks and route configuration for the shared saved-record list. | — |
| [legacy-multiple-redirect.tsx](../src/pages/legacy-multiple-redirect.tsx) | Compatibility redirect to the chat multiple-call tab. | — |
| [record-page.tsx](../src/pages/record-page.tsx) | Chat single/batch workspace, persistence, result history, and response tests. | — |
| [records-page.tsx](../src/pages/records-page.tsx) | Chat hooks and route configuration for the shared saved-record list. | [records-page.test.tsx](../src/pages/records-page.test.tsx) |
| [settings-page.tsx](../src/pages/settings-page.tsx) | Provider profiles, active selection, deletion, and optional sync settings. | [settings-page.test.tsx](../src/pages/settings-page.test.tsx) |

## src/test

| File | Responsibility | Tests |
| --- | --- | --- |
| [render.tsx](../src/test/render.tsx) | Testing Library helper with a data router, theme, and isolated query client. | — |
| [setup.ts](../src/test/setup.ts) | fake-indexeddb, database cleanup, jest-dom matchers, and browser API shims. | — |

## Additional test suites

| File | Focus |
| --- | --- |
| [use-provider-models.test.tsx](../src/hooks/use-provider-models.test.tsx) | Provider discovery readiness and cache refresh after credential/URL edits. |

## Styles

| File | Scope |
| --- | --- |
| [packages/ui-kit/src/dock-panel.module.css](../packages/ui-kit/src/dock-panel.module.css) | dock panel layout and presentation. |
| [packages/ui-kit/src/loading-overlay.module.css](../packages/ui-kit/src/loading-overlay.module.css) | loading overlay layout and presentation. |
| [packages/ui-kit/src/tokens.css](../packages/ui-kit/src/tokens.css) | Semantic aliases for Radix theme variables. |
| [src/components/bottom-panel.module.css](../src/components/bottom-panel.module.css) | bottom panel layout and presentation. |
| [src/components/image-gen-tasks-table.module.css](../src/components/image-gen-tasks-table.module.css) | image gen tasks table layout and presentation. |
| [src/components/message-block.module.css](../src/components/message-block.module.css) | message block layout and presentation. |
| [src/components/model-autocomplete.module.css](../src/components/model-autocomplete.module.css) | model autocomplete layout and presentation. |
| [src/components/multiple-tasks-table.module.css](../src/components/multiple-tasks-table.module.css) | multiple tasks table layout and presentation. |
| [src/components/question-card.module.css](../src/components/question-card.module.css) | question card layout and presentation. |
| [src/components/state-list.module.css](../src/components/state-list.module.css) | state list layout and presentation. |
| [src/components/submit-loading-overlay.module.css](../src/components/submit-loading-overlay.module.css) | submit loading overlay layout and presentation. |
| [src/components/tool-card.module.css](../src/components/tool-card.module.css) | tool card layout and presentation. |
| [src/components/toolbar.module.css](../src/components/toolbar.module.css) | toolbar layout and presentation. |
| [src/components/zoomable-image.module.css](../src/components/zoomable-image.module.css) | zoomable image layout and presentation. |
| [src/pages/decision-page.module.css](../src/pages/decision-page.module.css) | decision page layout and presentation. |
| [src/pages/record-page.module.css](../src/pages/record-page.module.css) | record page layout and presentation. |
| [src/styles/global.css](../src/styles/global.css) | Global sizing, background, and scrollbars. |

## Build and repository files

| File | Responsibility |
| --- | --- |
| [package.json](../package.json) | Scripts, dependency declarations, runtime requirements, overrides, and Yarn workspaces. |
| [yarn.lock](../yarn.lock) | Resolved dependency graph for reproducible installs. |
| [vite.config.ts](../vite.config.ts) | React build, base path, port 5174, ES workers, and Vitest configuration. |
| [tsconfig.json](../tsconfig.json) | Root TypeScript project references. |
| [tsconfig.app.json](../tsconfig.app.json) | Strict browser/worker/application/UI-kit type checking. |
| [tsconfig.node.json](../tsconfig.node.json) | Vite configuration type checking. |
| [eslint.config.js](../eslint.config.js) | TypeScript, React Hooks, and React Refresh lint rules. |
| [index.html](../index.html) | SPA root and browser entry script. |
| [.nvmrc](../.nvmrc) | Node 24 runtime selection. |
| [.gitignore](../.gitignore) | Generated output, dependencies, secrets, and local tooling exclusions. |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | Install, lint, tests, and build on push/pull request. |
| [packages/ui-kit/package.json](../packages/ui-kit/package.json) | Bundled source package exports and peer dependencies. |
| [packages/ui-kit/README.md](../packages/ui-kit/README.md) | UI-kit provenance and local maintenance instructions. |
| [README.md](../README.md) | Setup, features, hosting, and data/trust overview. |
| [SECURITY.md](../SECURITY.md) | Security boundaries and reporting guidance. |
| [LICENSE](../LICENSE) | Repository license terms. |
| [AGENTS.md](../AGENTS.md) | Repository architecture and contributor instructions; some older sections predate current routes. |
| [CLAUDE.md](../CLAUDE.md) | Companion repository guidance. |

## Historical design documents

- [Original TypeSafe design](superpowers/specs/2026-10-22-typesafe-page-design.md)
- [Original TypeSafe implementation plan](superpowers/plans/2026-10-22-typesafe-page.md)

These describe an earlier iteration. Current decisions behavior is documented in the guide and `src/pages/decision-page.tsx`.
