// Vuetify instance for the /prototype/* presentation screens only. This
// module imports no CSS — vite-plugin-vuetify's `autoImport` injects each
// component's styles straight into the .vue files that actually render
// <v-*> tags, so the shipped Bootstrap routes never pay for this.
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { md3 } from 'vuetify/blueprints'

// Matches --bs-primary / --bs-body-bg etc. in src/assets/main.css, so the
// prototype reads as the same brand under a different (Material 3) visual
// system rather than an unrelated redesign.
export const vuetify = createVuetify({
  blueprint: md3,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'byaLight',
    themes: {
      byaLight: {
        dark: false,
        colors: {
          primary: '#4f46e5',
          secondary: '#eef2ff',
          error: '#dc2626',
          warning: '#f59e0b',
          success: '#16a34a',
          background: '#f7f8fa',
          surface: '#ffffff',
        },
      },
      byaDark: {
        dark: true,
        colors: {
          primary: '#818cf8',
          secondary: '#191b22',
          error: '#f87171',
          warning: '#fbbf24',
          success: '#4ade80',
          background: '#0e0f13',
          surface: '#15171d',
        },
      },
    },
  },
})
