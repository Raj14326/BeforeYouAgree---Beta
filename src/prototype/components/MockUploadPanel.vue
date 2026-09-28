<script setup lang="ts">
// Visual-only mock: no call to the real /api/analyze endpoint. Text length
// only decides which *demo* outcome plays (result vs. a designed error
// state) — it is not real document detection.
import { ref } from 'vue'
import MockDocumentResult from '@/prototype/components/MockDocumentResult.vue'
import AnalyzingSkeleton from '@/prototype/components/AnalyzingSkeleton.vue'
import { computeMockRisk } from '@/prototype/lib/mock-risk'
import { RISK_LEVEL_LABELS } from '@/types'
import { MOCK_MIN_PASTE_LENGTH, UPLOAD_RESULT_ANALYSIS, UPLOAD_RESULT_TEXT } from '@/prototype/fixtures/upload-fixtures'

type Status = 'idle' | 'analyzing' | 'result' | 'error'
type Mode = 'paste' | 'file'

const mode = ref<Mode>('paste')
const pastedText = ref('')
const selectedFile = ref<File[]>([])
const status = ref<Status>('idle')
const liveMessage = ref('')

function analyze() {
  status.value = 'analyzing'
  liveMessage.value = ''

  // Paste mode fakes a "this doesn't look like an agreement" outcome for
  // short input, to demo the error state; file mode always "succeeds" since
  // no real content is read either way.
  const willFail = mode.value === 'paste' && pastedText.value.trim().length < MOCK_MIN_PASTE_LENGTH
  const delay = willFail ? 900 : 1400

  window.setTimeout(() => {
    if (willFail) {
      status.value = 'error'
      liveMessage.value = "Couldn't analyze this text. It doesn't look like enough of an agreement to review."
    } else {
      status.value = 'result'
      const level = computeMockRisk(UPLOAD_RESULT_ANALYSIS).level
      liveMessage.value = `Analysis complete. Document risk: ${RISK_LEVEL_LABELS[level]}.`
    }
  }, delay)
}

function reset() {
  status.value = 'idle'
  liveMessage.value = ''
}
</script>

<template>
  <div>
    <div aria-live="polite" class="visually-hidden">{{ liveMessage }}</div>

    <v-card variant="elevated" elevation="2" rounded="lg">
      <v-card-text>
        <v-tabs v-model="mode" color="primary" class="mb-4" :disabled="status !== 'idle'">
          <v-tab value="paste">Paste text</v-tab>
          <v-tab value="file">Upload a file</v-tab>
        </v-tabs>

        <template v-if="status === 'idle'">
          <v-textarea
            v-if="mode === 'paste'"
            v-model="pastedText"
            label="Paste the document text"
            placeholder="Paste a terms of service, privacy policy, lease, or other agreement…"
            variant="outlined"
            rows="8"
            auto-grow
            counter
          />
          <v-file-input
            v-else
            v-model="selectedFile"
            label="Choose a file"
            variant="outlined"
            accept=".txt,.pdf,.docx"
            prepend-icon="mdi-file-upload-outline"
            hint="Preview only — the file isn't actually read yet."
            persistent-hint
          />

          <v-btn
            color="primary"
            class="mt-4"
            :disabled="mode === 'paste' ? !pastedText.trim() : !selectedFile.length"
            @click="analyze"
          >
            Analyze (preview)
          </v-btn>
        </template>

        <AnalyzingSkeleton v-else-if="status === 'analyzing'" />

        <div v-else-if="status === 'error'">
          <v-empty-state
            icon="mdi-file-question-outline"
            title="This doesn't look like an agreement"
            text="Try pasting a longer excerpt, or the full document text."
          />
          <v-btn variant="tonal" color="primary" @click="reset">Try again</v-btn>
        </div>

        <div v-else>
          <div class="d-flex justify-space-between align-center mb-4">
            <div class="text-subtitle-1 font-weight-medium">Your pasted document</div>
            <v-btn variant="text" color="primary" @click="reset">Analyze another</v-btn>
          </div>
          <MockDocumentResult
            :analysis="UPLOAD_RESULT_ANALYSIS"
            :document-text="UPLOAD_RESULT_TEXT"
            doc-key="upload-result"
          />
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>
