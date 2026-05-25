import { Surface } from '@/components/ui/surface'

const plannedImportAreas = ['Topics', 'Companies', 'Tracks', 'Problems']

export function SelectiveImportPanel() {
  return (
    <Surface aria-labelledby="selective-import-title" className="grid gap-3">
      <header className="grid gap-1">
        <h2
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
          id="selective-import-title"
        >
          Selective import
        </h2>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
          Planned import choices for restoring part of a backup.
        </p>
      </header>
      <ul className="m-0 grid list-none gap-2 p-0 text-[length:var(--cp-copy-font-size)] sm:grid-cols-2">
        {plannedImportAreas.map((area) => (
          <li
            className="rounded-[var(--cp-radius-md)] border border-border bg-muted px-3 py-2 font-semibold"
            key={area}
          >
            {area}
          </li>
        ))}
      </ul>
    </Surface>
  )
}
