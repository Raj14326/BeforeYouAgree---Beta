/**
 * onboarding-tour.ts: the first-visit tour's content and progress, kept free
 * of driver.js/DOM so it can be unit-tested. useOnboardingTour drives it.
 *
 * The tour has two chapters because it spans two views: `document` on
 * DocumentSelectView (step 2) and `review` on ReviewView (step 3). Progress is
 * one value in localStorage, so skipping anywhere ends the whole tour.
 */
import type { Alignment, Side } from 'driver.js'

export type TourChapter = 'document' | 'review'

/** `document-done`: chapter 1 seen, chapter 2 still to come. `done`: finished or skipped. */
export type TourStatus = 'unseen' | 'document-done' | 'done'

export interface TourStepDef {
  /** Value of the `data-tour` attribute to point at; omitted for a centred bubble. */
  target?: string
  title: string
  description: string
  side?: Side
  align?: Alignment
}

/** Bump the version to show the tour again to everyone after a big change to it. */
export const TOUR_STORAGE_KEY = 'bya.tour.v1'

const TOUR_STATUSES: readonly TourStatus[] = ['unseen', 'document-done', 'done']

export const TOUR_STEPS: Record<TourChapter, TourStepDef[]> = {
  document: [
    {
      title: 'Welcome to Before You Agree 👋',
      description:
        'A quick tour of how to read a service’s terms here, about a minute long. You can skip it at any time.',
    },
    {
      target: 'flow-stepper',
      title: 'Your progress',
      description:
        'You’ve picked a service. Next, choose a document, then review it. Click an earlier step to go back.',
      side: 'bottom',
    },
    {
      target: 'document-list',
      title: 'Choose a document',
      description:
        'These are the agreements this service publishes, such as its Terms of Service and Privacy Policy. “Analysed” means its results are ready.',
      side: 'top',
    },
    {
      target: 'risk-preferences',
      title: 'Make it about you',
      description:
        'Choose which kinds of risk matter to you, like data sharing or arbitration. The review puts those first.',
      side: 'bottom',
      align: 'end',
    },
    {
      target: 'first-document',
      title: 'Open a document to continue',
      description: 'Pick the one you’re about to agree to. The tour continues on the review page.',
      side: 'bottom',
    },
  ],
  review: [
    {
      target: 'nutrition-card',
      title: 'Risks at a glance',
      description:
        'A summary of what this document puts at risk, by category. Click a category to see only its clauses.',
      side: 'top',
    },
    {
      target: 'clause-filter',
      title: 'Risky or not',
      description:
        'Switch between clauses flagged as risky or needing review and the ones that look fine.',
      side: 'bottom',
      align: 'end',
    },
    {
      target: 'first-clause',
      title: 'A flagged clause',
      description:
        'Each card quotes the clause and explains why it was flagged. “Show in text” jumps to it in the full document.',
      side: 'top',
    },
    {
      target: 'document-toolbar',
      title: 'Dig deeper',
      description:
        'Read the full document with risky clauses highlighted, see older versions in History, and get suggested next steps.',
      side: 'bottom',
      align: 'end',
    },
    {
      target: 'compare-button',
      title: 'Compare services',
      description:
        'Add this document to Compare to see it side by side with other services, or with an older version of itself.',
      side: 'bottom',
      align: 'end',
    },
    {
      target: 'compare-link',
      title: 'See the comparison',
      description:
        'Once you’ve added a few documents, open Compare here to see their risks side by side and which one asks less of you.',
      side: 'bottom',
      align: 'end',
    },
    {
      target: 'tour-button',
      title: 'That’s it!',
      description: 'You can replay this tour from here at any time.',
      side: 'bottom',
      align: 'end',
    },
  ],
}

/** Opens the review chapter for people who never saw chapter 1 (uploads, shared links). */
export const REVIEW_WELCOME: TourStepDef = {
  title: 'Welcome to Before You Agree 👋',
  description:
    'A quick tour of how to read this analysis, about a minute long. You can skip it at any time.',
}

/** Shown by the replay button on views with no tour of their own (e.g. Compare). */
export const TOUR_UNAVAILABLE: TourStepDef = {
  title: 'Take the tour',
  description:
    'The tour runs on a service’s documents and review pages. Search for a service above and it will start.',
}

export function tourSelector(target: string) {
  return `[data-tour="${target}"]`
}

/** Whether a chapter should start by itself when its view is ready. */
export function shouldAutoStart(chapter: TourChapter, status: TourStatus) {
  return chapter === 'document' ? status === 'unseen' : status !== 'done'
}

/** Progress after a chapter ends (finished, or left by navigating away). Never moves backwards. */
export function statusAfterChapter(chapter: TourChapter, status: TourStatus): TourStatus {
  return chapter === 'review' || status === 'done' ? 'done' : 'document-done'
}

/** Used when localStorage is unavailable (private mode, blocked site data) so the tour still shows once per visit. */
let memoryStatus: TourStatus = 'unseen'

export function readTourStatus(): TourStatus {
  try {
    const stored = window.localStorage.getItem(TOUR_STORAGE_KEY)
    if (stored === null) return memoryStatus
    return (TOUR_STATUSES as readonly string[]).includes(stored) ? (stored as TourStatus) : 'unseen'
  } catch {
    return memoryStatus
  }
}

export function writeTourStatus(status: TourStatus) {
  memoryStatus = status
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, status)
  } catch {
    // Storage blocked: the in-memory copy still covers this visit.
  }
}
