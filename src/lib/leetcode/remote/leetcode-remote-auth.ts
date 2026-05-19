import { readCookieValue } from '../core/value-readers'

import type { LeetCodeRemoteAuth } from './leetcode-remote-client'

/** Reads LeetCode auth values available to the content script page context. */
export function readLeetCodeRemoteAuthFromDocument(
  documentRef: Document = document,
): LeetCodeRemoteAuth {
  return {
    csrfToken: readCookieValue(documentRef.cookie, 'csrftoken'),
  }
}
