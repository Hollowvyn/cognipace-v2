import type { ReactNode } from 'react'

interface SettingsSectionProps {
  children: ReactNode
  id: string
  title: string
}

export function SettingsSection({ children, id, title }: SettingsSectionProps) {
  const titleId = `${id}-title`

  return (
    <section
      aria-labelledby={titleId}
      className="grid min-w-0 gap-2.5 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"
    >
      <header className="min-w-0">
        <h3
          className="m-0 text-[1.125rem] font-extrabold leading-tight text-foreground text-pretty"
          id={titleId}
        >
          {title}
        </h3>
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}
