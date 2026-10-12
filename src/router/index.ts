import { createRouter, createWebHistory } from 'vue-router'

/**
 * The user flow: Search (landing) → Document (pick one of a service's
 * documents) → Review (its analysis). An upload skips straight from Search
 * to Review. Compare sits outside the flow and is reachable from any step.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: '/service/:servicePath',
      name: 'service',
      component: () => import('@/views/DocumentSelectView.vue'),
    },
    {
      path: '/service/:servicePath/:termType',
      name: 'review',
      component: () => import('@/views/ReviewView.vue'),
    },
    {
      path: '/review/upload',
      name: 'review-upload',
      component: () => import('@/views/ReviewView.vue'),
    },
    {
      path: '/compare',
      name: 'compare',
      component: () => import('@/views/CompareView.vue'),
    },
    // The old single-page tool; search now starts on the landing page.
    { path: '/app', redirect: { name: 'landing', hash: '#start' } },
  ],
  scrollBehavior(to, from) {
    if (to.hash) return { el: to.hash, top: 88, behavior: 'smooth' }
    // Switching archived versions on the same document shouldn't jump back to the top.
    if (
      to.name === 'review' &&
      from.name === 'review' &&
      to.params.servicePath === from.params.servicePath &&
      to.params.termType === from.params.termType
    ) {
      return false
    }
    return { top: 0 }
  },
})

export default router
