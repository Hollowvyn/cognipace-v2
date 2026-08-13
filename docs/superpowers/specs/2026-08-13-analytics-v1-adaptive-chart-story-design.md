# Analytics V1 Adaptive Chart Story Design

## Status

Approved in product discussion on 2026-08-13. This design refines the visual
story, range behavior, chart interactions, and pagination of the Analytics V1
implementation described in
`2026-08-13-analytics-v1-shadcn-charts-design.md`.

The interactive companion is available locally at:

```text
.superpowers/brainstorm/34067-1786634654/content/analytics-story-v2.html
```

The companion demonstrates presentation and interaction intent. Production
implementation must use the existing shadcn Chart/Recharts foundation and real
Analytics contracts rather than the companion's illustrative data.

## Goal

Make Analytics read as one calm learning story instead of a collection of
unrelated technical reports. The page should answer, in order:

1. How is my recall changing?
2. How did my practice rhythm and review behavior move with it?
3. Where should I focus, and is my memory becoming more durable?
4. Is overdue work under control, and what work is coming?
5. Which individual memories need attention now?

The feature remains local-first, read-only, and dashboard-only. It does not add
accounts, hosted analytics, backend services, sync behavior, or Chrome
permissions.

## Approved page hierarchy

### Selected-period summary

Keep a compact summary row above the charts. Values that describe historical
behavior must respect the selected 14-, 30-, or 90-day range. All-time or
current-state values must be labelled explicitly and must not imply that they
changed with the selected range.

### Recall quality

Recall Quality is the full-width primary chart. It compares:

- observed correctness from eligible persisted assessments
- FSRS-predicted recall immediately before reviews
- configured target retention

The chart header includes a compact latest observed value and a comparison with
the previous comparable period when both samples are sufficient. Supporting
values below the chart show latest observed correctness, latest predicted
recall, and eligible sample size.

Observed and predicted values remain explicitly distinct. Predicted recall is
a model estimate, not an observed result or guarantee. Missing observations
render as gaps and are never converted to zero.

### Practice rhythm and ratings mix

Practice Rhythm is a Recharts `ComposedChart`:

- bars show review count per presentation bucket
- a line shows observed correctness per bucket
- count and percentage use separate, clearly labelled axes

The copy describes the relationship as an association and never claims that
practice frequency caused the performance change. A bucket with reviews but no
eligible correctness observations keeps its bar and leaves a gap in the line.

Ratings Mix is a 100% stacked bar chart. Colors remain stable and semantically
distinct:

- Again: red
- Hard: amber
- Good: teal
- Easy: light green

Every non-empty bucket totals 100%. Empty buckets remain empty. The panel keeps
the selected-period Hard + Again share and comparable-period direction as its
main takeaway.

### Where to focus and memory strength

Where to Focus displays the five weakest sufficiently sampled topics as ranked
horizontal bars. Tooltips include observed correctness and eligible sample
size. Topics below the minimum sample threshold are qualified separately and
are not confidently ranked as weak.

Memory Strength uses a restrained line chart for median FSRS stability in
days. It does not use an exaggerated smoothed area. Missing buckets create gaps
rather than artificial drops.

### Workload

Recent Overdue Backlog is a continuous line chart because backlog is state over
time rather than a collection of independent daily events.

- values at or below five use a green line and soft green area
- only values above five use a yellow line and soft yellow area
- a dashed reference line labels the five-problem watch threshold
- tooltips show the bucket, overdue count, and threshold status

Historical backlog continues to use reconstructed historical state. The chart
must not fabricate history from the current overdue count.

Upcoming Review Load remains a forward-looking 14-day chart at every selected
historical range. Its title and description must make that fixed forecast
horizon explicit so 30- and 90-day selection does not imply a longer forecast.

### Retention health and fragile knowledge

Retention Health presents a compact distribution of active problems by days
since review and current FSRS-predicted retrievability. Summary counts for
Above target, Approaching, and Below target use the same category definitions
and colors as the plot.

Hovering or focusing a problem point shows its plain-English details. Clicking
a point pins the tooltip. The pinned tooltip includes an **Open on LeetCode**
action that:

- uses `createLeetCodeProblemUrl(slug)`
- opens the canonical problem URL in a new tab
- uses `rel="noopener noreferrer"`
- remains keyboard operable
- closes with Escape or an outside click

Fragile Knowledge is a five-row paginated table. Problem titles use the same
canonical LeetCode URL utility and safe new-tab behavior. Previous and Next
controls expose disabled states, the table announces the visible row range,
and pagination resets when changed data would leave the current page out of
bounds.

## Adaptive timeframe behavior

Historical charts use the complete selected period with presentation buckets
chosen for legibility:

| Selected range | Presentation bucket | Intended density |
| -------------- | ------------------- | ---------------- |
| 14 days        | one day             | up to 14 points  |
| 30 days        | consecutive 3-day   | up to 10 points  |
| 90 days        | calendar week       | about 13 points  |

Partial first and last buckets remain visible and use accurate boundary
labels. Aggregation must preserve the meaning of each metric:

- counts are summed
- proportions are recomputed from summed numerators and denominators, never
  averaged from displayed percentages
- predicted recall uses the documented weighted aggregate of eligible samples
- stability uses the median of eligible stability samples
- backlog uses the reconstructed value at the bucket boundary
- null remains null when no eligible sample exists

The Analytics domain owns bucketing. React chart components receive typed,
chart-ready points and do not calculate FSRS state or contain range-specific
business rules.

## Analytics Evidence System

Analytics V1 introduces a feature-owned Analytics Evidence System. It is not a
new npm package or generic shared library. It standardizes how CogniPace turns
review history into sufficiently rich, chart-ready historical evidence:

```text
raw review history
  -> eligible evidence
  -> adaptive time buckets
  -> effective history window
  -> readiness evaluation
  -> trustworthy metric aggregation
  -> chart-ready data
```

Keep this system inside `src/features/analytics/domain` while it remains
specific to review assessments, FSRS stability, retrievability, ratings, and
practice history. Extract proven primitives only when another feature has a
real matching need.

### Generic bucket policy

For a requested range of `R` days, choose a bucket size `B` that produces a
readable historical chart:

- use one-day buckets when `R <= 14`
- otherwise choose from `2, 3, 7, 14, 30` days to produce approximately 8–14
  points

The current ranges resolve to:

| Requested range | Bucket size | Requested buckets |
| --------------- | ----------- | ----------------- |
| 7 days          | 1 day       | 7                 |
| 14 days         | 1 day       | 14                |
| 30 days         | 3 days      | 10                |
| 90 days         | 7 days      | 13                |
| 120 days        | 14 days     | 9                 |

In general:

```text
N = ceil(R / B)
```

The policy is deterministic and unit tested so future ranges do not require
new chart-component conditionals.

### Eligible evidence

For each requested bucket `i`, calculate:

```text
s_i = number of eligible persisted assessments in bucket i
a_i = 1 when s_i > 0, otherwise 0
```

The baseline evidence event is a persisted review assessment with a valid
rating. Individual metrics may require stricter evidence. Observed correctness,
for example, requires an observed correctness result; FSRS-predicted recall
requires a replayable card history. Stricter metric eligibility must be named
in the metric definition and may produce a metric-specific sparse state even
when the overall historical range is ready.

### Effective history window

Leading empty buckets are not rendered. Let `f` be the first requested bucket
containing eligible baseline evidence. The effective history window is
`[f, N]`, aligned to the beginning of bucket `f`:

```text
E = N - f + 1
```

`E` is the number of effective buckets. Internal and trailing empty buckets
remain because they represent real practice gaps. The UI identifies the
effective period honestly, for example:

> Showing 8 weeks of usable history from your selected 90-day range.

The selected range remains 90 days; CogniPace does not silently pretend that
the user selected a different range.

### Readiness measurements

Calculate readiness only across the effective window:

```text
S = sum(s_i) from f through N
A = sum(a_i) from f through N
G = longest consecutive run where a_i = 0 from f through N
K = number of separate empty-bucket runs from f through N
```

Where:

- `S` is total eligible baseline assessments
- `A` is the number of active effective buckets
- `G` is the longest internal or trailing empty-bucket gap
- `K` is the number of separate internal or trailing gaps

Example:

```text
Requested evidence: [0, 0, 4, 2, 0, 3, 0, 0, 5, 1]
Effective evidence:       [4, 2, 0, 3, 0, 0, 5, 1]

S = 15
A = 5
G = 2
K = 2
E = 8
```

### Generic readiness thresholds

Minimum effective history span:

```text
E_min = ceil(0.60 * N)
```

Minimum assessment count:

```text
S_min(R) = ceil(max(12, 0.5 * R, 0.8 * min(R, 30)))
```

Required active-bucket coverage:

```text
C(R) = clamp(0.76 - 0.06 * log2(R / 7), 0.55, 0.80)
A_min = ceil(C(R) * E)
```

Maximum bridgeable consecutive empty-bucket gap:

```text
G_max(R) = 1 when R <= 7, otherwise 2
```

This resolves to:

| Requested range | Bucket size | `G_max` | Maximum bridged time |
| --------------- | ----------- | ------- | -------------------- |
| 7 days          | 1 day       | 1       | 1 day                |
| 14 days         | 1 day       | 2       | 2 days               |
| 30 days         | 3 days      | 2       | 6 days               |
| 90 days         | 7 days      | 2       | 14 days              |
| 120 days        | 14 days     | 2       | 28 days              |

Maximum separate gap runs:

```text
K_max = max(1, ceil(0.20 * E))
```

A historical range is ready when every gate passes:

```text
Ready(R) =
  E >= E_min
  AND S >= S_min
  AND A >= A_min
  AND G <= G_max
  AND K <= K_max
```

The gates are complementary:

- `S` prevents conclusions from too few total assessments
- `A` prevents a few dense sessions from standing in for sustained coverage
- `G` prevents any one unbridgeably long interruption
- `K` prevents many individually acceptable gaps from producing a fragmented
  chart

The system returns the individual gate results rather than only an opaque
combined score:

```ts
interface AnalyticsReadiness {
  ready: boolean
  requestedDays: number
  bucketDays: number
  requestedBuckets: number
  effectiveBuckets: number
  effectiveStart: string | null
  assessments: number
  minimumAssessments: number
  activeBuckets: number
  minimumActiveBuckets: number
  longestGap: number
  maximumGap: number
  gapRuns: number
  maximumGapRuns: number
  failingReasons: ReadinessFailure[]
}
```

### Unready ranges and richest available analytics

All configured ranges remain selectable. When a requested historical range is
not ready:

- show the exact failing gates in plain English
- show achievable progress such as “3 more active weeks needed” or “8 more
  assessments needed”
- offer the longest shorter configured range that passes
- do not silently change the selected URL range
- continue rendering current-state and fixed-forecast analytics that do not
  depend on the selected historical window

The richest available historical range is:

```text
r* = max({r in configured ranges where Ready(r) is true})
```

Current-state Retention Health and Fragile Knowledge remain available when
historical readiness fails. Upcoming Review Load remains available because its
forward-looking 14-day horizon is independent of historical range readiness.
Historical Recall Quality, Practice Rhythm, Ratings Mix, Where to Focus, Memory
Strength, and Recent Overdue Backlog use the readiness contract applicable to
their evidence.

The readiness system encourages sustained practice by making progress visible,
but it must not shame the user, inflate activity requirements, or imply that
more review volume is inherently better.

### Historical line-series continuity

Readiness determines whether the overall historical interpretation is rich
enough to display. A separate continuity policy determines how missing internal
buckets appear inside an otherwise ready line chart.

For observed and derived historical line series:

- consecutive eligible values use a solid line
- a gap from one bucket through the range's configured `G_max` uses a dashed
  bridge between the two measured endpoints
- a gap longer than `G_max` makes that metric's historical range unready rather
  than rendering a broken trend
- no synthetic point, carried-forward value, interpolated tooltip value, or
  false marker is created inside a dashed bridge
- the legend or chart note explains that dashed segments cross a period with no
  eligible observation

Because presentation buckets adapt with the selected range, a permitted dashed
bridge represents at most:

- one day in a 7-day view
- two days in a 14-day view
- two three-day buckets in a 30-day view
- two weeks in a 90-day view
- two selected presentation buckets for future ranges longer than seven days

The `A` and `K` gates keep repeated acceptable-length gaps from producing an
overly dashed chart. A range with several dense sessions separated by repeated
two-bucket gaps therefore does not qualify merely because each individual gap
is bridgeable. This keeps the chart easy to follow without fabricating
evidence:

```text
solid segment  = adjacent measured values
dashed segment = a permitted missing run between measured values
no chart       = insufficient continuity or overall evidence
```

Practice Rhythm keeps the review-volume bar for every bucket. A zero-practice
bucket therefore has an empty bar and may be crossed by a dashed correctness
bridge when it is the only missing bucket. Recall Quality and Memory Strength
follow the same continuity semantics for each line independently.

## Chart catalogue and diagnostics

Every production chart has a typed, inspectable definition. The catalogue
documents chart semantics without replacing explicit Recharts components with
one generic configuration-driven renderer.

Suggested ownership:

```text
src/features/analytics/domain/
  analytics-range-policy.ts
  analytics-readiness.ts
  metric-definitions.ts

src/features/analytics/components/charts/
  chart-definitions.ts
  chart-shared.tsx
  <explicit chart components>
```

Each chart definition records:

```ts
interface AnalyticsChartDefinition {
  id: AnalyticsChartId
  title: string
  question: string
  metricMeaning: string
  dataSource: string
  eligibility: string
  aggregation: string
  readiness: 'historical' | 'current-state' | 'forecast'
  xAxis: string
  yAxis: string
  series: readonly ChartSeriesDefinition[]
  tooltipFields: readonly string[]
  emptyState: string
  continuity?: 'solid' | 'solid-with-permitted-gap-bridge'
  interpretationWarning?: string
}
```

Definitions use stable chart IDs, series keys, labels, and semantic color token
names. Legends and tooltips use the same labels. Each explicit chart component
links to its definition and corresponding metric builder so a maintainer can
trace:

```text
chart mark -> series definition -> serialized field -> aggregation -> evidence
```

Development diagnostics may serialize or display:

- requested and effective range boundaries
- bucket size and exact bucket boundaries
- accepted and rejected evidence counts
- `S`, `A`, `G`, and `E`
- every readiness threshold and pass/fail result
- metric-specific sample sizes
- null buckets and rejection reasons
- solid, dashed-bridge, and broken line-segment classifications

If a visual diagnostics panel is added, it is development-only, is not part of
normal user-facing Analytics, and consumes the same typed readiness result used
by production behavior. It must not introduce a second calculation path.

Focused tests keep chart definitions, contract keys, calculations, legends,
tooltips, and rendered series aligned. Semantic colors use named Analytics
tokens rather than anonymous `chart-1`, `chart-2`, or positional assumptions.

## Component and data ownership

Preserve the repository dependency direction:

```text
entrypoints -> app -> features -> platform/lib/components
```

The intended flow is:

```text
SQLite review attempts and FSRS cards
  -> Analytics repository and service
  -> daily truthful metric samples
  -> Analytics adaptive presentation-bucket builders
  -> Zod-validated serialized Analytics contract
  -> AnalyticsScreen composition
  -> feature chart components
  -> shared shadcn Chart/Recharts primitives
```

Responsibilities:

- `src/features/analytics/domain/analytics-range-policy.ts` owns generic bucket
  selection and configured-range ordering.
- `src/features/analytics/domain/analytics-readiness.ts` owns effective-window
  and readiness calculations.
- `src/features/analytics/domain` owns pure bucketing and metric aggregation.
- `src/features/analytics/server` composes local persisted and FSRS-derived
  inputs.
- `src/features/analytics/api` owns Zod-validated runtime contracts.
- `src/features/analytics/components/charts` owns explicit chart variants.
- `src/features/analytics/components/analytics-screen.tsx` only composes the
  approved hierarchy.
- `src/components/ui/chart.tsx` remains generic and owns shared shadcn chart
  infrastructure.
- `src/lib/leetcode/domain/problem-url.ts` remains the canonical URL builder.

Do not create one prop-heavy chart component with chart-type booleans. Shared
formatting, tick-density, tooltip, legend, and empty-state helpers may be
extracted when they have stable cross-chart behavior.

## Interaction, tooltip, and accessibility rules

- Every chart has a visible title, concise description, accessible name, and
  screen-reader description.
- Tooltips use plain-English labels, dates, units, and sample sizes.
- Retention Health's pinned tooltip is interactive; ordinary hover tooltips do
  not contain unreachable controls.
- Chart marks that support pinning are keyboard focusable and expose their
  problem identity.
- Color is paired with labels, marks, line styles, or threshold text and is
  never the only carrier of meaning.
- Axis tick density adapts to the presentation bucket and viewport.
- Charts use explicit minimum heights and stack on narrow dashboard widths.
- Reduced-motion preferences remain respected.
- All numeric dashboard values use tabular numerals.
- Empty and low-sample states explain why interpretation is unavailable.

## Error and sparse-data behavior

The existing route-level loading, retryable error, unavailable-data, and ready
states remain. Individual charts render local empty states when their metric is
unavailable while other useful Analytics content stays visible.

The UI must not interpolate missing observed outcomes, rank low-sample topics
as confidently weak, treat absent reviews as failed reviews, or present FSRS
predictions as observed outcomes.

## Verification strategy

Implementation follows test-driven development. Focused tests must first fail
for each changed behavior and then pass after the smallest production change.

Domain and contract tests cover:

- generic bucket selection for current and future example ranges
- exact `S`, `A`, `G`, `E`, and readiness-gate results
- exact `K` and maximum-gap-run readiness results
- leading-empty trimming without removal of internal or trailing gaps
- richest passing configured-range selection
- explainable readiness failure reasons
- exact 14-day daily, 30-day three-day, and 90-day weekly boundaries
- partial first and last buckets
- count preservation across aggregation
- ratio recomputation from numerators and denominators
- null and missing-observation behavior
- deterministic permitted-gap dashed bridges without synthetic metric values
- metric-specific unready behavior for gaps longer than the configured bridge
  threshold
- stability medians and backlog boundary values
- schema acceptance and rejection of the revised chart-ready shapes

Component tests cover:

- selected but unready range progress and shorter-range recommendation
- effective-window copy when leading empty buckets are removed
- continued current-state and forecast rendering when history is unready
- chart catalogue labels and semantic series alignment
- solid-line, dashed-bridge, and long-gap rendering semantics
- Recall Quality hierarchy, legends, and tooltip values
- mixed Practice Rhythm bars and correctness line
- stable Ratings Mix semantic series
- five-topic display and low-sample qualification
- green/yellow backlog threshold encoding
- visible and keyboard-usable Retention Health tooltips
- click-to-pin behavior, Escape/outside dismissal, and canonical LeetCode link
- five-row Fragile Knowledge pagination and safe LeetCode links
- loading, error, empty, sparse, and populated page states

Required automated validation for implementation:

```sh
npm run db:check
npm run typecheck
npm run lint
npm run test
npm run check
npm run build
```

Run focused Analytics tests before the complete validation set. Run Prettier on
all touched files and verify the final diff.

Because this changes visible dashboard behavior, a human engineer must run and
capture happy-path and edge-case browser proof before PR review or merge:

1. Open Analytics with representative local history.
2. Verify every chart at 14, 30, and 90 days.
3. Verify sparse and empty buckets do not render as zero outcomes.
4. Verify tooltips remain readable without clipping.
5. Pin a Retention Health tooltip, open its LeetCode action, and dismiss it by
   Escape and outside click.
6. Open a Fragile Knowledge problem and paginate forward and backward.
7. Verify narrow-width stacking and keyboard focus order.
8. Attach screenshots or a screen recording to the pull request.

## Out of scope

- hosted analytics or accounts
- new persistence or daily snapshot tables
- changes to FSRS scheduling behavior
- causal claims about consistency and performance
- workload scenario simulation beyond the existing fixed forecast
- topic drill-down pages
- changing the configured five-problem backlog watch threshold in Analytics V1
