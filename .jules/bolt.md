## 2024-11-20 - Intl.DateTimeFormat caching
**Learning:** `new Intl.DateTimeFormat` instantiation is a huge performance bottleneck in React when used directly inside render functions or formatting helpers (e.g. table cells and custom tooltips), taking roughly 4.9 seconds for 10,000 instantiations versus 14ms when cached.
**Action:** Always hoist `Intl.DateTimeFormat` instantiations to module-level constants to avoid excessive cost on every render cycle, especially within components that render lists, grids, or respond to hover states.
## 2026-07-19 - Max Call Stack Exceeded with Math.max spread
**Learning:** Using `Math.max(..., array.map(fn))` throws "Maximum call stack size exceeded" on large datasets because the spread operator expands the array into individual function arguments, hitting engine limits. It also creates intermediate array allocations.
**Action:** Always use `.reduce((max, item) => Math.max(max, val), init)` for array max/min calculations to keep O(1) space complexity and avoid call stack limits.
