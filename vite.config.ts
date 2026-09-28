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
    // Only src/prototype/** files use <v-*> tags, so autoImport only ever
    // injects Vuetify's per-component SCSS into those SFCs' own chunks —
    // it never touches the shipped Bootstrap-styled routes' bundle.
    // Per-component tree-shaking (styles: 'sass') does NOT pull in
    // Vuetify's shared reset/utility-class layer (that lives in a separate
    // generic/utilities partial main.sass forwards but individual
    // component partials don't) — PrototypeLayout.vue imports that layer
    // once, explicitly, via src/prototype/vuetify-base.scss.
    vuetify({ autoImport: true, styles: 'sass' }),
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
