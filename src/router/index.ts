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
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
