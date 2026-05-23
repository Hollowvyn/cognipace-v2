import { useNavigate, useParams } from '@tanstack/react-router'

import { RouteModal } from '@/app/dashboard/layout/route-modal'
import {
  dashboardModalRouteMeta,
  dashboardPaths,
} from '@/app/dashboard/navigation/route-manifest'
import { ProblemForm } from '@/features/problems'

export function NewTrackModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.trackNew} />
}

export function EditTrackModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.trackEdit} />
}

export function NewProblemModalPage() {
  const closeToLibrary = useCloseToLibrary()

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.problemNew.closeTo}
      description="Create a LeetCode problem in your Library."
      eyebrow="Problem"
      title={dashboardModalRouteMeta.problemNew.staticData.title}
    >
      <ProblemForm
        mode="create"
        onCancel={closeToLibrary}
        onSaved={closeToLibrary}
      />
    </RouteModal>
  )
}

export function EditProblemModalPage() {
  const closeToLibrary = useCloseToLibrary()
  const params = useParams({ from: dashboardPaths.problemEdit })

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.problemEdit.closeTo}
      description="Edit this problem's core Library metadata."
      eyebrow="Problem"
      title={dashboardModalRouteMeta.problemEdit.staticData.title}
    >
      <ProblemForm
        mode="edit"
        onCancel={closeToLibrary}
        onSaved={closeToLibrary}
        problemSlug={params.problemSlug}
      />
    </RouteModal>
  )
}

function ModalPlaceholder({
  content,
}: {
  content: (typeof dashboardModalRouteMeta)[keyof typeof dashboardModalRouteMeta]
}) {
  return (
    <RouteModal
      closeTo={content.closeTo}
      description={content.description}
      title={content.staticData.title}
    />
  )
}

function useCloseToLibrary() {
  const navigate = useNavigate()

  return () => {
    void navigate({ replace: true, to: dashboardPaths.library })
  }
}
