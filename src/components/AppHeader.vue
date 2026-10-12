<script setup lang="ts">
/**
 * AppHeader.vue: brand + quick guide + risk preferences + theme toggle, shared by every view
 * after the landing page. Navigation between steps (and to Compare) lives in
 * FlowStepper, just below. Every class used here (app-shell, brand-lockup,
 * brand-logo, brand-wordmark) is a global style in src/assets/main.css.
 */
import { motion } from 'motion-v'
import logoUrl from '@/assets/BYA_logo.png'
import QuickGuide from '@/components/QuickGuide.vue'
import RiskPreferenceSettings from '@/components/RiskPreferenceSettings.vue'

const { theme } = defineProps<{
  theme: 'light' | 'dark'
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
        <RiskPreferenceSettings />
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
