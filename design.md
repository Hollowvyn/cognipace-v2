---
name: Terra Compact
colors:
  surface: '#101414'
  surface-dim: '#101414'
  surface-bright: '#353a3a'
  surface-container-lowest: '#0a0f0f'
  surface-container-low: '#181c1c'
  surface-container: '#1c2020'
  surface-container-high: '#262b2b'
  surface-container-highest: '#313635'
  on-surface: '#dfe3e2'
  on-surface-variant: '#c0c9c1'
  inverse-surface: '#dfe3e2'
  inverse-on-surface: '#2d3131'
  outline: '#8b938c'
  outline-variant: '#414943'
  surface-tint: '#a1d1b4'
  primary: '#a1d1b4'
  on-primary: '#063824'
  primary-container: '#2d5a43'
  on-primary-container: '#9fcfb2'
  inverse-primary: '#3a674f'
  secondary: '#bec9c4'
  on-secondary: '#28332f'
  secondary-container: '#3e4945'
  on-secondary-container: '#acb8b3'
  tertiary: '#fbbc00'
  on-tertiary: '#402d00'
  tertiary-container: '#694d00'
  on-tertiary-container: '#f9bb00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#bceecf'
  primary-fixed-dim: '#a1d1b4'
  on-primary-fixed: '#002112'
  on-primary-fixed-variant: '#224f39'
  secondary-fixed: '#dae5e0'
  secondary-fixed-dim: '#bec9c4'
  on-secondary-fixed: '#141e1b'
  on-secondary-fixed-variant: '#3e4945'
  tertiary-fixed: '#ffdfa0'
  tertiary-fixed-dim: '#fbbc00'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#101414'
  on-background: '#dfe3e2'
  surface-variant: '#313635'
typography:
  display-lg:
    fontFamily: Literata
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title-sm:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.4'
  body-md:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Nunito Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  label-caps:
    fontFamily: Nunito Sans
    fontSize: 11px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.05em
  metric-lg:
    fontFamily: Nunito Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gap-dense: 12px
  gap-standard: 16px
  margin-page: 24px
  container-padding: 12px
---

# Terra Compact

## Brand & Style

The design system is a high-density, technical framework designed for precision monitoring and complex data management. It adopts a **Corporate / Modern** aesthetic with a lean toward **Minimalism**, prioritizing information density and clarity over decorative flair.

The brand personality is deliberate and focused. It avoids the soft, organic tropes often associated with environmental themes in favor of an industrial, data-driven approach. The UI should evoke a sense of professional control, reliability, and technical rigor. Visual interest is derived from structured information hierarchies and sharp execution rather than imagery or ornamentation.

## Colors

The color palette is rooted in a deep, dark slate-green foundation, providing a low-fatigue environment for long-duration monitoring.

- **Primary**: A resolute Forest Green (#2D5A43) used for high-importance actions and active states.
- **Surface**: The background and container layers use Dark Slate-Green (#1A2421), creating a monolithic, technical base.
- **Tertiary/Highlight**: Amber (#FFBF00) is reserved for status warnings, critical metrics, and precise highlights to ensure they pop against the dark backdrop.
- **Neutral**: Cool greys and off-whites are used for typography to maintain high legibility without the harshness of pure white.

## Typography

The typography strategy balances editorial authority with functional utility.

- **Brand/Titles**: Literata is used sparingly for page titles and high-level section headers to provide a grounded, authoritative voice.
- **UI/Body**: Nunito Sans handles all interface elements, navigation, and body copy. It is selected for its high legibility at small sizes.
- **Data/Metrics**: For all numerical values, timers, and coordinates, `tabular-nums` must be enabled to ensure alignment in dashboards and lists.
- **Mobile Scaling**: Headlines scale down by 15% on mobile devices, while body text remains consistent at 14px to ensure readability.

## Layout & Spacing

This design system utilizes a **Fixed Grid** philosophy for dashboard views and a fluid layout for data tables. The primary goal is high information density.

- **Grid**: A 12-column grid is standard for desktop, collapsing to 4 columns on mobile.
- **Gaps**: Use 12px gaps for related dashboard widgets and 16px for distinct functional sections.
- **Density**: Padding within components is tightened (12px) to maximize the amount of visible data on a single screen without sacrificing click targets.
- **Breakpoints**: Desktop (1280px+), Tablet (768px-1279px), Mobile (under 767px).

## Elevation & Depth

Depth is communicated through **Tonal Layers** rather than heavy shadows. In a dark, technical UI, stacking is achieved by lightening the surface color of the "elevated" element.

- **Base Layer**: The darkest slate-green.
- **Raised Layer (Cards/Panels)**: One step lighter than the base.
- **Overlays (Modals/Menus)**: The lightest surface value with a subtle 1px border (#FFFFFF15) to define edges.
- **Shadows**: If used, they should be sharp, low-spread, and high-opacity (e.g., `0 2px 4px rgba(0,0,0,0.5)`) to maintain a "heavy" and structured feel.

## Shapes

Shapes are disciplined but adopt a more approachable **Rounded** profile. This balance ensures the technical UI remains clean while avoiding an overly aggressive or "sharp" industrial feel.

- **Containers**: Cards and main panels use a substantial 16px (rounded-lg) radius to clearly define content boundaries.
- **Interactive Elements**: Primary and secondary buttons use a standard 8px radius (DEFAULT) to provide a soft, tactile feel that invites interaction.
- **Status/Tags**: Only chips, badges, and status indicators use a full pill-shape (999px) to provide a clear visual departure from the structural grid.

## Components

- **Buttons**: High-contrast Forest Green backgrounds with white text for primary actions. Use 1px borders for ghost/secondary buttons. Standard 8px corner radius.
- **Input Fields**: Darker than the card background to create an "inset" look. Use Amber for focus states to highlight the active entry point.
- **Cards**: Minimalist with 16px rounded corners. No drop shadows; use 1px borders or subtle value shifts to define edges. Title areas should have a distinct background tint.
- **Chips/Badges**: Small, pill-shaped, using the Amber tertiary color for warnings or specific status flags.
- **Data Lists**: High density, 40px row heights. Use alternating row stripes or subtle dividers.
- **Metrics**: Large Nunito Sans text with tabular numerals. Place units (e.g., "kg", "ms") in a smaller, low-opacity label style next to the value.

## CogniPace Popup Rules

- The popup is a compact Chrome extension command surface, not a mini dashboard.
- The header shows only the brand and settings action in the normal state.
- Do not show persistent explanation banners or helper paragraphs in the normal state.
- Use stateful controls, concise inline feedback, and native tooltips for secondary explanations.
- The normal populated popup should answer: what to review now, and what to study next.

## CogniPace Analytics Rules

- The historical range control offers 90 days, 120 days, and All time. Keep the
  exact range, timezone, and as-of scope visible and announce range refreshes
  politely to assistive technology.
- Preserve elapsed calendar time and every presentation row. Empty periods are
  Not measured positions; never compress them into review-event order.
- Use solid line segments for adjacent measurements, a dashed bridge across
  exactly one empty bucket, and a break across two or more empty buckets. Do not
  put a marker or tooltip value in a gap.
- Evidence controls the mark: under 30 eligible history days is Table-only; one
  measured bucket is one mark; two to five are unconnected marks; a line needs
  at least six measured buckets and 30 observations. Use quiet evidence copy,
  not repeated warning banners or shorter-range recommendations.
- Every chart has a semantic Table backed by the same presentation rows. Use
  `MM/DD/YY` for full dates and `MM/DD/YY–MM/DD/YY` for bucket spans; compact
  axes may abbreviate while keeping the first and last labels.
- Tooltips supplement rather than replace exact Tables. They must work with
  pointer and keyboard input, preserve visible focus, use semantic labels, and
  never rely on color alone. Interactive Retention Map details may be pinned and
  dismissed with the same-point toggle, close control, Escape, or outside click,
  with focus restored afterward.
- Current-state Views 6–7 do not change with the historical selector. View 8 is
  a fixed 120-day daily local backlog; View 9 is today plus 13 local dates.
- At narrow widths, reduce tick density and optional in-plot labels before
  removing data. Tables may scroll horizontally, but controls, tooltips,
  dialogs, pagination, and keyboard focus must remain usable at 200–400% zoom,
  forced colors, and reduced motion.
