// Brand logos come from the Simple Icons CDN, keyed by a slug derived from the
// service name. Names that don't map cleanly to a slug are aliased here.
const ALIASES: Record<string, string> = {
  Twitter: 'x',
  'Twitter (X)': 'x',
  'Google Play': 'googleplay',
  'Microsoft Teams': 'microsoftteams',
}

export function brandIconUrl(serviceName: string) {
  const slug = ALIASES[serviceName] ?? serviceName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `https://cdn.simpleicons.org/${encodeURIComponent(slug)}`
}
