<script setup lang="ts">
// Shell for every /prototype/* screen: a <v-app> boundary and an app bar
// with its own theme toggle (kept in sync with the real app's
// data-bs-theme / `bya-theme` localStorage key, so switching themes here
// carries over if you navigate back to /app).
//
// This is also the only file that imports Vuetify's icon-font CSS and this
// route tree's own stylesheet, so that cost is paid only when a session
// actually visits /prototype/*.
import { ref } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
// Full precompiled CSS (not tree-shaken — see vite.config.ts) — only
// reachable through the lazy /prototype/* chunk, so the shipped Bootstrap
// routes never pay for it.
import 'vuetify/dist/vuetify.css'
import '@mdi/font/css/materialdesignicons.css'
import '@/prototype/prototype.css'
import logoUrl from '@/assets/BYA_logo.png'
import MockRiskPreferences from '@/prototype/components/MockRiskPreferences.vue'

const vuetifyTheme = useTheme()
const isDark = ref(document.documentElement.getAttribute('data-bs-theme') === 'dark')
vuetifyTheme.global.name.value = isDark.value ? 'byaDark' : 'byaLight'

function toggleTheme() {
  isDark.value = !isDark.value
  const themeName = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-bs-theme', themeName)
  vuetifyTheme.global.name.value = isDark.value ? 'byaDark' : 'byaLight'
  try {
    localStorage.setItem('bya-theme', themeName)
  } catch {
    // Storage can be unavailable (private mode); the toggle still applies this session.
  }
}

const preferencesOpen = ref(false)

// Below this (960px), the app bar can't fit the inline nav links without
// wrapping/overflowing — collapse them into a drawer instead.
const { smAndDown } = useDisplay()
const navDrawerOpen = ref(false)

function openPreferences() {
  navDrawerOpen.value = false
  preferencesOpen.value = true
}
</script>

<template>
  <v-app>
    <v-app-bar flat density="comfortable" color="surface">
      <v-app-bar-nav-icon
        v-if="smAndDown"
        aria-label="Open navigation menu"
        @click="navDrawerOpen = !navDrawerOpen"
      />
      <router-link to="/" class="d-flex align-center text-decoration-none px-4 text-high-emphasis">
        <v-avatar :image="logoUrl" size="32" class="mr-2" />
        <span class="font-weight-medium">Before You Agree</span>
      </router-link>
      <v-chip v-if="!smAndDown" size="small" color="primary" variant="tonal" class="ml-2">Prototype</v-chip>
      <v-spacer />
      <template v-if="!smAndDown">
        <v-btn :to="{ name: 'prototype-home' }" variant="text" size="small">Home</v-btn>
        <v-btn :to="{ name: 'prototype-compare' }" variant="text" size="small">Compare</v-btn>
        <v-btn variant="text" size="small" prepend-icon="mdi-tune" @click="openPreferences">
          Risk preferences
        </v-btn>
      </template>
      <v-btn
        icon
        variant="text"
        :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="toggleTheme"
      >
        <v-icon :icon="isDark ? 'mdi-white-balance-sunny' : 'mdi-weather-night'" />
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer v-model="navDrawerOpen" temporary location="left">
      <v-list nav density="comfortable">
        <v-list-item
          :to="{ name: 'prototype-home' }"
          title="Home"
          prepend-icon="mdi-home-outline"
          @click="navDrawerOpen = false"
        />
        <v-list-item
          :to="{ name: 'prototype-compare' }"
          title="Compare"
          prepend-icon="mdi-view-column-outline"
          @click="navDrawerOpen = false"
        />
        <v-list-item title="Risk preferences" prepend-icon="mdi-tune" @click="openPreferences" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container class="py-6" style="max-width: 1200px">
        <router-view />
      </v-container>
    </v-main>

    <v-dialog v-model="preferencesOpen" max-width="480">
      <v-card rounded="lg">
        <v-card-item>
          <template #title>Risk preferences</template>
          <template #append>
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              aria-label="Close risk preferences"
              @click="preferencesOpen = false"
            />
          </template>
        </v-card-item>
        <v-card-text style="max-height: 65vh; overflow-y: auto">
          <MockRiskPreferences />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="tonal" @click="preferencesOpen = false">Done</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>
