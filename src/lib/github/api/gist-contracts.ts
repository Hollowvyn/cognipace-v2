import { z } from 'zod'

export const githubUserSchema = z
  .strictObject({
    login: z.string().min(1),
  })
  .passthrough()

const gistFileSchema = z
  .object({
    filename: z.string().optional(),
    content: z.string().optional(),
    truncated: z.boolean().optional(),
    raw_url: z.string().url().optional(),
  })
  .passthrough()

const gistHistoryEntrySchema = z
  .object({
    version: z.string().min(1),
    committed_at: z.iso.datetime().optional(),
  })
  .passthrough()

export const githubGistSchema = z
  .object({
    id: z.string().min(1),
    html_url: z.string().url().optional(),
    updated_at: z.iso.datetime(),
    files: z.record(z.string(), gistFileSchema),
    history: z.array(gistHistoryEntrySchema).optional(),
  })
  .passthrough()

export type GitHubUser = z.infer<typeof githubUserSchema>
export type GitHubGist = z.infer<typeof githubGistSchema>

export const cognipaceGistFileName = 'cognipace-sync.json'

export type GitHubGistSummary = {
  id: string
  htmlUrl: string | null
  updatedAt: string
  remoteVersion: string | null
  content: string | null
  contentTruncated: boolean
  rawUrl: string | null
}
