import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ServiceDocumentCard from './ServiceDocumentCard.vue'
import type { Retrieval, Term } from '@/types'

const term: Term = {
  sourceUrl: null,
  available: true,
  latestUrl: '/api/version/1/2/latest',
  updatedAt: '2026-09-04T12:50:00Z',
  historyAvailable: true,
  historyUrl: '/api/versions/1/2',
}

const retrieval: Retrieval = {
  format: 'plain_text',
  id: 'revision',
  serviceId: '1',
  termType: 'Privacy Policy',
  sourceUrl: null,
  fetchDate: '2024-03-02T01:30:00Z',
  characterCount: 123,
  content: 'Policy text',
  repository: 'test',
  repositoryUrl: '',
}

function mountCard(overrides: Record<string, unknown> = {}) {
  return mount(ServiceDocumentCard, {
    props: {
      serviceName: 'Example', termType: 'Privacy Policy', title: 'Privacy Policy', term,
      retrieval, analysis: undefined, fullDocumentOpen: false, isLoading: false,
      isAnalysing: false, retrievalError: '', analysisError: '', historyOpen: false,
      versions: undefined, selectedVersion: '', loadingHistory: false,
      isCompared: false, isVersionCompared: false, addingVersion: false, ...overrides,
    },
  })
}

describe('ServiceDocumentCard', () => {
  it('shows the loaded historical version date instead of the latest policy date', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('2 Mar 2024')
    expect(wrapper.text()).not.toContain('4 Sept 2026')
  })

  it('offers retry after retrieval failure without requiring another selection', async () => {
    const wrapper = mountCard({ retrieval: undefined, retrievalError: 'Network error.' })
    await wrapper.get('button.btn-outline-danger').trigger('click')
    expect(wrapper.emitted('retry-retrieval')).toHaveLength(1)
  })

  it('formats character counts for Australia and offers retry after analysis failure', async () => {
    const wrapper = mountCard({
      retrieval: { ...retrieval, characterCount: 251_794 },
      analysisError: 'NetworkError when attempting to fetch resource.',
    })

    expect(wrapper.text()).toContain('251,794 characters')
    await wrapper.get('button.btn-outline-danger').trigger('click')
    expect(wrapper.emitted('retry-analysis')).toHaveLength(1)
  })
})
