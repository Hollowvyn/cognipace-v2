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

- exact 14-day daily, 30-day three-day, and 90-day weekly boundaries
- partial first and last buckets
- count preservation across aggregation
- ratio recomputation from numerators and denominators
- null and missing-observation behavior
- stability medians and backlog boundary values
- schema acceptance and rejection of the revised chart-ready shapes

Component tests cover:

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
