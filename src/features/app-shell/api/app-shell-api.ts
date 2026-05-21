import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'

import {
  type AppShellData,
  type AppShellRequest,
  type DashboardAppShellData,
  type OverlayAppShellData,
  type PopupAppShellData,
} from './app-shell-contracts'

export const appShellQueryKeys = {
  all: ['app-shell-data'] as const,
  popup: () => [...appShellQueryKeys.all, 'popup'] as const,
  dashboard: () => [...appShellQueryKeys.all, 'dashboard'] as const,
  overlay: (problemSlug?: string | null) =>
    [...appShellQueryKeys.all, 'overlay', problemSlug ?? null] as const,
}

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
  DashboardAppShellData,
  OverlayAppShellData,
  PopupAppShellData,
}
