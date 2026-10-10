<script setup lang="ts">
/**
 * DocumentUploadPanel.vue: an alternative to SearchBar for analysing a
 * document the user supplies themselves, either pasted as text or uploaded
 * as a `.txt`/`.pdf`/`.docx` file.
 *
 * Owns its own input state and client-side text extraction (see
 * `@/lib/document-text-extraction`); it never calls `/api/analyze` itself —
 * once usable text is in hand it just emits `submit`, and the parent runs it
 * through the same analysis path as a catalogue document.
 */
import { computed, ref } from 'vue'
import { motion } from 'motion-v'
import {
  extractTextFromFile,
  MAX_FILE_BYTES,
  MAX_TEXT_LENGTH,
} from '@/lib/document-text-extraction'

const emit = defineEmits<{
  submit: [document: { name: string; content: string }]
}>()

/** Below this many characters there isn't enough text for a meaningful analysis. */
const MIN_TEXT_LENGTH = 120

const BUTTON_SPRING = { type: 'spring', stiffness: 400, damping: 17 } as const

const mode = ref<'paste' | 'file'>('paste')
const pastedText = ref('')
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const isExtracting = ref(false)
const error = ref('')

const canSubmit = computed(() => {
  if (isExtracting.value) return false
  if (mode.value === 'paste') {
    const length = pastedText.value.trim().length
    return length >= MIN_TEXT_LENGTH && length <= MAX_TEXT_LENGTH
  }
  return selectedFile.value !== null
})

function setMode(next: 'paste' | 'file') {
  mode.value = next
  error.value = ''
}

function selectFile(file: File | undefined) {
  selectedFile.value = null
  error.value = ''
  if (!file) return
  if (!/\.(?:txt|pdf|docx)$/i.test(file.name)) {
    error.value = 'Unsupported file type. Please upload a .txt, .pdf, or .docx file.'
    return
  }
  if (file.size > MAX_FILE_BYTES) {
    error.value = 'The selected file exceeds the 10 MB limit.'
    return
  }
  selectedFile.value = file
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectFile(input.files?.[0])
  input.value = ''
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  selectFile(event.dataTransfer?.files?.[0])
}

/** File name without its extension, used as the document's display name. */
function baseName(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'Uploaded document'
}

async function submit() {
  if (!canSubmit.value) return
  error.value = ''

  if (mode.value === 'paste') {
    const content = pastedText.value.trim()
    if (content.length > MAX_TEXT_LENGTH) {
      error.value = `Document text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.`
      return
    }
    emit('submit', { name: 'Your document', content })
    return
  }

  const file = selectedFile.value
  if (!file) return
  isExtracting.value = true
  try {
    const content = (await extractTextFromFile(file)).trim()
    if (content.length < MIN_TEXT_LENGTH) {
      error.value = "We couldn't find enough readable text in this file. Try a different file or paste the text instead."
      return
    }
    emit('submit', { name: baseName(file.name), content })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'This file could not be read.'
  } finally {
    isExtracting.value = false
  }
}
</script>

<template>
  <form class="card card-body shadow-sm upload-panel" @submit.prevent="submit">
    <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Choose how to provide your document">
      <button
        type="button"
        class="btn"
        :class="mode === 'paste' ? 'btn-primary' : 'btn-outline-secondary'"
        @click="setMode('paste')"
      >
        <i class="bi bi-clipboard me-1" aria-hidden="true"></i>Paste text
      </button>
      <button
        type="button"
        class="btn"
        :class="mode === 'file' ? 'btn-primary' : 'btn-outline-secondary'"
        @click="setMode('file')"
      >
        <i class="bi bi-file-earmark-arrow-up me-1" aria-hidden="true"></i>Upload a file
      </button>
    </div>

    <template v-if="mode === 'paste'">
      <label for="pasted-text" class="form-label fw-medium">Document text</label>
      <textarea
        id="pasted-text"
        v-model="pastedText"
        class="form-control"
        rows="8"
        :maxlength="MAX_TEXT_LENGTH"
        placeholder="Paste a Terms of Service, privacy policy, or other agreement…"
      ></textarea>
      <p class="form-text mb-0 mt-2">
        {{ pastedText.trim().length.toLocaleString() }} / {{ MAX_TEXT_LENGTH.toLocaleString() }} characters
        (at least {{ MIN_TEXT_LENGTH }} needed)
      </p>
    </template>

    <template v-else>
      <label class="form-label fw-medium">Document file</label>
      <label
        class="upload-dropzone d-flex flex-column align-items-center justify-content-center gap-2 text-center"
        :class="{ 'upload-dropzone-active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <i class="bi bi-cloud-arrow-up fs-2 text-body-secondary" aria-hidden="true"></i>
        <span v-if="selectedFile" class="fw-medium">{{ selectedFile.name }}</span>
        <span v-else class="text-body-secondary">Drag a file here, or click to browse</span>
        <span class="small text-body-secondary">.txt, .pdf, or .docx · maximum 10 MB</span>
        <input
          type="file"
          accept=".txt,.pdf,.docx"
          class="visually-hidden"
          @change="handleFileChange"
        />
      </label>
    </template>

    <p class="form-text mt-3 mb-0">
      Files are read in your browser. Only extracted or pasted text is sent for analysis, and it is not stored.
    </p>
    <div v-if="error" class="alert alert-warning mt-3 mb-0 py-2" role="alert">{{ error }}</div>

    <motion.button
      type="submit"
      class="btn btn-primary btn-lg mt-3"
      :disabled="!canSubmit"
      :while-hover="{ scale: 1.03, y: -2 }"
      :while-press="{ scale: 0.97, y: 0 }"
      :transition="BUTTON_SPRING"
    >
      <span v-if="isExtracting" class="spinner-border spinner-border-sm me-1"></span>
      {{ isExtracting ? 'Reading file…' : 'Analyze document' }}
    </motion.button>
  </form>
</template>

<style scoped>
.upload-dropzone {
  min-height: 140px;
  padding: 1.5rem;
  border: 2px dashed var(--bs-border-color);
  border-radius: var(--bs-border-radius-lg);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.upload-dropzone:hover,
.upload-dropzone-active {
  border-color: var(--bs-primary);
  background-color: rgba(var(--bs-primary-rgb), 0.08);
}
</style>
