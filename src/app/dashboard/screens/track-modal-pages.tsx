import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { RouteModal } from '@/app/dashboard/layout/route-modal'
import {
  dashboardModalRouteMeta,
  dashboardPaths,
} from '@/app/dashboard/navigation/route-manifest'
import { TrackForm } from '@/features/tracks'

export function NewTrackModalPage() {
  const closeToTracks = useCloseToTracks()

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.trackNew.closeTo}
      title="New Track"
      variant="form"
    >
      <TrackForm
        mode="create"
        onCancel={closeToTracks}
        onSaved={closeToTracks}
      />
    </RouteModal>
  )
}

export function EditTrackModalPage() {
  const closeToTracks = useCloseToTracks()
  const params = useParams({ from: dashboardPaths.trackEdit })
  const [title, setTitle] = useState<string>(
    dashboardModalRouteMeta.trackEdit.staticData.title,
  )

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.trackEdit.closeTo}
      title={title}
      variant="form"
    >
      <TrackForm
        mode="edit"
        onCancel={closeToTracks}
        onLoaded={(track) => setTitle(`Edit: ${track.title}`)}
        onSaved={closeToTracks}
        trackId={params.trackId}
      />
    </RouteModal>
  )
}

function useCloseToTracks() {
  const navigate = useNavigate()

  return () => {
    void navigate({ replace: true, to: dashboardPaths.tracks })
  }
}
