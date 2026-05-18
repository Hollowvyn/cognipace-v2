export type LeetCodeDomSnapshot = {
  title: string | null
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unknown'
  isPremium: boolean | null
}

export function readLeetCodeDomSnapshot(
  root: ParentNode = document,
): LeetCodeDomSnapshot {
  const title = root.querySelector('a[href^="/problems/"]')?.textContent ?? null
  const difficultyText = root.textContent ?? ''

  return {
    title: title?.trim() || null,
    difficulty: readDifficulty(difficultyText),
    isPremium: null,
  }
}

function readDifficulty(value: string): LeetCodeDomSnapshot['difficulty'] {
  if (value.includes('Easy')) return 'Easy'
  if (value.includes('Medium')) return 'Medium'
  if (value.includes('Hard')) return 'Hard'
  return 'Unknown'
}
