const migrationModules = import.meta.glob('./migrations/*.sql', {
  eager: true,
  import: 'default',
  query: '?raw',
})

export const migrationEntries = Object.entries(migrationModules)
  .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  .map(([path, sql]) => ({ path, sql: String(sql) }))

export const migrationSql = migrationEntries
  .map((entry) => entry.sql)
  .join('\n')
