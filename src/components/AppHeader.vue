<script setup lang="ts">
/**
 * AppHeader.vue: brand + quick guide + Compare nav link + theme toggle,
 * extracted from AppView.vue so CompareView.vue (a sibling route) can share
 * the same header instead of duplicating it. Every class used here
 * (app-shell, brand-lockup, brand-logo, brand-wordmark) is a global style in
 * src/assets/main.css, so this is a pure markup move.
 */
import { motion } from 'motion-v'
import logoUrl from '@/assets/BYA_logo.png'
import QuickGuide from '@/components/QuickGuide.vue'

const { theme, compareCount } = defineProps<{
  theme: 'light' | 'dark'
  compareCount: number
}>()

defineEmits<{ 'toggle-theme': [] }>()

const BUTTON_SPRING = { type: 'spring', stiffness: 400, damping: 17 } as const
</script>

<template>
  <header class="border-bottom bg-body sticky-top">
    <div class="container app-shell py-3 d-flex align-items-center flex-wrap gap-2">
      <RouterLink to="/" class="brand-lockup" aria-label="Before You Agree - home">
        <img :src="logoUrl" alt="" class="brand-logo" />
        <span class="brand-wordmark">Before You Agree</span>
      </RouterLink>
      <div class="ms-auto d-flex align-items-center gap-2">
        <QuickGuide />
        <RouterLink to="/compare" class="btn btn-sm btn-outline-secondary position-relative">
          Compare
          <span
            v-if="compareCount > 0"
            class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-primary"
          >
            {{ compareCount }}
            <span class="visually-hidden">documents in compare</span>
          </span>
        </RouterLink>
        <motion.button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :while-hover="{ scale: 1.08, rotate: 12 }"
          :while-press="{ scale: 0.9 }"
          :transition="BUTTON_SPRING"
          :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="$emit('toggle-theme')"
        >
          <i class="bi" :class="theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'"></i>
        </motion.button>
      </div>
    </div>
  </header>
</template>
