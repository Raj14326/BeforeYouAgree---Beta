// "Simple words" companion to lib/risk-level.ts's riskLevelPhrase(), for the
// prototype's Simple/Detailed toggle. Detailed mode reuses riskLevelPhrase()
// as-is (no duplicate copy) — this file only adds the simpler variant.
import type { RiskLevel } from '@/types'

const SIMPLE_SUMMARY: Record<RiskLevel, string> = {
  high: 'This is risky. Read it carefully before agreeing.',
  medium: 'This has some risky parts. Worth a closer look.',
  low: 'This looks mostly okay based on what we found.',
}

export function simpleSummaryPhrase(level: RiskLevel): string {
  return SIMPLE_SUMMARY[level]
}
