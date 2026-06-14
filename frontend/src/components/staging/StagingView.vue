<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useReposStore } from '../../stores/repos'
import { useBranchesStore } from '../../stores/branches'
import { useCommitsStore } from '../../stores/commits'
import { useStagingStore, isConflictedFile } from '../../stores/staging'
import { useToastStore } from '../../stores/toast'
import HunkSelector from './HunkSelector.vue'
import ConflictView from './ConflictView.vue'
import type { Hunk } from '../../stores/staging'
import { clampMenuPosition } from '../../composables/useContextMenu'
import {
  AbortMerge, ContinueRebase, AbortRebase, GetFileBase64,
  OpenInDefaultApp, ShowInFinder, OpenInEditor,
  StashFile, AppendToGitignore, SavePatchFile, DeleteWorkingFile,
} from '../../../wailsjs/go/main/App'

const repos = useReposStore()
const branches = useBranchesStore()
const commits = useCommitsStore()
const staging = useStagingStore()
const toast = useToastStore()

const fileListWidth = ref(260)

function makeResizer(width: Ref<number>, min: number, max: number) {
  let startX = 0
  let startW = 0
  function onMove(e: MouseEvent) {
    width.value = Math.max(min, Math.min(max, startW + e.clientX - startX))
  }
  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  return (e: MouseEvent) => {
    startX = e.clientX
    startW = width.value
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
}

const startResize = makeResizer(fileListWidth, 180, 520)

watch(
  () => repos.activeRepo?.path,
  path => {
    if (path) {
      staging.load(path)
    } else {
      staging.clear()
    }
  },
  { immediate: true },
)

function shortPath(p: string) {
  const parts = p.split('/')
  if (parts.length > 2) {
    return '…/' + parts.slice(-2).join('/')
  }
  return p
}

const repoPath = () => repos.activeRepo?.path ?? ''

function onSelectFile(path: string, mode: 'staged' | 'unstaged') {
  staging.selectFile(repoPath(), path, mode)
}
async function onStageFile(path: string) {
  const prevIdx = staging.unstagedFiles.findIndex(f => f.path === path)
  const wasSelected = staging.selectedPath === path
  await staging.stageFile(repoPath(), path)
  if (!wasSelected) {
    return
  }
  const next = staging.unstagedFiles[prevIdx] ?? staging.unstagedFiles[prevIdx - 1]
  if (next) {
    onSelectFile(next.path, 'unstaged')
  } else if (staging.stagedFiles.length) {
    onSelectFile(staging.stagedFiles[0].path, 'staged')
  } else {
    staging.selectedPath = null
    staging.diff = []
  }
}

async function onUnstageFile(path: string) {
  const prevIdx = staging.stagedFiles.findIndex(f => f.path === path)
  const wasSelected = staging.selectedPath === path
  await staging.unstageFile(repoPath(), path)
  if (!wasSelected) {
    return
  }
  const next = staging.stagedFiles[prevIdx] ?? staging.stagedFiles[prevIdx - 1]
  if (next) {
    onSelectFile(next.path, 'staged')
  } else if (staging.unstagedFiles.length) {
    onSelectFile(staging.unstagedFiles[0].path, 'unstaged')
  } else {
    staging.selectedPath = null
    staging.diff = []
  }
}

function onDiscardFile(path: string) {
  staging.discardFile(repoPath(), path)
}

function onStageHunk(hunk: Hunk) {
  if (staging.selectedPath) {
    staging.stageHunk(repoPath(), staging.selectedPath, hunk)
  }
}

function onUnstageHunk(hunk: Hunk) {
  if (staging.selectedPath) {
    staging.unstageHunk(repoPath(), staging.selectedPath, hunk)
  }
}
async function onStageAll() {
  for (const f of staging.unstagedFiles) await staging.stageFile(repoPath(), f.path)
}
async function onUnstageAll() {
  for (const f of staging.stagedFiles) await staging.unstageFile(repoPath(), f.path)
}

// ── Commit panel ─────────────────────────────────────────────────────────────
const commitSummary = ref('')
const commitDescription = ref('')

watch(
  () => staging.isInMerge,
  inMerge => {
    if (inMerge && staging.mergeMessage && !commitSummary.value) {
      const lines = staging.mergeMessage.trim().split('\n')
      commitSummary.value = lines[0] ?? ''
      if (lines.length > 2) {
        commitDescription.value = lines.slice(2).join('\n').trim()
      }
    }
  },
)
const amend = ref(false)
const committing = ref(false)

const currentBranch = computed(
  () => branches.local.find(b => b.isCurrent)?.name ?? 'HEAD'
)

// subject line: conventional max 72 chars
const summaryRemaining = computed(() => 72 - commitSummary.value.length)

const canCommit = computed(() => {
  if (committing.value) {
    return false
  }
  if (amend.value) {
    return true // amend: staged files optional
  }
  return staging.stagedFiles.length > 0 && commitSummary.value.trim().length > 0
})

async function onAmendToggle() {
  if (amend.value && !commitSummary.value) {
    commitSummary.value = await staging.getLastCommitSubject(repoPath())
  }
  if (!amend.value) {
    commitSummary.value = ''
    commitDescription.value = ''
  }
}

async function onCommit() {
  if (!canCommit.value) {
    return
  }
  committing.value = true
  try {
    const parts = [commitSummary.value.trim()]
    if (commitDescription.value.trim()) {
      parts.push('', commitDescription.value.trim())
    }
    const branch = currentBranch.value
    const wasAmend = amend.value
    await staging.commit(repoPath(), parts.join('\n'), amend.value)
    await Promise.all([commits.load(repoPath()), branches.load(repoPath())])
    commitSummary.value = ''
    commitDescription.value = ''
    amend.value = false
    toast.success(wasAmend ? `Amended commit on ${branch}` : `Committed to ${branch}`)
  } catch (e) {
    toast.error(String(e))
  } finally {
    committing.value = false
  }
}

const STATUS_LABELS: Record<string, string> = {
  M: 'M', A: 'A', D: 'D', R: 'R', C: 'C', '?': 'U', U: '!',
}

const selectedIsConflict = computed(() => {
  if (!staging.selectedPath) {
    return false
  }
  const f = staging.files.find(x => x.path === staging.selectedPath)
  return f ? isConflictedFile(f) : false
})

function onSelectConflict(path: string) {
  staging.selectedPath = path
  staging.selectedMode = 'unstaged'
  staging.diff = []
}

// ── File context menu ─────────────────────────────────────────────────────────

type FileCtxMode = 'default' | 'ignore' | 'confirm-delete'

interface FileCtxMenu {
  x: number
  y: number
  path: string
  section: 'conflict' | 'unstaged' | 'staged'
  mode: FileCtxMode
}

const fileCtxMenu = ref<FileCtxMenu | null>(null)

async function openFileCtxMenu(e: MouseEvent, path: string, section: FileCtxMenu['section']) {
  e.preventDefault()
  e.stopPropagation()
  fileCtxMenu.value = { x: e.clientX, y: e.clientY, path, section, mode: 'default' }
  await nextTick()
  const menu = document.getElementById('file-ctx-menu')
  if (menu && fileCtxMenu.value) {
    const { x, y } = clampMenuPosition(menu, e.clientX, e.clientY)
    fileCtxMenu.value = { ...fileCtxMenu.value, x, y }
  }
}

function closeFileCtxMenu() {
  fileCtxMenu.value = null
}

function onFileCtxMouseDown(e: MouseEvent) {
  const menu = document.getElementById('file-ctx-menu')
  if (menu && !menu.contains(e.target as Node)) {
    closeFileCtxMenu()
  }
}

onMounted(() => window.addEventListener('mousedown', onFileCtxMouseDown))
onUnmounted(() => window.removeEventListener('mousedown', onFileCtxMouseDown))

function fileExt(path: string): string {
  return path.split('.').pop() ?? ''
}

function fileDir(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : ''
}

async function ctxStageFile() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  await onStageFile(m.path)
}

async function ctxUnstageFile() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  await onUnstageFile(m.path)
}

async function ctxDiscardFile() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  await staging.discardFile(repoPath(), m.path)
}

async function ctxStashFile() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  try {
    await StashFile(repoPath(), m.path)
    await staging.load(repoPath())
    toast.success(`Stashed ${m.path}`)
  } catch (e) {
    toast.error(String(e))
  }
}

async function ctxIgnore(mode: 'file' | 'ext' | 'dir') {
  const m = fileCtxMenu.value
  if (!m) { return }
  let pattern: string
  if (mode === 'file') {
    pattern = m.path
  } else if (mode === 'ext') {
    pattern = `*.${fileExt(m.path)}`
  } else {
    pattern = fileDir(m.path) || m.path
  }
  closeFileCtxMenu()
  try {
    await AppendToGitignore(repoPath(), pattern)
    await staging.load(repoPath())
    toast.success(`Added "${pattern}" to .gitignore`)
  } catch (e) {
    toast.error(String(e))
  }
}

async function ctxOpenDefaultApp() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  try {
    await OpenInDefaultApp(repoPath(), m.path)
  } catch (e) {
    toast.error(String(e))
  }
}

async function ctxShowInFinder() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  try {
    await ShowInFinder(repoPath(), m.path)
  } catch (e) {
    toast.error(String(e))
  }
}

async function ctxOpenInEditor() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  try {
    await OpenInEditor(repoPath(), m.path)
  } catch (e) {
    toast.error(String(e))
  }
}

function ctxCopyPath() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  navigator.clipboard.writeText(`${repoPath()}/${m.path}`)
  toast.success('Path copied')
}

async function ctxSavePatch() {
  const m = fileCtxMenu.value
  if (!m) { return }
  closeFileCtxMenu()
  try {
    await SavePatchFile(repoPath(), m.path)
  } catch (e) {
    toast.error(String(e))
  }
}

async function ctxDeleteFile() {
  const m = fileCtxMenu.value
  if (!m) { return }
  if (m.mode !== 'confirm-delete') {
    fileCtxMenu.value = { ...m, mode: 'confirm-delete' }
    return
  }
  const path = m.path
  closeFileCtxMenu()
  try {
    await DeleteWorkingFile(repoPath(), path)
    await staging.load(repoPath())
    if (staging.selectedPath === path) {
      staging.selectedPath = null
    }
    toast.success(`Deleted ${path}`)
  } catch (e) {
    toast.error(String(e))
  }
}

// ── Arrow key navigation ──────────────────────────────────────────────────────

type NavEntry = { path: string; section: 'conflict' | 'unstaged' | 'staged' }

const navigableFiles = computed((): NavEntry[] => [
  ...staging.conflictedFiles.map(f => ({ path: f.path, section: 'conflict' as const })),
  ...staging.unstagedFiles.map(f => ({ path: f.path, section: 'unstaged' as const })),
  ...staging.stagedFiles.map(f => ({ path: f.path, section: 'staged' as const })),
])

const currentNavIndex = computed(() => {
  if (!staging.selectedPath) {
    return -1
  }
  if (selectedIsConflict.value) {
    return navigableFiles.value.findIndex(f => f.path === staging.selectedPath && f.section === 'conflict')
  }
  const section = staging.selectedMode === 'staged' ? 'staged' : 'unstaged'
  return navigableFiles.value.findIndex(f => f.path === staging.selectedPath && f.section === section)
})

const fileListScrollRef = ref<HTMLElement | null>(null)

function navigateTo(delta: number) {
  const list = navigableFiles.value
  if (!list.length) {
    return
  }
  let idx = currentNavIndex.value
  if (idx === -1) {
    idx = delta > 0 ? -1 : list.length
  }
  const next = Math.max(0, Math.min(list.length - 1, idx + delta))
  const entry = list[next]
  if (entry.section === 'conflict') {
    onSelectConflict(entry.path)
  } else {
    onSelectFile(entry.path, entry.section)
  }
  nextTick(() => {
    fileListScrollRef.value?.querySelector('.file-item.selected')?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    navigateTo(-1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    navigateTo(1)
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

// ── Image preview ─────────────────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'])
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  ico: 'image/x-icon', tiff: 'image/tiff', avif: 'image/avif',
}

function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() ?? '')
}

const selectedIsImage = computed(() => !!staging.selectedPath && isImageFile(staging.selectedPath))

const imageLoading = ref(false)
const imageSrc = ref<string | null>(null)

watch(
  () => [staging.selectedPath, staging.selectedMode] as const,
  async ([path]) => {
    imageSrc.value = null
    if (!path || !isImageFile(path)) {
      return
    }
    imageLoading.value = true
    try {
      const b64 = await GetFileBase64(repoPath(), path)
      const ext = path.split('.').pop()?.toLowerCase() ?? ''
      imageSrc.value = `data:${IMAGE_MIME[ext] ?? 'image/png'};base64,${b64}`
    } catch {
      imageSrc.value = null
    } finally {
      imageLoading.value = false
    }
  },
)

async function onConflictResolved() {
  await staging.load(repoPath())
  if (!staging.conflictedFiles.find(f => f.path === staging.selectedPath)) {
    staging.selectedPath = null
  }
}

const confirmingAbort = ref(false)

async function doAbortMerge() {
  confirmingAbort.value = false
  try {
    await AbortMerge(repoPath())
    await Promise.all([staging.load(repoPath()), commits.load(repoPath()), branches.load(repoPath())])
    staging.selectedPath = null
    toast.success('Merge aborted')
  } catch (e) {
    toast.error(String(e))
  }
}

const confirmingAbortRebase = ref(false)

async function doContinueRebase() {
  try {
    await ContinueRebase(repoPath())
    await Promise.all([staging.load(repoPath()), commits.load(repoPath()), branches.load(repoPath())])
    staging.selectedPath = null
    if (staging.isInRebase) {
      toast.success('Conflict resolved — next commit has conflicts, keep resolving')
    } else {
      toast.success('Rebase complete')
    }
  } catch (e) {
    await staging.load(repoPath())
    if (staging.isInRebase) {
      toast.success('Conflict resolved — next commit has conflicts, keep resolving')
    } else {
      toast.error(String(e))
    }
  }
}

async function doAbortRebase() {
  confirmingAbortRebase.value = false
  try {
    await AbortRebase(repoPath())
    await Promise.all([staging.load(repoPath()), commits.load(repoPath()), branches.load(repoPath())])
    staging.selectedPath = null
    toast.success('Rebase aborted')
  } catch (e) {
    toast.error(String(e))
  }
}
</script>

<template>
  <div class="staging-outer">
    <!-- Merge in progress banner -->
    <div v-if="staging.isInMerge" class="merge-banner">
      <span class="merge-banner-text">⚡ Merge in progress — resolve all conflicts, then commit</span>
      <div v-if="confirmingAbort" class="merge-abort-confirm">
        <span class="merge-abort-confirm-text">Discard all resolutions?</span>
        <button class="merge-abort-btn merge-abort-btn--confirm" @click="doAbortMerge">Yes, abort</button>
        <button class="merge-abort-btn merge-abort-btn--cancel" @click="confirmingAbort = false">Cancel</button>
      </div>
      <button v-else class="merge-abort-btn" @click="confirmingAbort = true">Abort Merge</button>
    </div>

    <!-- Rebase in progress banner -->
    <div v-if="staging.isInRebase" class="rebase-banner">
      <div class="rebase-banner-left">
        <span class="rebase-banner-title">Rebasing</span>
        <span v-if="staging.rebaseState.total" class="rebase-step">
          {{ staging.rebaseState.step }}/{{ staging.rebaseState.total }}
        </span>
        <span v-if="staging.rebaseState.onto" class="rebase-onto">onto {{ staging.rebaseState.onto }}</span>
        <span v-if="staging.rebaseState.message" class="rebase-msg">{{ staging.rebaseState.message }}</span>
      </div>
      <div v-if="confirmingAbortRebase" class="merge-abort-confirm">
        <span class="merge-abort-confirm-text">Discard all rebase progress?</span>
        <button class="merge-abort-btn merge-abort-btn--confirm" @click="doAbortRebase">Yes, abort</button>
        <button class="merge-abort-btn merge-abort-btn--cancel" @click="confirmingAbortRebase = false">Cancel</button>
      </div>
      <button v-else class="merge-abort-btn" @click="confirmingAbortRebase = true">Abort Rebase</button>
    </div>

    <div class="staging-view">
    <!-- File list panel (fixed width, has its own scroll + commit panel) -->
    <div class="file-panel" :style="{ width: fileListWidth + 'px' }">

      <!-- Scrollable file list area -->
      <div ref="fileListScrollRef" class="file-list-scroll">
        <div class="staging-toolbar">
          <button class="toolbar-btn" @click="staging.load(repoPath())" title="Refresh status">⟳ Refresh</button>
        </div>

        <div v-if="staging.loading" class="list-loading">Loading…</div>
        <template v-else>
          <!-- Conflicts section (only shown during a merge) -->
          <template v-if="staging.conflictedFiles.length">
            <div class="section-header conflict-header-section">
              <span>Conflicts ({{ staging.conflictedFiles.length }})</span>
            </div>
            <div
              v-for="file in staging.conflictedFiles"
              :key="file.path + ':conflict'"
              class="file-item file-item--conflict"
              :class="{ selected: staging.selectedPath === file.path }"
              @click="onSelectConflict(file.path)"
              @contextmenu="openFileCtxMenu($event, file.path, 'conflict')"
            >
              <span class="status-code sc-conflict">!</span>
              <span class="file-name" :title="file.path">{{ shortPath(file.path) }}</span>
            </div>
          </template>

          <!-- Unstaged section -->
          <div class="section-header">
            <span>Unstaged ({{ staging.unstagedFiles.length }})</span>
            <button v-if="staging.unstagedFiles.length" class="section-btn" @click="onStageAll">
              Stage All
            </button>
          </div>
          <div v-if="!staging.unstagedFiles.length" class="empty-section">Clean</div>
          <div
            v-for="file in staging.unstagedFiles"
            :key="file.path"
            class="file-item"
            :class="{ selected: staging.selectedPath === file.path && staging.selectedMode === 'unstaged' }"
            @click="onSelectFile(file.path, 'unstaged')"
            @contextmenu="openFileCtxMenu($event, file.path, 'unstaged')"
          >
            <span class="status-code" :class="`sc-${file.unstaged.trim() || 'q'}`">
              {{ STATUS_LABELS[file.unstaged] ?? file.unstaged }}
            </span>
            <span class="file-name" :title="file.path">{{ shortPath(file.path) }}</span>
            <button class="inline-btn stage-inline" @click.stop="onStageFile(file.path)" title="Stage file">+</button>
          </div>

          <!-- Staged section -->
          <div class="section-header staged-header">
            <span>Staged ({{ staging.stagedFiles.length }})</span>
            <button v-if="staging.stagedFiles.length" class="section-btn" @click="onUnstageAll">
              Unstage All
            </button>
          </div>
          <div v-if="!staging.stagedFiles.length" class="empty-section">Nothing staged</div>
          <div
            v-for="file in staging.stagedFiles"
            :key="file.path + ':staged'"
            class="file-item"
            :class="{ selected: staging.selectedPath === file.path && staging.selectedMode === 'staged' }"
            @click="onSelectFile(file.path, 'staged')"
            @contextmenu="openFileCtxMenu($event, file.path, 'staged')"
          >
            <span class="status-code" :class="`sc-${file.staged.trim() || 'q'}`">
              {{ STATUS_LABELS[file.staged] ?? file.staged }}
            </span>
            <span class="file-name" :title="file.path">{{ shortPath(file.path) }}</span>
            <button class="inline-btn unstage-inline" @click.stop="onUnstageFile(file.path)" title="Unstage file">−</button>
          </div>
        </template>
      </div>

      <!-- Commit panel — pinned at bottom -->
      <div class="commit-panel">
        <!-- During rebase: show Continue button instead of normal commit form -->
        <template v-if="staging.isInRebase">
          <div class="rebase-action-hint">Resolve all conflicts above, then continue the rebase.</div>
          <button
            class="commit-btn rebase-continue-btn"
            :disabled="staging.conflictedFiles.length > 0"
            @click="doContinueRebase"
          >
            <span v-if="staging.conflictedFiles.length > 0">Resolve {{ staging.conflictedFiles.length }} conflict(s) first</span>
            <span v-else>↪ Continue Rebase</span>
          </button>
        </template>

        <template v-else>
          <label class="amend-row">
            <input type="checkbox" v-model="amend" @change="onAmendToggle" />
            <span>Amend previous commit</span>
          </label>

          <div class="summary-row">
            <textarea
              v-model="commitSummary"
              class="summary-input"
              placeholder="Commit summary"
              rows="2"
              maxlength="200"
            />
            <span class="char-count" :class="{ over: summaryRemaining < 0, warn: summaryRemaining < 10 && summaryRemaining >= 0 }">
              {{ summaryRemaining }}
            </span>
          </div>

          <textarea
            v-model="commitDescription"
            class="desc-input"
            placeholder="Description (optional)"
            rows="2"
          />

          <button
            class="commit-btn"
            :class="{ ready: canCommit && commitSummary.trim() }"
            :disabled="!canCommit"
            @click="onCommit"
          >
            <span v-if="committing">Committing…</span>
            <span v-else-if="!commitSummary.trim() && !amend">Type a message to commit</span>
            <span v-else>
              ○ Commit to <strong>{{ currentBranch }}</strong>
            </span>
          </button>
        </template>
      </div>
    </div>

    <!-- Resize handle -->
    <div class="resize-handle" @mousedown.prevent="startResize" />

    <!-- Diff / hunk panel -->
    <div class="diff-panel">
      <div v-if="!staging.selectedPath" class="diff-empty">Select a file to view changes</div>
      <ConflictView
        v-else-if="selectedIsConflict"
        :repo-path="repoPath()"
        :path="staging.selectedPath!"
        @resolved="onConflictResolved"
      />
      <div v-else-if="selectedIsImage" class="image-preview-panel">
        <div class="image-preview-header">{{ staging.selectedPath }}</div>
        <div v-if="imageLoading" class="image-preview-loading">Loading…</div>
        <div v-else-if="imageSrc" class="image-preview-container">
          <img :src="imageSrc" class="image-preview-img" :alt="staging.selectedPath ?? ''" />
        </div>
        <div v-else class="image-preview-missing">File not found on disk</div>
      </div>
      <HunkSelector
        v-else
        :diffs="staging.diff"
        :mode="staging.selectedMode === 'staged' ? 'unstage' : 'stage'"
        :path="staging.selectedPath"
        :diff-loading="staging.diffLoading"
        @stage-file="onStageFile(staging.selectedPath!)"
        @unstage-file="onUnstageFile(staging.selectedPath!)"
        @discard-file="onDiscardFile(staging.selectedPath!)"
        @stage-hunk="onStageHunk"
        @unstage-hunk="onUnstageHunk"
      />
    </div>
  </div>
  </div>

  <!-- File context menu (teleported to escape overflow clipping) -->
  <Teleport to="body">
    <div
      v-if="fileCtxMenu"
      id="file-ctx-menu"
      class="ctx-menu"
      :style="{ left: fileCtxMenu.x + 'px', top: fileCtxMenu.y + 'px' }"
    >
      <div class="ctx-menu-label">{{ fileCtxMenu.path.split('/').pop() }}</div>

      <!-- Default mode -->
      <template v-if="fileCtxMenu.mode === 'default'">
        <!-- Unstaged-only actions -->
        <template v-if="fileCtxMenu.section === 'unstaged'">
          <button class="ctx-menu-item ctx-menu-item-primary" @click="ctxStageFile">Stage file</button>
          <button class="ctx-menu-item ctx-menu-item-danger" @click="ctxDiscardFile">Discard changes</button>
          <div class="ctx-menu-divider" />
          <button class="ctx-menu-item" @click="fileCtxMenu!.mode = 'ignore'">Ignore <span style="float:right;opacity:.5">▸</span></button>
          <button class="ctx-menu-item" @click="ctxStashFile">Stash file</button>
          <div class="ctx-menu-divider" />
        </template>

        <!-- Staged-only actions -->
        <template v-else-if="fileCtxMenu.section === 'staged'">
          <button class="ctx-menu-item ctx-menu-item-primary" @click="ctxUnstageFile">Unstage file</button>
          <div class="ctx-menu-divider" />
        </template>

        <!-- Common actions -->
        <button class="ctx-menu-item" @click="ctxOpenDefaultApp">Open in default app</button>
        <button class="ctx-menu-item" @click="ctxShowInFinder">Show in Finder</button>
        <button class="ctx-menu-item" @click="ctxOpenInEditor">Open in editor</button>
        <div class="ctx-menu-divider" />
        <button class="ctx-menu-item" @click="ctxCopyPath">Copy path</button>
        <button v-if="fileCtxMenu.section !== 'conflict'" class="ctx-menu-item" @click="ctxSavePatch">Save patch…</button>

        <!-- Unstaged: delete -->
        <template v-if="fileCtxMenu.section === 'unstaged'">
          <div class="ctx-menu-divider" />
          <button class="ctx-menu-item ctx-menu-item-danger" @click="ctxDeleteFile">Delete file</button>
        </template>
      </template>

      <!-- Ignore submenu -->
      <template v-else-if="fileCtxMenu.mode === 'ignore'">
        <button class="ctx-menu-item" @click="fileCtxMenu!.mode = 'default'">← Back</button>
        <div class="ctx-menu-divider" />
        <button class="ctx-menu-item" @click="ctxIgnore('file')">Ignore this file</button>
        <button class="ctx-menu-item" @click="ctxIgnore('ext')" :disabled="!fileExt(fileCtxMenu.path)">
          Ignore all *.{{ fileExt(fileCtxMenu.path) }} files
        </button>
        <button class="ctx-menu-item" @click="ctxIgnore('dir')" :disabled="!fileDir(fileCtxMenu.path)">
          Ignore containing folder
        </button>
      </template>

      <!-- Delete confirm -->
      <template v-else-if="fileCtxMenu.mode === 'confirm-delete'">
        <div class="ctx-menu-confirm">
          <p class="ctx-menu-confirm-text">Delete "{{ fileCtxMenu.path.split('/').pop() }}" from disk?</p>
          <button class="ctx-menu-item ctx-menu-item-danger" @click="ctxDeleteFile">Yes, delete</button>
          <button class="ctx-menu-item" @click="closeFileCtxMenu">Cancel</button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.staging-outer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* Merge banner */
.merge-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  background: #1e1a00;
  border-bottom: 1px solid #3a3000;
  flex-shrink: 0;
}

.merge-banner-text {
  font-size: 12px;
  color: #f0c050;
}

.merge-abort-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
}

.merge-abort-confirm-text {
  font-size: 11px;
  color: #f09070;
}

.merge-abort-btn {
  padding: 3px 10px;
  background: #2a1818;
  border: 1px solid #4a2020;
  border-radius: 4px;
  color: #f07070;
  font-size: 11px;
  cursor: pointer;
}
.merge-abort-btn:hover { background: #381e1e; color: #f09090; }
.merge-abort-btn--confirm { background: #3a1818; border-color: #6a2020; color: #f08080; }
.merge-abort-btn--confirm:hover { background: #4a1c1c; color: #f0a0a0; }
.merge-abort-btn--cancel { background: transparent; border-color: #2a2a44; color: #556; margin-left: 2px; }
.merge-abort-btn--cancel:hover { border-color: #3a3a60; color: #778; }

/* Rebase banner */
.rebase-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  background: #0e1a28;
  border-bottom: 1px solid #1a3050;
  flex-shrink: 0;
  gap: 8px;
}

.rebase-banner-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.rebase-banner-title {
  font-size: 12px;
  font-weight: 600;
  color: #4f8ef7;
  flex-shrink: 0;
}

.rebase-step {
  font-size: 11px;
  color: #7a9abb;
  font-family: monospace;
  flex-shrink: 0;
}

.rebase-onto {
  font-size: 11px;
  color: #5a7a9b;
  flex-shrink: 0;
}

.rebase-msg {
  font-size: 11px;
  color: #8aadcc;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rebase-action-hint {
  font-size: 11px;
  color: #5a7a9b;
  padding: 2px 2px 4px;
}

.rebase-continue-btn {
  background: #0e2040 !important;
  color: #4f8ef7 !important;
  border: 1px solid #1a3a6a !important;
}
.rebase-continue-btn:hover:not(:disabled) { background: #132848 !important; }
.rebase-continue-btn:disabled { cursor: default; color: #556 !important; border-color: #252540 !important; background: #1a1a30 !important; }

.staging-view {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* File list panel — no overflow here; children manage it */
.file-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #16213e;
  border-right: 1px solid #2d2d4e;
  overflow: hidden;
  min-height: 0;
}

/* Scrollable file list */
.file-list-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.staging-toolbar {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid #2d2d4e;
  flex-shrink: 0;
}

.toolbar-btn {
  padding: 3px 8px;
  background: #1e2d50;
  border: 1px solid #2d3d6e;
  border-radius: 4px;
  color: #8aadee;
  font-size: 11px;
  cursor: pointer;
}
.toolbar-btn:hover { background: #243466; }

.list-loading {
  padding: 16px;
  color: #778;
  font-size: 12px;
  text-align: center;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #778;
  flex-shrink: 0;
}
.staged-header { margin-top: 4px; border-top: 1px solid #1e1e36; padding-top: 8px; }

.section-btn {
  font-size: 10px;
  padding: 1px 6px;
  background: transparent;
  border: 1px solid #445;
  border-radius: 3px;
  color: #889;
  cursor: pointer;
}
.section-btn:hover { border-color: #667; color: #aab; }

.empty-section {
  padding: 4px 12px 6px;
  font-size: 11px;
  color: #667;
  font-style: italic;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 10px;
  font-size: 12px;
  cursor: pointer;
  min-width: 0;
}
.file-item:hover { background: #1e2d50; }
.file-item.selected { background: #1e2d54; }

.status-code {
  font-size: 10px;
  font-weight: 700;
  font-family: monospace;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}
.sc-M { color: #f0a050; }
.sc-A { color: #4ff7a0; }
.sc-D { color: #f74f4f; }
.sc-R { color: #7aadff; }
.sc-q { color: #5af0f0; }
.sc-conflict { color: #f07070; }

.conflict-header-section { color: #c06060; }

.file-item--conflict .file-name { color: #f07070; }
.file-item--conflict.selected .file-name { color: #f09090; }
.file-item--conflict:hover { background: #2a1818; }

.file-name {
  flex: 1;
  font-size: 11px;
  font-family: monospace;
  color: #aab;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-item.selected .file-name { color: #dde; }

.inline-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: none;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s;
}
.file-item:hover .inline-btn { opacity: 1; }
.stage-inline   { background: rgba(79,247,160,0.15); color: #4ff7a0; }
.stage-inline:hover   { background: rgba(79,247,160,0.30); }
.unstage-inline { background: rgba(247,79,79,0.15); color: #f74f4f; }
.unstage-inline:hover { background: rgba(247,79,79,0.30); }

/* ── Commit panel ─────────────────────────── */
.commit-panel {
  flex-shrink: 0;
  border-top: 1px solid #1e1e36;
  background: #111124;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.amend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #99aabb;
  cursor: pointer;
  user-select: none;
  padding: 0 2px;
}
.amend-row input[type=checkbox] { accent-color: #4f8ef7; cursor: pointer; }
.amend-row:hover span { color: #bbccdd; }

.summary-row {
  position: relative;
}

.summary-input {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #252540;
  border-radius: 4px;
  color: #ccc;
  font-size: 12px;
  padding: 6px 30px 6px 8px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.4;
  box-sizing: border-box;
}
.summary-input:focus { border-color: #4f8ef7; }
.summary-input::placeholder { color: #556; }

.char-count {
  position: absolute;
  right: 6px;
  bottom: 6px;
  font-size: 10px;
  color: #667;
  pointer-events: none;
}
.char-count.warn { color: #f0a050; }
.char-count.over { color: #f74f4f; }

.desc-input {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #252540;
  border-radius: 4px;
  color: #aaa;
  font-size: 11px;
  padding: 5px 8px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.4;
  box-sizing: border-box;
}
.desc-input:focus { border-color: #3a3a60; }
.desc-input::placeholder { color: #4a4a66; }

.commit-btn {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  background: #1a1a30;
  color: #778;
}
.commit-btn:disabled { cursor: default; }
.commit-btn.ready {
  background: #1e3d28;
  color: #4ff7a0;
  border: 1px solid #2a5a38;
}
.commit-btn.ready:hover { background: #254830; }
.commit-btn strong { font-weight: 700; }

/* Resize handle */
.resize-handle {
  width: 4px;
  flex-shrink: 0;
  background: #1e1e36;
  cursor: col-resize;
  transition: background 0.15s;
}
.resize-handle:hover { background: #4f8ef7; }

/* Diff panel */
.diff-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.diff-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #778;
  font-size: 13px;
}

/* Image preview */
.image-preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.image-preview-header {
  flex-shrink: 0;
  padding: 7px 12px;
  font-size: 11px;
  font-family: monospace;
  color: #6688aa;
  border-bottom: 1px solid #1e1e36;
  background: #0f0f1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-preview-loading,
.image-preview-missing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #556;
  font-size: 13px;
}

.image-preview-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 24px;
  background: #0a0a14;
}

.image-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
}
</style>
