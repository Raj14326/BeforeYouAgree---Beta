<script setup lang="ts">
// Material-3 sibling of BrandAvatar.vue: same brandIconUrl lookup + graceful
// fallback to an initial when a service has no logo on Simple Icons (which
// every fictional "Service 1"/"Service 2" name here will hit) — same
// resilience as the real component, just Vuetify markup.
import { ref, watch } from 'vue'
import { brandIconUrl } from '@/lib/brand-icon'

const { serviceName, size = 32 } = defineProps<{ serviceName: string; size?: number }>()

const failed = ref(false)
watch(
  () => serviceName,
  () => (failed.value = false),
)
</script>

<template>
  <v-avatar :size="size" color="surface-variant" variant="tonal">
    <v-img v-if="!failed" :src="brandIconUrl(serviceName)" :alt="`${serviceName} logo`" cover @error="failed = true" />
    <span v-else class="text-caption font-weight-medium">{{ serviceName.slice(0, 1).toUpperCase() }}</span>
  </v-avatar>
</template>
