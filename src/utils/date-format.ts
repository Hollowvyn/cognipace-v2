const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(value: string, fallback = 'Unknown date') {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return dateTimeFormatter.format(date)
}
