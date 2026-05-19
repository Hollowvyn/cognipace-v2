import { parseLeetCodeDifficulty } from '../domain/difficulty'
import {
  parseLeetCodeProblemLocation,
  titleFromLeetCodeSlug,
} from '../domain/problem-url'
import type {
  LeetCodeDifficulty,
  LeetCodePageSnapshot,
  LeetCodeProblemLocation,
  LeetCodeTopic,
} from '../domain/types'
import {
  leetCodeDifficultyCandidatesSelector,
  leetCodeFrontendIdSelectors,
  leetCodePageTitleSelectors,
  leetCodePremiumSelector,
  leetCodePremiumTextCandidatesSelector,
  leetCodeProblemMetadataRootSelectors,
  leetCodeScopedDifficultySelectors,
  leetCodeTopicLinkSelector,
  leetCodeVisibleTitleSelectors,
} from './selectors'

export type LeetCodeDomSnapshot = Pick<
  LeetCodePageSnapshot,
  'title' | 'difficulty' | 'isPremium'
>

export function readLeetCodeDomSnapshot(
  root: ParentNode = document,
): LeetCodeDomSnapshot {
  const location = readLocationFromRoot(root)
  const snapshot = readLeetCodePageSnapshot(root, {
    location:
      location ??
      ({
        slug: '',
        url: 'https://leetcode.com/problems/',
        host: 'leetcode.com',
      } satisfies LeetCodeProblemLocation),
  })

  return {
    title: snapshot.title,
    difficulty: snapshot.difficulty,
    isPremium: snapshot.isPremium,
  }
}

export function readLeetCodePageSnapshot(
  root: ParentNode = document,
  options: {
    location?: LeetCodeProblemLocation | null | undefined
    now?: (() => number) | undefined
  } = {},
): LeetCodePageSnapshot {
  const location = options.location ?? readLocationFromRoot(root)

  if (!location) {
    throw new Error('Cannot read a LeetCode page snapshot without a location.')
  }

  const metadataRoot = readProblemMetadataRoot(root)
  const titleParts = readTitleParts(root, metadataRoot, location.slug)
  const difficulty = readDifficulty(metadataRoot)
  const topics = readTopics(metadataRoot)

  return {
    location,
    title: titleParts.title,
    frontendId: titleParts.frontendId,
    difficulty,
    isPremium: readPremium(metadataRoot),
    topics,
    isReady: Boolean(
      titleParts.title || difficulty !== 'Unknown' || topics.length,
    ),
    capturedAt: options.now?.() ?? Date.now(),
  }
}

export function readLocationFromRoot(root: ParentNode) {
  const documentRef = getDocument(root)
  const href = documentRef?.defaultView?.location.href

  return href ? parseLeetCodeProblemLocation(href) : null
}

function readTitleParts(
  root: ParentNode,
  metadataRoot: ParentNode,
  slug: string,
) {
  const rawTitle =
    readTextFromFirstMatch(metadataRoot, leetCodeVisibleTitleSelectors) ??
    readTextFromFirstMatch(root, leetCodePageTitleSelectors) ??
    titleFromLeetCodeSlug(slug)
  const titleMatch = rawTitle.match(/^\s*(\d+)\.\s+(.+?)\s*$/)

  return {
    title: (titleMatch?.[2] ?? rawTitle).trim() || null,
    frontendId: titleMatch?.[1] ?? readFrontendId(metadataRoot),
  }
}

function readFrontendId(root: ParentNode) {
  const candidate = readTextFromFirstMatch(root, leetCodeFrontendIdSelectors)

  return candidate?.match(/^\s*(\d+)\./)?.[1] ?? null
}

function readProblemMetadataRoot(root: ParentNode) {
  for (const selector of leetCodeProblemMetadataRootSelectors) {
    const node = root.querySelector(selector)

    if (node) {
      return node
    }
  }

  return root
}

function readDifficulty(root: ParentNode): LeetCodeDifficulty {
  const scopedText = readTextFromFirstMatch(
    root,
    leetCodeScopedDifficultySelectors,
  )

  if (scopedText) {
    return parseLeetCodeDifficulty(scopedText)
  }

  const exact = Array.from(
    root.querySelectorAll(leetCodeDifficultyCandidatesSelector),
  )
    .map((node) => node.textContent?.trim() ?? '')
    .find((text) => text === 'Easy' || text === 'Medium' || text === 'Hard')

  return parseLeetCodeDifficulty(exact)
}

function readPremium(root: ParentNode) {
  if (root.querySelector(leetCodePremiumSelector)) {
    return true
  }

  const marker = Array.from(
    root.querySelectorAll(leetCodePremiumTextCandidatesSelector),
  ).some((node) => {
    const text = node.textContent?.trim().toLowerCase()
    return (
      text === 'premium' ||
      text === 'premium only' ||
      text === 'subscribe to unlock'
    )
  })

  return marker ? true : null
}

function readTopics(root: ParentNode): LeetCodeTopic[] {
  const topics = Array.from(
    root.querySelectorAll<HTMLAnchorElement>(leetCodeTopicLinkSelector),
  )
    .map((anchor) => {
      const name = anchor.textContent?.trim()

      if (!name) {
        return null
      }

      return {
        name,
        slug: readSlugFromHref(anchor.getAttribute('href')),
      } satisfies LeetCodeTopic
    })
    .filter((topic): topic is LeetCodeTopic => Boolean(topic))

  return uniqueTopics(topics)
}

function readTextFromFirstMatch(
  root: ParentNode,
  selectors: readonly string[],
) {
  for (const selector of selectors) {
    const node = root.querySelector(selector)

    if (!node) {
      continue
    }

    if (node instanceof HTMLMetaElement) {
      const content = node.getAttribute('content')?.trim()

      if (content) {
        return content
      }
    }

    const text = node.textContent?.trim()

    if (text) {
      return text
    }
  }

  return null
}

function readSlugFromHref(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value, 'https://leetcode.com')
    return url.pathname.split('/').filter(Boolean).at(-1) ?? null
  } catch {
    return null
  }
}

function uniqueTopics(topics: LeetCodeTopic[]) {
  const seen = new Set<string>()

  return topics.filter((topic) => {
    const key = topic.slug ?? topic.name.toLowerCase()

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function getDocument(root: ParentNode) {
  if ('nodeType' in root && root.nodeType === Node.DOCUMENT_NODE) {
    return root as Document
  }

  return root.ownerDocument
}
