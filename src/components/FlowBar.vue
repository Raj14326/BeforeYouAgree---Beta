<script setup lang="ts">
/**
 * FlowBar.vue: the strip at the top of every view after the landing page —
 * the step indicator (FlowStepper) and a compact search bar, so the user can
 * jump to another service (e.g. to add more documents to Compare) without
 * going back to the landing page. An "Upload your own" link goes back to the
 * landing page's upload tab, the only place the upload form lives.
 *
 * Deliberately not inside the sticky header: the header's backdrop-filter
 * would become the containing block for SearchBar's fixed-position
 * Spotlight mode and trap it inside the header.
 */
import { useRouter } from 'vue-router'
import SearchBar from '@/components/SearchBar.vue'
import FlowStepper from '@/components/FlowStepper.vue'
import { useServiceCatalogue } from '@/composables/useServiceCatalogue'
import { serviceRoute, startRoute } from '@/lib/flow-routes'
import type { Service } from '@/types'

const router = useRouter()
const { services, isCatalogueLoading, catalogueIsFallback, ensureCatalogueLoaded } = useServiceCatalogue()
void ensureCatalogueLoaded()

function openService(service: Service) {
  void router.push(serviceRoute(service.path, service.name))
}
</script>

<template>
  <div class="flow-bar border-bottom">
    <div class="container app-shell py-3 d-flex flex-column gap-3">
      <FlowStepper />
      <div class="d-flex flex-wrap align-items-center gap-2">
        <div class="flex-grow-1">
          <SearchBar
            compact
            :services="services"
            :is-catalogue-loading="isCatalogueLoading"
            :is-service-loading="false"
            :catalogue-is-fallback="catalogueIsFallback"
            @select="openService"
          />
        </div>
        <RouterLink :to="startRoute('upload')" class="btn btn-outline-secondary">
          <i class="bi bi-file-earmark-arrow-up me-1" aria-hidden="true"></i>Upload your own
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-bar {
  background-color: var(--bs-tertiary-bg);
}
</style>
