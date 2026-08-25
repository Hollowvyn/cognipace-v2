# Product

## Product Summary

CogniPace is a local-first Chrome MV3 extension for deliberate LeetCode review and
study pacing. It helps a user keep two loops visible while studying:

- what to review now, using FSRS-backed spaced repetition
- what to study next, using the active curated track

The app is intentionally a compact browser tool, not a SaaS app, hosted study
platform, or general React dashboard.

## Target User

CogniPace is for someone preparing for coding interviews who already uses
LeetCode, wants to remember previously solved problems, wants curated progression
through study tracks, and wants guidance inside the browser without creating an
account.

## Core Problem

Interview prep often splits into two weak workflows: random LeetCode grinding
with poor retention, or curated lists that do not remind the user to review older
material. CogniPace combines retention and progression by showing both a review
target and the next track target.

## Product Principles

- Extension-first: optimize for popup, dashboard, overlay, and background
  service-worker realities.
- Local-first: persisted user data lives in the extension.
- No account system: no sign-in, authentication, or hosted identity in the
  current scope.
- No backend service: scheduling, queue composition, tracks, and settings run
  locally.
- Compact workflows: prefer direct actions, short copy, and low ceremony.
- Explicit scope: future ideas are not approved work until a human explicitly
  asks for them.

## Current Status

Implemented or meaningfully wired:

- Popup command surface
- LeetCode content-script overlay
- Dashboard shell and navigation
- Library/Problems management
- Tracks workspace, management, and non-destructive JSON import
- Settings
- Backup, restore, and clear local data from Settings
- Analytics dashboard route for local review-health reporting
- Optional GitHub Gist pseudo-sync from Settings > Data Management
- FSRS-backed practice scheduling
- AI assessment settings and trusted local provider key storage for approved
  BYOK providers
- Runtime messaging, cache invalidation, local database, migrations, and seed data

Currently incomplete or intentionally light:

- Overview is a dashboard route with a planned guided-practice home.

## Product Surfaces

### Popup

The popup is the fast command surface. It should answer what to review now and
what to study next without becoming a mini dashboard.

Current behavior:

- shows compact metric tiles
- shows a review recommendation
- allows recommendation shuffle when available
- shows study-mode or freestyle track guidance
- opens the current problem when a problem action is available
- links to Settings and Tracks where relevant
- keeps feedback scoped to the affected surface area

### LeetCode Overlay

The overlay runs on LeetCode problem pages and supports in-context practice
logging.

Current behavior:

- collapsed, expanded, and docked visual modes
- timer start, pause, and reset
- target-time awareness
- quick submit preparation from the collapsed state
- expanded submit, fail, update, restart, and rating controls
- structured draft fields managed through the overlay session
- settings access from the overlay
- page metadata and problem context sync through content-script/runtime messages

### Dashboard

The dashboard is the control and inspection surface for product state.

Current behavior:

- Library manages problem rows, filters, details, create/edit modals, and problem
  practice actions.
- Tracks manages active track workspace, groups, ordered problems, progress,
  create/edit, activation, deletion, reset progress, and non-destructive JSON
  import. Import reuses existing problems by normalized slug, creates missing
  problems with safe defaults, rejects existing track conflicts, and never
  activates or replaces local state.
- Settings manages persisted user preferences through a dirty-state form workflow.
- Data Management in Settings exports full local backups, validates and restores
  full backups, configures optional GitHub Gist pseudo-sync, shows planned
  selective import sections for topics, companies, and problems, and performs
  explicit full local clear/reset. Tracks use their dedicated import workflow
  instead of the planned selective-backup placeholder.
- The dashboard header shows compact pull and push shortcuts after GitHub Gist
  sync is configured.
- Analytics shows local review-day totals, all-time review counts, current
  streak, low-sample-aware observed rating quality, a tracked-card memory
  profile, current retention health, fragile knowledge, and a fixed 14-day
  upcoming-review forecast. Its historical charts use the selected 14-, 30-,
  or 90-day range as evidence-gated presentation windows rather than promising
  a trend from sparse local history.
- Overview currently reserves route ownership for a future guided-practice home.

### Background Service Worker

The background service worker owns trusted extension runtime work:

- local database access
- runtime sender authorization
- runtime handler registration
- feature service calls
- database snapshot persistence
- cache invalidation broadcasts
- GitHub Gist sync orchestration and background-only token access
- local due-review reminder scheduling through Chrome alarms and notifications

## Features

### Practice Scheduling

Practice state is local and FSRS-backed. The persisted database owns practice
facts, and UI surfaces read them through feature services and runtime messages.

### Queue

The queue composes review recommendations from local practice state, settings,
and problem data. Popup guidance should keep queue recommendation and track
progression visibly separate.

### Problems And Library

Problems owns LeetCode problem identity, difficulty, premium status, topics,
companies, catalog rows, and problem-level practice details. Library is the
dashboard surface for inspecting and editing that problem data.

Library topics remain editable as problem metadata. Saved topic labels are
standardized through stored aliases, so variant labels such as LeetCode page
labels or older local labels resolve to the same persisted topic where an alias
exists. Captured LeetCode page topics merge into the problem without clearing
unrelated local or manually edited topics.

Parent topic rollups exist for internal read models and future analytics
support, but they are not separate problem assignments. The current product does
not include a topic graph management UI.

### Tracks

Tracks owns curriculum progression. Track completion is separate from global
practice history, and active track/session state is local database state. Tracks
can contain groups and ordered problem memberships. The dashboard's Import
Tracks workflow accepts a versioned JSON file, previews it before persistence,
reuses existing Library problems by normalized slug, creates missing problems,
and atomically creates new inactive tracks. See
[`docs/track-import.md`](./track-import.md) for the public contract and
authoring rules.

### Settings

Settings owns persisted preferences, defaults, validation, and the dashboard
settings form. Changes should flow through the settings feature API and
invalidate affected query families.

AI assessment settings can store provider preference and model configuration.
Provider API keys are stored in trusted local extension secret storage, never in
backup exports, sync payloads, logs, or unmasked UI payloads. When configured,
trusted background code can call the approved BYOK provider hosts for OpenAI,
Anthropic, and Google Gemini. Development smoke testing can optionally run a
live provider check, but that hidden dashboard smoke route is not normal product
navigation and never reveals stored secret values.

### Analytics

Analytics owns the local dashboard route for review health, historical recall
and practice patterns, current memory state, workload, and weak-area
inspection. It is read-only and derived from local practice state; it does not
introduce hosted reporting or account behavior.

Historical Analytics uses adaptive presentation buckets and evidence gates:

- The implemented range choices are 14 days with daily buckets, 30 days with
  three-day buckets, and 90 days with weekly buckets. The selection is always
  explicit and never silently changes to a shorter period.
- For each metric, Analytics removes only unsupported leading buckets from its
  presentation window. Internal and trailing gaps remain unknown; it does not
  fill them with invented values. When the selected range is not ready, the
  page explains the relevant evidence shortfall and can offer the richest
  shorter ready range as a link; the available chart still remains visible.
- Practice Rhythm keeps every bucket after the first supported practice bucket.
  A bucket with no reviews is plotted as zero review volume, while correctness
  remains unknown unless an eligible correctness assessment exists.
- A dashed line bridge means two measured values are separated by a missing-
  evidence gap. It is a visual connection only, never an interpolated data
  value. Historical line charts connect each measured point to the next valid
  point so sparse history does not create a broken visual story; unknown
  buckets still do not receive markers or tooltip values.
- Readiness is metric-specific and explainable. A range or metric can be held
  back for too little usable span, too few eligible assessments or active
  buckets, a gap that is too long, or too many gaps. Readiness is guidance for
  confidence, not a reason to hide an otherwise available chart.

Historical readiness does not hide useful analytics. Recall Quality, Practice
Rhythm, Memory Strength, and Recent Overdue Backlog keep showing available
points when a historical selected range is unready; a one-point series says
that it is not enough for a trend yet. Retention Health, Fragile Knowledge, and
the fixed 14-day Upcoming Review Load remain available as current or forecast
views. Retention Health compares each active problem's current FSRS
retrievability with the configured target; its hover/focus preview can be
pinned for details and provides a canonical LeetCode link. Fragile Knowledge
highlights current cards with risk signals and shows five rows per page with
canonical LeetCode problem links.

Observed correctness is the persisted share of eligible assessments marked
correct. It is not FSRS-predicted recall, retention, or a record of first-try
performance: the current review history does not identify retries or hints.
Predicted recall and current retrievability are FSRS estimates, not guaranteed
outcomes. The memory profile is based on tracked local FSRS cards and includes
due today, overdue, learning, review, average retrievability, and low-sample
messaging when local data is sparse.

### Sync

GitHub Gist sync is optional, BYOK, and pseudo-real-time rather than live
collaborative editing. A user stores a GitHub token locally, creates or connects
a private CogniPace Gist, and can use explicit manual directional actions to
move data. Pull latest updates this browser from the connected Gist. Push local
updates the connected Gist from this browser.

Settings presents sync as a connection summary instead of an always-open token
form. Not-connected users open a Connect GitHub Sync dialog to add a masked
GitHub token and connect or create a private Gist. Connected users stay
connected when auto-sync is paused; the Manage connection dialog supports stored
token validation, token replacement, token deletion, and Gist connection
changes.

Local writes always save locally first, mark data as needing push, and schedule a
safe background push through Chrome alarms. Opening popup, dashboard, or overlay
surfaces performs a safe remote check and clean-pulls changed Gist data only
when local data has no unpushed changes.

Automatic sync never force-overwrites local data or the Gist. Dirty local data
blocks automatic pull, changed remote data blocks automatic push, and manual
force pull or force push remains the recovery path after confirmation. Manual
action feedback is shown in dialogs so the direction and result of the operation
stay clear. Retryable sync failures do not roll back local saves.

Settings is the setup and recovery surface; once sync is configured, the
dashboard header also provides compact shortcuts for quick pull and push actions
with the same force-pull and force-push confirmation rules. Pausing auto-sync
only stops automatic open-check and mutation-triggered sync behavior; manual
pull and push actions continue to work from Settings and the dashboard header.

GitHub tokens are stored in trusted `chrome.storage.local` extension storage and
are only read by the background service worker. Tokens are not included in
backup exports, sync envelopes, logs, or UI status payloads.

### LeetCode Capture

LeetCode capture reads page metadata, page content, and submission result
information from the content script and passes validated data through runtime
messaging. Captured page topics are treated as additional problem metadata and
merge with existing Library topics instead of replacing them.

## Non-Goals

- account creation
- authentication
- hosted CogniPace cloud sync service
- hosted backend services
- multi-user or team workflows
- generic SaaS dashboard expansion
- mobile app support
- broad browser support beyond the current Chrome MV3 target

## Future Candidates

These are possible future directions, not approved work by default:

- overview home polish
- richer analytics
- selective import conflict policies for topics, companies, and problems
- improved notification strategy beyond the current local due-review reminder
- passphrase lock for local BYOK secrets
- enterprise KMS-backed secret wrapping
- richer sync conflict previews and selective merge policies

## Success Criteria

The current product stage is successful when a user can:

- open the popup and identify a useful review target
- identify the next problem in the active track
- open a LeetCode problem page and log a review from the overlay
- inspect and maintain Library problems
- manage tracks and active progression
- import ordered tracks without replacing existing local data
- adjust settings
- export, restore, and clear local data from Settings
- optionally keep extension installs aligned through GitHub Gist sync
- keep all persisted state local unless explicitly using the optional Gist sync

## Canonicality

This document owns current product behavior and scope. Technical structure lives
in `docs/architecture.md`. Manual verification lives in `docs/testing.md`. Visual
and interaction guidance lives in `design.md`. Superpowers specs and plans are
planning artifacts unless a current doc explicitly says otherwise.
