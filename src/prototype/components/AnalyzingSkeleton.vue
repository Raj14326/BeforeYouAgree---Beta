<script setup lang="ts">
import { usePrefersReducedMotion } from '@/prototype/composables/usePrefersReducedMotion'

const { prefersReducedMotion } = usePrefersReducedMotion()
</script>

<template>
  <div aria-hidden="true">
    <v-progress-linear
      :indeterminate="!prefersReducedMotion"
      :model-value="prefersReducedMotion ? 60 : undefined"
      color="primary"
      rounded
      height="6"
      class="mb-4"
    />
    <v-skeleton-loader type="article" :boilerplate="prefersReducedMotion" />
  </div>
</template>
