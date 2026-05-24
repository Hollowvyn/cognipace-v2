import { RouteModal } from '@/app/dashboard/layout/route-modal'
import { dashboardModalRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function ModalPlaceholder({
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
