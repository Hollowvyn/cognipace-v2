import { RouteModal } from '@/app/dashboard/layout/route-modal'
import { dashboardModalRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function NewTrackModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.trackNew} />
}

export function EditTrackModalPage() {
  return <ModalPlaceholder content={dashboardModalRouteMeta.trackEdit} />
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
      eyebrow="Placeholder"
      title={content.staticData.title}
    />
  )
}
