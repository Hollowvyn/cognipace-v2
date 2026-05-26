import { createRestRequest, type HttpClient } from '@/platform/http'

import {
  cognipaceGistFileName,
  githubGistSchema,
  githubUserSchema,
  type GitHubGist,
  type GitHubGistSummary,
} from './gist-contracts'

export const githubBaseUrl = 'https://api.github.com'
export const githubApiVersion = '2026-03-10'

export function createGitHubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': githubApiVersion,
  }
}

export async function validateGitHubToken(input: {
  httpClient: HttpClient
  token: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: '/user',
    method: 'GET',
    headers: createGitHubHeaders(input.token),
    sensitiveValues: [input.token],
  })(input.httpClient)
  const user = githubUserSchema.parse(response)

  return { ok: true as const, login: user.login }
}

export async function getGitHubGist(input: {
  httpClient: HttpClient
  token: string
  gistId: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: `/gists/${encodeURIComponent(input.gistId)}`,
    method: 'GET',
    headers: createGitHubHeaders(input.token),
    sensitiveValues: [input.token],
  })(input.httpClient)

  return summarizeGist(githubGistSchema.parse(response))
}

export async function createGitHubGist(input: {
  httpClient: HttpClient
  token: string
  content: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: '/gists',
    method: 'POST',
    headers: createGitHubHeaders(input.token),
    body: {
      description: 'CogniPace sync data',
      public: false,
      files: {
        [cognipaceGistFileName]: {
          content: input.content,
        },
      },
    },
    sensitiveValues: [input.token],
  })(input.httpClient)

  return summarizeGist(githubGistSchema.parse(response))
}

export async function updateGitHubGistFile(input: {
  httpClient: HttpClient
  token: string
  gistId: string
  content: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: `/gists/${encodeURIComponent(input.gistId)}`,
    method: 'PATCH',
    headers: createGitHubHeaders(input.token),
    body: {
      files: {
        [cognipaceGistFileName]: {
          content: input.content,
        },
      },
    },
    sensitiveValues: [input.token],
  })(input.httpClient)

  return summarizeGist(githubGistSchema.parse(response))
}

function summarizeGist(gist: GitHubGist): GitHubGistSummary {
  const syncFile = gist.files[cognipaceGistFileName]
  const latestHistory = gist.history?.[0]
  const contentTruncated = Boolean(syncFile?.truncated)

  return {
    id: gist.id,
    htmlUrl: gist.html_url ?? null,
    updatedAt: gist.updated_at,
    remoteVersion: latestHistory?.version ?? null,
    content: contentTruncated ? null : (syncFile?.content ?? null),
    contentTruncated,
    rawUrl: syncFile?.raw_url ?? null,
  }
}
