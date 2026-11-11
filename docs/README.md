# Project documentation

Reviewed against the working tree on 2026-10-30, with security/release updates on 2026-11-11, including local uncommitted changes.

- [Public-source security review](security-review.md): fixes, verification, and remaining trust boundaries from the 2026-11-11 review.
- [Codebase guide](codebase-guide.md): current tools, architecture, routes, persistence, API integration, testing, and deployment.
- [Demo backend requirements](demo-backend-requirements.md): exact proxy routes, existing `/agent/submit` compatibility, limits, and required frontend routing fixes.
- [Source map](source-map.md): first-party source files and their responsibilities, with links to implementation and tests.
- [Landing page and demo draft](__DRAFT__landing-page-and-demo.md): requested product direction, proposed copy, onboarding, privacy requirements, and demo service requirements. This describes future work, not shipped behavior.

The older [TypeSafe design](superpowers/specs/2026-10-22-typesafe-page-design.md) and [implementation plan](superpowers/plans/2026-10-22-typesafe-page.md) are historical. The current feature is `/decision`, supports batches and saved configurations, and differs from their original `/typesafe` single-call design. Use the codebase guide and implementation for current behavior.
