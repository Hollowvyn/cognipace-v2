import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

import { type AppShellData, type AppShellRequest } from './app-shell-contracts'

export const appShellQueryKeys = queryKeys.appShell

async function getAppShellDataViaRuntime(request: AppShellRequest) {
  return sendMessage('app.getShellData', request)
}

export async function getPopupAppShellDataViaRuntime() {
  return readAppShellSurface(
    await getAppShellDataViaRuntime({ surface: 'popup' }),
    'popup',
  )
}

export async function getDashboardAppShellDataViaRuntime() {
  return readAppShellSurface(
    await getAppShellDataViaRuntime({ surface: 'dashboard' }),
    'dashboard',
  )
}

export async function getOverlayAppShellDataViaRuntime(
  problemSlug?: string | null,
) {
  return readAppShellSurface(
    await getAppShellDataViaRuntime({
      surface: 'overlay',
      ...(problemSlug ? { problemSlug } : {}),
    }),
    'overlay',
  )
}

export function usePopupAppShellData() {
  return useQuery({
    queryKey: appShellQueryKeys.popup(),
    queryFn: getPopupAppShellDataViaRuntime,
  })
}

export function useDashboardAppShellData() {
  return useQuery({
    queryKey: appShellQueryKeys.dashboard(),
    queryFn: getDashboardAppShellDataViaRuntime,
  })
}

export function useOverlayAppShellData(problemSlug?: string | null) {
  return useQuery({
    enabled: problemSlug !== null && problemSlug !== undefined,
    queryKey: appShellQueryKeys.overlay(problemSlug),
    queryFn: () => getOverlayAppShellDataViaRuntime(problemSlug),
  })
}

function readAppShellSurface<TSurface extends AppShellData['surface']>(
  data: AppShellData,
  surface: TSurface,
): Extract<AppShellData, { surface: TSurface }> {
  if (!hasAppShellSurface(data, surface)) {
    throw new Error(`Expected ${surface} app-shell data.`)
  }

  return data
}

function hasAppShellSurface<TSurface extends AppShellData['surface']>(
  data: AppShellData,
  surface: TSurface,
): data is Extract<AppShellData, { surface: TSurface }> {
  return data.surface === surface
}

export type {
  AppShellProblemSummary,
  DashboardAppShellData,
  OverlayNextStep,
  OverlayAppShellData,
  PopupAppShellData,
} from './app-shell-contracts'
