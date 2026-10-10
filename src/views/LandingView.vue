<script setup lang="ts">
/**
 * LandingView.vue: entry point at `/` and step 1 (Search) of the flow.
 * Introduces the product and hosts the start card (`#start`): search for a
 * service (→ DocumentSelectView) or paste/upload your own document (→
 * straight to ReviewView). The rest of the page is static copy, so it still
 * renders if the backend is unreachable — search then uses the offline list.
 *
 * `?mode=upload` opens the start card on the upload tab (FlowBar's "Upload
 * your own" link lands here).
 */

import { ref, watch } from 'vue'
import { motion } from 'motion-v'
import { useRoute, useRouter } from 'vue-router'
import logoUrl from '@/assets/BYA_logo.png'
import ClauseCard from '@/components/ClauseCard.vue'
import DocumentUploadPanel from '@/components/DocumentUploadPanel.vue'
import SearchBar from '@/components/SearchBar.vue'
import { useDocumentSession } from '@/composables/useDocumentSession'
import { useServiceCatalogue } from '@/composables/useServiceCatalogue'
import { useTheme } from '@/composables/useTheme'
import { serviceRoute, uploadReviewRoute } from '@/lib/flow-routes'
import type { RiskFinding, Service } from '@/types'

const BUTTON_SPRING = { type: 'spring', stiffness: 400, damping: 17 }

const HIGHLIGHT_CATEGORIES = [
  {
    icon: 'bi-shield-exclamation',
    name: 'Limitation of liability',
    description: 'Won’t pay you back for problems it causes.',
  },
  {
    icon: 'bi-x-octagon',
    name: 'Unilateral termination',
    description: 'Can close your account anytime, no reason given.',
  },
  {
    icon: 'bi-gavel',
    name: 'Arbitration',
    description: 'You give up the right to sue or join a class action.',
  },
  {
    icon: 'bi-database-fill-lock',
    name: 'Broad data collection',
    description: 'Collects more personal data than it needs.',
  },
  {
    icon: 'bi-geo-alt',
    name: 'Location tracking',
    description: 'Tracks where you are, even in the background.',
  },
  {
    icon: 'bi-people',
    name: 'Third-party data sharing',
    description: 'Shares your data with outside companies.',
  },
]

const STATS = [
  {
    value: '91% of people',
    label: 'accept Terms of Service without reading them',
    source: 'Deloitte Global Mobile Consumer Survey',
  },
  {
    value: '97%',
    label: 'among 18–34 year-olds specifically',
    source: 'Deloitte Global Mobile Consumer Survey',
  },
  {
    value: '51 sec',
    label: 'average time spent on a policy that takes ~15 min to actually read',
    source: 'Obar & Oeldorf-Hirsch, "The Biggest Lie on the Internet" (2020)',
  },
]

const EXAMPLE_FINDING: RiskFinding = {
  text: 'We may terminate or suspend your account at any time, without notice or liability, for any reason.',
  start: 0,
  end: 0,
  occurrenceCount: 1,
  occurrenceStarts: [],
  categories: [{ id: 'unilateral_termination', name: 'Unilateral termination', score: 1 }],
  predictedLabel: 'not_risky',
  riskLevel: 'high',
  riskLevelMessage: '',
  reviewCategories: [],
}
const EXAMPLE_CATEGORY_PRIORITY = ['unilateral_termination']
const EXAMPLE_ENABLED_CATEGORY_IDS = new Set(['unilateral_termination'])

const STEPS = [
  {
    title: 'Search for a service',
    description: 'Enter a name like Spotify or Google, or paste in a document of your own.',
  },
  {
    title: 'Retrieve a document',
    description: 'Choose the Terms of Service or Privacy Policy you want to review.',
  },
  {
    title: 'Read the risks',
    description: 'See the clauses flagged as risky, explained in plain language and in context.',
  },
]

const route = useRoute()
const router = useRouter()
const { theme, toggleTheme } = useTheme()
const { services, isCatalogueLoading, catalogueIsFallback, ensureCatalogueLoaded } = useServiceCatalogue()
const { startUpload } = useDocumentSession()
void ensureCatalogueLoaded()

/** Whether the start card shows the service search or the upload-your-own form. */
const searchMode = ref<'catalogue' | 'upload'>('catalogue')
watch(
  () => route.query.mode,
  (mode) => {
    searchMode.value = mode === 'upload' ? 'upload' : 'catalogue'
  },
  { immediate: true },
)

function openService(service: Service) {
  void router.push(serviceRoute(service.path, service.name))
}

/** An upload has nothing to choose between, so it skips the Document step and goes straight to Review. */
function reviewUpload(document: { name: string; content: string }) {
  startUpload(document)
  void router.push(uploadReviewRoute)
}
</script>

<template>
  <header class="border-bottom bg-body sticky-top">
    <div class="container app-shell py-3 d-flex align-items-center flex-wrap gap-2">
      <RouterLink to="/" class="brand-lockup" aria-label="Before You Agree - home">
        <img :src="logoUrl" alt="" class="brand-logo" />
        <span class="brand-wordmark">Before You Agree</span>
      </RouterLink>
      <div class="ms-auto d-flex align-items-center gap-2">
        <motion.button type="button" class="btn btn-sm btn-outline-secondary"
          :while-hover="{ scale: 1.08, rotate: 12 }" :while-press="{ scale: 0.9 }" :transition="BUTTON_SPRING"
          :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme">
          <i class="bi" :class="theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'"></i>
        </motion.button>
        <motion.a href="#start" class="btn btn-sm btn-primary" :while-hover="{ scale: 1.05 }"
          :while-press="{ scale: 0.95 }" :transition="BUTTON_SPRING">
          Get started
        </motion.a>
      </div>
    </div>
  </header>

  <main>
    <!-- Hero -->
    <section class="container app-shell pt-5 pb-4 pb-md-5 mt-md-4">
      <div class="hero row align-items-center gy-4">
        <div class="col-lg-7">
          <p class="eyebrow mb-3">TERMS OF SERVICE &amp; PRIVACY POLICIES, DECODED</p>
          <h1 class="display-6 fw-bold mb-3">
            Before you tap "I agree"...
          </h1>
          <div class="row g-3 stats-row mb-3">
            <div v-for="stat in STATS" :key="stat.label" class="col-4">
              <p class="stat-value mb-1">{{ stat.value }}</p>
              <p class="stat-label mb-0">{{ stat.label }}</p>
            </div>
          </div>
          <p class="stat-source small text-body-secondary mb-0">
            Sources: {{[...new Set(STATS.map((s) => s.source))].join(' · ')}}
          </p>
        </div>
        <div class="col-lg-5">
          <div class="hero-card card shadow-sm border-0">
            <div class="card-body p-4">
              <div class="d-flex align-items-center gap-2 mb-3">
                <span class="brand-avatar brand-avatar-lg">Nx</span>
                <div>
                  <p class="fw-semibold mb-0">Example Streaming Co.</p>
                  <p class="small text-body-secondary mb-0">Terms of Service</p>
                </div>
              </div>
              <ClauseCard :finding="EXAMPLE_FINDING" :category-priority="EXAMPLE_CATEGORY_PRIORITY"
                :enabled-category-ids="EXAMPLE_ENABLED_CATEGORY_IDS" :risk-preferences-enabled="true" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Start: search a service or upload your own (step 1 of the flow) -->
    <section id="start" class="start-band" aria-labelledby="start-heading">
      <div class="container app-shell py-5">
        <div class="start-inner mx-auto">
          <div class="text-center mb-4">
            <p class="eyebrow mb-2">START HERE</p>
            <h2 id="start-heading" class="h2 fw-bold mb-2">What are you about to agree to?</h2>
            <p class="fs-5 text-body-secondary mb-0">
              Search a service, or paste in your own document, and see the clauses worth a second look.
            </p>
          </div>

          <div class="d-flex justify-content-center mb-3">
            <div class="btn-group" role="group" aria-label="Choose how to find a document">
              <button type="button" class="btn"
                :class="searchMode === 'catalogue' ? 'btn-primary' : 'btn-outline-secondary'"
                :aria-pressed="searchMode === 'catalogue'" @click="searchMode = 'catalogue'">
                <i class="bi bi-search me-1" aria-hidden="true"></i>Search a service
              </button>
              <button type="button" class="btn"
                :class="searchMode === 'upload' ? 'btn-primary' : 'btn-outline-secondary'"
                :aria-pressed="searchMode === 'upload'" @click="searchMode = 'upload'">
                <i class="bi bi-file-earmark-arrow-up me-1" aria-hidden="true"></i>Upload your own
              </button>
            </div>
          </div>

          <SearchBar v-if="searchMode === 'catalogue'" :services="services" :is-catalogue-loading="isCatalogueLoading"
            :is-service-loading="false" :catalogue-is-fallback="catalogueIsFallback" @select="openService" />
          <DocumentUploadPanel v-else @submit="reviewUpload" />

          <p class="small text-body-secondary text-center mt-4 mb-0">
            An automated prediction to help you focus your reading, not legal advice.
            <a href="#how-it-works" class="ms-1">See how it works</a>
          </p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="container app-shell py-5">
      <div class="text-center mx-auto mb-4" style="max-width: 640px">
        <p class="eyebrow mb-2">HOW IT WORKS</p>
      </div>
      <div class="steps-panel card border-0 shadow-sm">
        <div class="row g-0">
          <div v-for="(step, index) in STEPS" :key="step.title" class="col-md-4 step-col">
            <div class="p-4 p-md-5 h-100">
              <span class="step-number" aria-hidden="true">{{ index + 1 }}</span>
              <h3 class="h6 fw-semibold mb-1 mt-3">{{ step.title }}</h3>
              <p class="text-body-secondary mb-0">{{ step.description }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="text-center mx-auto mb-4" style="max-width: 640px">
        <p class="text-body-secondary mb-0">No sign-up. No reading the fine print yourself.</p>
      </div>

    </section>

    <!-- What it catches -->
    <section class="container app-shell py-5">
      <div class="text-center mx-auto mb-5" style="max-width: 640px">
        <p class="eyebrow mb-2">WHAT IT CATCHES</p>
        <h2 class="h3 fw-bold mb-2">Common clauses worth a second look</h2>
        <p class="text-body-secondary mb-0">
          Across Terms of Service and Privacy Policies, the model watches for patterns like
          these.
        </p>
      </div>
      <div class="row g-3">
        <div v-for="category in HIGHLIGHT_CATEGORIES" :key="category.name" class="col-sm-6 col-lg-4">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body d-flex gap-3">
              <i class="bi category-icon" :class="category.icon" aria-hidden="true"></i>
              <div>
                <p class="fw-semibold mb-1">{{ category.name }}</p>
                <p class="small text-body-secondary mb-0">{{ category.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="container app-shell pb-5 mb-md-4">
      <div class="final-cta card border-0 shadow text-center p-4 p-md-5">
        <h2 class="h3 fw-bold mb-2">Ready to see what you're signing up for?</h2>
        <p class="text-body-secondary mb-4">
          Search any service and get a plain-language breakdown in seconds.
        </p>
        <div>
          <motion.a href="#start" class="btn btn-primary btn-lg" :while-hover="{ scale: 1.04, y: -2 }"
            :while-press="{ scale: 0.97, y: 0 }" :transition="BUTTON_SPRING">
            Search a service <i class="bi bi-arrow-up ms-1"></i>
          </motion.a>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.eyebrow {
  color: var(--bs-link-color);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

#start {
  scroll-margin-top: 4.5rem;
}

/* Full-bleed tinted band so the search stands out as the page's main action. */
.start-band {
  border-block: 1px solid rgba(var(--bs-primary-rgb), 0.15);
  background:
    radial-gradient(ellipse at top, rgba(var(--bs-primary-rgb), 0.14), transparent 70%),
    rgba(var(--bs-primary-rgb), 0.04);
}

.start-inner {
  max-width: 820px;
}

.start-band :deep(.search-bar),
.start-band :deep(.upload-panel) {
  box-shadow: 0 0.75rem 2rem rgba(var(--bs-primary-rgb), 0.12) !important;
}

.hero-card {
  background: var(--bs-body-bg);
}

.stat-value {
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--bs-link-color);
}

.stat-label {
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--bs-secondary-color);
}

.stat-source {
  font-size: 0.72rem;
}

.steps-panel {
  border-radius: var(--bs-border-radius-xl);
  overflow: hidden;
}

.step-col:not(:last-child) {
  border-right: 1px solid var(--bs-border-color);
}

@media (max-width: 767.98px) {
  .step-col:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid var(--bs-border-color);
  }
}

.step-number {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: rgba(var(--bs-primary-rgb), 0.12);
  color: var(--bs-link-color);
  font-weight: 700;
}

.category-icon {
  flex: none;
  font-size: 1.25rem;
  color: var(--bs-link-color);
  margin-top: 0.15rem;
}

.final-cta {
  background: linear-gradient(180deg, rgba(var(--bs-primary-rgb), 0.08), transparent);
  border-radius: var(--bs-border-radius-xl);
}
</style>
