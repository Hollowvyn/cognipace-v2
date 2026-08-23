# Analytics Nine-View Working Decisions

> Status: completed brainstorming record, not current product authority. The
> consolidated future-state specification is
> `../specs/2026-08-22-analytics-dashboard-system-design.md` and was approved by
> the user on August 22, 2026. Implementation authority comes from the approved
> specification and its phase-sized plan suite, not this working record.

## Purpose

Prevent drift while CogniPace defines the shared chart system and reviews the
nine Analytics views individually. The consolidated design belongs in
`docs/superpowers/specs/2026-08-22-analytics-dashboard-system-design.md`.

**Checklist progress:** 9 of 9 views locked. Chart-by-chart review is complete.

## Confirmed dashboard decisions

- Overview owns recommendations, due work, streak, and the review queue.
- Analytics answers what changed, where, and with how much evidence.
- The historical controls are 14, 30, and 90 days.
- The current presentation buckets are daily, three-day, and weekly.
- Full visible dates use `MM/DD/YY`. Compact axes may use `MM/DD` when the year
  is already explicit in the selected-range label.
- Persist and transport exact timestamps as UTC instants; group Analytics by
  the browser's declared local calendar timezone.
- Include today as a visibly partial bucket and compare previous periods only
  through equivalent elapsed local time.
- Upcoming Review Load always forecasts the next 14 days.
- Every chart provides Chart and Table views from the same presentation rows.
- A visible table, not a tooltip, is the exhaustive exact-value alternative.
- One calm page evidence summary is followed by compact per-view evidence.
- Unsupported takeaways are suppressed rather than guessed.
- View 1's observed recalled share is rating-derived: Hard + Good + Easy divided
  by the exact paired eligible ratings; Again is the no-recall outcome.
- Good + Easy may appear only as secondary rating-quality context, not as the
  observed counterpart to FSRS retrievability.
- Do not claim first-try recall, independent correctness, FSRS calibration,
  causal influence, readiness, or guaranteed memory outcomes.
- View 1 compares observed recalled share with the mean reconstructed pre-review
  FSRS retrievability for those exact paired reviews.
- Current FSRS estimates remain available in Retention Map.
- The layout uses one lead view, paired supporting views, full-width
  diagnostics, and early responsive stacking.
- Use a thin shared `AnalyticsFigure` composition around explicit per-view
  Recharts components. Do not build a universal configuration-driven chart
  renderer.
- The domain/service layer returns one Zod-validated presentation dataset that
  is consumed unchanged by both Chart and Table views.
- Ordinary charts use transient hover/focus tooltips; Retention Map alone
  supports a richer pinned detail state. Memory Signals is table-native and has
  no tooltip.
- Tooltips are inspection aids. The Table tab remains the exhaustive exact-value
  path and uses identical metric names, units, precision, and ordering.

## Nine-view inventory

| #   | View                      | Locked presentation                            | Scope               | Main job                                                        |
| --- | ------------------------- | ---------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| 1   | Observed Recall vs FSRS   | two lines with distinct measured markers       | 14/30/90 historical | compare paired recalled outcomes with pre-review FSRS estimates |
| 2   | Memory Strength over Time | median line, measured markers, and IQR band    | 14/30/90 historical | show post-review memory durability in days over time            |
| 3   | Practice Rhythm           | composed bars and line with explicit dual axes | 14/30/90 historical | compare review volume with Review Success as association only   |
| 4   | Ratings Mix               | 100% stacked columns                           | 14/30/90 historical | show the composition of Again, Hard, Good, and Easy             |
| 5   | Topic Performance         | ranked horizontal bars                         | 14/30/90 historical | expose sufficiently sampled weaker topic outcomes               |
| 6   | Retention Map             | scatter/dot plot plus target reference         | current state       | compare current predicted retrievability with target            |
| 7   | Memory Signals by Problem | semantic diagnostic table                      | current state       | explain exact qualifying signals per problem                    |
| 8   | Recent Overdue Backlog    | daily threshold step line                      | 14/30/90 historical | show reconstructible backlog pressure over time                 |
| 9   | Upcoming Review Load      | columns with overdue separated                 | fixed next 14 days  | show scheduled future workload                                  |

Memory Signals is intentionally table-native. A decorative chart will not be
invented where exact multi-field comparison is the real task.

## Shared figure checklist

Each view must explicitly settle all of the following before the design locks:

1. learner question;
2. supported interpretation or decision;
3. chart suitability and rejected alternatives;
4. metric formula and unit;
5. source fields and lineage;
6. eligible cohort and exclusions;
7. aggregation and weighting;
8. range, bucket, timezone, and partial-period meaning;
9. comparator and reference-line meaning;
10. missing, zero, and unknown semantics;
11. evidence gate and sample disclosure;
12. takeaway generation and suppression rule;
13. axes, scales, domains, ticks, labels, and legend;
14. tooltip fields and interaction;
15. exact table columns and row parity;
16. keyboard, screen-reader, color-independent, and reduced-motion behavior;
17. responsive and zoom behavior;
18. contract, builder, rendering, and manual visual tests.

## Confirmed shared chart scaffold

Keep two ownership layers instead of creating a generic chart builder:

### Generic UI layer

`src/components/ui/chart.tsx` continues to own the local Shadcn-style
`ChartContainer`, semantic color config, tooltip content, legend content, and
responsive Recharts container. It must not know Analytics metrics.

### Analytics figure layer

A feature-owned `AnalyticsFigure` composition must own:

- title, learner question, and concise metric definition;
- Chart/Table tabs;
- supported takeaway or neutral evidence state;
- chart/table body;
- compact evidence strip;
- expandable calculation and eligibility details;
- stable labelled-region and described-by relationships.

Each of the eight charts remains an explicit Recharts component. The system
shares presentation contracts and composition, not one configuration-driven
renderer full of exceptions.

The service/domain layer produces Zod-validated presentation rows. Both chart
and table consume those exact rows; neither recomputes business metrics.

## Confirmed date and range integrity contract

- Persist and transport timestamps as UTC instants, but group historical data
  by the browser's declared local calendar timezone.
- Serialize `timeZone`, `asOf`, exact period bounds, bucket bounds, and
  `isPartial` with the response.
- Treat 14 days as today plus the preceding 13 local calendar days; label today
  as in progress.
- Compare periods only through equivalent elapsed local time so a partial today
  is not compared with a completed historical day.
- Use calendar arithmetic across daylight-saving changes, never fixed
  `86,400,000` millisecond subtraction.
- Keep stable `YYYY-MM-DD` keys for identity, but format visible labels through
  one formatter. Full dates use `MM/DD/YY`; do not parse a date-only key as UTC.
- Show exact range and timezone near the range control, for example:
  `08/09/26–08/22/26 · America/New_York · as of 12:40 PM`.
- Always show the first and last axis label; select a small, non-overlapping set
  of intermediate ticks. Compact axes may use `MM/DD`; tooltips and tables use
  full `MM/DD/YY` bucket labels.

### Confirmed bucket and comparison matrix

| Selected range | Presentation buckets                   | Period-level comparator           | Reason                                                         |
| -------------- | -------------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| 14 days        | one local day                          | previous equivalent 14-day window | 14 marks preserve useful daily shape without excessive density |
| 30 days        | three local days                       | previous equivalent 30-day window | about 10 marks show a monthly pattern without noisy daily bars |
| 90 days        | calendar weeks, clipped at range edges | previous equivalent 90-day window | about 13–14 marks support a quarter-scale trend                |

Bucket values are not automatically described as day-over-day or week-over-week
changes. The chart shows the bucket sequence; a comparison claim is made only
when the exact comparator and both eligible samples are present.

## Confirmed tooltip contract

- Tooltip content is a preview, never the only source of essential information.
- The first line is the full date or bucket range.
- Values use the same names, units, rounding, and order as the table.
- Ratios include the eligible numerator/denominator or sample size.
- Reference context is named, for example `Target: 90%`; color alone is never
  the status.
- Unknown values are labelled `Not measured` or omitted deliberately, never
  rendered as zero.
- Keep the primary tooltip compact; longer methodology belongs in disclosure.
- Recharts keyboard access is enabled, with one chart tab stop and arrow-key
  point navigation. Supported pinning must also work with Enter/Space and
  dismiss with Escape.
- Tooltip motion must respect reduced motion. The table remains the exhaustive
  keyboard and screen-reader path.

## Confirmed cross-chart scale rule

- Movement-focused line and point charts may use an explicit adaptive numeric
  domain instead of automatically starting at zero.
- The percentage-domain rule includes every visible series value and
  required reference, expands the observed spread by `1.5x`, enforces at least
  a `25` percentage-point window, clamps the result to `0%..100%`, and rounds
  outward to clear tick boundaries.
- The active domain must be visible beside the chart and included in the
  accessible chart description. A truncated domain must never be implicit.
- This is not a universal truncated-axis rule. Bars, areas, and part-to-whole
  charts retain the honest baseline required by their mark: zero for magnitude
  bars/areas and `0%..100%` for 100% stacks. Threshold views must include their
  required reference line.
- The rule has now been exercised against all nine views. Each locked view
  explicitly uses the scale required by its mark: adaptive movement domains
  where approved, zero-based magnitude axes for bars and areas, full
  **0%–100%** domains for part-to-whole stacks, and required benchmark or target
  references for threshold views.

## Library provenance

- Installed project versions: Recharts `3.10.1`, React `19.2.6`, and
  date-fns `4.2.1`.
- Shadcn documents its Chart components as local composition around Recharts,
  not a replacement charting abstraction. It requires measurable height and
  supports semantic chart config, custom tooltip content, and Recharts'
  accessibility layer.
- Recharts documents responsive containers, `accessibilityLayer`, custom
  tooltip content, hover/click triggering, controlled active state, and reduced
  motion-aware tooltip animation.
- Context7 access recovered through the installed app endpoint. The reviewed
  sources include current Shadcn Chart and Recharts documentation, the FSRS
  algorithm wiki and tutorial, and the current `ts-fsrs` documentation.

## Review sequence

1. Complete: confirm the shared local-date/range contract.
2. Complete: confirm the figure scaffold and tooltip contract.
3. Complete: review views 1–9 individually against the shared checklist.
4. Complete: re-run the cross-view consistency and dashboard-density audit.
5. Complete: consolidate this working record into the formal design
   specification for user review.

## View 1 locked: observed recall versus FSRS estimate

Locked during visual review on August 22, 2026.

- **Reason reopened:** the intended lead question compares observed recall with
  the FSRS pre-review retrievability estimate. Removing the prediction discarded
  a valuable question instead of repairing its data contract.
- **Comparable observed metric:** `(Hard + Good + Easy) / valid ratings`, paired
  to the same reviews that have a valid FSRS estimate. `Again` is the
  rating-derived no-recall event. This remains a rating-derived outcome, not an
  independently assessed first-try result.
- **Non-comparable quality metric:** `(Good + Easy) / valid ratings` may remain
  as rating-quality context, but must not be plotted as though it measures the
  event predicted by FSRS retrievability.
- **Predicted metric:** mean pre-review FSRS retrievability for those exact
  paired reviews.
- **Current provenance:** CogniPace stores FSRS review-log state but not an
  immutable `predictedRetrievabilityAtReview` scalar or model/settings version.
  Current Analytics replays rating history with current code/options; this is a
  reconstructed estimate, not literally the scalar recorded at the time.
- **Recommended future capture:** persist pre-review retrievability, FSRS model
  version/provenance, and the relevant settings snapshot for new reviews.
- **Recommended mark:** two measured-marker lines: observed recalled share and
  FSRS expected recall.
- **Scale:** adaptive percentage domain across both visible series:
  `1.5x` observed spread, minimum `25` percentage-point window, clamped to
  `0%..100%`, and rounded outward to clear tick boundaries. The active domain
  is visible and included in the accessible chart description. This rule is
  locked for View 1; whether another view may use it remains a per-view
  decision.
- **Continuity:** solid between adjacent measured buckets; dashed across a
  permitted short evidence gap; no connection across a longer gap.
- **Missing versus zero:** no valid ratings is `null` and receives no marker;
  paired ratings with only Again outcomes is a measured `0%` observed recall.
- **Difference:** observed recalled share minus mean FSRS estimate, expressed in
  percentage points. Say “above/below the reconstructed estimate in this
  sample,” never “you are better/worse than FSRS.”
- **Tooltip:** full bucket date, observed recalled share and count, FSRS expected
  recall, percentage-point difference, paired sample, prediction provenance,
  and partial-period status. Good + Easy may appear only as secondary context.
- **Table:** bucket, recalled count, paired reviews, observed recalled share,
  mean FSRS estimate, percentage-point difference, prediction provenance, and
  evidence status. Paginate at seven rows so the table stays within the figure
  height; pagination changes presentation only and never changes the shared
  dataset. Reset to page one when the selected range changes.
- **Evidence tiers:** show measured values whenever present; suppress a trend
  takeaway until the metric-specific minimum assessment, active-bucket, span,
  and gap rules pass. A previous-period comparison requires both periods to
  pass.
- **Claim boundary:** rating-derived recalled share versus a model estimate. Do
  not claim independent correctness, first-try performance, formal calibration,
  personal ability, guaranteed retention, or causality.

## View 2 locked: memory strength over time

Locked during visual review on August 22, 2026.

- **Learner question:** “Are your memories staying strong for longer after
  review?”
- **Plain-English meaning:** as the selected period progresses, the chart shows
  how many days FSRS expects a typical reviewed memory to remain at or above
  approximately 90% recall probability after the review.
- **Metric:** median resulting FSRS stability, in days, across eligible completed
  review events in each presentation bucket.
- **Interpretation:** a higher point means the reviewed memories were expected to
  remain retrievable for longer before reinforcement. A lower point means they
  may need reinforcement sooner.
- **Population and weighting:** one observation per eligible completed review
  event. A memory reviewed more than once contributes more than once; the chart
  describes review outcomes, not a whole-library snapshot.
- **Eligibility:** include valid Again, Hard, Good, or Easy review attempts whose
  post-review FSRS state can be reconstructed. Exclude non-finite, non-positive,
  or otherwise invalid stability results. A bucket without an eligible result
  is missing, never zero.
- **Provenance:** current history is reconstructed by replaying each review and
  reading the resulting card stability. Going forward, persist the exact
  post-review stability together with FSRS model and settings provenance.
- **Recommended mark:** one median line with measured markers and a light
  interquartile-range band. Hide the band when a bucket has too little evidence
  to calculate it honestly; never invent a range.
- **Scale:** an explicit adaptive linear day domain derived from all visible
  medians and visible interquartile bounds. Expand the observed span by `1.5x`,
  enforce at least a two-day window, clamp the lower bound at zero, and round
  outward to clear day ticks. The active day range is visible and included in
  the accessible description. Zero is not implied as the chart baseline.
- **Continuity:** solid between adjacent measured buckets; dashed only across a
  permitted short no-evidence gap; disconnected across a longer gap.
- **Tooltip:** full bucket date, median expected strong-memory duration,
  interquartile range when supported, eligible review count, median change from
  pre-review stability, reconstruction or captured provenance, and
  partial-period status.
- **Table:** bucket, median post-review strength, middle-50% range, eligible
  reviews, median change from before review, provenance, and evidence status.
  Use the shared seven-row pagination rule and reset to page one when the range
  changes.
- **Evidence:** measured points may appear whenever an eligible result exists.
  Trend language is suppressed until the shared active-bucket, span, gap, and
  sample requirements pass; the interquartile band requires enough observations
  to calculate quartiles meaningfully.
- **Takeaway copy:** “The typical reviewed memory was expected to stay strong
  for approximately {value} days after review.” Add directional wording only
  when the trend evidence gate passes.
- **Claim boundary:** this is estimated post-review durability for memories
  reviewed in each bucket. It is not answer correctness, a guarantee of recall,
  a whole-library score, personal ability, or proof that the learner improved.

## View 3 locked: practice rhythm

Locked during visual review on August 22, 2026.

- **Learner question:** “When you practiced more or less, how did Review
  Success move?”
- **Outcome metric:** Review Success is `(Good + Easy) / valid ratings`,
  recomputed per presentation bucket. It is intentionally distinct from View
  1's rating-derived recalled share of Hard + Good + Easy.
- **Volume metric:** count eligible persisted review attempts with a valid
  Again, Hard, Good, or Easy rating per presentation bucket. The chart labels
  this “Completed reviews”; invalid persisted rows are excluded and disclosed
  in the calculation details.
- **Source and weighting:** use each eligible review attempt's rating and
  `reviewedAt` timestamp. Each attempt has equal weight. Bucket boundaries use
  the locked browser-local calendar contract.
- **Interpretation:** show whether heavier or lighter practice coincided with
  more comfortable review outcomes. Describe co-movement or association; do not
  claim that volume caused the outcome or report a statistical correlation
  unless a correlation statistic is actually calculated.
- **Selected mark:** one composed chart with review-count bars and a measured
  Review Success line on separate, directly labelled Y axes. The learner
  intentionally preferred this compact correlation-inspection view over aligned
  small multiples.
- **Review-count scale:** an honest zero baseline is mandatory because bars
  encode magnitude. Round the upper domain outward to a clear integer tick above
  the observed maximum; never truncate the bar baseline.
- **Review Success scale:** use the locked adaptive percentage-domain rule from
  View 1 over the visible measured success values: expand the observed spread by
  `1.5x`, enforce a minimum `25` percentage-point window, clamp to `0%..100%`,
  and round outward to clear ticks. Show the active percentage range and include
  it in the accessible description.
- **Range behavior:** 14 days uses local-day buckets, 30 days uses three-local-
  day buckets, and 90 days uses calendar weeks clipped at the selected-range
  edges. Recompute both axes whenever the range changes. The last bucket is
  visibly in progress, and its exact date bounds remain available in the
  tooltip and table.
- **Aggregation integrity:** aggregate Good, Easy, and valid-rating counts first,
  then calculate the bucket percentage. Never average daily percentages into a
  three-day or weekly result.
- **Missing versus zero:** after the first supported practice bucket, an empty
  bucket renders a zero-height review bar and a missing Review Success value
  with no marker. It must not render as `0%`. A short no-evidence gap may be
  bridged with a dashed line; a longer gap breaks the line.
- **Tooltip:** full `MM/DD/YY` bucket date or date range, Completed reviews,
  Review Success, Good + Easy numerator and valid-rating denominator,
  evidence status, and partial-period status. Unknown success is labelled “Not
  measured,” never zero.
- **Table:** bucket, Completed reviews, Good + Easy shown as “{numerator} of
  {denominator},” Review Success, and evidence status. It consumes the exact
  presentation rows used by the chart, paginates at seven rows, resets to page
  one on range change, and contains narrow-screen horizontal overflow within
  the figure.
- **Evidence and takeaway:** measured values may appear whenever their
  denominator exists. Do not produce an automatic directional association
  takeaway until the shared active-bucket, time-span, gap, and sample gates
  pass. The safe default is the neutral statement: “Review volume and Review
  Success are shown together for this period.” Keep the concise visible note
  “Association, not causation.”
- **Accessibility:** enable Recharts' accessibility layer; expose the chart as
  one tab stop with arrow-key point navigation; distinguish bars and line by
  mark shape as well as color; name both axes and their units; include both
  active domains in the accessible description; and provide the exhaustive
  Table view. Respect reduced motion.
- **Responsive behavior:** keep the composed chart intact, reserve space for
  both Y axes, reduce the X-axis to at most four labels at narrow widths, and
  prevent clipping or page-level horizontal scroll. The table may scroll only
  inside its own contained region.
- **Tests:** cover formula and aggregate-first behavior, invalid ratings,
  missing-versus-zero semantics, local bucket boundaries, partial buckets,
  14/30/90 range changes, both domain helpers, tooltip/table parity, seven-row
  pagination, keyboard description, reduced motion, and responsive visual
  states.
- **Claim boundary:** Review Success is rating-derived Good + Easy share. It is
  not independent correctness, first-try recall, personal ability, causation,
  or a computed correlation coefficient. The view shows co-movement for
  inspection without claiming why it occurred.

## View 4 locked: ratings mix

Locked during visual review on August 22, 2026.

- **Learner question:** “How is the balance of your review ratings changing?”
- **Rating semantics:** Again means forgotten; Hard means recalled correctly
  but with difficulty; Good means expected recall; Easy means easier than
  expected. Hard + Again may be described as “challenging reviews,” not as a
  failure or incorrectness rate.
- **Metric:** count each valid Again, Hard, Good, and Easy rating per
  presentation bucket, then divide each count by the bucket's total valid
  ratings. Every non-empty bucket totals exactly `100%` apart from visible
  display rounding.
- **Source and weighting:** use each eligible persisted review attempt's rating
  and `reviewedAt` timestamp. Each valid rating contributes once. Invalid and
  internal-only ratings are excluded and disclosed.
- **Selected mark:** 100% stacked columns with stable Again, Hard, Good, and Easy
  series order. This discrete part-to-whole treatment was preferred over a
  stacked area, which implies continuity, and four independent trends, which
  weakens the whole-composition question.
- **Scale:** the percentage axis is always `0%..100%`; View 1's adaptive scale
  does not apply to part-to-whole marks. Empty buckets contain no stack and must
  not be rendered as four zero-valued ratings or as an equal split.
- **Supporting signal:** report the selected-period Hard + Again share as
  challenging-review context. Compare it with the equivalent elapsed previous
  period only when both periods meet their evidence gates.
- **Range behavior:** 14 days uses local-day buckets, 30 days uses three-local-
  day buckets, and 90 days uses calendar weeks clipped at the selected-range
  edges. Aggregate rating counts first and derive the four shares from those
  bucket totals; never average daily percentages. Mark the last bucket as in
  progress and expose its exact date bounds.
- **Missing versus zero:** a non-empty bucket may contain a measured zero for a
  specific rating, and that segment is absent while the other shares still form
  the stack. A bucket with no valid ratings is unknown composition, renders no
  stack, and reports “Not measured”; it is not an equal four-way split.
- **Tooltip:** full `MM/DD/YY` bucket date or date range first, followed by
  Again, Hard, Good, and Easy in stack order with count and percentage, then
  valid ratings and partial-period status. Challenging reviews does not appear
  in the tooltip; it remains period-level context beneath the chart.
- **Table:** bucket, Again, Hard, Good, Easy, valid ratings, challenging reviews,
  and evidence status. Each rating cell includes the exact count and percentage
  from the shared presentation row. Paginate at seven rows, reset to page one
  when the range changes, and contain narrow-screen horizontal overflow within
  the figure.
- **Rounding:** calculate stacks from exact counts. Tooltip and table
  percentages use the shared display precision and may visibly sum to `99%` or
  `101%` after independent rounding; do not alter a category's value merely to
  force displayed labels to total `100%`.
- **Evidence and takeaway:** individual bucket composition may appear whenever
  at least one valid rating exists. The selected-period challenging-review
  share may appear with its sample. Suppress its previous-period direction
  unless both equivalent elapsed periods meet their rating-count and coverage
  gates.
- **Legend and color:** keep the stable stack and legend order Again, Hard,
  Good, Easy. Preserve semantic color identity across chart, tooltip, and
  table, but never rely on color alone: order, labels, accessible descriptions,
  and the Table view carry the category meaning.
- **Accessibility:** enable Recharts' accessibility layer; expose the chart as
  one tab stop with arrow-key bucket navigation; announce the bucket date,
  four counts and shares, valid-rating total, and partial status; and provide
  the exhaustive Table view. Respect reduced motion.
- **Responsive behavior:** retain all selected-range buckets without horizontal
  page scrolling, reduce the X-axis to at most four labels at narrow widths,
  keep the `0%..100%` scale explicit, and move the tooltip to a non-clipping
  position. The table may scroll only inside its own contained region.
- **Tests:** cover valid-rating eligibility, aggregate-first shares, exact stack
  totals, per-rating zeroes, empty composition, independent display rounding,
  local bucket boundaries, partial buckets, 14/30/90 ranges, equivalent elapsed
  comparison, tooltip/table parity, seven-row pagination, keyboard description,
  semantic order, reduced motion, and responsive visual states.
- **Claim boundary:** the view describes the learner's FSRS rating choices.
  Hard is correct but difficult, Again is forgotten, and their combined share
  is challenging-review context—not a failure rate, independent correctness,
  first-try recall, personal ability, or proof of learning improvement.

## View 5 locked: topic performance

Locked during visual review on August 22, 2026.

- **Learner question:** “Which sufficiently practiced topics had lower Review
  Success?”
- **Outcome metric:** topic Review Success is `(Good + Easy) / valid ratings`
  for review attempts attributed to that topic during the selected historical
  period. This reuses the locked View 3 definition and replaces the prior
  persisted-correctness ranking.
- **Reason:** a rating-quality outcome answers a distinct focus question without
  duplicating View 1's rating-derived recalled share or View 4's challenging-
  review composition.
- **Known attribution rule:** one review attempt contributes at most once to
  each unique topic attached to its problem. A multi-topic attempt may
  contribute to several topic rows, so topic samples overlap and the rows are
  not additive.
- **Selected weighting:** use review-attempt-weighted Review Success within each
  topic, guarded by both volume and breadth. A topic becomes rankable only with
  at least `10` valid ratings across at least `3` distinct reviewed problems in
  the selected period.
- **Why this weighting:** it preserves an exact Good + Easy numerator and valid-
  rating denominator while preventing one repeatedly reviewed problem from
  qualifying an otherwise narrow topic. It is preferred over equal problem
  weighting, which would give a one-review problem as much influence as a
  deeply reviewed problem.
- **Selected mark:** ranked horizontal bars ordered from lower to higher Review
  Success. This direct ranking was preferred over an adaptive dot plot, whose
  truncated domain needs more explanation, and an evidence-first hybrid that
  duplicates the Table view.
- **Scale:** bars encode percentage magnitude and therefore retain an honest
  `0%..100%` baseline. View 1's adaptive percentage rule does not apply. Exact
  percentage labels at each bar end preserve nearby comparisons without
  truncating the scale.
- **Presentation rows:** rank only the five qualifying topics with the lowest
  Review Success. Chart and Table consume those exact same five rows; the Table
  does not silently expand to stronger topics and requires no pagination.
- **Ranking order:** sort by Review Success ascending, then valid-rating count
  descending, then normalized topic label ascending for deterministic ties.
  The tie-breakers stabilize presentation and do not imply a meaningful
  performance difference between equal percentages.
- **Range behavior:** 14, 30, and 90 days each aggregate the complete selected
  historical period into one topic ranking; this view does not plot the shared
  time buckets. Include today's eligible attempts, identify the period as in
  progress, and rebuild the ranking when the range changes.
- **Missing and excluded topics:** a topic with no valid ratings is absent. A
  topic below either the 10-rating or three-problem gate remains unranked and is
  reported as insufficient evidence, never given a zero score. Stronger
  qualifying topics omitted by the five-row focus are counted separately.
- **Tooltip:** topic name first, then Review Success, Good + Easy numerator and
  valid-rating denominator, distinct reviewed problems, selected period, and
  evidence status. Use the locked shared names, units, precision, and ordering.
- **Table:** topic, Review Success, Good + Easy, valid ratings, distinct reviewed
  problems, and evidence status. Long topic labels may wrap; the five rows and
  exact metrics remain identical to the chart presentation rows.
- **Evidence disclosure:** beneath the figure, report how many stronger
  qualifying topics were omitted and identify low-evidence topics with both
  their valid-rating and distinct-problem progress. Move a long excluded list
  into the calculation disclosure instead of letting it dominate the figure.
- **Takeaway:** the safe default is “Showing the five qualifying topics with the
  lowest Review Success in this period.” Do not generate trend or
  previous-period direction from a single selected-period ranking.
- **Color and labels:** use one stable series treatment for all bars because
  color does not encode separate risk bands. The bar order, full topic labels,
  exact end values, tooltip, and Table view carry the ranking meaning without
  relying on color.
- **Accessibility:** enable Recharts' accessibility layer; expose the chart as
  one tab stop with arrow-key topic navigation; announce topic, Review Success,
  Good + Easy count, valid ratings, reviewed-problem breadth, and evidence
  status; and provide the exhaustive five-row Table view. Respect reduced
  motion.
- **Responsive behavior:** preserve all five bars without page-level horizontal
  scrolling, reserve enough Y-axis width for useful topic labels, wrap or
  visually truncate only when necessary, and keep the full label in the
  accessible name, tooltip, and Table. Exact percentage end labels must remain
  visible at narrow widths.
- **Tests:** cover Good + Easy aggregation, de-duplicated topic labels per
  attempt, overlapping multi-topic attribution, distinct-problem breadth, both
  evidence gates, deterministic ties, five-row selection, 14/30/90 range
  rebuilding, partial periods, tooltip/table parity, long labels, keyboard
  description, reduced motion, and responsive visual states.
- **Claim boundary:** this is selected-period rating quality for overlapping
  topic samples. It is not independent correctness, topic mastery, first-try
  recall, a causal diagnosis, a non-overlapping share of all work, or proof of
  personal ability.

## View 6 locked: retention map

Research reviewed and the view locked on August 22, 2026. The research notes
below explain the model semantics that informed the approved chart contract.

- **Retrievability (`R`)** is the model's present probability of recalling a
  reviewed card. CogniPace already obtains it through the installed `ts-fsrs`
  adapter's `get_retrievability(card, at, false)` call.
- **Stability (`S`)** is memory durability in days. In the current FSRS curve,
  it is specifically the elapsed interval at which retrievability reaches 90%.
  It is not the next due interval for every target: the configured target can be
  lower or higher than 90%, so the corresponding target interval can be longer
  or shorter than stability.
- **Target retention** is the configured recall probability used to choose the
  scheduled interval. Higher target retention means earlier reviews and more
  review work. It is a scheduling goal, not an observed result and not the
  card's current retrievability.
- **Difficulty (`D`)** is a `1..10` model state that affects how stability
  changes after future review outcomes. Once elapsed time and current stability
  are known, difficulty is not another input to the current forgetting-curve
  calculation. It therefore belongs in detail context, not as the default
  Retention Map axis.
- **Lapses, due date, and last-review date** are useful diagnostic context.
  Stored `dueAt` remains the authoritative product schedule; a theoretical
  target crossing in an explainer must not replace it because learning steps,
  interval rounding, maximum intervals, and optional fuzz can affect the stored
  schedule.
- **Current implementation limitation:** the existing plot uses days since
  review on X and current retrievability on Y. This is intuitive, but two cards
  of the same age can have very different health because stability differs. Age
  alone hides the model's durability dimension.
- **Current point contract:** one point represents one active, non-suspended
  problem with at least one review and a finite current retrievability estimate.
  Its Y position is the FSRS retrievability calculated at the dashboard's exact
  `asOf` instant. The existing X position is elapsed time since `lastReviewAt`;
  color is a product-defined comparison with that problem's target retention.
- **What must remain visible:** changing the X axis must not weaken the primary
  threshold signal. Every problem keeps the same Y position, target difference,
  status treatment, summary count, tooltip fields, and Table row. Problems below
  target remain the dominant visual inspection path.
- **Compared X-axis meanings:** days since review answers “how old is this
  memory state?” Target-duration answers “for how many days after review is this
  memory state expected to remain above my configured target?” The latter is
  derived from FSRS stability and the configured target, and explains why
  equally old memories can have different predicted recall. Last-review age
  remains in the tooltip and Table.
- **Locked target-duration scale:** use a labelled logarithmic day scale because
  the visible derived duration can span orders of magnitude. A linear scale
  would compress the fragile problems that most need inspection.
- **Model-to-visual mapping:** compare current retrievability on Y with
  target-duration in days on X, retain the configured target as a horizontal
  reference, and keep last-review age in the compact detail. Due status,
  difficulty, and lapses remain available in the exact Table rather than the
  quick point detail. This makes “up means easier to recall now” and “right
  means durable for longer” simultaneously visible.
- **Important category correction:** FSRS does not provide scientific “above,”
  “approaching,” and “below” classes. Any watch band is a product presentation
  rule and must be named as such. The current implementation's “approaching”
  bucket is already below target, so that wording should not survive unchanged.
- **Boundary with other views:** Retention Map is the current-state model
  map. Memory Signals remains the exact diagnostic table, and the dashboard
  overview remains the action surface. View 6 should explain distribution and
  severity without becoming another due queue.
- **Boundary with View 2:** Memory Strength is a historical 14/30/90 trend of
  bucket-level post-review stability. Retention Map is an as-of-now map with
  one mark per included active problem. Reusing stability as View 6 context does
  not merge the views: one asks whether durability is changing over time; the
  other asks which current memories are below target and how long their current
  memory state can sustain the configured target.
- **Interaction weight:** the exploratory “Inspect problem” selector is not a
  candidate production control. The default figure should remain a snapshot;
  transient hover/focus and the already approved pinned point detail provide
  inspection without adding a permanent picker.
- **Locked density:** cap the chart at no more than 30 deterministic priority
  rows while retaining full-cohort status counts. Prioritize deepest target
  shortfalls, then near-target problems, then fragile-but-above-target problems,
  with unused slots redistributed severity-first.
- **Locked mark:** keep compact color-plus-shape marks. Do not replace
  points with colored truncated problem names, and do not directly label even
  the deepest shortfalls by default. Full names remain in focus/hover, pinned
  detail, and the Table view. This preserves an uncluttered snapshot and makes
  the detail surface responsible for problem identity.
- **Plain-English job:** “Which active memories are below target, and
  how durable are they?” Each point is one active reviewed problem. Higher means
  FSRS predicts a greater chance of recalling it now; farther right means the
  memory is expected to remain durable for longer. Points below the target line
  have fallen below the configured retention goal.
- **Interactive-detail behavior:** ordinary hover or chart focus opens
  the same rich non-modal detail surface. It remains open while either the mark
  or detail surface contains the pointer or focus, with a short delayed close to
  bridge the pointer gap. Click or Enter/Space toggles the pinned detail, exposes
  an explicit close affordance, and Escape closes and restores focus. Because
  the surface contains a LeetCode link, it is an interactive popover/dialog
  rather than an ARIA tooltip; implementation must preserve appropriate
  dialog/popover roles and focus handling.
- **Detail-content refinement:** omit the problem slug from the visible detail.
  Make the full problem title the LeetCode link, keep the detail open while the
  pointer or keyboard focus moves from the mark into it, and preserve a short
  delayed close so the pointer can cross the gap without losing the surface.
- **Watch-band treatment:** reserve the ten percentage points immediately below
  the configured recall target for a restrained amber gradient. It begins very
  lightly at the target and strengthens toward the `target - 10` boundary. The
  vertical durability split produces six regions: light/strong green above the
  target, strong/light amber within the watch band, and strong/light red below
  the band. Intensity follows meaning: durable is stronger in the healthy row,
  while fragile is stronger in the warning and risk rows. The boundary remains
  explicit, diamond marks identify problems in the band, and deeper shortfalls
  retain triangle marks. Color never replaces those shapes or direct labels.
- **Compact pinned detail:** use a compact header with the linked problem title
  and a shadcn-style ghost close button, followed by a full-width current-status
  row and a two-column exact-value grid. Hover/focus remains transient; click or
  Enter toggles the surface: activating an unpinned point pins it, activating
  that same pinned point closes it, and activating a different point moves the
  pinned detail there. Pointer or focus may move into it, while the close button,
  Escape, and outside interaction dismiss it. A transient detail closes as soon
  as the pointer leaves the detail surface, using a restrained 150ms exit
  transition; a pinned detail remains open. Do not show the slug.

### Locked product contract

- This is the analytics dashboard's primary full-width graph. Do not compress it
  into the two-column secondary-chart grid.
- Render one current active reviewed problem per mark. Y is current predicted
  recall. X is the logarithmic number of days that the card's current FSRS
  memory state is expected to remain above the user's configured recall target.
- The horizontal reference is the user's configured recall target. The ten
  percentage points immediately below it form the amber watch band. Recall more
  than ten points below target uses the red risk band.
- The vertical reference remains a fixed seven-day operational benchmark,
  labelled **1-week durability benchmark**. It is a stable, understandable
  product reference—not an FSRS scientific threshold, a second user goal, or a
  claim that seven days is universally optimal.
- Do not add a cohort average, median line, personalized durability threshold,
  or durability-goal control. Target retention remains the only user-controlled
  memory goal in this view.
- The six regions retain their approved relative-strength treatment: lighter
  green on-target but fragile, stronger green on-target and durable; stronger
  amber watch-and-fragile, lighter amber watch-and-more-durable; stronger red
  deep-risk-and-fragile, lighter red deep-risk-and-more-durable. Color remains
  paired with circle, diamond, and triangle marks and direct region labels.
- Cap the visible plot at 30 deterministically selected problems while keeping
  the three summary counts based on the full eligible cohort. Prioritize deeper
  target shortfalls, then watch-band problems, then fragile on-target problems;
  redistribute unused slots severity-first.
- Hover or focus provides transient detail. Pointer or focus may enter the
  detail surface. A transient detail closes with the approved 150ms exit when
  the pointer leaves it. Click or Enter toggles pinning: first activation pins,
  activating the same point closes, and activating another point moves the pin.
  The close button, Escape, and outside interaction also dismiss pinned detail.
- Keep the compact detail layout, full linked LeetCode problem title, current
  status, exact recall, time above target, target difference, and last-reviewed
  value. Do not show the slug or expand this into a second diagnostic panel.
- Preserve the globally approved Chart/Table toggle using the same presentation
  dataset. The exact-value table remains constrained to the card and paginated.

## View 7 locked: memory signals by problem

Locked during visual review on August 22, 2026.

- **Learner question:** “Which current problems need attention, and exactly why
  were they flagged?”
- **Selected presentation:** use a table-native actionable-signals view. Show only
  qualifying current problems and explain each inclusion with a plain-English
  **Why it’s here** field. Do not add a decorative chart.
- **Boundary with View 6:** Retention Map is the fast spatial snapshot.
  Memory Signals is its exact diagnostic partner: it identifies the qualifying
  problems, names their qualifying signals, and exposes the values behind those
  signals.
- **No composite score:** do not collapse retrievability, durability,
  difficulty, lapses, and lateness into an opaque weighted risk number.
- **Problem navigation:** render the full problem title as a keyboard-focusable
  link to the canonical LeetCode problem. The title itself is the link; do not
  add a competing row-level action or require pointer hover to discover it.
- **Locked qualification rule:** a current active reviewed problem qualifies
  when at least one of these actionable health signals is true at the shared
  dashboard `asOf` instant: current predicted recall is below its configured
  target; its stored due time is already past; or its FSRS-derived target
  duration is below the fixed seven-day durability benchmark. Name every true
  qualifying signal in **Why it’s here** rather than selecting only one.
- **Supporting context only:** FSRS difficulty and historical lapse count do not
  independently qualify a recovered or currently healthy problem and do not
  appear in this intentionally compact primary table. This keeps lifetime
  history from acting like an irreversible warning.
- **No hidden historical window:** the view remains current-state. Do not use
  the selected 14/30/90-day range or an undisclosed recent-lapse window to
  decide whether a row appears.
- **Locked table density:** keep the primary table to three columns: **Rank**,
  **Problem**, and **Why it’s here**. Do not repeat recall, overdue days, or
  durability as separate columns when the exact values already appear in the
  reason treatments.
- **Reason treatments:** use compact, text-labelled, value-bearing treatments
  such as “Below recall 57%,” “8d overdue,” and “Low durability 0.9d.” Permit at
  most two wrapped lines of reasons per row, and never rely on color alone.
- **Locked ordering:** use transparent severity lanes. First place all
  below-target rows in descending percentage-point target shortfall. Then place
  remaining overdue rows in descending days overdue. Then place remaining
  low-durability rows in ascending target duration. A row with multiple signals
  occupies its highest-priority lane while still showing every true reason.
  Break remaining ties by normalized problem title ascending.
- **Visible cohort cap:** apply the locked ordering first, retain its first 25
  qualifying problems, and paginate only that retained cohort. Continue to show
  the full qualifying count; when more than 25 qualify, state explicitly that
  the table is showing the 25 highest-priority problems.
- **Pagination:** show five rows per page to preserve a stable card height when
  problem titles and reason treatments need two lines. Provide labelled
  Previous and Next buttons, announce the visible range, disable unavailable
  directions, and reset to page one whenever the current cohort is rebuilt.
- **Interaction restraint:** do not add search, filters, sortable headers, row
  selection, or a tooltip. The severity order is part of the view's meaning,
  and the table already exposes the exact values needed to understand it.
- **Current-state scope:** calculate membership at the shared dashboard `asOf`
  instant. The historical 14/30/90-day selection does not change this table.
  Label the view as current state so this exception is not hidden.
- **Missing values:** evaluate each signal only when its required source value
  is available. Do not infer a missing recall estimate or target duration as
  zero. A problem may still qualify through another fully supported signal.
- **Empty state:** when no problem qualifies, replace the table and pagination
  with the neutral message “No current problems meet these attention signals.”
  Do not turn the absence of signals into a guarantee about future recall.
- **Accessibility:** use a semantic table with a concise caption or accessible
  description. Keep the linked problem title in the native tab order with a
  visible focus state and identify that it opens LeetCode in a new tab. Reason
  treatments contain their labels and exact values in text, never color alone.
  Pagination changes announce the new visible range through a polite live
  region.
- **Responsive behavior:** retain the three-column structure at narrow widths,
  clamp the visible linked title to two lines without changing its accessible
  name, allow at most two wrapped lines of compact reasons, and contain all
  content inside the card without page-level horizontal scrolling.
- **Tests:** cover each independent qualification signal, multiple simultaneous
  signals, unavailable source values, current-state independence from
  14/30/90, severity-lane ordering, cross-lane rows, deterministic ties, the
  25-row cap, full qualifying counts, five-row pagination, page reset, empty
  state, linked-title semantics, text alternatives, two-line responsive states,
  and the absence of sorting or hidden composite scoring.
- **Claim boundary:** these are explicit current attention signals, not a
  diagnosis, mastery score, due queue, complete history, or guarantee of future
  recall. Suspended and inactive problems remain excluded.

## View 8 locked: recent overdue backlog

Locked on August 22, 2026 after the implementation audit and three visual
iterations.

- **Learner question:** “Is my overdue backlog staying at an acceptable level
  instead of accumulating over time?”
- **Supported interpretation:** show when the backlog grew, shrank, crossed the
  watch zone, or remained controlled. Do not claim why a change happened or
  prescribe a causal fix.
- **Metric and unit:** at each local-day observation instant, count active,
  non-suspended problems whose stored FSRS due time has passed and whose overdue
  state has not been cleared by a later review. The unit is overdue problems.
  This is a stock or level; never sum observations across days.
- **Source and lineage:** reconstruct each included problem's known due
  intervals from persisted FSRS review-log snapshots, current card state,
  creation time, and the shared as-of instant.
- **Missing history:** retain the full daily sequence and represent an
  unreconstructible day as **Not measured**. Break the chart line across that
  day rather than interpolating it or treating it as zero.
- **Range exception:** use one local-day observation for all 14-, 30-, and
  90-day selections. Reduce only x-axis tick density. This is an explicit
  exception to the shared three-day and weekly presentation buckets because
  aggregation can conceal a short-lived threshold breach.
- **Partial today:** include today as an in-progress daily observation and label
  it in the tooltip and table.
- **Reference:** retain the fixed five-problem watch zone for v1. It is a
  CogniPace product guardrail, not an FSRS threshold, scientific boundary, or
  personalized memory goal.
- **Selected mark:** use a daily step line because backlog is an end-of-day
  level that persists until the next observation. Keep a truthful zero baseline.
  Set the upper bound from the observed peak and threshold with modest breathing
  room, then use integer ticks.
- **Color and regions:** draw the line green at or below five and yellow above
  five. Use matching restrained background regions and direct “Within watch
  zone” and “Above watch zone” labels. Omit permanent point markers; show a
  temporary marker only during hover or keyboard focus.
- **Color-independent meaning:** the labelled threshold, labelled regions,
  tooltip count, accessible chart description, and exact-value table carry the
  meaning without relying on green or yellow.
- **Summary:** show known days within the zone, current known backlog, and known
  peak. When history is incomplete, use the reconstructible-day denominator,
  for example “8 of 11 known days within zone.”
- **Tooltip:** keep it deliberately minimal: full MM/DD/YY date and overdue
  problem count only, plus **In progress** on today. Do not repeat daily change
  or threshold status because the chart already explains them.
- **Exact-value table:** use the same daily rows with **Date** and **Overdue
  problems** columns. Display missing values as **Not measured**, label today as
  in progress, paginate at seven rows, and reset to page one when the selected
  range changes.
- **Evidence and takeaway:** disclose reconstructible days out of selected days.
  Current, peak, and within-zone summaries use known observations only. Suppress
  growth or shrinkage language unless at least two comparable known
  observations exist.
- **Responsive behavior:** preserve the daily dataset at every width, reduce
  visible date ticks to avoid collisions, hide optional in-plot region labels
  before essential labels, and keep the exact-value table contained within the
  figure.
- **Accessibility and interaction:** enable transient pointer and keyboard
  inspection, one chart tab stop with arrow-key daily navigation, a concise
  screen-reader summary, reduced-motion behavior, and the exhaustive semantic
  table path.
- **Tests:** cover local-day reconstruction, active and suspended cohorts,
  overdue interval boundaries, missing-history gaps, partial today, all three
  daily ranges, threshold equality, green/yellow line clipping, zero baseline,
  upper-domain padding, known-day summaries, minimal tooltip content,
  chart/table parity, seven-row pagination, keyboard inspection, reduced
  motion, and responsive tick selection.

## View 9 locked: upcoming review load

Locked on August 22, 2026 after the implementation audit and combined
chart/tooltip/table/accessibility review.

- **Plain-English meaning:** show the current scheduled workload snapshot: work
  already overdue at the shared as-of instant, work due later today, and work
  currently due on each of the next 13 local calendar days.
- **Forecast boundary:** this is not a guaranteed future workload. Completing a
  review can reschedule that card and change later bars, while time passing can
  move scheduled work into the overdue segment.
- **Current source:** query active default FSRS cards whose due instant is no
  later than the forecast boundary, exclude suspended problems, and group their
  exact due instants into local calendar days.
- **Fixed scope:** always use today plus the next 13 local days. The historical
  14/30/90 control and historical readiness do not alter this view.
- **Current separation:** place every card already overdue into today's overdue
  segment. Keep cards due later today in today's upcoming segment, and keep each
  future card in its scheduled local-day segment. Do not repeat overdue cards on
  later days.
- **Selected mark:** retain one stacked magnitude column per day so column height
  answers total scheduled load while color separates overdue from upcoming.
  Keep a zero baseline, integer ticks, and an upper domain derived from the
  tallest total column with breathing room.
- **Tooltip:** use only the full MM/DD/YY date followed by **Due** and
  **Overdue** counts in that order. Prefix today's date with **Today**. Keep both
  rows visible when a value is zero so the tooltip and table remain predictable.
- **Exact-value table:** use the same 14 rows and exactly three
  columns: **Date**, **Due**, and **Overdue**. Treat the date as the row header,
  right-align integer counts, paginate at seven rows, announce the visible
  range, disable unavailable directions, and reset to page one whenever the
  schedule snapshot is rebuilt.
- **Color-independent treatment:** keep Due solid green. Keep Overdue pink/red
  with a restrained diagonal hatch so the stacked segments remain
  distinguishable without color. Repeat the same labels and order in the
  legend, tooltip, accessible description, and table.
- **Accessibility:** expose Chart and Table as native labelled
  controls with one selected state. Give the chart one accessible name,
  description, and tab stop; use Left/Right arrows to inspect dates and announce
  tooltip changes politely. Keep the semantic table as the exhaustive fallback,
  with a caption, date row headers, numeric column headers, native pagination
  controls, visible focus, and a polite visible-range announcement.
- **Recharts support checked:** Recharts 3 enables its accessibility layer by
  default, focuses the chart surface, uses Left/Right arrow navigation, and
  connects the default tooltip to a live region. CogniPace must still test its
  custom tooltip and avoid duplicate chart tab stops or roles. The Table view
  remains required because screen-reader chart navigation depends on
  application/interaction modes, including VoiceOver QuickNav behavior.
- **Reduced motion:** keep the forecast columns unanimated. Presentation changes
  must not create looping or decorative motion.
- **All-zero state:** when every Due and Overdue count is zero, replace the empty
  plot with “No reviews are currently scheduled in the next 14 days.” Keep the
  Table view available with the exact zero rows.
- **Snapshot copy:** describe the chart as a current schedule
  snapshot that will change after reviews, scheduling changes, and the passage
  of time—not as a promise of exactly how many reviews the learner will perform.
- **Responsive behavior:** preserve all 14 daily columns, reduce visible x-axis
  ticks before labels collide, keep Today and the forecast endpoint visible,
  and contain the three-column table without page-level horizontal scrolling.
- **Tests:** cover due-instant boundaries, local-day grouping, suspended-card
  exclusion, today plus 13 days, historical-range independence, overdue
  placement only under Today, later-today separation, stack totals, zero
  baseline, integer ticks, upper-domain padding, minimal tooltip fields,
  chart/table parity, seven-row pagination and reset, solid-versus-hatched
  distinction, all-zero state, one chart tab stop, arrow-key navigation, live
  tooltip announcements, semantic table headers, reduced motion, and responsive
  tick selection.

## Chart-by-chart lock complete

All nine Analytics views now have a confirmed learner question, metric meaning,
source and eligibility boundary, range behavior, mark and scale, tooltip,
exact-value alternative, accessibility treatment, responsive behavior, and test
contract. Remaining work is consolidation into the formal Analytics dashboard
specification; it is not an invitation to reopen chart decisions without new
evidence or an explicit product change.
