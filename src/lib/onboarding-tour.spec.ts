import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TOUR_STEPS,
  TOUR_STORAGE_KEY,
  readTourStatus,
  shouldAutoStart,
  statusAfterChapter,
  writeTourStatus,
} from './onboarding-tour'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('shouldAutoStart', () => {
  it('starts the document chapter only on a first visit', () => {
    expect(shouldAutoStart('document', 'unseen')).toBe(true)
    expect(shouldAutoStart('document', 'document-done')).toBe(false)
    expect(shouldAutoStart('document', 'done')).toBe(false)
  })

  it('starts the review chapter until the tour is finished or skipped', () => {
    expect(shouldAutoStart('review', 'unseen')).toBe(true)
    expect(shouldAutoStart('review', 'document-done')).toBe(true)
    expect(shouldAutoStart('review', 'done')).toBe(false)
  })
})

describe('statusAfterChapter', () => {
  it('moves on to the review chapter after the document chapter', () => {
    expect(statusAfterChapter('document', 'unseen')).toBe('document-done')
  })

  it('finishes the tour after the review chapter', () => {
    expect(statusAfterChapter('review', 'unseen')).toBe('done')
    expect(statusAfterChapter('review', 'document-done')).toBe('done')
  })

  it('never reopens a skipped tour', () => {
    expect(statusAfterChapter('document', 'done')).toBe('done')
  })
})

describe('tour status storage', () => {
  it('round-trips through localStorage', () => {
    expect(readTourStatus()).toBe('unseen')
    writeTourStatus('document-done')
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe('document-done')
    expect(readTourStatus()).toBe('document-done')
  })

  it('treats an unrecognised stored value as unseen', () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'bogus')
    expect(readTourStatus()).toBe('unseen')
  })

  it('falls back to memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    writeTourStatus('done')
    expect(readTourStatus()).toBe('done')
  })
})

describe('TOUR_STEPS', () => {
  it('ends the document chapter on the card that continues the tour', () => {
    expect(TOUR_STEPS.document.at(-1)?.target).toBe('first-document')
  })

  it('ends the review chapter on the replay button', () => {
    expect(TOUR_STEPS.review.at(-1)?.target).toBe('tour-button')
  })
})
