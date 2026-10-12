/**
 * useOnboardingTour.ts: runs the first-visit tour (driver.js bubbles) whose
 * content and progress live in src/lib/onboarding-tour.ts.
 *
 * A view opts in with `useTourChapter(chapter, ready)`; its chapter starts by
 * itself once `ready` is true (the view's content has rendered) unless the
 * person has already seen or skipped it. Steps whose `data-tour` target isn't
 * on the page (no History for an upload, an analysis that failed) are dropped.
 * Leaving the view ends its chapter; "Skip tour" or Esc ends the whole tour.
 * `restartTour` (the header's Tour button) replays the current view's chapter.
 */
import { driver, type Driver, type DriveStep, type PopoverDOM } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/assets/onboarding-tour.css'
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import {
  REVIEW_WELCOME,
  TOUR_STEPS,
  TOUR_UNAVAILABLE,
  readTourStatus,
  shouldAutoStart,
  statusAfterChapter,
  tourSelector,
  writeTourStatus,
  type TourChapter,
  type TourStatus,
  type TourStepDef,
} from '@/lib/onboarding-tour'

interface ChapterRegistration {
  chapter: TourChapter
  ready: Ref<boolean>
}

let status: TourStatus = readTourStatus()
let currentChapter: ChapterRegistration | null = null
let activeTour: Driver | null = null

function setStatus(next: TourStatus) {
  status = next
  writeTourStatus(next)
}

function toDriveSteps(defs: TourStepDef[]): DriveStep[] {
  return defs
    .filter((def) => !def.target || document.querySelector(tourSelector(def.target)))
    .map((def) => ({
      element: def.target ? tourSelector(def.target) : undefined,
      popover: { title: def.title, description: def.description, side: def.side, align: def.align },
    }))
}

/** Whether the bubble showing belongs to a chapter (vs the one-off "tour unavailable" note, which Esc just closes). */
let activeIsChapter = false

function skipTour() {
  if (activeIsChapter) setStatus('done')
  activeTour?.destroy()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') skipTour()
}

/** driver.js has only a close (×) button; a labelled "Skip tour" is clearer. Not on the last step, where Finish does the same. */
function addSkipButton(popover: PopoverDOM, tour: Driver) {
  if (tour.isLastStep()) return
  const skip = document.createElement('button')
  skip.type = 'button'
  skip.className = 'bya-tour-skip'
  skip.textContent = 'Skip tour'
  skip.addEventListener('click', skipTour)
  popover.footer.prepend(skip)
}

/**
 * driver.js only scrolls targets that are off-screen, and one tucked under the
 * sticky header counts as on-screen, so centre such targets ourselves.
 */
function bringIntoView(element: Element | undefined) {
  if (!element || element.closest('header')) return
  const headerBottom =
    document.querySelector('header.sticky-top')?.getBoundingClientRect().bottom ?? 0
  const rect = element.getBoundingClientRect()
  if (rect.top < headerBottom || rect.bottom > window.innerHeight)
    element.scrollIntoView({ block: 'center' })
}

function run(steps: DriveStep[], onEnd?: () => void) {
  activeTour?.destroy()
  activeIsChapter = Boolean(onEnd)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const tour: Driver = driver({
    steps,
    animate: !reduceMotion,
    smoothScroll: !reduceMotion,
    // Closing only through "Skip tour"/Esc, so a stray click on the overlay doesn't end it.
    allowClose: false,
    showProgress: steps.length > 1,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: steps.length > 1 ? 'Finish' : 'Got it',
    popoverClass: 'bya-tour',
    overlayColor: 'rgb(9, 13, 25)',
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 12,
    onHighlightStarted: (element) => bringIntoView(element),
    // A scroll during the move between steps re-places the bubble against the
    // previous step's element (driver.js only switches at the end), so re-place it once settled.
    onHighlighted: () => window.requestAnimationFrame(() => tour.refresh()),
    onPopoverRender: (popover) => addSkipButton(popover, tour),
    onDestroyed: () => {
      document.removeEventListener('keydown', onKeydown)
      if (activeTour === tour) activeTour = null
      onEnd?.()
    },
  })
  activeTour = tour
  document.addEventListener('keydown', onKeydown)
  tour.drive()
}

async function startChapter(chapter: TourChapter) {
  // Let the view finish rendering the targets that just became ready.
  await nextTick()
  await new Promise((resolve) => window.requestAnimationFrame(resolve))
  if (currentChapter?.chapter !== chapter || activeTour) return

  const defs =
    chapter === 'review' && status === 'unseen'
      ? [REVIEW_WELCOME, ...TOUR_STEPS.review]
      : TOUR_STEPS[chapter]
  const steps = toDriveSteps(defs)
  if (!steps.length) return
  run(steps, () => setStatus(statusAfterChapter(chapter, status)))
}

/** Registers the calling view's chapter; call from the view's setup. */
export function useTourChapter(chapter: TourChapter, ready: Ref<boolean>) {
  const registration: ChapterRegistration = { chapter, ready }
  const endTour = () => activeTour?.destroy()

  onMounted(() => {
    currentChapter = registration
  })
  onBeforeUnmount(() => {
    if (currentChapter === registration) currentChapter = null
    endTour()
  })
  onBeforeRouteLeave(endTour)
  onBeforeRouteUpdate(endTour)

  watch(
    ready,
    (isReady) => {
      if (isReady && shouldAutoStart(chapter, status)) void startChapter(chapter)
    },
    { immediate: true },
  )
}

/** Replays the current view's chapter, or explains where the tour lives on views without one. */
export function restartTour() {
  const current = currentChapter
  if (!current) {
    // Show the tour again next time they open a service.
    setStatus('unseen')
    run(toDriveSteps([TOUR_UNAVAILABLE]))
    return
  }
  setStatus(current.chapter === 'document' ? 'unseen' : 'document-done')
  // If the view is still loading, its ready watcher starts the chapter instead.
  if (current.ready.value) void startChapter(current.chapter)
}
