# Superpowers Planning Artifacts

This folder contains planning artifacts created through Superpowers workflows. These files are useful history, but they are not the first source of truth for current product behavior or architecture.

## Current Authority

- Current product behavior and scope: [`docs/product.md`](../product.md)
- Current architecture and change recipes: [`docs/architecture.md`](../architecture.md)
- Manual testing and validation: [`docs/testing.md`](../testing.md)
- UI and interaction direction: [`design.md`](../../design.md)
- Agent operating rules: [`AGENTS.md`](../../AGENTS.md)

## Specs

- [`specs/2026-05-26-directional-gist-sync-design.md`](./specs/2026-05-26-directional-gist-sync-design.md): approved design for replacing the vague GitHub Gist `Sync now` action with explicit manual pull and push actions, dashboard header shortcuts, and focused sync tests. Use as implementation history; verify current behavior against `docs/product.md` and source code.
- [`specs/2026-05-26-github-gist-sync-design.md`](./specs/2026-05-26-github-gist-sync-design.md): approved design for GitHub Gist pseudo-sync, reusable local secrets, and shared external API transport. Use as implementation history; verify current behavior against `docs/product.md` and source code.
- [`specs/2026-05-27-track-owned-progress-design.md`](./specs/2026-05-27-track-owned-progress-design.md): approved design for replacing group-owned track progress with track/problem-owned progress and correction-aware review reconciliation.
- [`specs/2026-05-24-docs-architecture-design.md`](./specs/2026-05-24-docs-architecture-design.md): approved design for the compact docs architecture. Current for this docs pass.
- [`specs/2026-05-24-tracks-phase-3-design.md`](./specs/2026-05-24-tracks-phase-3-design.md): Tracks phase 3 design artifact. Use as implementation history; verify current behavior against `docs/product.md` and source code.

## Plans

- [`plans/2026-05-27-track-owned-progress.md`](./plans/2026-05-27-track-owned-progress.md): implementation plan for replacing group-owned track progress with track/problem-owned progress, correction-aware review reconciliation, and backup compatibility.
- [`plans/2026-05-26-directional-gist-sync.md`](./plans/2026-05-26-directional-gist-sync.md): implementation plan for directional manual GitHub Gist pull/push actions, dashboard header shortcuts, and sync test cleanup.
- [`plans/2026-05-26-github-gist-sync.md`](./plans/2026-05-26-github-gist-sync.md): implementation plan for GitHub Gist pseudo-sync, reusable local secrets, shared external API transport, and LeetCode API transport cleanup.
- [`plans/2026-05-24-docs-architecture.md`](./plans/2026-05-24-docs-architecture.md): implementation plan for this docs pass. Current while the docs pass is in progress.
- [`plans/2026-05-24-tracks-phase-3.md`](./plans/2026-05-24-tracks-phase-3.md): Tracks phase 3 implementation plan. Historical once the feature has landed.
- [`plans/2026-05-23-problems-mvp.md`](./plans/2026-05-23-problems-mvp.md): Problems MVP implementation plan. Historical once the feature has landed.

## Reading Guidance

Use these files to understand why work was shaped a certain way. Before changing product behavior, architecture, or tests, check the current docs and source code first.
