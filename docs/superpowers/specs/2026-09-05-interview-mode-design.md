# Interview Mode Design

## Context

A separate bundle at `mock-interviewer/` in the working tree implements a
speech-to-speech mock coding interviewer: a Python LiveKit worker running
OpenAI Realtime plus a Next.js frontend with CodeMirror and Mermaid, deployed
as two Railway services. Its central premise is a rubric-based gate: the
editor stays locked until the candidate has stated a data structure and
algorithm, traced a real input, and stated time and space complexity out loud.

CogniPace should adopt that gate as a native feature. Two constraints shape
how:

- `docs/product.md` lists as non-goals: "no backend service", "no hosted
  CogniPace cloud sync service", "no hosted backend services". `CLAUDE.md`
  safety rules block adding backend or hosted-service behavior without
  explicit approval.
- CogniPace already runs a content-script overlay on
  `leetcode.com/problems/*` (`overlay-session`, `leetcode-capture`) with
  problem reads, submission capture, and BYOK GenAI provider calls
  (`genai:openai`).

Dropping in the mock-interviewer as-shipped would introduce a hosted Python
worker and a Next.js `/api/token` endpoint, both violating the non-goals.
Building the interview as a native overlay-mode feature instead honors the
product principles and reuses infrastructure already in place.

## Product Decision

Interview mode ships as a new CogniPace feature (`src/features/interview`)
that activates on the LeetCode overlay when a global setting is enabled. It
uses the OpenAI Realtime API directly from the overlay's content-script
context over WebRTC. Ephemeral session tokens are minted by the background
service worker from the stored `genai:openai` BYOK secret; no long-lived
credential leaves the trusted background context.

The rubric, ratchet, and unlock rule from the mock-interviewer are ported to
TypeScript. The gate lives in the overlay React state (not background) because
CogniPace's trust boundary exists to protect BYOK secrets, not to prevent a
user from cheating themselves in a study tool. The final interview record is
persisted through the background service worker like every other CogniPace
write.

No Python process, no LiveKit dependency, no separate deploy, no new hosted
service. The feature is opt-in and off by default.

## The Gate

Three scored axes, each `0..3`, integers:

- `approach` earns a 2 when the candidate has stated a correct data
  structure and algorithm and justified them.
- `examples` earns a 2 when the candidate has traced a real input and shown
  intermediate state.
- `complexity` earns a 2 when time and space costs are stated and explained.

`unlocked = min(approach, examples, complexity) >= 2`. Scores ratchet up
only. A `missing` string names the weakest axis in short human copy.

The rubric is duplicated in three places by design (shared domain module,
lock-plate render, HUD render). Changes to the rubric shape update all three
in the same commit.

## Behavior

### Enabling Interview Mode

Users enable interview mode from Settings > AI Assessment via a new
`enableInterviewMode` boolean. Default is off. When off, no interview
controls appear in the overlay. Enabling requires an existing configured
`genai:openai` BYOK key; if not present, the setting explains the
prerequisite and links to the key setup.

### Starting an Interview

On a `leetcode.com/problems/*` page with interview mode enabled, the overlay
shows a "Start interview" action alongside existing controls. Clicking it:

- transitions the overlay-session state to `interview`
- reads the current problem statement from `leetcode-capture`
- calls `interview.mintSessionToken` runtime method (background) to obtain an
  ephemeral OpenAI Realtime session token
- opens a WebRTC connection from the content script to
  `https://api.openai.com/v1/realtime` using the ephemeral token
- mounts the lock plate over LeetCode's Monaco editor container
- mounts the interview HUD as a floating card
- injects the problem text into the model as the opening system message and
  triggers the greeting

The overlay's normal controls (timer, submit, rating) are hidden while in
interview mode; the HUD provides the interview-specific controls.

### During the Interview

Each candidate turn produces model audio back through WebRTC. The model calls
its `update_assessment` function tool. That tool call arrives on the content
script through the WebRTC data channel, the domain rubric applies clamp and
ratchet, and React state updates the lock plate and HUD.

The model may call `show_diagram(mermaid, caption)` when a picture would land
better than words. A whiteboard modal renders the Mermaid source and stays
open until dismissed or replaced by a new diagram.

The candidate can ask for a hint at levels 1, 2, or 3. Hint requests are
sent to the model as new user turns with a hint-level prompt. Hints never
produce code.

The candidate can open a pseudocode scratchpad from the HUD. The scratchpad
is a plain textarea with per-problem `chrome.storage.local` persistence keyed
by problem id. The scratchpad text is not sent to the model in v1.

The candidate can end the interview at any time via an "End interview"
button. Ending the interview triggers session save and returns the overlay
to its normal mode.

### Unlocking the Editor

When the rubric reaches passing state, the lock plate unmounts and LeetCode's
Monaco editor becomes writable again. The model receives an unlock directive
that instructs it to briefly acknowledge and then stop talking so the
candidate can code. The HUD stays mounted with the rubric bars visible so
the candidate can see their earned scores while coding.

### Submitting Code

The candidate submits through LeetCode's own submit button (already captured
by `leetcode-capture` today). On submission capture, the overlay forwards the
submitted code to the model as a new user turn with a "review this code"
prompt. The interviewer responds with a short spoken review naming the first
real issue.

### Ending the Interview

The interview ends when any of these occur:

- the candidate clicks End interview
- the candidate navigates away from the problem page
- the candidate disables interview mode in Settings
- the WebRTC session errors out or the token expires

Ending the interview:

- tears down the WebRTC connection
- calls `interview.saveSession` runtime method with the final rubric scores,
  timestamps, submitted code (if any), and end reason
- if the session unlocked and code was submitted, records a practice review
  through the standard `practice` feature service so the attempt appears in
  history and Analytics. The rating used for the auto-recorded review is
  captured as an open question below.
- unmounts the HUD, lock plate, whiteboard, and pseudocode components
- restores the normal overlay mode

Ending does not compete with Study Plan or Free Practice modes; the recorded
review follows CogniPace's existing rules for how reviews flow through
tracks, FSRS, and analytics.

## UI Surfaces

Three CogniPace-owned DOM surfaces render during interview mode. LeetCode's
own DOM is not modified; CogniPace overlays are positioned on top.

### Lock Plate

Positioned-absolute cover over the Monaco editor container. Frosted look.
Renders the three rubric bars and the `missing` copy inside. Captures pointer
and keyboard events so keystrokes and clicks cannot reach Monaco while
locked. Unmounts when `unlocked` becomes true.

### Interview HUD

Small floating card near the bottom-right corner of the page. Draggable in
v1 is optional. Contains:

- a waveform ribbon reflecting the model's audio state
- a "missing" hint line
- collapsible pseudocode scratchpad
- three hint level buttons
- End interview button

The HUD stays mounted for the entire interview, including after unlock so
scores remain visible while the candidate codes.

### Whiteboard Modal

Renders Mermaid source received from `show_diagram` tool calls. Auto-replaces
when a new diagram arrives. Dismissible.

### Settings

`enableInterviewMode` boolean added to persisted settings, surfaced in
Settings > AI Assessment. Explains the prerequisite `genai:openai` key.

## Data Model

New Drizzle table `interview_sessions`:

```text
id                    text pk (uuid)
problem_id            text (fk problems.id, nullable if problem was outside
                      the catalog)
started_at            integer (ms epoch)
ended_at              integer (ms epoch, nullable while active — but sessions
                      only persist on end, so effectively required)
final_approach        integer 0..3
final_examples        integer 0..3
final_complexity      integer 0..3
unlocked_at           integer (ms epoch, nullable if never unlocked)
ended_reason          text ('user_end' | 'navigation' | 'settings_off' |
                      'error' | 'token_expired')
submitted_code        text nullable
submitted_language    text nullable
```

Generated migration lands as `0008_interview_sessions.sql`. Schema module
lives at `src/platform/db/schema/interview-sessions.ts`. The feature
repository at `src/features/interview/data/interview-session-repo.ts` owns
writes.

No changes to existing tables. Practice reviews recorded from a completed
interview go through the existing `practice` feature service unchanged.

## Runtime Messaging

Two new runtime methods, both authorized for the overlay content-script
surface only.

### `interview.mintSessionToken`

Request: `{ problem_id: string, problem_title: string }`
Response: `{ session_token: string, expires_at: number, model: string,
voice: string }`

Background handler:

- reads the `genai:openai` BYOK secret from `src/platform/secrets`
- calls `POST https://api.openai.com/v1/realtime/sessions` with the model,
  voice, tools, and instructions
- validates the response, extracts the client secret, returns it
- redacts provider errors before returning
- must not log the secret or the session token beyond one-line success
  acknowledgement

### `interview.saveSession`

Request: full session summary (final scores, timestamps, ended_reason,
submitted_code, submitted_language, problem_id)
Response: `{ session_id: string, practice_review_id: string | null }`

Background handler:

- validates with Zod
- writes to `interview_sessions` through the feature repository
- if unlocked and submitted code exists, calls `practice.recordReview`
  through the practice server service
- flushes the DB snapshot
- broadcasts invalidation tags for `interview`, `practice`, `analytics`,
  `queue`, and `app-shell`

Both methods follow the standard runtime recipe from `docs/architecture.md`:
Zod parse, sender authorization, feature server, DB write behind repository,
snapshot flush, invalidation.

## Feature Ownership

New feature module `src/features/interview/` following the CogniPace feature
layout:

```text
src/features/interview/
├── api/
│   ├── interview-contracts.ts    Zod schemas for both runtime methods
│   └── interview-hooks.ts        client hooks for calling the runtime methods
├── components/
│   ├── interview-hud.tsx
│   ├── interview-lock-plate.tsx
│   ├── interview-whiteboard.tsx
│   ├── pseudocode-scratchpad.tsx
│   └── rubric-meter.tsx
├── data/
│   └── interview-session-repo.ts
├── domain/
│   ├── rubric.ts                 Assessment, ratchet, unlock rule
│   ├── interview-prompts.ts      BASE, hint 1/2/3, submit-review prompts
│   └── realtime-tools.ts         OpenAI Realtime function tool schemas
├── hooks/
│   ├── use-interview-session.ts  WebRTC lifecycle
│   └── use-interview-gate.ts     rubric state from tool calls
├── server/
│   ├── interview-token-service.ts    mints ephemeral sessions
│   └── interview-session-service.ts  persists completed sessions
└── index.ts
```

Extended modules:

- `src/features/overlay-session/` gains an `interview` mode in its state
  machine and mounts the interview HUD, lock plate, whiteboard, and
  scratchpad when active.
- `src/features/settings/` gains the `enableInterviewMode` boolean.
- `src/extension/messaging.ts` gains both new runtime methods.
- `src/extension/background/runtime-policy.ts` authorizes both methods for
  the overlay surface.
- `src/extension/background/register-handlers.ts` registers both handlers.
- `src/platform/db/schema/interview-sessions.ts` adds the new table.
- `src/platform/db/migrations/0008_interview_sessions.sql` is generated.

Root `CLAUDE.md` gains a Sub-projects pointer to `mock-interviewer/` per its
own `MERGE_GUIDE.md`. The `mock-interviewer/` directory is renamed to
`interviewer/` and kept in-tree as a historical reference for the ported
prompts and rubric; it is not built or deployed.

## External API And Secrets

OpenAI Realtime is called from two places:

- Background service worker for ephemeral token minting (`POST /v1/realtime/sessions`).
  Uses the stored `genai:openai` BYOK secret. Follows existing patterns in
  `src/features/genai/server/providers/openai.ts` for BYOK handling.
- Content script for the actual WebRTC session against
  `wss://api.openai.com/v1/realtime` using the ephemeral token returned by
  the background call.

Host permission for `https://api.openai.com/*` is already granted per
`docs/architecture.md`. No new Chrome permission is expected for the API
call itself; microphone access uses `getUserMedia` from the content-script
page context, which prompts the user on first use like any web page.

Whether the WXT manifest needs any additional permission for
microphone access from a content script is an open question flagged below.

The ephemeral token has short server-side TTL (currently ~1 minute per
OpenAI docs). Renewal is handled by re-calling `interview.mintSessionToken`
if the session drops; the overlay treats a lost session as a natural end
rather than an auto-reconnect in v1.

## Trust Model

- BYOK secret never crosses the content-script boundary. Background is the
  sole reader.
- Ephemeral session tokens do cross, but their short TTL and per-session
  scope limit blast radius.
- The rubric gate lives in the overlay React state. A user opening DevTools
  and forcing `unlocked = true` cheats themselves; this is acceptable for a
  personal study tool. This differs from the mock-interviewer's
  Python-side gate, which existed because the browser was assumed untrusted
  in a possible public deploy.
- The final session record is written by background through the normal
  runtime boundary, so persistence still respects CogniPace's write policy.

## Open Questions

These are recorded as verification items for the implementing engineer to
resolve during slice 1, not as blockers to committing this design.

- Does `leetcode-capture` support reading in-progress editor content, or
  only submission results? The submit-code review flow assumes submission
  capture, which is confirmed. Live-code reads are not required in v1.
- Does the WXT manifest require any additional permission for `getUserMedia`
  microphone access from a content script on `leetcode.com`?
- What OpenAI Realtime voice to use as the default? The mock-interviewer
  uses `marin`; OpenAI Realtime voices differ from LiveKit's voice ids and
  should be picked before slice 4 lands.
- Selector strategy for the Monaco editor container on the LeetCode page.
  LeetCode's DOM changes occasionally; the lock plate mount point should
  degrade gracefully if the selector misses.
- Mermaid dependency footprint in the WXT extension bundle. If the bundle
  grows unacceptably, dynamic import behind interview-mode enablement is a
  known mitigation.
- Which OpenAI Realtime model id and voice to use as the default. The
  mock-interviewer uses `marin` on the LiveKit Realtime plugin path; OpenAI
  Realtime voice ids differ. Slice 2 owns the choice.
- Rating semantics for the auto-recorded practice review when interview
  ends with unlock plus submission. Options: (a) always record as `good`
  since unlock implies passing rubric; (b) prompt the candidate to
  self-rate after the interviewer's review; (c) let the interviewer emit a
  rating tool call before session end. Pick during slice 2.

## Ownership And Data Flow

```text
overlay start interview
-> overlay-session state transitions to 'interview'
-> interview.mintSessionToken RPC
-> background reads genai:openai secret
-> background calls OpenAI /v1/realtime/sessions
-> background returns ephemeral token
-> overlay opens WebRTC to api.openai.com/v1/realtime
-> model tool calls (update_assessment, show_diagram) arrive on data channel
-> useInterviewGate applies clamp + ratchet
-> lock plate and HUD render current state
-> submit captured by leetcode-capture (existing path)
-> overlay forwards submitted code to model as review prompt
-> candidate clicks End (or navigation/settings-off/error)
-> interview.saveSession RPC
-> background writes interview_sessions row
-> background calls practice.recordReview if unlocked + submitted
-> snapshot flush
-> invalidation broadcast: interview, practice, analytics, queue, app-shell
-> overlay returns to normal mode
```

## Testing And Validation

Test-first coverage will target:

- rubric domain: clamp, ratchet, unlock rule, missing string derivation
- interview-token-service: BYOK read, error redaction, response shape
- interview-session-service: repo write, conditional practice review call,
  invalidation tags
- runtime contracts: request/response shape, invalid input rejection
- runtime policy: overlay-only authorization for both methods
- register-handlers: both handlers registered and callable
- useInterviewGate: tool call ingestion, state transitions
- lock plate: mounts and unmounts on unlock, blocks pointer/key events
- HUD: displays gate state, calls end handler on click
- pseudocode scratchpad: persists per-problem, does not leak across problems
- whiteboard modal: renders Mermaid, replaces on new diagram
- settings toggle: gated by BYOK key presence

Required automated validation (governance validation matrix, feature +
database + runtime + UI):

```sh
npm run db:generate
npm run db:check
npm run lint
npm run check
npm run build
```

Focused feature, contract, repository, and component tests run before the
full suite.

Manual smoke checklist (behavior-changing feature, human-run, with
screenshot or screen-recording proof before PR review or merge):

- start interview on a LeetCode problem with the feature enabled
- confirm lock plate blocks all Monaco input
- rubric bars ratchet up as scores increase
- editor unlocks at passing state
- submit code through LeetCode's own submit button
- interviewer verbally reviews the submission
- end interview via HUD button, confirm practice review is recorded
- end interview via navigation, confirm session is saved with correct reason
- disable interview mode in Settings mid-session, confirm graceful teardown
- verify no interview controls appear when feature is disabled
- verify no interview controls appear when `genai:openai` key is missing

## Rollout And Phases

Work decomposes into four parallel slices after a foundation slice unblocks
them. Full ticket breakdown is tracked in the four GitHub issues per slice
plus one governance issue.

- **Slice 1 — Foundation and Data**: DB schema, migration, feature scaffold,
  rubric domain, prompt catalog, settings toggle. Unblocks all other slices.
- **Slice 2 — Realtime and Background**: token mint service, save session
  service, runtime contracts and messaging registration.
- **Slice 3 — Overlay Integration and HUD**: overlay-session state
  extension, HUD component, pseudocode scratchpad, mount composition.
- **Slice 4 — WebRTC Session, Lock Plate, Whiteboard**: WebRTC hook, gate
  hook, lock plate, whiteboard modal, session teardown wiring.

Slice 1 lands first. Slices 2, 3, 4 proceed in parallel once slice 1 is in.

## Non-Goals

- No paste-a-problem interview mode. Interview requires a LeetCode problem
  page in v1.
- No pseudocode-to-model streaming. The scratchpad is private in v1.
- No live editor content reads for interviewer feedback. Only submission
  captures.
- No auto-reconnect on session drop. A lost session ends the interview.
- No multi-language voice selection UI. Voice is a fixed default.
- No interview history dashboard route or interview analytics in v1. The
  persisted session log exists so future work can build these.
- No hosted deploy of any interview infrastructure. Zero backend services.
- No account, auth, or multi-user behavior. Same principle as the rest of
  the extension.
- No use of the Python worker or Next.js frontend from `mock-interviewer/`
  at runtime. The bundle stays in-tree as historical reference only.

## Canonicality

This spec owns the interview mode design as of 2026-09-05. Product behavior
and scope statements here are subordinate to `docs/product.md` if it is
later updated to include interview mode as canonical behavior. Architecture
and runtime rules here follow `docs/architecture.md`; any conflict resolves
in favor of `docs/architecture.md`.
