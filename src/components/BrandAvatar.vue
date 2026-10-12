<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { brandIconUrl } from '@/lib/brand-icon'

const props = withDefaults(defineProps<{
  serviceName: string
  logoUrl?: string | null
  size?: 'sm' | 'lg' | 'xl'
}>(), { logoUrl: null, size: 'sm' })

const ICON_PX = { sm: 18, lg: 22, xl: 40 } as const

const useFallbackLogo = ref(false)
const failed = ref(false)
const imageUrl = computed(() =>
  props.logoUrl && !useFallbackLogo.value
    ? props.logoUrl
    : brandIconUrl(props.serviceName),
)

watch(() => [props.serviceName, props.logoUrl], () => {
  useFallbackLogo.value = false
  failed.value = false
})

function handleError() {
  if (props.logoUrl && !useFallbackLogo.value) useFallbackLogo.value = true
  else failed.value = true
}
</script>

<template>
  <span class="brand-avatar" :class="{ 'brand-avatar-lg': props.size === 'lg', 'brand-avatar-xl': props.size === 'xl' }">
    <img
      v-if="!failed"
      :src="imageUrl"
      alt=""
      loading="lazy"
      :width="ICON_PX[props.size]"
      :height="ICON_PX[props.size]"
      @error="handleError"
    />
    <span v-else>{{ props.serviceName.slice(0, 1).toUpperCase() }}</span>
  </span>
</template>
