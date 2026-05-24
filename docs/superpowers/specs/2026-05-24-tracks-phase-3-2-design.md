# Phase 3.2 Tracks Active Guidance Design

## Context

Phase 3 delivered the Tracks MVP surface and introduced track-scoped progress through `track_problem_progress`. The next step is not more visible UI. Phase 3.2 should make active-track progression consistent everywhere the app needs a "next problem" answer.

The old CogniPace product kept active track guidance and queue recommendations as separate concepts. That part is worth preserving. The old implementation also derived track progress from global practice state, which v2 should avoid. V2's track progress ledger is the right model: a problem practiced globally can remain in the lifelong FSRS queue, while track completion belongs only to the active track context.

Phase 3.2 optimizes for cross-surface active-track behavior first. Library filtered-problems-to-track creation is deferred to Phase 3.3. Target date, countdown, and pacing work is deferred to Phase 3.4.

## Goals

- Make active track the consistent next-problem source for study-plan guidance.
- Keep Tracks as the owner of active-track next-problem and progress rules.
- Keep app shell thin: it consumes Tracks guidance and adapts it to popup/overlay surfaces.
- Keep queue fallback out of normal active-track guidance.
- Preserve the overlay post-submit continuation behavior with an explicit queue fallback.
- Block active-track guidance and active-track progress writes in Free Practice mode.
- Keep using the existing extension messaging invalidation bus and React Query cache invalidation.

## Non-Goals

- No new Overview card or Overview redesign in Phase 3.2.
- No Library filtered-problems-to-track creation yet.
- No target-date pacing, countdown, or workload balancing yet.
- No WebSocket, Server-Sent Events, polling loop, or new global client store.
- No planned schema migration. If implementation discovers a small supporting index is required for the resolver, that index must be justified in the implementation plan before code changes begin.
- No append-only track progress event log.

## Product Rules

Study Plan mode is the only mode that participates in active-track guidance and active-track progression.

When Study Plan mode is active and an active track exists, track guidance should be the default next-problem source anywhere the app asks for active study guidance. The app should not silently switch popup, dashboard, or track guidance to the queue when the track is exhausted. Those surfaces should show a "No more problems in track" state and let their separate queue UI remain separate.

The post-submission overlay is the one exception. It is a lightweight continuation snapshot shown immediately after a review. It should prefer the active track's next problem. If that active-track candidate has the same slug as the just-reviewed problem, the overlay next action should fall back to the first distinct queue recommendation. If neither exists, it shows an empty next-step state.

Free Practice mode disables active-track behavior. Practice-facing active-track reads should return no active-track guidance, and practice saves should not write to `track_problem_progress`. Tracks management screens may still read the track catalog/workspace for editing and selection, but that management read must not drive practice guidance while Free Practice is active.

Study Plan mode always permits active-track ledger writes on Good/Easy when the solved problem belongs to the active track. The overlay fallback rule does not weaken this. If a Study Plan review completes an active-track member, the ledger write is valid even when the next overlay card later falls back to queue because the track has no next candidate.

## Tracks-Owned Guidance Resolver

Tracks should expose a single server-side guidance resolver used by both the Tracks workspace read model and app-shell active-track reads.

The resolver belongs in the Tracks feature, behind the server/repository boundary. It should not live in React components, app-shell UI code, or popup-specific view models.

The resolver reads:

- `track_session.activeTrackId`
- `track_session.activeGroupId`
- active track metadata
- active track groups ordered by `track_groups.position`
- memberships ordered by `track_group_problems.position`
- `track_problem_progress`
- practice summaries needed to know schedule, due state, suspended state, and last review metadata
- current settings mode when the caller is practice-facing
- `now` from the request or service call for deterministic due calculations

The resolver returns a serialized guidance model that can be adapted by app-shell. Model it as a discriminated read model or an equivalent explicit state shape, with these fields represented clearly:

- generated timestamp
- guidance mode, such as `disabled-free-practice`, `no-active-track`, `ready`, or `exhausted`
- active track metadata when available
- active group metadata when available
- progress summary
- due count scoped to active-track problem memberships
- next problem summary when available
- exhausted/no-next reason when no next problem exists

The contract should follow existing Zod patterns. The key requirement is that consumers no longer recompute active-track next-problem behavior independently.

## Next-Problem Algorithm

The next-problem algorithm should be shared between `/tracks` workspace data and app-shell active-track guidance.

Eligible rows are active-track memberships that:

- belong to the active track
- are not complete in `track_problem_progress`
- are not suspended in global practice state
- still reference an existing problem

Selection order:

1. Prefer incomplete eligible rows that are due according to the practice summary, preserving group order and membership position among due rows.
2. Otherwise choose the first incomplete eligible row by group order and membership position.
3. If no eligible row exists, return an exhausted state.

Hard/Again reviews do not complete the track ledger. If the same problem remains the next active-track problem after a failed attempt, normal active-track surfaces may continue to show it. The post-submit overlay can exclude the current problem for its immediate next button and fall back to queue because that surface is explicitly about continuation.

## App-Shell Consumption

App shell should consume Tracks guidance rather than deriving its own active-track next problem.

Popup:

- Free Practice: queue/recommendation-first UI, no active-track guidance.
- Study Plan without active track: no-active-track state.
- Study Plan with active track and next problem: active-track next-up state.
- Study Plan with exhausted active track: no-more-problems-in-track state.
- Recommendation shuffle remains recommendation-only and must not change active-track next.

Overlay:

- After review save, refetch app-shell overlay data as it does today.
- Use Tracks guidance first when Study Plan guidance is ready.
- Exclude the current problem from the overlay "next" action when the active-track next candidate has the same slug as the just-reviewed problem.
- Fall back to first distinct queue item only in the overlay post-submit next-step selector.
- Preserve empty/loading states when neither track nor queue can supply a next target.

Dashboard:

- Phase 3.2 prepares app-shell/dashboard data for future Overview usage.
- Phase 3.2 does not build a new Overview card.

## Practice Writes

Practice save remains responsible for global FSRS and review-attempt persistence.

Track progression is a side effect of a successful Study Plan review:

- The saved rating must be Good or Easy.
- The current settings mode must be Study Plan.
- There must be an active track in `track_session`.
- The reviewed problem must belong to that active track.
- The service records completion for the first ordered incomplete membership for that problem.

Free Practice must skip this track progress write entirely, even if `track_session.activeTrackId` is set.

This keeps the mental model clean: Free Practice is queue/global practice only; Study Plan can advance the active curriculum.

## Runtime And Data Refresh

Phase 3.2 should keep the existing runtime and cache model.

Writes continue to use background runtime handlers, Zod boundary parsing, runtime policy checks, service functions, and `runDbMutation`.

After writes:

- flush the DB snapshot before broadcasting
- broadcast typed `cache.invalidate` events
- include tags that invalidate all affected React Query families
- let visible surfaces refetch read models through existing hooks

Expected invalidation behavior:

- Track session or track progress changes invalidate `tracks` and `app-shell`.
- Practice saves invalidate `practice`, `problems`, `queue`, `tracks`, and `app-shell`.
- Settings mode changes invalidate `settings`, `app-shell`, `practice`, `queue`, and `tracks` through the existing settings invalidation mapping.

No new streaming transport is needed. The app's "real-time" behavior is persisted state plus extension-message invalidation into React Query.

## React Architecture

Follow the existing Problems and Settings architecture.

- Route screens stay thin.
- Feature API modules own contracts, runtime senders, query keys, and React Query hooks.
- Feature server modules own business orchestration and serialization.
- Feature data modules own Drizzle queries and transactions.
- Components render serialized state and call hooks/mutations; they do not recompute curriculum rules.
- Server state stays in React Query.
- Persisted product state stays in SQLite.
- Transient UI state stays local.
- No new global client store.
- No HOC layer for this work.

This matches current React guidance to keep data-fetching concerns in reusable hooks/client caches instead of duplicating manual effects in components, and it keeps Bulletproof React boundaries intact: Tracks owns curriculum domain behavior; app-shell composes cross-surface payloads; UI renders.

## Testing Plan

Repository/domain tests:

- shared resolver returns the same next problem used by workspace and app-shell active guidance
- due eligible rows beat later unscheduled rows
- suspended rows are skipped
- completed ledger rows are skipped
- exhausted state is returned when no eligible rows remain
- active group/order behavior is deterministic
- duplicate problem memberships complete only the first ordered incomplete active-track membership

Practice/runtime tests:

- Study Plan Good/Easy writes active-track progress for active-track members
- Study Plan Hard/Again does not write active-track progress
- Free Practice Good/Easy does not write active-track progress
- practice saves still invalidate `tracks` and `app-shell`
- DB snapshot flush happens before invalidation broadcast

App-shell tests:

- popup active-track guidance uses the Tracks resolver
- popup exhausted state does not fall back to queue
- popup Free Practice hides active-track guidance
- overlay post-submit prefers track next
- overlay post-submit falls back to a distinct queue item only when track next is unavailable or excluded
- overlay empty state appears when neither track nor queue can provide a next step

Contract/policy tests:

- any new/updated contracts parse valid and invalid payloads
- dashboard/popup/content-script access remains consistent with runtime policy
- content-script continues to use app-shell for overlay data rather than full Tracks workspace APIs

Architecture tests:

- app imports only public feature surfaces
- root feature barrels do not export `data` or `server`

## Deferred Follow-Ups

Phase 3.3 should implement Library filtered-problems-to-track creation. It should support filtered rows and selected rows as explicit source modes, preserve current filtered/sorted order, dedupe slugs, and create ordered memberships in one transaction with lightweight grouping by topic, difficulty, company, or single group.

Phase 3.4 should implement target date, countdown, pacing, and due-load planning from `tracks.dueAt`. It should keep "Due Reviews" separate from target date language so users do not confuse review due count with a track deadline.
