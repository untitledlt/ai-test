# @untitled/ui-kit

Bundled source for the shared Radix Themes components used by ai-test-agent.
This Yarn workspace replaces the private GitHub dependency; no GitHub credentials
or separate package build are required. Existing `@untitled/ui-kit` imports stay the same.

The source was copied from `untitledlt/ui-kit` tag `v0.1.0`, commit
`db4d4bfa24489a7fe528395c0bde26632b6eec71`. It is maintained here as part of this
project under the repository's [license](../../LICENSE).

Exports: `AppTheme`, `UI_THEME`, `DockPanel`, `JsonEditor`, `LoadingOverlay`,
and `useResizableHeight`. Import Radix's stylesheet before `@untitled/ui-kit/styles.css`.

Vite compiles the TypeScript and CSS Modules directly. From the repository root,
`yarn typecheck`, `yarn lint`, and `yarn test` include this package. Change
`src/theme-tokens.ts` to adjust the brand tokens and `src/tokens.css` for semantic CSS aliases.
