// Canned result for the upload/paste mock — returned regardless of what the
// user actually pastes (no real /api/analyze call is made). The scoring and
// highlighting are still real: both run against the genuine documentRiskScore
// and lib/document-view functions, just against fixture data.
import { withOffsets } from './finding-helpers'
import type { Analysis } from '@/types'

// Below this pasted-text length, the mock pretends analysis failed — this is
// a presentation-only heuristic, not real document detection.
export const MOCK_MIN_PASTE_LENGTH = 120

export const UPLOAD_RESULT_TEXT = `General Terms and Conditions. This is an example of the kind of agreement you might paste in for analysis.

Liability. We are not liable for any damages arising from your use of the service, and disputes must go through arbitration.

Changes. We may update these terms at any time; your continued use constitutes acceptance.

Account review. Staff may access account data to investigate suspected policy violations.

Closing. Thank you for reviewing these terms carefully before agreeing.`

export const UPLOAD_RESULT_ANALYSIS: Analysis = {
  model: 'mock-v1',
  clauseCount: 14,
  riskyClauseCount: 6,
  findings: withOffsets(UPLOAD_RESULT_TEXT, [
    {
      text: 'We are not liable for any damages arising from your use of the service, and disputes must go through arbitration.',
      categories: [
        { id: 'limitation_of_liability', name: 'Limitation of liability', score: 0.85 },
        { id: 'arbitration', name: 'Arbitration', score: 0.6 },
      ],
    },
    {
      text: 'We may update these terms at any time; your continued use constitutes acceptance.',
      categories: [{ id: 'unilateral_change', name: 'Unilateral change', score: 0.5 }],
    },
    {
      text: 'Staff may access account data to investigate suspected policy violations.',
      categories: [{ id: 'privacy_admin_control', name: 'Administrator access and control', score: 0.55 }],
    },
  ]),
}
