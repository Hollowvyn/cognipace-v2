# Analytics V1 Shadcn Charts Design

## Status

Approved direction captured from product discussion; implementation has not
started.

## Goal

Turn the Analytics dashboard into a chart-led personal memory report that
explains observed recall, FSRS predictions, practice consistency, topic
weakness, memory durability, and review workload without overwhelming the user.

The page should answer this sequence:

1. How am I performing?
2. Is the improvement becoming durable?
3. Does my practice rhythm appear to help?
4. How do I behave when reviews are difficult?
5. Where should I focus?
6. What looks fragile before it fails?
7. What workload is coming?

## Product scope

Analytics V1 is a read-only, local-first dashboard feature. It does not add
accounts, hosted reporting, backend services, or new sync behavior. FSRS
calculations remain behind the Analytics/Practice domain and service boundary;
React chart components only render typed chart-ready data.

The approved primary experience is based on the current chart preview:

- compact CogniPace / Analytics header
- 14/30/90-day period control
- main Recall Quality chart
- supporting metric signals
- paired secondary charts
- Retention Health and Fragile Knowledge details
- dark Terra Compact styling with responsive stacking

## Chart library decision

Use the shadcn Chart component layer with Recharts as the standard rendering
engine.

shadcn is not treated as a separate chart runtime. The local chart primitive
will provide the shared container, configuration, theme integration, tooltip,
legend, and accessibility conventions while Recharts supplies the chart
primitives.

Keep custom SVG shapes available for FSRS-specific marks, but do not make
hand-built SVG or CSS charts the default implementation approach.

### Shared foundation

Add the shadcn chart primitive at:

```text
src/components/ui/chart.tsx
```

Install Recharts as the chart rendering dependency. The shared primitive should
expose or support:

- `ChartContainer`
- `ChartTooltip`
- `ChartTooltipContent`
- `ChartLegend`
- `ChartLegendContent`
- typed chart configuration with human-readable labels
- CSS-variable-driven chart colors
- responsive sizing with an explicit minimum chart height
- Recharts accessibility support

The implementation should use the existing CogniPace tokens from
`src/styles/tokens.css`, not introduce a second visual theme.

## Component ownership

Generic chart infrastructure belongs in `src/components/ui/chart.tsx`.
Product-specific chart components belong inside the Analytics feature:

```text
src/features/analytics/components/charts/
  recall-quality-chart.tsx
  consistency-recall-chart.tsx
  ratings-mix-chart.tsx
  weakest-topics-chart.tsx
  memory-strength-chart.tsx
  overdue-backlog-chart.tsx
  upcoming-review-load-chart.tsx
  retention-health-chart.tsx
```

Analytics-specific pure transformations and metric definitions belong in the
Analytics domain, for example:

```text
src/features/analytics/domain/chart-data.ts
src/features/analytics/domain/metric-definitions.ts
```

The existing Analytics server/service remains responsible for composing local
database and FSRS data. The feature API contracts remain the runtime boundary
for serialized chart data and must continue to use Zod validation.

## Chart inventory

### Recall Quality

Recharts `ComposedChart` with:

- First-try recall line: observed first-attempt performance
- Predicted recall line: current FSRS estimate for recall probability
- 90% target `ReferenceLine`

The chart must visually distinguish observed results from model estimates.

Supporting signals:

- Memory strength: median stability and change over the selected period
- Hard + Again: review friction rate and period comparison
- Target gap: predicted recall compared with the target

### Consistency vs Recall Quality

Recharts `ScatterChart` with a lightweight trend line.

- X axis: review days per week
- Y axis: first-try recall
- Point size: eligible review volume

The copy must say “association” or equivalent. It must not claim that
consistency caused the observed difference.

### Ratings Mix

Stacked `BarChart` showing Again, Hard, Good, and Easy proportions by review
day or period bucket.

The main derived signal is the Hard + Again rate. Pie charts are not used for
this time-based part-to-whole view.

### Weakest Topics

Horizontal `BarChart` ranked by a documented topic focus score. The first
version should show recall quality as the primary visible measure, with
first-try performance, Hard + Again rate, overdue pressure, and lapses
available for ranking or tooltip detail when data supports them.

### Memory Strength

`LineChart` or `AreaChart` showing median stability over time. Stability is
shown in days and represents durability, not current recall probability.

### Recent Overdue Backlog

`AreaChart` showing overdue problem count across observed dates. A
`ReferenceArea` or equivalent watch zone should mark the agreed backlog
threshold.

Historical values must come from replayable review history or daily snapshots;
the chart must not imply a historical trend from a single current overdue
count.

### Upcoming Review Load

`BarChart` showing scheduled review counts by future date. The initial chart
uses the current FSRS schedule. Scenario projections for Good, Hard, and Again
assumptions can be added as tooltip or drill-down detail without making the
default view noisy.

### Retention Health

`ScatterChart` showing each active problem:

- X axis: days since review
- Y axis: predicted retrievability
- target `ReferenceLine`
- optional FSRS reference forgetting curve
- green, amber, and red risk categories

This chart is model-predicted memory health. It must not be labelled as the
same thing as observed recall quality.

### Fragile Knowledge

A quiet shadcn table linked conceptually to Retention Health. It highlights
problems that are currently recallable but vulnerable because of low stability,
high difficulty, previous lapses, or long review gaps.

## Metric definitions and user-facing language

### First-try recall

The percentage of eligible review sessions where the user recalled the problem
correctly on the first attempt, before retries, hints, or repeated submissions.

```text
correct first attempts / eligible review sessions
```

The implementation must define how a session starts, how retries are detected,
and how incomplete or missing attempt data is excluded. A retry must not count
as first-try success.

### Predicted recall

The FSRS estimate of the probability that the user would recall a problem if
asked at the selected moment. It is not a guarantee and is not the same as
observed correctness.

### Recall quality

The observed performance view of recent review behavior. First-try recall is
the main visible measure; rating distribution, correctness, and Hard + Again
provide supporting context.

The existing `retentionProxy` is currently a Good + Easy percentage over the
last 30 days. It must not be silently presented as FSRS retention. The UI
should use explicit labels such as “First-try recall”, “Observed recall
quality”, or “Predicted recall”.

### Target retention

The user’s desired FSRS recall threshold, commonly 90%. It is a scheduling
preference and not a grade.

### Memory strength

FSRS stability, expressed in days. It describes expected durability and is
distinct from current predicted recall.

### Hard + Again

The percentage of eligible ratings that are Hard or Again. It is a review
friction signal and should be shown as a trend when sample size supports it.

### Difficulty

The FSRS estimate of personal problem difficulty. It is distinct from the
problem’s LeetCode Easy/Medium/Hard label.

### Lapse

A failure on a problem that was already in the review phase. Lapse count and
recovery time support fragile-knowledge and lapse-cost analysis.

### Review consistency

The rhythm of practice, including review days per week, gaps between sessions,
streaks, and completion of scheduled reviews. More activity is not inherently
better; the desired signal is sustainable consistency.

### Schedule discipline

The difference between scheduled/due review time and actual review time. It
supports on-time rate, lateness, and the association between late reviews and
Again ratings.

### Overdue backlog and upcoming review load

Overdue backlog is accumulated work that should already have been reviewed.
Upcoming review load is future work predicted by the current FSRS schedule.

## Data flow and contracts

The intended flow is:

```text
SQLite review attempts and FSRS cards
  -> Analytics repository/service
  -> pure metric and chart-data builders
  -> Zod-validated serialized analytics contract
  -> AnalyticsScreen
  -> shadcn ChartContainer + Recharts chart
```

The UI must not calculate FSRS values, infer historical trends from current
state, or access persistence directly.

The current real data supports the initial migration of:

- current Retention Health
- current upcoming due forecast
- current weak-problem list
- current memory profile

Additional chart contracts are required for:

- recall-quality time series
- rating-mix time series
- practice consistency buckets
- topic aggregates
- stability history
- first-try performance
- Hard + Again trend
- overdue history
- fragile-knowledge details

If historical data is insufficient, the chart renders a truthful low-sample or
empty state instead of fabricated numbers.

## Interaction and accessibility

- The 14/30/90-day control changes the analytics query range and chart data;
  it is not decorative.
- Tooltips use plain-English labels, units, period, and sample size where
  relevant.
- Legends may toggle optional series, but the first view remains understandable
  with all primary series visible.
- Every chart has a visible title and concise screen-reader description.
- Recharts accessibility support is enabled where available.
- Colors are paired with labels and line/mark differences; color alone never
  carries meaning.
- Charts have explicit minimum heights and stack on narrow dashboard widths.
- Animation follows the existing motion tokens and respects reduced-motion
  preferences.
- Small samples suppress strong interpretations and display a clear qualifier.

## Implementation order

### Phase 1: Chart foundation

- Add Recharts and the local shadcn Chart primitive.
- Map chart tokens to the existing dark/light CogniPace theme.
- Establish shared tooltip, legend, axis, empty-state, and accessibility
  conventions.

### Phase 2: Existing real data migration

- Migrate the due forecast to Recharts.
- Migrate Retention Health to Recharts while preserving current FSRS behavior.
- Migrate weak problems and memory profile into the approved layout.
- Add focused component tests for loading, error, empty, and populated states.

### Phase 3: Primary V1 charts

- Add Recall Quality.
- Add Ratings Mix.
- Add Consistency vs Recall Quality.
- Add Weakest Topics.
- Add Memory Strength.

### Phase 4: Workload and risk completion

- Add Recent Overdue Backlog once historical data is available.
- Add Upcoming Review Load scenario detail.
- Add Fragile Knowledge table and linked details.
- Add the remaining schedule-discipline and calibration explanations when the
  required immutable history is available.

## Validation expectations

Because this is visible dashboard UI, implementation will require:

- focused Analytics component and contract tests
- `npm run lint`
- `npm run check`
- `npm run build`
- human dashboard happy-path and edge-case smoke testing
- screenshot or screen-recording proof at desktop and narrow widths
- light/dark theme and low-sample state verification

No application code or dependency changes are part of this design capture.
