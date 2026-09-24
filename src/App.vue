<script setup lang="ts">
/**
 * App.vue: router outlet only. Page content lives in `src/views/*.vue`
 * (LandingView at `/`, AppView — the actual tool — at `/app`).
 *
 * `MotionConfig reduced-motion="user"` makes every motion-v animation in the
 * app check `prefers-reduced-motion` and skip straight to its end state for
 * users who have that OS/browser preference set (motion-v defaults to
 * "never", i.e. it ignores the preference unless told otherwise here).
 */
import { MotionConfig } from 'motion-v'
</script>

<template>
  <MotionConfig reduced-motion="user">
    <RouterView />
  </MotionConfig>
</template>
