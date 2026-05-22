import { RouteModal } from '@/app/dashboard/layout/route-modal'
import { dashboardModalRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function NewTrackModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.trackNew} />
}

export function EditTrackModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.trackEdit} />
}

export function NewProblemModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.problemNew} />
}

export function EditProblemModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.problemEdit} />
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
