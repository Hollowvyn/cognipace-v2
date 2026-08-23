# Analytics Dashboard System Design

## Status and authority

Approved by the user on August 22, 2026 after chart-by-chart product review.
This document is the approved **future-state specification** for the CogniPace
Analytics dashboard. It does not claim that the current branch already
implements these contracts. Implementation follows the retained plan at
`../plans/2026-08-22-analytics-dashboard-system.md`.

This specification supersedes the following Analytics planning artifacts when
they conflict with it:

- `2026-08-13-analytics-v1-shadcn-charts-design.md`
- `2026-08-13-analytics-v1-adaptive-chart-story-design.md`

Current product, architecture, testing, visual-design, contribution, and agent
governance documents remain authoritative for shipped behavior until this
design is implemented. The implementation phase must update those authority
documents in the same change that makes their descriptions true.

This specification is the sole retained record of the chart-by-chart decisions
and resolves the nomenclature and algorithmic ambiguities that arose during
design review.

## Executive decision

Build one calm, question-led Analytics page containing eight charts and one
table-native diagnostic. The page explains:

1. what changed in recent review outcomes;
2. whether reviewed memories are becoming more durable;
3. what review behavior accompanied those outcomes;
4. which topics showed weaker sufficiently sampled outcomes;
5. which current memories are below target or fragile now; and
6. whether overdue and upcoming workload are controlled.

Every metric has an explicit source, cohort, denominator, time meaning,
evidence state, claim boundary, and exact-value path. The design prefers
truthful partial information over a confident but unsupported narrative.

The system uses local Shadcn-style chart primitives around Recharts, explicit
feature-owned view components, and one Zod-validated presentation model. It
does not use a universal schema-driven renderer.

## Product boundary

Analytics is a local-first, read-only dashboard feature. This design does not
add:

- accounts, authentication, teams, or hosted analytics;
- a backend or remote reporting service;
- new or expanded sync behavior;
- Chrome permissions;
- changes to FSRS scheduling behavior;
- automatic practice recommendations, a due queue, or a review launcher;
- unsupported first-try, calibration, readiness, causal, or mastery claims.

The Overview surface owns recommendations, due work, streak, and the review
queue. Analytics answers **what changed, where, and with how much evidence**.
Links from problem-level Analytics views may open the canonical LeetCode
problem, but Analytics does not become a second queue.

## Corrected metric and current-to-target audit

The implementation must not preserve familiar labels when their underlying
meaning changes. The following changes are intentional:

| Current or older design                                                          | Locked target                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Recall Quality based on persisted correctness or proposed first-try recall       | Observed Recall vs FSRS Estimate using rating-derived recalled share on exactly paired reviews |
| Practice Rhythm line based on observed correctness                               | Review Success, defined as Good + Easy share                                                   |
| Weakest Topics based on correctness or a composite focus score                   | Topic Performance based only on sufficiently sampled Review Success                            |
| Retention Health with days-since-review X axis                                   | Retention Map with logarithmic FSRS-derived target-duration X axis                             |
| Fragile Knowledge qualified by difficulty, lapses, or broad fragility heuristics | Memory Signals qualified by below-target recall, overdue state, or sub-week target duration    |
| Overdue history aggregated into 3-day or weekly buckets                          | Daily overdue observations for all 14/30/90 ranges                                             |
| Tooltips as the main exact-value path                                            | Same-model semantic Table view for every chart; View 7 is already table-native                 |

The current persisted review history does not reliably identify retries,
hints, or independent first attempts. Therefore this design never renames a
rating or correctness field to first-try recall.

## Dashboard story and layout

The reading order is fixed:

1. page title, 14/30/90 historical control, exact range/timezone/as-of label,
   and one compact evidence summary;
2. **Observed Recall vs FSRS Estimate**, full width;
3. **Memory Strength** and **Practice Rhythm**, paired;
4. **Ratings Mix** and **Topic Performance**, paired;
5. **Retention Map**, primary full-width current-state diagnostic;
6. **Memory Signals by Problem**, full-width table-native diagnostic;
7. **Recent Overdue Backlog** and **Upcoming Review Load**, paired.

The lead outcome chart and Retention Map may be taller than supporting cards.
Supporting pairs stack before content becomes cramped. No chart is reduced to a
sparkline solely to preserve a desktop grid.

The page does not repeat overview metrics merely to fill a summary row. Any
summary value must identify its scope as selected period, current state,
all-time, or fixed forecast.

## Stable view catalogue

| #   | Stable ID                 | User-facing name                 | Scope                     | Mark                              |
| --- | ------------------------- | -------------------------------- | ------------------------- | --------------------------------- |
| 1   | `observed-recall-vs-fsrs` | Observed Recall vs FSRS Estimate | historical 14/30/90       | two lines                         |
| 2   | `memory-strength`         | Memory Strength                  | historical 14/30/90       | median line and optional IQR band |
| 3   | `practice-rhythm`         | Practice Rhythm                  | historical 14/30/90       | count bars plus percentage line   |
| 4   | `ratings-mix`             | Ratings Mix                      | historical 14/30/90       | 100% stacked columns              |
| 5   | `topic-performance`       | Topic Performance                | whole selected period     | ranked horizontal bars            |
| 6   | `retention-map`           | Retention Map                    | current state             | scatter plot                      |
| 7   | `memory-signals`          | Memory Signals by Problem        | current state             | semantic table                    |
| 8   | `overdue-backlog`         | Recent Overdue Backlog           | historical daily 14/30/90 | threshold step line               |
| 9   | `upcoming-review-load`    | Upcoming Review Load             | fixed today + 13 days     | stacked columns                   |

`Retention Map` and `Memory Signals by Problem` are the canonical names.
`Retention Health` and `Fragile Knowledge` are superseded labels.

### Mark rationale and rejected alternatives

| View                    | Why the locked mark fits                                                      | Rejected default                                                         |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Observed Recall vs FSRS | two aligned lines compare movement of two paired percentages over time        | bars obscure continuity; one blended score hides model versus outcome    |
| Memory Strength         | median line shows time movement; optional IQR shows supported spread          | smoothed area exaggerates continuity and volume                          |
| Practice Rhythm         | composed bars and line preserve count magnitude and outcome movement together | scatter loses chronology; one axis conflates units                       |
| Ratings Mix             | 100% stacks answer changing part-to-whole composition                         | pie loses time; stacked area implies evidence between buckets            |
| Topic Performance       | horizontal bars support direct ranked label comparison                        | adaptive dots add scale explanation without improving a five-row ranking |
| Retention Map           | scatter exposes two continuous FSRS dimensions and threshold regions          | colored names overload the plot; a list loses spatial distribution       |
| Memory Signals          | semantic table is the exact multi-reason comparison                           | a decorative chart hides why rows qualify                                |
| Recent Overdue Backlog  | step line represents a level that persists until the next observation         | daily bars imply independent events; filled area adds unnecessary weight |
| Upcoming Review Load    | stacked columns show total daily magnitude and overdue composition            | a line implies continuity; scenario layers make the snapshot speculative |

## Shared date, range, and time contract

### Instants and local calendar grouping

- Persist and transport exact timestamps as UTC ISO instants.
- Serialize an IANA `timeZone`, UTC `asOf`, exact period bounds, bucket bounds,
  and `isPartial` state in the Analytics response.
- Group calendar analytics in the browser's declared IANA timezone.
- If that timezone is unavailable or invalid, fall back to UTC and disclose
  `UTC fallback` beside the range; do not silently mix zones.
- A timezone change invalidates and rebuilds every calendar-grouped
  presentation row.
- Use calendar arithmetic across daylight-saving transitions. Never derive a
  local day by subtracting `86,400,000` milliseconds.
- Use half-open intervals `[start, end)` throughout.

### Historical ranges

- 14 days means today plus the preceding 13 local dates.
- 30 days means today plus the preceding 29 local dates.
- 90 days means today plus the preceding 89 local dates.
- The range end is the start of the local day after today, but observations are
  queried only through `asOf`; therefore today's bucket is visibly in progress.
- Compare previous periods only through equivalent elapsed local time. A
  partial today is never compared with a completed historical day.

### Default presentation buckets

| Range   | Bucket algorithm                                                  | Expected marks |
| ------- | ----------------------------------------------------------------- | -------------- |
| 14 days | one local date                                                    | 14             |
| 30 days | consecutive 3-local-date buckets anchored at selected-range start | 10             |
| 90 days | Monday-start calendar weeks clipped at the selected-range edges   | about 13–14    |

This matrix applies to historical time-series Views 1–4. View 5
aggregates the complete selected period, View 8 deliberately remains daily at
all ranges, Views 6–7 are current-state, and View 9 is a fixed forecast.

Counts are aggregated before ratios are derived. Percentages are never averaged
from already displayed percentages.

### Forecast boundaries

View 9 covers `[startOfToday, startOfTodayPlus14Days)`. At `asOf`:

- `dueAt < asOf` is overdue;
- `dueAt >= asOf` and before tomorrow is due later today; and
- later due instants are grouped into their local calendar date.

A due instant exactly equal to `asOf` is due now, not yet overdue.

### Labels

- Stable row identity uses `YYYY-MM-DD` local-date keys.
- Full visible dates and table dates use `MM/DD/YY`.
- Multi-date buckets use `MM/DD/YY–MM/DD/YY`.
- Compact axes may use `MM/DD` when the selected-range label already states the
  year.
- Always retain the first and last axis labels and select non-overlapping
  intermediate ticks.
- Show range, timezone, and as-of together, for example
  `08/09/26–08/22/26 · America/New_York · as of 12:40 PM`.

## Shared evidence contract

### Vocabulary

Use only these presentation states:

- **Measured**: the metric has a valid source value and denominator.
- **In progress**: the row is measured through `asOf` but its calendar period
  has not ended.
- **Reconstructed**: the value was replayed from persisted history rather than
  captured immutably at the event.
- **Not measured**: the required source value cannot be calculated; it is
  `null`, never zero.
- **Insufficient evidence**: measured values may be shown, but the evidence
  gates do not support a trend, comparison, or ranking claim.

These labels may coexist, for example `Reconstructed · In progress`.

### Historical evidence gates

For the requested presentation buckets, let:

```text
N = requested bucket count
f = first bucket containing eligible metric evidence
E = buckets from f through the current bucket
S = total eligible observations in E
A = buckets in E with at least one eligible observation
G = longest run of empty buckets in E
K = number of separate empty-bucket runs in E
```

The selected range is not shortened visually: leading empty rows remain
available in the Table view and the selected bounds stay explicit. `f` is used
only to assess whether enough usable history spans the selected range.

The shared trend gate is:

```text
E_min = ceil(0.60 * N)
S_min(R) = ceil(max(12, 0.5 * R, 0.8 * min(R, 30)))
C(R) = clamp(0.76 - 0.06 * log2(R / 7), 0.55, 0.80)
A_min = ceil(C(R) * E)
G_max = 2 for 14, 30, and 90-day ranges
K_max = max(1, ceil(0.20 * E))

trendSupported =
  E >= E_min AND
  S >= S_min AND
  A >= A_min AND
  G <= G_max AND
  K <= K_max
```

Each view computes these values from its own eligibility predicate. The page
shows one quiet evidence summary; each figure shows only the compact sample and
status needed to qualify its own statement. Repeated warning banners are not
allowed.

Measured marks remain visible when the trend gate fails. The gate suppresses
directional takeaways; it does not erase truthful points. A previous-period
comparison appears only when both periods independently satisfy the same
metric-specific gate through equivalent elapsed time.

View-specific overrides:

- View 2 requires at least four eligible bucket observations to display an IQR.
- View 5 uses its explicit 10-rating and 3-problem ranking gates.
- View 6 and View 7 use current-state eligibility, not historical readiness.
- View 8 reports reconstructible-day coverage and needs two comparable known
  observations for growth/shrinkage language.
- View 9 is a current schedule snapshot and does not use historical evidence.

Analytics must not call this evidence system learner readiness. It qualifies
the evidence behind Analytics, not whether the learner is ready for an exam or
prepared to perform.

## Missing, zero, sparse, and partial data

- `0` is a measured zero; `null` is unknown or ineligible.
- No chart converts missing outcomes to zero.
- Historical line charts draw solid segments between adjacent measured
  buckets, dashed segments across a permitted gap of at most `G_max`, and no
  segment across a longer gap.
- A dashed segment has no synthetic marker or tooltip value inside it.
- View 8 never bridges an unknown daily backlog value; its step line breaks.
- One point is a measurement, not a trend.
- Today remains visible and labelled in progress.
- Unsupported takeaways are replaced with a neutral evidence sentence, not a
  recommendation to practice more.

## Shared display precision

- Counts are whole numbers with locale grouping.
- Percentages and percentage-point differences display as whole percentages in
  chart labels and compact summaries. The Table may expose one decimal place
  when two distinct exact values would otherwise collapse to the same display.
- Signed differences use `+` or `−` and the unit `pp`.
- Durations below 10 days use one decimal; durations at or above 10 days use a
  whole day. A positive duration below 0.05 day displays `<0.1d`.
- Difficulty uses one decimal.
- Calculations retain unrounded values. Rounding is presentation-only and the
  same formatter is used by chart, tooltip, summary, and table.

## Shared scale contract

### Adaptive movement percentage domain

Views 1 and 3, and the Y axis of View 6, use this deterministic helper:

1. Collect every finite visible series value and required percentage
   reference.
2. Let `lo` and `hi` be the minimum and maximum.
3. Let `window = max((hi - lo) * 1.5, 0.25)`.
4. Center that window on `(lo + hi) / 2`.
5. Shift, rather than shrink, the window when possible to fit `0..1`; clamp
   only when the full domain is already needed.
6. Round the lower bound down and upper bound up to the nearest 0.05.
7. If there is one value or all values are equal, center the minimum 25-point
   window on that value and apply the same clamping and rounding.

The visible figure states the active domain, for example `Scale: 60%–100%`, and
the accessible description repeats it. A truncated percentage axis is never
implicit.

### Adaptive duration domain

View 2 applies the same centered 1.5-times-spread method to all visible medians
and IQR bounds, with a minimum two-day window and a lower clamp of zero. Bounds
and ticks use a deterministic nice-number step from `1, 2, 5 × 10^n`.

### Magnitude domains

Bars, areas, and backlog counts start at zero. Their upper bound is
`niceCeil(max(1, visiblePeak, requiredReference) * 1.1)` with four to five
integer tick intervals selected from `1, 2, 5 × 10^n`. A zero-only chart uses
`0..1` unless its view defines a dedicated empty state.

Ratings Mix and Topic Performance use the full `0%..100%` domain.

### Retention Map logarithmic X domain

View 6 includes only finite positive target-duration values. The lower bound is
the power of ten at or below the smallest visible value; the upper bound is the
power of ten at or above the largest visible value. The seven-day benchmark is
always included. Ticks use useful powers of ten plus the directly labelled
seven-day reference; redundant ticks may be removed at narrow widths.

## Chart/Table parity

Each of the eight chart-based views provides native **Chart** and **Table** tabs
with one labelled tablist and one selected tab. The Table is not hidden screen-
reader-only content; it is a visible exact-value alternative.

- Both tabs consume the same Zod-validated presentation model.
- Neither tab recalculates metrics, eligibility, ranking, classification, or
  thresholds.
- Names, units, precision, status, ordering, and row identity match.
- Switching tabs moves focus to the selected tab, not into the panel body.
- The selected tab persists across range refreshes during the page session.
- Range changes reset table pagination to page one and announce the new range.
- Default table pagination is seven rows. View 5 has at most five rows and no
  pagination; View 7 uses five rows per page.
- Tables use captions, scoped column headers, row headers where appropriate,
  right-aligned tabular numeric cells, and native buttons for pagination.
- A table may scroll horizontally only inside its card. The page itself must
  not gain horizontal scroll.

View 7 is intentionally table-native and therefore has no decorative Chart tab.

For View 6, the presentation cohort is the deterministically retained maximum
of 30 problems. Both Chart and Table use those exact retained rows. The three
status counts and `showing 30 of N` disclosure use the full eligible cohort.

## Tooltip and point-detail contract

Ordinary chart tooltips are transient inspection aids:

- hover, touch activation, and arrow-key focus expose the same content;
- the first line is a full date, bucket range, or category name;
- values follow Table names, units, precision, and order;
- ratios include numerator and denominator or an eligible sample;
- unknown values say `Not measured`;
- tooltips contain no required action and are never the exhaustive value path;
- motion respects `prefers-reduced-motion`.

Retention Map is the sole exception. Its linked problem detail is an
interactive non-modal popover/dialog, not an ARIA tooltip. Its complete
interaction is specified in View 6.

## Shared accessibility contract

Every chart must provide more than Recharts' accessibility layer:

- a visible learner question and concise metric definition;
- one chart name and described-by summary containing scope, units, active
  domains, references, and evidence status;
- one chart tab stop, not one tab stop per SVG mark;
- Left/Right arrows for ordered time/category views and a documented logical
  arrow order for the scatter plot;
- polite live announcement of the active datum without duplicate announcements;
- a visible semantic Table alternative;
- color-independent series/status meaning through mark type, line style,
  direct label, pattern, or shape;
- visible focus, sufficient text/non-text contrast, and forced-colors support;
- no essential hover-only interaction;
- no auto-playing, looping, or decorative animation;
- unanimated charts under reduced motion;
- full operation at 200% zoom and reflow without page-level two-dimensional
  scrolling at 400% zoom; localized table/plot overflow is allowed only when
  preserving the data relationship requires it.

Touch activation shows a datum without requiring hover. A second activation or
outside interaction dismisses transient inspection. The exact table remains
the primary mobile accessibility fallback when dense mark selection would be
unreliable.

## Reusable chart-quality checklist and score

Every future Analytics view is reviewed on the following 18 categories:

1. learner question;
2. supported decision or interpretation;
3. mark suitability and rejected alternatives;
4. formula and unit;
5. source lineage;
6. cohort and exclusions;
7. aggregation and weighting;
8. range, bucket, timezone, and partial-period meaning;
9. comparator and reference;
10. missing, zero, and unknown semantics;
11. evidence gate and sample disclosure;
12. takeaway and suppression rule;
13. axes, domains, ticks, labels, and legend;
14. tooltip or detail interaction;
15. exact-value table parity;
16. keyboard, screen-reader, color-independent, and motion behavior;
17. responsive and zoom behavior;
18. contract, builder, rendering, and human visual tests.

Score each category:

- `0`: absent, misleading, or untestable;
- `1`: present but incomplete or dependent on convention;
- `2`: explicit, truthful, and testable.

A design passes at 30/36 or higher only when categories 4–6, 10–11, 15–16,
and 18 each score `2`. A misleading claim or fabricated evidence fails the
view regardless of total. The nine contracts below are design-locked at 18/18
categories (36/36). This is **100% design lock**, not implementation progress.

## Component ownership and data flow

Preserve the dependency direction:

```text
entrypoints -> app -> features -> platform/lib/components
```

### Ownership

- `src/app` owns route and dashboard page composition.
- `src/features/analytics/server` performs one read/composition pass over local
  review history, problem metadata, and current FSRS card data.
- `src/features/analytics/domain` owns eligibility, replay provenance,
  bucketing, aggregation, evidence, ranking, scale inputs, and presentation
  builders.
- `src/features/analytics/api` owns Zod request and response contracts across
  the extension runtime boundary.
- `src/features/analytics/components` owns page sections and explicit view
  components. Shared presentation layers exist only when mounted by those
  components.
- `src/components/ui/chart.tsx` owns only generic local Shadcn/Recharts
  primitives: container, semantic config, tooltip/legend primitives, responsive
  measurement, and common accessibility wiring.
- `src/lib/fsrs` remains the only package-facing FSRS adapter.
- `src/lib/leetcode/domain/problem-url.ts` remains the canonical problem URL
  builder.

Analytics UI never reads SQLite, imports the FSRS package, replays cards,
calculates a metric, or ranks rows.

### Presentation flow

```text
SQLite review attempts + problem metadata + current FSRS cards
  -> Analytics repository/service inputs
  -> pure feature-owned metric/evidence builders
  -> one serialized, Zod-validated Analytics presentation model
  -> AnalyticsScreen story composition
  -> explicit Recharts chart or semantic table over feature-owned rows
```

The response includes the selected range, evidence state, and nine named view
models. Each historical row includes stable identity, exact bounds, source
status, evidence counts, and raw values. Formatting remains a presentation
concern, not serialized prose.

### Presentation metadata

Keep only metadata a mounted chart consumes: its accessible identity, metric
meaning, series names, exact-value fields, and any interpretation warning.
Feature components may share that small semantic metadata, but a generic
renderer and a parallel full catalogue are out of scope.

### Provenance capture boundary

Current View 1 and View 2 history may replay persisted FSRS review logs using
current code/options. Such values must be labelled `Reconstructed` and include
model/settings provenance when known.

Future immutable capture of pre-review retrievability, post-review stability,
FSRS version, or settings belongs to the Practice write path and schema—not to
Analytics, which stays read-only. Existing history is never backfilled as if a
replayed scalar had been captured at review time. The first implementation may
ship the honest reconstructed path; immutable capture is a separately reviewed
schema phase.

## Shared loading, error, stale, and empty behavior

- Route loading uses one stable skeleton matching the final page hierarchy.
- A route/API/Zod failure shows a concise alert and Retry; it never renders
  partially parsed data.
- A single figure calculation failure is represented in its validated view
  state and does not hide independent figures.
- Refresh keeps the last validated page visible only when the data is labelled
  with its prior `asOf` and a non-blocking `Refreshing` state.
- Empty state copy states what is absent and what scope was checked; it does not
  promise future recall or prescribe more volume.
- Partial or reconstructed evidence stays visible with qualification.
- Retry controls are native buttons with visible focus and announced results.

## Responsive and visual-system contract

Use Terra Compact rather than generic dashboard styling:

- existing dark tonal surface layers and semantic Analytics tokens;
- Nunito Sans for UI/data and Literata only for high-level editorial titles;
- 12px gaps for related content and 16px gaps for distinct cards;
- 16px card radii and compact approximately 40px table rows;
- tabular numerals for all metrics;
- the existing 12-column desktop and 4-column mobile grid;
- early pair stacking, no page-level horizontal overflow, and no clipped
  tooltips or focus rings.

Green, amber, red/pink, lines, regions, and hatches must be named semantic
tokens. A component must not invent positional `chart-1` colors or use color as
the only state encoding.

## View 1 — Observed Recall vs FSRS Estimate

### Question and meaning

**Question:** “How did recalled review outcomes compare with the FSRS estimate?”

This view compares a rating-derived recalled outcome with FSRS retrievability
immediately before those exact reviews. It is not an independent correctness
test, first-try result, or formal calibration analysis.

### Metric contract

- Eligible pair: a persisted review with a valid Again, Hard, Good, or Easy
  rating and a finite reconstructed or captured pre-review retrievability in
  `0..1`.
- Observed recalled share:
  `(Hard + Good + Easy) / eligible paired reviews`.
- FSRS estimate: arithmetic mean of pre-review retrievability across those same
  pairs.
- Difference: observed recalled share minus mean estimate, in percentage
  points.
- `Again` is the rating-derived no-recall outcome.
- Good + Easy does not appear in this figure; Review Success belongs to Views 3
  and 5.

### Presentation

- Two lines with distinct colors, line treatments, and measured markers;
  target-retention reference line.
- Historical default buckets and adaptive percentage domain across both series
  and the target.
- Solid adjacent measurements, dashed permitted short gaps, long gaps broken.
- Tooltip: bucket, recalled count and paired reviews, observed recalled share,
  mean FSRS estimate, signed difference, provenance, evidence, partial state.
- Table: Bucket, Recalled, Paired reviews, Observed recall, FSRS estimate,
  Difference, Provenance, Evidence. Seven rows per page.
- Neutral takeaway when unsupported: “Measured recalled outcomes and the FSRS
  estimate are shown for the available paired reviews.”
- Empty state: “No reviews in this period have both a valid rating and an FSRS
  estimate.”

At narrow widths keep both series and target visible, reduce date ticks before
removing labels, and move the legend below the plot. Keyboard order is
chronological.

### Claim boundary and tests

Say “above/below the reconstructed estimate in this sample.” Never say the
learner is better or worse than FSRS, calibrated, more able, or guaranteed to
remember.

Test pairing, finite-range validation, Again-only measured zero, aggregate-
first ratios, provenance, missing/zero, all ranges, DST and partial today,
adaptive domain, continuity, evidence suppression, tooltip/table parity,
pagination, keyboard announcements, reduced motion, and narrow layout.

## View 2 — Memory Strength

### Question and meaning

**Question:** “Are your reviewed memories staying strong for longer?”

Higher means FSRS estimates that the memories reviewed in that bucket will
remain retrievable for longer after review. It does not describe a whole-
library score or guarantee recall.

### Metric contract

- One observation per eligible completed review event with a valid finite
  positive post-review FSRS stability.
- Value: median post-review stability in days.
- Distribution: Q1 and Q3 using Tukey hinges over sorted event values; show the
  IQR only with at least four observations in the bucket.
- Change: median of each event's `postReviewStability - preReviewStability`
  when both values are valid; do not subtract independently aggregated medians.
- Repeated reviews of one memory contribute as separate review outcomes.
- Current replayed values are labelled Reconstructed; future captured values
  retain their capture provenance.

### Presentation

- Median line with measured markers and a restrained IQR band when supported.
- Adaptive duration domain including every visible median and IQR bound.
- Tooltip: bucket, median strong-memory duration, IQR when present, eligible
  reviews, median per-event change when supported, provenance, partial state.
- Table: Bucket, Median strength, Middle 50%, Eligible reviews, Median change,
  Provenance, Evidence. Seven rows per page.
- Empty state: “No valid post-review FSRS stability is available in this
  period.”
- Neutral takeaway: “The typical reviewed memory was expected to stay strong
  for approximately {value} days after review.” Directional wording requires
  the trend gate.

Hide the band before compressing the plot at narrow widths, but retain its exact
values in the Table. Keyboard order is chronological.

### Claim boundary and tests

Do not call this correctness, current recall, personal ability, guaranteed
memory, or proof that the learner improved.

Test replay/capture provenance, eligibility, Tukey hinges, four-observation IQR
gate, median per-event delta, missing buckets, all ranges, adaptive duration
domain, continuity, evidence, table parity, pagination, keyboard, motion, and
responsive states.

## View 3 — Practice Rhythm

### Question and meaning

**Question:** “When you practiced more or less, how did Review Success move?”

This view shows whether heavier or lighter practice coincided with more
comfortable review outcomes. It reports association only; it does not calculate
a correlation coefficient or claim that volume caused the outcome.

### Metric contract

- Completed reviews: count persisted attempts with a valid Again, Hard, Good,
  or Easy rating.
- Review Success: `(Good + Easy) / valid ratings` in the same bucket.
- Each attempt has equal weight.
- Aggregate counts first, then derive the percentage.
- A known empty bucket has Completed reviews `0` and Review Success `null`.
- A bucket whose underlying history is unavailable has both metrics Not
  measured; it is not a zero-practice day.

### Presentation

- Composed chart with zero-based count bars and a measured Review Success line
  on a separately labelled adaptive percentage axis.
- Tooltip: Bucket, Completed reviews, Review Success, Good + Easy as
  `{numerator} of {denominator}`, Evidence, partial state.
- Table: Bucket, Completed reviews, Good + Easy, Review Success, Evidence.
  Seven rows per page.
- Visible note: “Association, not causation.”
- Neutral takeaway: “Review volume and Review Success are shown together for
  this period.”
- Empty state: “No valid review ratings are available in this period.”

Both axes and active domains appear in the accessible description. Marks differ
by shape as well as color. At narrow widths preserve both axes, reduce date
ticks to at most four, and keep overflow inside the figure.

### Tests

Test formula and aggregate-first behavior, invalid ratings, known-zero versus
unknown history, all ranges, partial buckets, both domain helpers, continuity,
evidence suppression, tooltip/table parity, pagination, keyboard description,
reduced motion, and responsive states.

## View 4 — Ratings Mix

### Question and meaning

**Question:** “How is the balance of your review ratings changing?”

Again means forgotten; Hard means recalled correctly but with difficulty; Good
means expected recall; Easy means easier than expected. Hard + Again may be
called challenging reviews, not failures or incorrect answers.

### Metric contract

- Count each valid rating once per presentation bucket.
- Divide Again, Hard, Good, and Easy counts by total valid ratings.
- Aggregate counts before shares.
- A measured category may be zero inside a non-empty bucket.
- A bucket with no valid ratings is Not measured and has no stack; it is not an
  equal split.

### Presentation

- 100% stacked columns in stable Again, Hard, Good, Easy order on `0..100%`.
- Tooltip: bucket, each category in stack order with count and share, valid
  ratings, partial state. Do not add challenging reviews to the tooltip.
- Table: Bucket, Again, Hard, Good, Easy, Valid ratings, Challenging reviews,
  Evidence. Each rating cell contains count and percentage. Seven rows per
  page.
- Period context: selected-period Hard + Again count/share, displayed to the
  shared precision. Previous direction appears only when both periods qualify.
- Empty state: “No valid review ratings are available in this period.”
- Safe takeaway: “This period's rating mix is based on {n} valid ratings.”

The chart uses category order, text, and accessible announcements in addition
to color. Independently rounded labels may total 99% or 101%; do not falsify a
category to force a displayed 100%.

### Tests

Test eligibility, aggregate-first shares, exact totals, per-category zeros,
empty composition, rounding, ranges, equivalent elapsed comparison, tooltip/
table parity, pagination, semantic order, keyboard description, motion, and
responsive states.

## View 5 — Topic Performance

### Question and meaning

**Question:** “Which sufficiently practiced topics had lower Review Success?”

This is a selected-period focus ranking, not a topic mastery score.

### Metric contract

- Topic Review Success: `(Good + Easy) / valid ratings` attributed to the
  topic.
- One attempt contributes at most once to each unique normalized topic attached
  to its problem.
- A multi-topic attempt may contribute to multiple rows; samples overlap and
  are not additive.
- A topic qualifies with at least 10 valid ratings across at least 3 distinct
  reviewed problems in the selected period.
- Sort by Review Success ascending, valid ratings descending, then normalized
  topic label ascending.
- Retain the lowest five qualifying topics. If only one to four qualify, show
  those rows; if none qualify, show the empty state.

### Presentation

- Horizontal bars on a full `0..100%` axis with exact end labels.
- Chart and Table use the same up-to-five rows; no pagination.
- Tooltip: Topic, Review Success, Good + Easy, Valid ratings, Distinct reviewed
  problems, Selected period, Evidence.
- Table: Topic, Review Success, Good + Easy, Valid ratings, Distinct problems,
  Evidence.
- Under the figure, state the count of stronger qualifying topics omitted.
  Show progress for at most five low-evidence topics and move the remaining
  count/details into the calculation disclosure.
- Empty state: “No topic has at least 10 valid ratings across 3 reviewed
  problems in this period.”
- Takeaway: “Showing the qualifying topics with the lowest Review Success in
  this period.”

Use one stable bar treatment; color does not imply risk bands. Preserve full
topic names in accessible text and Table. At narrow widths, wrap or visually
truncate plot labels only when the full accessible name remains available.

### Claim boundary and tests

Do not call the ranking independent correctness, mastery, a diagnosis, a
non-overlapping distribution, or proof of ability.

Test Good + Easy aggregation, topic de-duplication, overlapping attribution,
problem breadth, both gates, deterministic ties, zero through five qualifying
rows, omitted/low-evidence disclosure, all ranges, partial periods, parity,
long labels, keyboard navigation, motion, and responsive states.

## View 6 — Retention Map

### Question and meaning

**Question:** “Which active memories are below target, and how durable are
they?”

Each point is one active reviewed problem. Higher means FSRS predicts a greater
chance of recalling it now. Farther right means its current FSRS memory state
supports a longer total interval after review before crossing the configured
recall target.

The X value is **total target-crossing duration**, not remaining time above
target and not the stored due interval. A below-target problem may still have a
positive target-duration value because that duration describes the memory
state's full target interval after review. Stored `dueAt` remains the
authoritative product schedule.

### Metric and cohort

- Full eligible cohort: active, non-suspended problems with at least one review,
  finite current retrievability in `0..1`, a finite target where
  `0 < target < 1`, and a finite positive target duration.
- Current retrievability is evaluated at the shared exact `asOf`.
- Target duration is obtained by solving the same FSRS forgetting curve used by
  the feature's FSRS adapter for the elapsed duration at which retrievability
  equals the configured target. Domain code owns this helper; UI never
  approximates it.
- Invalid or non-positive target duration is Not measured and excluded from the
  plotted cohort, never coerced onto the log axis.

Full-cohort statuses are:

- **On target now:** `R >= target`;
- **Watch:** `max(0, target - 0.10) <= R < target`;
- **Needs attention:** `R < max(0, target - 0.10)`.

The plot and table retain at most 30 rows using one deterministic total order:

1. Needs attention before Watch;
2. Watch before on-target rows below the 7-day benchmark;
3. on-target rows below 7 days before on-target rows at or above 7 days;
4. within a tier, larger target shortfall first;
5. then shorter target duration;
6. then normalized title ascending.

Summary counts always describe the full eligible cohort. When capped, disclose
`Showing the 30 highest-priority problems of {N} eligible`.

### Plot and regions

- Scatter plot, logarithmic target-duration days on X, adaptive current recall
  on Y.
- Horizontal configured target and ten-point watch band immediately below it.
- Recall deeper than ten points below target is the red risk row.
- Fixed vertical **1-week durability benchmark** at seven days. It is an
  operational product reference, not an FSRS scientific threshold or user goal.
- Six directly labelled regions:
  - on target + at least 7d: **Strongest position**;
  - on target + below 7d: **On target now**;
  - watch + at least 7d: **Near target, more durable**;
  - watch + below 7d: **Watch closely**;
  - deep risk + at least 7d: **Needs attention**;
  - deep risk + below 7d: **Highest attention**.
- Healthy row uses light green left/strong green right; watch row uses stronger
  amber left/lighter amber right; risk row uses stronger red left/lighter red
  right.
- Use circle for On target now, diamond for Watch, triangle for Needs attention.
  Region labels, shapes, and Table text make color redundant.
- Do not add direct problem labels, a cohort average, median line, personalized
  durability threshold, selector, or forgetting curve.

### Interactive detail

Hover or chart focus opens the same compact transient detail. It remains open
while the point or detail contains pointer/focus. A 150ms delayed exit bridges
the pointer gap; once the pointer leaves the detail, the transient surface
closes.

Click or Enter/Space toggles pinning. Activating an unpinned point pins it;
activating the same pinned point closes it; activating another moves the pin.
Pinned detail dismisses through its shadcn-style ghost close button, Escape,
outside interaction, or the same-point toggle. Escape restores focus to the
point.

The surface is a non-modal interactive popover/dialog with:

- linked full problem title opening the canonical LeetCode URL safely in a new
  tab;
- current status;
- current recall;
- time above target;
- signed target gap; and
- last reviewed.

Do not show the slug. Difficulty, lapses, and due context remain in the Table.

### Exact table and navigation

Table columns: Rank, Problem, Current recall, Target, Target gap, Time above
target, Last reviewed, Due, Difficulty, Lapses, Status. Use the exact retained
maximum 30 rows, seven rows per page, reset on cohort rebuild, and contain
horizontal overflow inside the card.

Scatter keyboard order follows retained rank, not screen geometry. Arrow keys
advance or reverse that deterministic order and live announcements include
problem, status, current recall, target duration, and region. Touch activation
uses the same pin toggle.

### Empty state, claim boundary, and tests

Empty state: “No active reviewed problems have enough current FSRS data for the
Retention Map.”

This is current model-estimated memory health, not observed recall, a diagnosis,
a due queue, a guarantee, or a claim that seven days is universally optimal.

Test target-duration derivation against the FSRS adapter, log eligibility,
status equality boundaries, target-minus-ten boundary, seven-day equality,
deterministic retained order/cap, full counts, all six regions, adaptive Y/log
X domains, shapes and forced colors, transient/pinned lifecycle, 150ms exit,
same-point toggle, focus restoration, safe link, table parity/pagination,
empty state, touch, zoom, reduced motion, and narrow layout.

## View 7 — Memory Signals by Problem

### Question and meaning

**Question:** “Which current problems need attention, and exactly why were they
flagged?”

This table is the exact diagnostic partner to Retention Map. It does not use a
composite score.

### Qualification and ordering

An active, non-suspended reviewed problem qualifies when at least one supported
signal is true at `asOf`:

- current recall is below its configured target;
- `dueAt < asOf`; or
- target duration is below seven days.

Evaluate each signal only when its source exists. Difficulty and lapse count do
not qualify a row. A row with multiple signals names every true reason.

Order by transparent severity lanes:

1. below-target rows by target shortfall descending;
2. remaining overdue rows by overdue duration descending;
3. remaining low-durability rows by target duration ascending;
4. normalized title ascending for remaining ties.

A multi-signal row occupies its highest lane. Retain the first 25; ranks remain
1–25 across pages. Full qualifying count remains visible.

### Day semantics and presentation

`dueAt === asOf` is due now, not overdue. For an overdue date on the same local
calendar day, display `Overdue today`; otherwise display the count of crossed
local date boundaries as `{n}d overdue`. This avoids DST-sensitive millisecond
division.

Use exactly three columns: Rank, Problem, Why it's here. The full problem title
is the canonical LeetCode link. Reasons are compact, text-labelled,
value-bearing treatments such as `Below recall 57%`, `8d overdue`, and
`Low durability 0.9d`, wrapping to at most two lines.

Show five rows per page with labelled Previous/Next buttons and a polite visible
range announcement. Reset on cohort rebuild. Do not add a Chart tab, tooltip,
search, filters, sorting, row selection, or a competing row action.

Empty state: “No current problems meet these attention signals.” This is not a
guarantee about future recall.

### Tests

Test each signal and equality boundary, unavailable sources, simultaneous
signals, local overdue-day labels across DST, range independence, severity
lanes, deterministic ties, 25-row cap, full count, persistent ranks, five-row
pagination/reset, empty state, safe linked title, semantic table, two-line
responsive state, and absence of sorting/composite scoring.

## View 8 — Recent Overdue Backlog

### Question and meaning

**Question:** “Is my overdue backlog staying at an acceptable level instead of
accumulating?”

Each observation is the number of active, non-suspended problems overdue at
that time. It is a stock, not a flow; daily values are never summed.

### Reconstruction and range

- Reconstruct known due intervals from persisted FSRS review-log snapshots,
  current card state, creation time, and `asOf`.
- For a past local date, observe immediately before the next local date begins.
- For today, observe at `asOf` and label In progress.
- A problem is overdue at an observation when its known due instant precedes
  the observation and no later review has cleared that interval.
- If complete state cannot be reconstructed for a day, keep the date row as Not
  measured and break the line.
- Use one local-day row for all 14, 30, and 90-day selections; change tick
  density only.

### Presentation

- Daily step line with truthful zero baseline.
- Fixed five-problem product watch zone.
- Green line/region at or below five; yellow line/region above five. Split line
  segments exactly at threshold crossings. No permanent point markers; show a
  temporary marker only during inspection.
- Direct region labels: Within watch zone and Above watch zone.
- Summary: known days within zone, current known backlog, known peak, and known
  days out of selected days.
- Tooltip only: full date, Overdue problems, and In progress for today. Do not
  show daily change or status.
- Table: Date, Overdue problems. Seven rows per page. Unknown is Not measured.
- Empty state when all days are unknown: “Historical overdue backlog could not
  be reconstructed for this period.” A known all-zero series remains a valid
  measured chart.

Use the shared zero-based nice count domain with five included as a reference.
Suppress grew/shrank language unless two comparable known observations exist.
At narrow widths preserve every daily row, reduce ticks, then hide optional
in-plot region labels before essential threshold labelling.

### Claim boundary and tests

The five-problem threshold is a CogniPace watch zone, not an FSRS or scientific
boundary. Do not claim why backlog changed.

Test reconstruction, observation instants, active/suspended state, interval
clearing, missing days, partial today, daily 14/30/90 rows, threshold equality
and crossings, green/yellow clipping, zero baseline/nice upper bound, all-zero
versus all-unknown, known-day summaries, minimal tooltip, parity, pagination,
keyboard inspection, motion, and responsive ticks.

## View 9 — Upcoming Review Load

### Question and meaning

**Question:** “What review work is currently scheduled for the next 14 days?”

This is a current schedule snapshot, not a guarantee. Reviews, scheduling
changes, and time passing can change every bar.

### Cohort and grouping

- Include active, non-suspended FSRS cards with a valid finite `dueAt` before
  the forecast end, regardless of learning/review state.
- Group already overdue cards only into today's Overdue segment.
- Group `asOf <= dueAt < startOfTomorrow` into today's Due segment.
- Group later cards by local due date through day 13.
- Do not repeat an overdue card on future dates.
- Always return 14 chronological rows, including explicit zeros.
- The historical range control does not change this view.

### Presentation

- One zero-based stacked magnitude column per day.
- Due is solid green. Overdue is pink/red with restrained diagonal hatching.
- Tooltip exactly: full Date, Due, Overdue, in that order; prefix today's date
  with Today and keep zero rows visible.
- Table exactly: Date, Due, Overdue. Date is the row header; counts are
  right-aligned. Seven rows per page.
- Preserve Today and endpoint axis ticks. Upper bound uses the tallest stacked
  total and the shared nice count helper.
- All-zero plot state: “No reviews are currently scheduled in the next 14
  days.” The Table remains available with its exact 14 zero rows.

One chart tab stop and Left/Right chronological inspection announce Date, Due,
and Overdue. Columns are unanimated. Pattern, legend labels, tooltip order, and
Table make color redundant.

### Tests

Test half-open forecast bounds, equality at `asOf`, local-day grouping,
suspended exclusion, all FSRS schedule states, today plus 13 days, historical-
range independence, overdue only under Today, later-today separation, explicit
zero rows, stack totals, zero/nice domains, minimal tooltip, parity,
pagination/reset, solid/hatch distinction, all-zero state, one tab stop,
arrows/live announcements, table headers, reduced motion, and responsive ticks.

## Cross-view empty, partial, and error acceptance

The implementation is acceptable only when these combinations are verified:

- no review history but a valid future schedule;
- sparse history with current-state cards;
- one measured point;
- measured zero versus missing value;
- internal short gap and long gap;
- partial today;
- reconstructed FSRS evidence;
- zero qualifying topics;
- more than 30 Retention Map candidates;
- more than 25 Memory Signals candidates;
- all unknown backlog history;
- all-zero upcoming schedule;
- API/Zod failure and successful retry;
- refresh while last validated data remains visible.

Independent current-state and forecast views remain useful when historical
evidence is insufficient.

## Migration and refactor strategy

This is a design sequence, not the implementation plan:

1. Freeze current behavior with focused tests and add fixtures for every
   current-to-target semantic change.
2. Introduce only the shared date/domain helpers and response contracts that
   have a live consumer.
3. Correct metric builders and runtime contracts before changing labels.
4. Migrate the historical views and Chart/Table parity.
5. Build Retention Map and Memory Signals from one current-state source model.
6. Replace workload views with the locked daily-backlog and fixed-forecast
   contracts.
7. Update product, architecture, testing, and visual authority docs to shipped
   behavior; remove obsolete components and duplicate definitions only after
   all consumers move.
8. Treat immutable FSRS provenance capture as a separately approved Practice
   schema phase if included.

Do not preserve old serialized field names when they imply old semantics. Use a
contract version or coordinated runtime migration so background and dashboard
cannot silently disagree.

If a schema phase adds provenance fields, it must cover Drizzle migration and
fingerprint behavior, local-reset risk, Practice repository ownership,
backup/restore compatibility, and Gist-sync compatibility. Analytics itself
remains read-only.

## Verification contract for implementation

### Automated

Run focused tests before the full validation set. Coverage must include:

- pure formulas, denominators, aggregation order, ranking, and qualification;
- local date, timezone fallback/change, DST, half-open bounds, and partial time;
- evidence gates, sparse continuity, zero/null, and provenance;
- Zod acceptance/rejection and runtime serialization;
- domain helpers for adaptive, count, and logarithmic scales;
- chart/table row parity and formatting parity;
- loading/error/refresh/empty/partial states;
- keyboard, live-region, focus restoration, touch, forced colors, and reduced
  motion;
- pagination and range/cohort reset;
- responsive, 200% zoom, and 400% reflow fixtures.

Required future visible-dashboard validation:

```sh
npm run lint
npm run check
npm run build
```

If implementation changes persistence or schema, also run:

```sh
npm run db:generate
npm run db:check
```

### Human extension smoke proof

Before PR review or merge, a human engineer must run happy-path and edge-case
Chrome-extension smoke tests and attach screenshots or a recording:

1. open Analytics with representative local history;
2. verify every historical view at 14, 30, and 90 days;
3. confirm exact range, timezone, partial today, and View 8's daily exception;
4. switch each chart between Chart and Table and verify exact parity;
5. inspect each tooltip with pointer, keyboard, and touch-equivalent input;
6. operate Retention Map transient and pinned detail, same-point toggle,
   Escape/outside/close dismissal, focus restoration, and LeetCode link;
7. paginate Retention Map, Memory Signals, backlog, and load tables;
8. verify empty, sparse, zero, missing, reconstruction, and error states;
9. verify light/dark or supported themes, grayscale/forced colors, narrow width,
   200–400% zoom, and reduced motion;
10. confirm Overview and Analytics do not duplicate recommendations or queue
    behavior.

Exact commands run, commands skipped with reasons, remaining risk, and human
proof must be recorded in the eventual PR handoff.

## Deferred analytics

The chart system may support these later, but this design does not implement or
claim them:

- independently captured first-try recall;
- retry, hint, or repeated-attempt analysis;
- formal FSRS calibration;
- lapse cost and recovery speed;
- schedule discipline and lateness association;
- personalized preparedness/readiness;
- scenario workload simulation;
- topic or problem drill-down pages;
- a personalized durability goal.

Each future metric must pass the same 18-category checklist with a real data
contract before it enters Analytics.

## Supersession matrix

| Older decision                                                | Status here                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| First-try Recall Quality                                      | Rejected until first-attempt evidence exists                              |
| Persisted correctness as View 1 counterpart to FSRS           | Replaced by paired rating-derived recalled share                          |
| Consistency scatterplot                                       | Replaced by composed Practice Rhythm bars + Review Success line           |
| Correctness/composite Weakest Topics                          | Replaced by gated Review Success Topic Performance                        |
| Retention Health days-since-review X axis                     | Replaced by Retention Map target-duration log X axis                      |
| Above/Approaching/Below labels                                | Replaced by On target now/Watch/Needs attention with six labelled regions |
| Difficulty/lapses as independent Fragile Knowledge qualifiers | Rejected; retained only as Retention Map table context                    |
| Generic 3-day/weekly backlog aggregation                      | Replaced by daily View 8 rows for all ranges                              |
| Backlog tooltip status and daily change                       | Removed                                                                   |
| Upcoming-load scenario projections                            | Deferred                                                                  |
| Leading-empty visual trimming                                 | Rejected; selected-period rows and bounds remain truthful                 |
| Generic learner “readiness” framing                           | Replaced by evidence sufficiency                                          |
| Universal chart renderer                                      | Rejected in favor of explicit view components                             |

## Traceability appendix

### Guidance classification

- **Directly source-backed guidance:** Shadcn is locally owned composition over
  Recharts; accessible charts require text equivalents and semantic tables;
  color cannot be the sole carrier of meaning; interactive linked content is
  not an ARIA tooltip; keyboard, focus, reflow, contrast, and reduced-motion
  behavior require explicit treatment.
- **CogniPace-specific design inference:** the question-led page hierarchy,
  evidence-sufficiency presentation, adaptive domain helpers, and explicit
  feature chart components apply that guidance to this repository's local-first
  data and Terra Compact design system.
- **Explicit approved product decisions:** the nine metrics and formulas,
  14/30/90 behavior, five-problem backlog watch zone, seven-day durability
  benchmark, Retention Map six-region treatment and 30-row cap, Memory Signals
  25-row cap, exact tooltip fields, and fixed 14-day forecast are CogniPace
  product rules. They are not presented as scientific or library defaults.

### Decision sources

- Current product authority: `docs/product.md`
- Current architecture authority: `docs/architecture.md`
- Current testing authority: `docs/testing.md`
- Visual authority: `design.md`
- Workflow authority: `docs/agent-governance.md`

### External guidance informing the system

- [Shadcn Chart documentation](https://ui.shadcn.com/docs/components/chart)
- [Recharts documentation](https://recharts.github.io/en-US/)
- [Shadcn UI best-practices article reviewed during discovery](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI complex images guidance](https://www.w3.org/WAI/tutorials/images/complex/)
- [WAI tables tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [ARIA Authoring Practices tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
- [ARIA Authoring Practices dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Storytelling with Data chart guide](https://www.storytellingwithdata.com/chart-guide)
- [Highcharts data-visualization accessibility guidance](https://www.highcharts.com/article/10-guidelines-for-dataviz-accessibility/)
- [A11Y Collective accessible-chart checklist](https://www.a11y-collective.com/blog/accessible-charts/)
- [Tableau visualization best practices](https://www.tableau.com/visualization/data-visualization-best-practices)
- [Sisense dashboard design guidance](https://docs.sisense.com/main/SisenseLinux/dashboard-design-best-practices-creating-effective-visualizations.htm)
- [FSRS algorithm documentation](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)
- [`ts-fsrs` documentation](https://github.com/open-spaced-repetition/ts-fsrs)

### Design completion

- Shared system contracts: locked.
- View contracts: 9/9 locked.
- Chart-quality checklist coverage: 18/18 for every view.
- Implementation: not started by this specification.
- Implementation plan: `docs/superpowers/plans/2026-08-22-analytics-dashboard-system.md`.
