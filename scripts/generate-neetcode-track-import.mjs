import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = resolve(
  repositoryRoot,
  'track-imports/neetcode-150-and-250.json',
)
const fixturePath = resolve(
  repositoryRoot,
  'src/features/tracks/api/fixtures/legacy-neetcode-tracks.ts',
)
const legacyRelativePath = 'src/features/problems/data/seed/curatedSets.ts'

function getMainRepositoryRoot() {
  const commonGitDirectory = execFileSync(
    'git',
    ['rev-parse', '--git-common-dir'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ).trim()

  if (!commonGitDirectory) {
    throw new Error('Could not determine the Git common directory.')
  }

  return dirname(resolve(repositoryRoot, commonGitDirectory))
}

function getLegacySourcePath() {
  const legacySourcePath = resolve(
    getMainRepositoryRoot(),
    '..',
    'CogniPace',
    legacyRelativePath,
  )

  if (!existsSync(legacySourcePath)) {
    throw new Error(
      'Expected the developer-only legacy source at ../CogniPace/' +
        legacyRelativePath +
        ', but it was not found.',
    )
  }

  return legacySourcePath
}

function getPropertyInitializer(object, propertyName) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === propertyName,
  )

  if (!property) {
    throw new Error(
      'Legacy source is missing the ' + propertyName + ' property.',
    )
  }

  return property.initializer
}

function getOptionalPropertyInitializer(object, propertyName) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === propertyName,
  )

  return property && ts.isPropertyAssignment(property)
    ? property.initializer
    : undefined
}

function readString(initializer, description) {
  if (!ts.isStringLiteral(initializer)) {
    throw new Error('Legacy ' + description + ' must be a string.')
  }

  return initializer.text
}

function readOptionalString(object, propertyName) {
  const initializer = getOptionalPropertyInitializer(object, propertyName)
  return initializer ? readString(initializer, propertyName) : undefined
}

function readOptionalDifficulty(object) {
  const difficulty = readOptionalString(object, 'difficulty')
  if (!difficulty) {
    return undefined
  }

  const normalizedDifficulty = difficulty.trim().toLowerCase()
  if (!['easy', 'medium', 'hard', 'unknown'].includes(normalizedDifficulty)) {
    throw new Error('Unsupported legacy difficulty: ' + difficulty + '.')
  }

  return normalizedDifficulty
}

function readLegacyProblem(element) {
  if (ts.isStringLiteral(element)) {
    return { slug: element.text }
  }

  if (ts.isObjectLiteralExpression(element)) {
    const slug = readString(
      getPropertyInitializer(element, 'slug'),
      'problem slug',
    )
    const title = readOptionalString(element, 'displayTitle')
    const difficulty = readOptionalDifficulty(element)

    return {
      slug,
      ...(title ? { title } : {}),
      ...(difficulty ? { difficulty } : {}),
    }
  }

  if (
    ts.isCallExpression(element) &&
    ts.isIdentifier(element.expression) &&
    element.expression.text === 'courseProblem'
  ) {
    const slug = element.arguments[0]
    const title = element.arguments[1]
    const difficulty = element.arguments[2]

    if (!slug || !ts.isStringLiteral(slug)) {
      throw new Error('Legacy courseProblem must start with a string slug.')
    }
    if (!title || !ts.isStringLiteral(title)) {
      throw new Error('Legacy courseProblem must include a string title.')
    }
    if (!difficulty || !ts.isStringLiteral(difficulty)) {
      throw new Error('Legacy courseProblem must include a string difficulty.')
    }

    const normalizedDifficulty = difficulty.text.trim().toLowerCase()
    if (!['easy', 'medium', 'hard', 'unknown'].includes(normalizedDifficulty)) {
      throw new Error('Unsupported legacy difficulty: ' + difficulty.text + '.')
    }

    return {
      slug: slug.text,
      title: title.text,
      difficulty: normalizedDifficulty,
    }
  }

  throw new Error(
    'Legacy topic-path problems must be string literals, objects, or courseProblem calls.',
  )
}

function readLegacyStringArray(object, propertyName) {
  const initializer = getPropertyInitializer(object, propertyName)
  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error('Legacy ' + propertyName + ' must be an array.')
  }

  return initializer.elements.map(readLegacyProblem)
}

function findLegacyDeclaration(sourceFile, declarationName) {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => Array.from(statement.declarationList.declarations))
    .find(
      (candidate) =>
        ts.isIdentifier(candidate.name) &&
        candidate.name.text === declarationName,
    )

  if (!declaration || !declaration.initializer) {
    throw new Error('Legacy source is missing ' + declarationName + '.')
  }
  if (!ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error('Legacy ' + declarationName + ' must be an array.')
  }

  return declaration.initializer
}

function readLegacyGroups(sourceFile, declarationName) {
  return findLegacyDeclaration(sourceFile, declarationName).elements.map(
    (element) => {
      if (!ts.isObjectLiteralExpression(element)) {
        throw new Error(
          'Legacy ' + declarationName + ' must contain group objects.',
        )
      }

      return {
        title: readString(
          getPropertyInitializer(element, 'topic'),
          declarationName + ' topic',
        ),
        problems: readLegacyStringArray(element, 'slugs'),
      }
    },
  )
}

function readLegacyTrackDescription(sourceFile, sourceSet) {
  const plan = findLegacyDeclaration(
    sourceFile,
    'STUDY_PLAN_INPUTS',
  ).elements.find(
    (element) =>
      ts.isObjectLiteralExpression(element) &&
      readString(
        getPropertyInitializer(element, 'sourceSet'),
        sourceSet + ' sourceSet',
      ) === sourceSet,
  )

  if (!plan || !ts.isObjectLiteralExpression(plan)) {
    throw new Error('Legacy source is missing the ' + sourceSet + ' plan.')
  }

  return readString(
    getPropertyInitializer(plan, 'description'),
    sourceSet + ' description',
  )
}

function normalizeSlug(slugInput) {
  const normalized = slugInput
    .trim()
    .toLowerCase()
    .replace(/^problems\//, '')
    .replace(/\/.*/, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!normalized) {
    throw new Error(
      'Legacy slug did not normalize to a value: ' + slugInput + '.',
    )
  }

  return normalized
}

function normalizeTrack(title, groups, problemMetadata) {
  const seenSlugs = new Set()

  return {
    title,
    groups: groups.map((group) => {
      const problemSlugs = []

      for (const problem of group.problems) {
        const slug = normalizeSlug(problem.slug)
        if (seenSlugs.has(slug)) {
          continue
        }

        seenSlugs.add(slug)
        problemSlugs.push(slug)

        if (!problemMetadata.has(slug)) {
          problemMetadata.set(slug, {
            slug,
            ...(problem.title ? { title: problem.title } : {}),
            difficulty: problem.difficulty || 'unknown',
            isPremium: false,
          })
        }
      }

      if (problemSlugs.length === 0) {
        throw new Error(
          'Legacy group ' +
            group.title +
            ' in ' +
            title +
            ' has no first-occurrence problems.',
        )
      }

      return { title: group.title, problemSlugs }
    }),
  }
}

function renderFixtureValue(value, depth = 0) {
  const indentation = '  '.repeat(depth)

  if (typeof value === 'string') {
    return "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'") + "'"
  }

  if (Array.isArray(value)) {
    return [
      '[',
      ...value.map(
        (item) =>
          '  '.repeat(depth + 1) + renderFixtureValue(item, depth + 1) + ',',
      ),
      indentation + ']',
    ].join('\n')
  }

  if (value && typeof value === 'object') {
    return [
      '{',
      ...Object.entries(value).map(
        ([key, item]) =>
          '  '.repeat(depth + 1) +
          key +
          ': ' +
          renderFixtureValue(item, depth + 1) +
          ',',
      ),
      indentation + '}',
    ].join('\n')
  }

  return String(value)
}

function renderFixture(tracks) {
  return (
    '/**\n' +
    ' * Generated from the legacy curated source at\n' +
    ' * ../CogniPace/src/features/problems/data/seed/curatedSets.ts.\n' +
    ' *\n' +
    ' * Slugs are normalized and retain only their first occurrence within each\n' +
    ' * track, preserving the legacy group and problem order.\n' +
    ' */\n' +
    'export const legacyNeetCodeTracks = ' +
    renderFixtureValue(tracks) +
    ' as const\n'
  )
}

const legacySourcePath = getLegacySourcePath()
const sourceFile = ts.createSourceFile(
  legacySourcePath,
  readFileSync(legacySourcePath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
)
const problemMetadata = new Map()
const trackDescriptions = new Map([
  ['NeetCode 150', readLegacyTrackDescription(sourceFile, 'NeetCode150')],
  ['NeetCode 250', readLegacyTrackDescription(sourceFile, 'NeetCode250')],
])
const tracks = [
  normalizeTrack(
    'NeetCode 150',
    readLegacyGroups(sourceFile, 'neetCode150TopicPath'),
    problemMetadata,
  ),
  normalizeTrack(
    'NeetCode 250',
    readLegacyGroups(sourceFile, 'neetCode250TopicPath'),
    problemMetadata,
  ),
]
const artifact = {
  schemaVersion: 1,
  app: 'cognipace-track-import',
  problems: Array.from(problemMetadata.values()),
  tracks: tracks.map((track) => ({
    title: track.title,
    description: trackDescriptions.get(track.title),
    dueAt: null,
    groups: track.groups,
  })),
}

const referencedSlugs = new Set(
  tracks.flatMap((track) =>
    track.groups.flatMap((group) => group.problemSlugs),
  ),
)
if (referencedSlugs.size !== artifact.problems.length) {
  throw new Error('Generated problem metadata does not match track references.')
}

writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + '\n')
writeFileSync(fixturePath, renderFixture(tracks))

console.log(
  'Generated ' +
    tracks.length +
    ' tracks, ' +
    tracks.reduce((count, track) => count + track.groups.length, 0) +
    ' groups, and ' +
    artifact.problems.length +
    ' unique problems from ' +
    legacySourcePath +
    '.',
)
