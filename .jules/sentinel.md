## 2025-10-18 - Prevent CSS Injection in Chart Styles
**Vulnerability:** The `chartId` variable in `src/components/ui/chart.tsx` was directly interpolating a user-provided `id` prop into a CSS selector inside a `<style dangerouslySetInnerHTML>` block, allowing for potential CSS injection or XSS if the ID contained unsafe characters (e.g., `</style><script>`).
**Learning:** Even when standard component props (like `id`) are used, if they are injected directly into raw HTML/CSS strings rather than React elements, they must be sanitized.
**Prevention:** Always sanitize dynamically interpolated strings used in `<style dangerouslySetInnerHTML>` blocks, for example by stripping non-alphanumeric characters with `.replace(/[^a-zA-Z0-9_-]/g, '')`.
