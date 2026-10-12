<script setup lang="ts">
import { ref } from 'vue'
import { brandIconUrl } from '@/lib/brand-icon'

const { serviceName, size = 'sm' } = defineProps<{
  serviceName: string
  size?: 'sm' | 'lg' | 'xl'
}>()

const ICON_PX = { sm: 18, lg: 22, xl: 40 } as const

const failed = ref(false)
</script>

<template>
  <span class="brand-avatar" :class="{ 'brand-avatar-lg': size === 'lg', 'brand-avatar-xl': size === 'xl' }">
    <img
      v-if="!failed"
      :src="brandIconUrl(serviceName)"
      alt=""
      loading="lazy"
      :width="ICON_PX[size]"
      :height="ICON_PX[size]"
      @error="failed = true"
    />
    <span v-else>{{ serviceName.slice(0, 1).toUpperCase() }}</span>
  </span>
</template>
