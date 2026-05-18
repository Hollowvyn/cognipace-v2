export type LeetCodeProblemLocation = {
  slug: string
  url: string
}

export function parseLeetCodeProblemLocation(
  value: string | URL,
): LeetCodeProblemLocation | null {
  const url = typeof value === 'string' ? new URL(value) : value

  if (!isLeetCodeHost(url.hostname)) {
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
    url: `https://leetcode.com/problems/${slug}/`,
  }
}

export function normalizeLeetCodeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isLeetCodeHost(hostname: string) {
  return hostname === 'leetcode.com' || hostname === 'www.leetcode.com'
}
