import { defineExtensionMessaging } from '@webext-core/messaging'
import { z } from 'zod'

export const extensionSurfaceSchema = z.enum([
  'background',
  'popup',
  'dashboard',
  'content-script',
])

export type ExtensionSurface = z.infer<typeof extensionSurfaceSchema>

export const appShellDataSchema = z.object({
  status: z.object({
    label: z.string(),
    detail: z.string(),
  }),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
  recommendation: z.object({
    title: z.string(),
    detail: z.string(),
  }),
  activeTrack: z.object({
    title: z.string(),
    detail: z.string(),
  }),
})

export type AppShellData = z.infer<typeof appShellDataSchema>

export const pingRequestSchema = z.object({
  surface: extensionSurfaceSchema,
})

export type PingRequest = z.infer<typeof pingRequestSchema>

export type PingResponse = {
  ok: true
  surface: ExtensionSurface
  receivedAt: string
}

export const appShellRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard', 'content-script']),
})

export type AppShellRequest = z.infer<typeof appShellRequestSchema>

export interface ProtocolMap {
  'runtime.ping'(request: PingRequest): PingResponse
  'app.getShellData'(request: AppShellRequest): AppShellData
}

const extensionMessenger = defineExtensionMessaging<ProtocolMap>()

export const onMessage = extensionMessenger.onMessage.bind(extensionMessenger)

export const sendMessage =
  extensionMessenger.sendMessage.bind(extensionMessenger)
