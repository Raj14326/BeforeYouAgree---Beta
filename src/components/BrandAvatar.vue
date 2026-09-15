<script setup lang="ts">
import { ref } from 'vue'
import { brandIconUrl } from '@/lib/brand-icon'

const { serviceName, size = 'sm' } = defineProps<{
  serviceName: string
  size?: 'sm' | 'lg'
}>()

const failed = ref(false)
</script>

<template>
  <span class="brand-avatar" :class="{ 'brand-avatar-lg': size === 'lg' }">
    <img
      v-if="!failed"
      :src="brandIconUrl(serviceName)"
      alt=""
      loading="lazy"
      :width="size === 'lg' ? 22 : 18"
      :height="size === 'lg' ? 22 : 18"
      @error="failed = true"
    />
    <span v-else>{{ serviceName.slice(0, 1).toUpperCase() }}</span>
  </span>
</template>
