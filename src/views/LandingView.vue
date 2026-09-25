<script setup lang="ts">
/**
 * LandingView.vue: marketing entry point at `/`. Introduces the product and
 * hands off to the tool at `/app` (see AppView.vue). No API calls — this
 * page is static copy plus a theme toggle, so it stays fast and always
 * renders even if the backend is unreachable.
 */

import { ref } from 'vue'
import { motion } from 'motion-v'
import logoUrl from '@/assets/BYA_logo.png'
import ClauseCard from '@/components/ClauseCard.vue'
import type { RiskFinding } from '@/types'

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
    description: 'Enter a name like Spotify or Google and pick it from the list.',
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

const theme = ref<'light' | 'dark'>(
  document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light',
)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-bs-theme', theme.value)
  try {
    localStorage.setItem('bya-theme', theme.value)
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies this session.
  }
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
        <motion.button as-child :while-hover="{ scale: 1.05 }" :while-press="{ scale: 0.95 }" :transition="BUTTON_SPRING">
          <RouterLink to="/app" class="btn btn-sm btn-primary">Open the app</RouterLink>
        </motion.button>
      </div>
    </div>
  </header>

  <main>
    <!-- Hero -->
    <section class="container app-shell py-5 my-md-4">
      <div class="hero row align-items-center gy-4">
        <div class="col-lg-7">
          <p class="eyebrow mb-3">TERMS OF SERVICE &amp; PRIVACY POLICIES, DECODED</p>
          <h1 class="display-6 fw-bold mb-3">
            Before you tap "I agree"...
          </h1>
          <div class="row g-3 stats-row mb-4">
            <div v-for="stat in STATS" :key="stat.label" class="col-4">
              <p class="stat-value mb-1">{{ stat.value }}</p>
              <p class="stat-label mb-0">{{ stat.label }}</p>
            </div>
          </div>
          <p class="stat-source small text-body-secondary mb-4">
            Sources: {{[...new Set(STATS.map((s) => s.source))].join(' · ')}}
          </p>
          <div class="d-flex flex-wrap gap-2">
            <motion.button as-child :while-hover="{ scale: 1.04, y: -2 }" :while-press="{ scale: 0.97, y: 0 }"
              :transition="BUTTON_SPRING">
              <RouterLink to="/app" class="btn btn-primary btn-lg">
                Analyse a service <i class="bi bi-arrow-right ms-1"></i>
              </RouterLink>
            </motion.button>
            <motion.a href="#how-it-works" class="btn btn-outline-secondary btn-lg"
              :while-hover="{ scale: 1.04, y: -2 }" :while-press="{ scale: 0.97, y: 0 }" :transition="BUTTON_SPRING">
              See how it works
            </motion.a>
          </div>
          <p class="small text-body-secondary mt-4 mb-0">
            An automated prediction to help you focus your reading, not legal advice.
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
          <motion.button as-child :while-hover="{ scale: 1.04, y: -2 }" :while-press="{ scale: 0.97, y: 0 }"
            :transition="BUTTON_SPRING">
            <RouterLink to="/app" class="btn btn-primary btn-lg">
              Analyse a service <i class="bi bi-arrow-right ms-1"></i>
            </RouterLink>
          </motion.button>
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
