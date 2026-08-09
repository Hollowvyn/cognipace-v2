## 2024-11-20 - Intl.DateTimeFormat caching
**Learning:** `new Intl.DateTimeFormat` instantiation is a huge performance bottleneck in React when used directly inside render functions or formatting helpers (e.g. table cells and custom tooltips), taking roughly 4.9 seconds for 10,000 instantiations versus 14ms when cached.
**Action:** Always hoist `Intl.DateTimeFormat` instantiations to module-level constants to avoid excessive cost on every render cycle, especially within components that render lists, grids, or respond to hover states.

## 2024-08-09 - Avoid spreading potentially large arrays into Math.max
**Learning:** Avoid using the spread operator with `Math.max()` or `Math.min()` on potentially large arrays (e.g., `Math.max(...array.map(...))`). It allocates unnecessary intermediate arrays and can throw a `RangeError: Maximum call stack size exceeded` if the array exceeds maximum call stack size limits.
**Action:** Use `.reduce()` instead (e.g., `array.reduce((max, val) => Math.max(max, val), initialValue)`) for O(n) time and O(1) space complexity.
