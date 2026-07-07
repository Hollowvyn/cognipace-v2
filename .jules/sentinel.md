## 2024-06-07 - Add DOMPurify to mitigate DOM-based XSS in LeetCode problem reader
**Vulnerability:** Raw HTML from a GraphQL response (`contentHtml`) was being assigned directly to `contentDocument.body.innerHTML` without sanitization.
**Learning:** External API responses containing HTML content must always be sanitized before being injected into the DOM, even if the source is trusted (e.g., LeetCode API), to prevent DOM-based XSS vulnerabilities.
**Prevention:** Use a robust sanitization library like `DOMPurify` to sanitize HTML content before injecting it using `innerHTML`.

## 2025-02-20 - Avoid DOM XSS via innerHTML
**Learning:** Even when using DOMPurify, static analysis tools and best practices flag `innerHTML` usage as a potential DOM XSS vulnerability.
**Action:** When sanitizing HTML with DOMPurify, pass `{ RETURN_DOM_FRAGMENT: true, RETURN_DOM: true }` to `sanitize()`, cast the result to a `DocumentFragment` (since DOMPurify's types are overloaded), and safely append the nodes using `appendChild()` rather than assigning to `.innerHTML`.
