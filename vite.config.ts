import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    // Only src/prototype/** files use <v-*> tags, so autoImport (component
    // JS registration only) never touches the shipped Bootstrap-styled
    // routes' bundle. styles: 'none' + a manual `vuetify/dist/vuetify.css`
    // import in PrototypeLayout.vue (full precompiled CSS, not tree-shaken)
    // is deliberate, not the default: vite-plugin-vuetify's per-component
    // sass tree-shaking (styles: 'sass') silently drops every component's
    // hover/focus/active state-layer CSS (verified: zero "__overlay" rules
    // in the compiled output vs. 122 in Vuetify's own precompiled bundle) —
    // buttons/chips lost all contrast on hover as a result. The precompiled
    // CSS is proven correct; the KB cost is accepted, same as the base
    // reset/utility-class layer already being a full, non-tree-shaken pull.
    vuetify({ autoImport: true, styles: 'none' }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
