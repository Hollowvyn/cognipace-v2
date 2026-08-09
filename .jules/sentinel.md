## 2024-06-07 - Add DOMPurify to mitigate DOM-based XSS in LeetCode problem reader
**Vulnerability:** Raw HTML from a GraphQL response (`contentHtml`) was being assigned directly to `contentDocument.body.innerHTML` without sanitization.
**Learning:** External API responses containing HTML content must always be sanitized before being injected into the DOM, even if the source is trusted (e.g., LeetCode API), to prevent DOM-based XSS vulnerabilities.
**Prevention:** Use a robust sanitization library like `DOMPurify` to sanitize HTML content before injecting it using `innerHTML`.

## 2025-02-27 - Fix prototype-based method bypass in runtime policy
**Vulnerability:** The `isExtensionMethod` function used the `in` operator to check if a method string exists in the `methodSurfaceAccess` object.
**Learning:** The `in` operator checks both own properties and inherited prototype properties. If an attacker sends a message with an inherited method name like `"toString"` or `"valueOf"`, the check returns `true`, allowing the request to proceed. This bypasses the boundary and can lead to a runtime TypeError when it attempts to call `.includes()` on the inherited function object.
**Prevention:** Use `Object.prototype.hasOwnProperty.call(obj, key)` or `Object.hasOwn(obj, key)` to ensure only own properties are considered when validating untrusted keys against a dictionary or map.
