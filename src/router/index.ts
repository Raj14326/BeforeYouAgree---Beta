import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: '/app',
      name: 'app',
      component: () => import('@/views/AppView.vue'),
    },
    {
      // Presentation-only preview of not-yet-built features, restyled with
      // Vuetify as a design experiment. Not /compare — that path is reserved
      // for the real future Phase B feature (see
      // .claude/plans/glittery-strolling-moore.md).
      path: '/prototype',
      component: () => import('@/prototype/layouts/PrototypeLayout.vue'),
      children: [
        {
          path: '',
          name: 'prototype-home',
          component: () => import('@/prototype/views/PrototypeHomeView.vue'),
        },
        {
          path: 'compare',
          name: 'prototype-compare',
          component: () => import('@/prototype/views/ComparePreviewView.vue'),
        },
      ],
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
