import type { LeetCodeProblemLocation } from './types'

export function parseLeetCodeProblemLocation(
  value: string | URL,
): LeetCodeProblemLocation | null {
  const url = readUrl(value)

  if (!url || !isLeetCodeHost(url.hostname)) {
    return null
  }

  const [section, rawSlug] = url.pathname.split('/').filter(Boolean)

  if (section !== 'problems' || !rawSlug) {
    return null
  }

  const slug = normalizeLeetCodeSlug(rawSlug)

  if (!slug) {
    return null
  }

  return {
    slug,
    url: createLeetCodeProblemUrl(slug),
    host: url.hostname,
  }
}

export function parseLeetCodeProblemInput(value: string) {
  const location = parseLeetCodeProblemLocation(value)

  if (location) {
    return location
  }

  const slug = normalizeLeetCodeSlug(value)

  if (!slug) {
    return null
  }

  return {
    slug,
    url: createLeetCodeProblemUrl(slug),
    host: 'leetcode.com',
  } satisfies LeetCodeProblemLocation
}

export function normalizeLeetCodeSlug(value: string) {
  const location = parseLeetCodeProblemLocation(value)

  if (location) {
    return location.slug
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^problems\//, '')
    .replace(/\/.*/, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function createLeetCodeProblemUrl(slug: string) {
  return `https://leetcode.com/problems/${normalizeLeetCodeSlug(slug)}/`
}

export function titleFromLeetCodeSlug(slug: string) {
  return normalizeLeetCodeSlug(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function isLeetCodeProblemUrl(value: string | URL) {
  return Boolean(parseLeetCodeProblemLocation(value))
}

export function isLeetCodeHost(hostname: string) {
  return hostname === 'leetcode.com' || hostname === 'www.leetcode.com'
}

function readUrl(value: string | URL) {
  if (value instanceof URL) {
    return value
  }

  try {
    return new URL(value)
  } catch {
    return null
  }
}
