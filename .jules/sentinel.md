## 2024-06-07 - Add DOMPurify to mitigate DOM-based XSS in LeetCode problem reader
**Vulnerability:** Raw HTML from a GraphQL response (`contentHtml`) was being assigned directly to `contentDocument.body.innerHTML` without sanitization.
**Learning:** External API responses containing HTML content must always be sanitized before being injected into the DOM, even if the source is trusted (e.g., LeetCode API), to prevent DOM-based XSS vulnerabilities.
**Prevention:** Use a robust sanitization library like `DOMPurify` to sanitize HTML content before injecting it using `innerHTML`.

## 2025-02-15 - Sanitize dynamic ID interpolation in ChartStyle to prevent CSS injection and XSS
**Vulnerability:** A component property `id` was being dynamically embedded directly into a CSS class selector inside a `<style dangerouslySetInnerHTML>` block without sanitization.
**Learning:** Even though component props might seem harmless, embedding raw variables into `<style dangerouslySetInnerHTML>` templates without validation exposes the application to CSS injection and cross-site scripting (XSS), as an attacker or malicious data source could theoretically inject arbitrary styles or break out of the style block.
**Prevention:** Always validate or sanitize dynamic inputs before interpolating them into HTML structures when using `dangerouslySetInnerHTML`. In this case, stripping all non-alphanumeric/hyphen/underscore characters via regex `id.replace(/[^a-zA-Z0-9_-]/g, '')` ensures the ID only contains safe CSS selector characters.
