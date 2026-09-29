import { analyzeWithBert } from './bert-model.ts'
import { htmlToPlainText } from './html-to-plain-text.ts'

const documents = [
  {
    name: 'GitHub General Privacy Statement',
    url: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
  },
  {
    name: 'Mozilla Websites Privacy Notice',
    url: 'https://www.mozilla.org/en-US/privacy/websites/',
  },
  { name: 'Dropbox Privacy Policy', url: 'https://www.dropbox.com/privacy' },
  { name: 'Cloudflare Privacy Policy', url: 'https://www.cloudflare.com/privacypolicy/' },
  {
    name: 'GitHub Terms of Service',
    url: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service',
  },
]

function normalized(text: string) {
  return text.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim()
}

for (const document of documents) {
  const response = await fetch(document.url)
  if (!response.ok) throw new Error(`${document.name}: HTTP ${response.status}`)
  const content = htmlToPlainText(await response.text())
  const analysis = await analyzeWithBert(content)
  const occurrences = new Map<string, { category: string; text: string; count: number }>()
  for (const finding of analysis.findings) {
    for (const category of finding.categories) {
      const key = `${category.id}\u0000${normalized(finding.text)}`
      const existing = occurrences.get(key)
      if (existing) existing.count += 1
      else occurrences.set(key, { category: category.name, text: finding.text, count: 1 })
    }
  }
  const duplicates = [...occurrences.values()].filter((item) => item.count > 1)
  console.log(
    JSON.stringify({
      ...document,
      characters: content.length,
      clauses: analysis.clauseCount,
      riskyClauses: analysis.riskyClauseCount,
      duplicateGroups: duplicates.length,
      duplicates,
    }),
  )
}
