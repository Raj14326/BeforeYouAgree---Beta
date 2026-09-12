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

createApp(App).mount('#app')
