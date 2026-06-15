<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDetailWidth } from '../../composables/useDetailWidth';

const fileListWidth = useDetailWidth();

function startFileListResize(e: MouseEvent) {
  const startX = e.clientX;
  const startW = fileListWidth.value;
  function onMove(ev: MouseEvent) {
    fileListWidth.value = Math.max(160, Math.min(600, startW - (ev.clientX - startX)));
  }
  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
import { useCommitsStore } from '../../stores/commits';
import { useReposStore } from '../../stores/repos';
import { GetFileAtCommitBase64 } from '../../../wailsjs/go/main/App';
import CommitFileList from './CommitFileList.vue';

const commits = useCommitsStore();
const repos = useReposStore();

const file = computed(() =>
  commits.selectedFileIndex !== null ? commits.diff[commits.selectedFileIndex] : null
);

const selectedRow = computed(() =>
  commits.rows.find((r) => r.hash === commits.selectedHash) ?? null
);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif',
]);
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  ico: 'image/x-icon', tiff: 'image/tiff', avif: 'image/avif',
};

function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() ?? '');
}

const imageSrc = ref<string | null>(null);
const imageLoading = ref(false);

watch(
  () => commits.selectedFileIndex,
  async () => {
    imageSrc.value = null;
    imageLoading.value = false;
    const f = file.value;
    if (!f?.isBinary) {
      return;
    }
    const path = f.newPath || f.oldPath;
    if (!path || !isImageFile(path)) {
      return;
    }
    const hash = commits.selectedHash;
    const repoPath = repos.activeRepo?.path;
    if (!hash || !repoPath) {
      return;
    }
    imageLoading.value = true;
    try {
      const b64 = await GetFileAtCommitBase64(repoPath, hash, path);
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      imageSrc.value = `data:${IMAGE_MIME[ext] ?? 'image/png'};base64,${b64}`;
    } catch {
      // imageSrc stays null
    } finally {
      imageLoading.value = false;
    }
  },
  { immediate: true }
);

type FileDiff = (typeof commits.diff)[0];

function filePath(f: FileDiff): string {
  return f.newPath || f.oldPath || '';
}

function close() {
  commits.clearFileSelection();
}

function navigateTo(delta: number) {
  if (commits.selectedFileIndex === null) {
    return;
  }
  const next = commits.selectedFileIndex + delta;
  if (next >= 0 && next < commits.diff.length) {
    commits.selectFile(next);
  }
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
    return;
  }
  if (e.key === 'Escape') {
    close();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    navigateTo(-1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    navigateTo(1);
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <div class="fdv">
    <!-- Header bar -->
    <div class="fdv-header">
      <button class="fdv-back" @click="close">
        <span class="fdv-back-arrow">‹</span>
        Commits
      </button>
      <div class="fdv-title" v-if="file">
        <span class="fdv-filepath">{{ filePath(file) }}</span>
      </div>
      <div class="fdv-commit-chip" v-if="selectedRow">
        <span class="fdv-chip-hash">{{ selectedRow.shortHash }}</span>
        <span class="fdv-chip-subject">{{ selectedRow.subject }}</span>
      </div>
    </div>

    <!-- Body -->
    <div class="fdv-body">
      <!-- Diff content -->
      <div class="fdv-diff" v-if="file">
        <template v-if="file.isBinary">
          <template v-if="isImageFile(filePath(file))">
            <div v-if="imageLoading" class="fdv-notice">Loading…</div>
            <div v-else-if="imageSrc" class="fdv-img-wrap">
              <img :src="imageSrc" class="fdv-img" :alt="filePath(file)" />
            </div>
            <div v-else class="fdv-notice">Image not available at this commit</div>
          </template>
          <div v-else class="fdv-notice">Binary file not shown</div>
        </template>
        <template v-else>
          <div v-if="file.hunks.length === 0" class="fdv-notice">No changes</div>
          <div v-for="(hunk, hi) in file.hunks" :key="hi" class="fdv-hunk">
            <div class="fdv-hunk-header">{{ hunk.header }}</div>
            <div
              v-for="(line, li) in hunk.lines"
              :key="li"
              class="diff-line"
              :class="`diff-line--${line.type}`"
            >
              <span class="diff-gutter">{{
                line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '
              }}</span>
              <span class="diff-lineno old">{{ line.oldLine || '' }}</span>
              <span class="diff-lineno new">{{ line.newLine || '' }}</span>
              <span class="diff-content">{{ line.content }}</span>
            </div>
          </div>
        </template>
      </div>

      <div class="resize-handle" @mousedown.prevent="startFileListResize" />

      <!-- File list sidebar -->
      <div class="fdv-files" :style="{ width: fileListWidth + 'px' }">
        <div class="fdv-files-title">
          {{ commits.diff.length }} changed file{{ commits.diff.length !== 1 ? 's' : '' }}
        </div>
        <CommitFileList />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fdv {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0f0f1a;
}

/* ── Header ── */
.fdv-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  height: 38px;
  background: #0a0a14;
  border-bottom: 1px solid #1e1e36;
  flex-shrink: 0;
  min-width: 0;
}

.fdv-back {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #16162a;
  border: 1px solid #2a2a44;
  border-radius: 4px;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
}
.fdv-back:hover {
  color: #ccc;
  border-color: #4f8ef7;
}

.fdv-back-arrow {
  font-size: 16px;
  line-height: 1;
  margin-top: -1px;
}

.fdv-title {
  flex: 1;
  min-width: 0;
}

.fdv-filepath {
  font-family: monospace;
  font-size: 12px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.fdv-commit-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  max-width: 380px;
  min-width: 0;
}

.fdv-chip-hash {
  font-family: monospace;
  font-size: 11px;
  color: #555;
  flex-shrink: 0;
}

.fdv-chip-subject {
  font-size: 11px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Body ── */
.fdv-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Diff pane ── */
.fdv-diff {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}

.fdv-notice {
  padding: 24px;
  color: #555;
  font-size: 12px;
  text-align: center;
}

.fdv-img-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #0a0a14;
}

.fdv-img {
  max-width: 100%;
  max-height: 600px;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
}

.fdv-hunk {
  border-bottom: 1px solid #0e0e1c;
}

.fdv-hunk-header {
  padding: 3px 12px;
  font-family: monospace;
  font-size: 11px;
  color: #5577aa;
  background: #0e0e20;
  border-top: 1px solid #1a1a30;
  border-bottom: 1px solid #1a1a30;
}

/* ── Diff line styles ── */
.diff-line {
  display: flex;
  font-family: monospace;
  font-size: 12px;
  line-height: 19px;
  white-space: pre;
}
.diff-line--add {
  background: rgba(79, 247, 160, 0.06);
}
.diff-line--del {
  background: rgba(247, 79, 79, 0.08);
}
.diff-line--context {
  color: #555;
}

.diff-gutter {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
  color: #333;
  user-select: none;
}
.diff-line--add .diff-gutter {
  color: #4ff7a0;
}
.diff-line--del .diff-gutter {
  color: #f74f4f;
}

.diff-lineno {
  width: 40px;
  text-align: right;
  padding-right: 8px;
  color: #333;
  flex-shrink: 0;
  user-select: none;
  font-size: 10px;
  line-height: 19px;
}
.diff-line--add .diff-lineno.old {
  color: transparent;
}
.diff-line--del .diff-lineno.new {
  color: transparent;
}

.diff-content {
  padding-left: 6px;
  color: #ccc;
  overflow: visible;
}
.diff-line--add .diff-content {
  color: #9effd0;
}
.diff-line--del .diff-content {
  color: #ff9090;
}

/* ── File list sidebar ── */
.fdv-files {
  flex-shrink: 0;
  border-left: 1px solid #1e1e36;
  background: #0d0d18;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.resize-handle {
  width: 4px;
  flex-shrink: 0;
  background: #1e1e36;
  cursor: col-resize;
  transition: background 0.15s;
}
.resize-handle:hover {
  background: #4f8ef7;
}

.fdv-files-title {
  padding: 8px 12px;
  font-size: 11px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid #1e1e36;
  flex-shrink: 0;
}
</style>
