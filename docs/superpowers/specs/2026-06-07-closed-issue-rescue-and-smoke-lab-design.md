# Closed Issue Rescue and Smoke Lab Design

## Context

Issues #1-6 and #11-17 were worked from commit
`0caf86a59dbbea6fa389b69efc3ba6a183656681` through latest. Several are
closed even though local evidence shows contract drift:

- #13 is still open while #14 and #15 are closed.
- `analytics.getSummary` is now authorized for dashboard, but the request
  schema is still `{}` instead of carrying `surface: 'dashboard'` and optional
  `at`.
- The analytics summary does not expose `memoryProfile`, although #14 and #15
  require it.
- Queue exposes useful fields, but not the exact #12 shared contract names
  (`dueToday`, `newAvailable`, `queueLoad`, `recommendationReason`).
- GenAI provider adapters exist and are tested with mocked `fetch`, but live
  provider calls were not smoke-testable because provider host permissions were
  absent.

The current branch already corrected two important architectural problems:

- Dashboard senders may call `analytics.getSummary`.
- GenAI API keys moved out of SQLite `settings_kv` and into trusted extension
  secret storage backed by `chrome.storage.local`.

This rescue pass builds on that good work, audits the rest, and adds a
repeatable smoke path so closed issues represent working behavior.

## Goals

- Audit every requirement in issues #1-6 and #11-17 against code, tests, and
  runtime behavior.
- Preserve code that follows current project architecture.
- Fix confirmed contract gaps without broad rewrites.
- Enable live GenAI provider calls with explicitly approved narrow host
  permissions:

```text
https://api.openai.com/*
https://api.anthropic.com/*
https://generativelanguage.googleapis.com/*
```

- Add a dev-only smoke lab that verifies the behaviors the team was closing
  issues for.
- Keep docs honest about what was fixed, what was smoke-tested, and what still
  needs product discussion.

## Non-Goals

- No account, auth, sync, team, or SaaS behavior.
- No generic analytics redesign beyond resolving the issue contracts.
- No provider proxy server in this pass. EasyRepeat's local-server path was
  useful as a smoke-testing reference, but CogniPace should keep direct
  background-owned provider calls for BYOK.
- No content-script provider calls.
- No API keys in app-shell payloads, content props, fixtures outside GenAI, or
  SQLite.

## Issue Audit Matrix

The implementation plan will create an audit table covering each issue:

| Issue | Expected Result                                                                        | Audit Outcome                                                                  |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| #1    | Deterministic LeetCode assessment is pure, typed, and persistence-free.                | Verify and keep unless evidence contradicts it.                                |
| #2    | Review session context is transient and does not pollute practice persistence.         | Verify and keep unless reset/SPA cases fail.                                   |
| #3    | Background-only GenAI provider layer supports OpenAI, Anthropic, Gemini.               | Keep adapters, add live host permissions, add smoke coverage.                  |
| #4    | AI settings and secrets are safe.                                                      | Keep trusted storage, prove no DB/app-shell leak.                              |
| #5    | Prompt/schema produce conservative FSRS recommendations.                               | Verify schema and prompt tests; add smoke if needed.                           |
| #6    | Runtime AI recommendation endpoint works, blocks wrong surfaces, and leaks no secrets. | Restore live path after permissions, test unavailable/configured/error states. |
| #11   | FSRS/practice read contracts normalize state for consumers.                            | Verify consumers do not receive raw FSRS state.                                |
| #12   | Queue exposes shared categorization and recommendation summary.                        | Fix or formally align field names and tests.                                   |
| #13   | Shared summary contracts are resolved for overview and consumers.                      | Treat as required for #14/#15 completion.                                      |
| #14   | Analytics backend/read model returns full summary including memory profile.            | Add request shape and memory profile.                                          |
| #15   | Analytics route renders required sections including memory profile.                    | Add UI and tests for no-data/low-sample/populated.                             |
| #16   | Practice/settings mutations invalidate derived read models.                            | Keep central tag map; verify emitters.                                         |
| #17   | Due notification uses queue summary fields and dedupes locally.                        | Verify notification reads queue summary contract, not raw FSRS.                |

The audit document should classify each issue as:

- `keep`: implementation meets contract and has useful tests.
- `fix`: implementation is close but misses a contract field or edge case.
- `reopen`: issue is materially incomplete and should not be considered closed.
- `defer`: requires product decision outside this rescue pass.

## Architecture

The rescue keeps the existing dependency direction:

```text
entrypoints -> app -> features -> platform/lib/components
```

Feature modules continue owning their contracts:

- `features/assessment`: deterministic decision policy.
- `features/overlay-session`: transient review context.
- `features/genai`: provider settings, provider adapters, prompt-time JSON
  generation facade, and trusted provider secret access through server-only
  code.
- `features/leetcode-review-assistant`: prompt building and AI assessment
  recommendation service.
- `features/practice`: normalized practice state.
- `features/queue`: queue categorization and recommendation summary.
- `features/analytics`: analytics summary contracts, read model, and dashboard
  components.
- `extension/background`: runtime method registration, sender policy, alarms,
  notifications, cache invalidation broadcasting, and dev-only smoke handlers.
- `platform/query`: query-key family mapping and invalidation helpers.
- `platform/secrets`: trusted secret store.

No feature should import from another feature's internal `server` directory
unless the existing architecture docs explicitly allow the background/runtime
composition point to do so.

## GenAI Live Provider Path

The live GenAI path should be:

```text
overlay/content request
  -> extension runtime policy
  -> leetcode-review-assistant runtime handler service
  -> genai settings service loads safe settings + trusted secret
  -> features/genai/server/generateJson
  -> provider adapter fetches OpenAI/Anthropic/Gemini
  -> Zod validates recommendation schema
  -> runtime response returns recommendation without secret fields
```

Provider host permissions are narrow and explicit. Custom `baseUrl` support must
not imply wildcard host permissions. If custom provider hosts are needed later,
that should be a separate design with optional host permissions or a local proxy.

The current hard gate that always returns "AI recommendations are disabled until
provider host permissions are approved" should be removed only after manifest
tests prove the approved provider hosts exist.

## Analytics and Shared Summary Contracts

Issue #13 blocks honest completion of #14 and #15. This rescue resolves the
shared summary contract in the smallest useful way:

- `analytics.getSummary` request requires `surface: 'dashboard'` and accepts
  optional `at`.
- Runtime policy authorizes dashboard only.
- Analytics response includes existing fields plus `memoryProfile`.
- `memoryProfile` is derived from normalized practice/FSRS data, not raw card
  rows leaking to UI.
- Analytics screen renders memory profile for no-data, low-sample, and populated
  states.

The memory profile should be compact and actionable, for example:

```ts
type MemoryProfile = {
  totalTracked: number
  dueToday: number
  overdue: number
  learning: number
  review: number
  mastered: number
  suspended: number
  averageRetrievability: number | null
  lowSample: boolean
}
```

The exact shape may change during implementation if existing domain names point
to a cleaner local contract, but it must be explicit, Zod-validated, and covered
by tests before #14/#15 are considered fixed.

## Queue Contract Alignment

The current queue implementation has useful behavior:

- due/new/reinforcement partitioning,
- suspended/mastered/premium exclusions,
- top recommendation,
- recommendation reasons,
- track-independent queue generation.

The rescue should avoid replacing this. The fix is contract alignment:

- Either expose #12's requested field names directly (`dueToday`,
  `newAvailable`, `queueLoad`, `recommendationReason`) or document an explicit
  project-owned replacement contract in current docs and tests.
- Due notification should read from the same serialized queue summary contract
  used by runtime consumers.
- Tests must prove queue summary does not depend on active track state.

## Dev-Only Smoke Lab

Add a dev-only smoke surface that can be run manually during development and
covered by focused tests. It is not product UI and must not ship secrets to
content scripts or app-shell payloads.

The smoke lab should expose results similar to EasyRepeat's useful smoke ideas
(`/health`, `/providers`, `/models`, `/verify`) while staying inside CogniPace's
architecture:

- `health`: background runtime is reachable and DB opens.
- `analytics`: `analytics.getSummary` succeeds for dashboard, validates schema,
  and includes memory profile.
- `queue`: `queue.getTodayQueue` succeeds and returns the shared summary fields.
- `notifications`: due reminder dry-run reports would-notify/deduped/disabled
  without sending a real notification unless explicitly requested.
- `genai.config`: selected provider, model, enabled flag, and secret presence;
  never raw secret.
- `genai.live`: optional real provider call when AI is enabled and a key exists.
  It should request a tiny schema-valid JSON payload and show provider,
  latency, status, and redacted error details.
- `leetcode.assessment`: deterministic and AI recommendation smoke for a small
  canned assessment context.

The smoke lab may be a dashboard dev route, a background runtime method, or both.
The preferred implementation is a dashboard dev route backed by background-only
smoke runtime methods because it lets the user test the extension without
opening DevTools.

The route must be hidden outside development builds or behind an explicit
project dev flag. It should never appear as a normal product navigation item.

## Testing Strategy

Focused tests come before implementation fixes:

- Runtime policy tests for analytics, queue, smoke methods, and AI endpoint
  surfaces.
- Manifest/static tests proving provider host permissions exist and are narrow.
- GenAI live-path unit tests with mocked `fetch` for configured, missing key,
  provider HTTP error, invalid JSON, and schema failure.
- Secret leak tests proving API keys do not appear outside `features/genai` or
  `platform/secrets`, and do not serialize into app-shell/backup payloads.
- Analytics contract and domain tests for no-data, low-sample, populated,
  suspended, and reset data.
- Analytics UI tests for memory profile rendering.
- Queue contract tests for field names, top recommendation reason, exclusions,
  and active-track independence.
- Due-notification tests for disabled, deduped, no due items, due items, and
  schedule resumption.
- Cache-invalidation tests proving practice and target-retention settings
  invalidate practice, queue, analytics, tracks, problems, and app-shell query
  families as appropriate.

Full verification before completion:

```text
npm run check
```

Docs-only formatting for touched Markdown:

```text
npx prettier --write <touched-docs>
```

If repo-wide formatting still fails on unrelated pre-existing files, report that
separately and keep the touched files formatted.

## Completion Criteria

This rescue is complete when:

- The issue audit matrix is written and committed.
- Every `fix` item in the agreed scope has a focused test and code fix.
- Every `reopen` or `defer` item is documented with concrete evidence.
- Live GenAI provider calls are no longer globally gated after approved host
  permissions are present.
- The smoke lab can verify analytics, queue, notifications, GenAI configuration,
  and optional live GenAI calls without exposing secrets.
- `npm run check` passes.
- Current docs describe actual behavior and actual validation run.

## Risks

- Live provider smoke depends on user-supplied API keys and network access.
  Tests should mock provider APIs; manual smoke should report unavailable or
  auth failures clearly without failing the whole app.
- Adding provider host permissions changes extension review/security posture.
  The permissions must remain exact provider origins, not wildcard hosts.
- Memory profile requirements were implied by issues but not finalized in #13.
  This design chooses a minimal version to unblock truthful analytics behavior.
- A smoke lab can become product clutter if it is not development-gated.

## Open Decisions

- Exact `memoryProfile` field names can be adjusted during implementation if
  existing domain vocabulary offers a cleaner shape, but it must remain explicit
  and tested.
- The smoke lab route name should be chosen during planning. A likely path is
  `#/dev/smoke`.
- Whether to open follow-up GitHub issues for any `reopen` findings should be
  decided after the audit matrix is written.
