<script setup lang="ts">
// Risk severity, always as icon + text label + color together — never color
// alone, so the signal reads for colorblind users too.
import { computed } from 'vue'
import type { RiskLevel } from '@/types'

const { level } = defineProps<{ level: RiskLevel }>()

const config = computed(() => {
  if (level === 'high') return { icon: 'mdi-alert-circle', color: 'error', label: 'High risk' }
  if (level === 'medium') return { icon: 'mdi-alert', color: 'warning', label: 'Medium risk' }
  return { icon: 'mdi-check-circle', color: 'success', label: 'Low risk' }
})
</script>

<template>
  <v-chip :prepend-icon="config.icon" :color="config.color" variant="tonal" size="small" role="status">
    {{ config.label }}
  </v-chip>
</template>
