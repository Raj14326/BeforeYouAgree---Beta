/**
 * Application entry point.
 *
 * Loads the global stylesheet, then creates the Vue app from the single root
 * component and mounts it into `#app` in `index.html`. All UI and behaviour
 * lives in `App.vue`.
 */
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { vuetify } from './prototype/plugins/vuetify'

// vuetify here registers Vuetify's plugin context (required — there's only
// one createApp instance) but imports no CSS itself; that only loads when a
// session actually visits /prototype/*. See src/prototype/layouts/PrototypeLayout.vue.
createApp(App).use(router).use(vuetify).mount('#app')
