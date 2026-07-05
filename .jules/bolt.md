## 2024-11-20 - Intl.DateTimeFormat caching
**Learning:** `new Intl.DateTimeFormat` instantiation is a huge performance bottleneck in React when used directly inside render functions or formatting helpers (e.g. table cells and custom tooltips), taking roughly 4.9 seconds for 10,000 instantiations versus 14ms when cached.
**Action:** Always hoist `Intl.DateTimeFormat` instantiations to module-level constants to avoid excessive cost on every render cycle, especially within components that render lists, grids, or respond to hover states.
