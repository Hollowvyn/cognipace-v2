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

export type LeetCodeVisibleProblemSummary = LeetCodeDomSnapshot

export function readLeetCodeVisibleProblemSummary(
  pageRoot: ParentNode = document,
): LeetCodeDomSnapshot {
  const problemLocation = readLeetCodeProblemLocationFromPageRoot(pageRoot)
  const pageSnapshot = readLeetCodePageSnapshot(pageRoot, {
    location:
      problemLocation ??
      ({
        slug: '',
        url: 'https://leetcode.com/problems/',
        host: 'leetcode.com',
      } satisfies LeetCodeProblemLocation),
  })

  return {
    title: pageSnapshot.title,
    difficulty: pageSnapshot.difficulty,
    isPremium: pageSnapshot.isPremium,
  }
}

export const readLeetCodeDomSnapshot = readLeetCodeVisibleProblemSummary

export function readLeetCodePageSnapshot(
  pageRoot: ParentNode = document,
  snapshotOptions: {
    location?: LeetCodeProblemLocation | null | undefined
    now?: (() => number) | undefined
  } = {},
): LeetCodePageSnapshot {
  const problemLocation =
    snapshotOptions.location ??
    readLeetCodeProblemLocationFromPageRoot(pageRoot)

  if (!problemLocation) {
    throw new Error('Cannot read a LeetCode page snapshot without a location.')
  }

  const problemMetadataRoot = readLeetCodeProblemMetadataRoot(pageRoot)
  const problemTitle = readLeetCodeProblemTitle(
    pageRoot,
    problemMetadataRoot,
    problemLocation.slug,
  )
  const problemDifficulty = readLeetCodeDifficultyFromPage(problemMetadataRoot)
  const problemTopics = readLeetCodeTopics(problemMetadataRoot)

  return {
    location: problemLocation,
    title: problemTitle.title,
    frontendId: problemTitle.frontendId,
    difficulty: problemDifficulty,
    isPremium: readLeetCodePremiumLockState(problemMetadataRoot),
    topics: problemTopics,
    isReady: Boolean(
      problemTitle.title ||
      problemDifficulty !== 'Unknown' ||
      problemTopics.length,
    ),
    capturedAt: snapshotOptions.now?.() ?? Date.now(),
  }
}

export function readLeetCodeProblemLocationFromPageRoot(pageRoot: ParentNode) {
  const ownerDocument = getOwnerDocument(pageRoot)
  const pageHref = ownerDocument?.defaultView?.location.href

  return pageHref ? parseLeetCodeProblemLocation(pageHref) : null
}

export const readLocationFromRoot = readLeetCodeProblemLocationFromPageRoot

function readLeetCodeProblemTitle(
  pageRoot: ParentNode,
  problemMetadataRoot: ParentNode,
  slug: string,
) {
  const problemTitleText =
    readFirstNonEmptyTextFromSelectors(
      problemMetadataRoot,
      leetCodeVisibleTitleSelectors,
    ) ??
    readFirstNonEmptyTextFromSelectors(pageRoot, leetCodePageTitleSelectors) ??
    titleFromLeetCodeSlug(slug)
  const numberedTitleMatch = problemTitleText.match(/^\s*(\d+)\.\s+(.+?)\s*$/)

  return {
    title: (numberedTitleMatch?.[2] ?? problemTitleText).trim() || null,
    frontendId:
      numberedTitleMatch?.[1] ?? readLeetCodeFrontendId(problemMetadataRoot),
  }
}

function readLeetCodeFrontendId(problemMetadataRoot: ParentNode) {
  const titleWithFrontendId = readFirstNonEmptyTextFromSelectors(
    problemMetadataRoot,
    leetCodeFrontendIdSelectors,
  )

  return titleWithFrontendId?.match(/^\s*(\d+)\./)?.[1] ?? null
}

function readLeetCodeProblemMetadataRoot(pageRoot: ParentNode) {
  for (const selector of leetCodeProblemMetadataRootSelectors) {
    const problemMetadataElement = pageRoot.querySelector(selector)

    if (problemMetadataElement) {
      return problemMetadataElement
    }
  }

  return pageRoot
}

function readLeetCodeDifficultyFromPage(
  problemMetadataRoot: ParentNode,
): LeetCodeDifficulty {
  const scopedDifficultyText = readFirstNonEmptyTextFromSelectors(
    problemMetadataRoot,
    leetCodeScopedDifficultySelectors,
  )

  if (scopedDifficultyText) {
    return parseLeetCodeDifficulty(scopedDifficultyText)
  }

  const visibleDifficultyText = Array.from(
    problemMetadataRoot.querySelectorAll(leetCodeDifficultyCandidatesSelector),
  )
    .map((difficultyElement) => difficultyElement.textContent?.trim() ?? '')
    .find(
      (difficultyText) =>
        difficultyText === 'Easy' ||
        difficultyText === 'Medium' ||
        difficultyText === 'Hard',
    )

  return parseLeetCodeDifficulty(visibleDifficultyText)
}

function readLeetCodePremiumLockState(problemMetadataRoot: ParentNode) {
  if (problemMetadataRoot.querySelector(leetCodePremiumSelector)) {
    return true
  }

  const hasPremiumLockText = Array.from(
    problemMetadataRoot.querySelectorAll(leetCodePremiumTextCandidatesSelector),
  ).some((premiumCandidateElement) => {
    const premiumCandidateText = premiumCandidateElement.textContent
      ?.trim()
      .toLowerCase()
    return (
      premiumCandidateText === 'premium' ||
      premiumCandidateText === 'premium only' ||
      premiumCandidateText === 'subscribe to unlock'
    )
  })

  return hasPremiumLockText ? true : null
}

function readLeetCodeTopics(problemMetadataRoot: ParentNode): LeetCodeTopic[] {
  const detectedTopics = Array.from(
    problemMetadataRoot.querySelectorAll<HTMLAnchorElement>(
      leetCodeTopicLinkSelector,
    ),
  )
    .map((topicLink) => {
      const topicName = topicLink.textContent?.trim()

      if (!topicName) {
        return null
      }

      return {
        name: topicName,
        slug: readLeetCodeTopicSlugFromHref(topicLink.getAttribute('href')),
      } satisfies LeetCodeTopic
    })
    .filter((topic): topic is LeetCodeTopic => Boolean(topic))

  return uniqueTopicsBySlugOrName(detectedTopics)
}

function readFirstNonEmptyTextFromSelectors(
  elementRoot: ParentNode,
  selectors: readonly string[],
) {
  for (const selector of selectors) {
    const matchingElement = elementRoot.querySelector(selector)

    if (!matchingElement) {
      continue
    }

    if (matchingElement instanceof HTMLMetaElement) {
      const metaContent = matchingElement.getAttribute('content')?.trim()

      if (metaContent) {
        return metaContent
      }
    }

    const elementText = matchingElement.textContent?.trim()

    if (elementText) {
      return elementText
    }
  }

  return null
}

function readLeetCodeTopicSlugFromHref(topicHref: string | null) {
  if (!topicHref) {
    return null
  }

  try {
    const topicUrl = new URL(topicHref, 'https://leetcode.com')
    return topicUrl.pathname.split('/').filter(Boolean).at(-1) ?? null
  } catch {
    return null
  }
}

function uniqueTopicsBySlugOrName(topics: LeetCodeTopic[]) {
  const seenTopicKeys = new Set<string>()

  return topics.filter((topic) => {
    const topicKey = topic.slug ?? topic.name.toLowerCase()

    if (seenTopicKeys.has(topicKey)) {
      return false
    }

    seenTopicKeys.add(topicKey)
    return true
  })
}

function getOwnerDocument(pageRoot: ParentNode) {
  if ('nodeType' in pageRoot && pageRoot.nodeType === Node.DOCUMENT_NODE) {
    return pageRoot as Document
  }

  return pageRoot.ownerDocument
}
