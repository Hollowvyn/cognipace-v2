const migrationModules = import.meta.glob('./migrations/*.sql', {
  eager: true,
  import: 'default',
  query: '?raw',
})

export const migrationSql = Object.entries(migrationModules)
  .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  .map(([, sql]) => String(sql))
  .join('\n')
