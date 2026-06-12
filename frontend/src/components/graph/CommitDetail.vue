<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCommitsStore } from '../../stores/commits'

const commits = useCommitsStore()

const selectedRow = computed(() =>
  commits.rows.find(r => r.hash === commits.selectedHash) ?? null
)

// Track collapsed state per file index
const collapsed = ref<Set<number>>(new Set())

function toggle(i: number) {
  const s = new Set(collapsed.value)
  if (s.has(i)) s.delete(i)
  else s.add(i)
  collapsed.value = s
}

// Reset collapse state when diff changes
const prevHash = ref<string | null>(null)
computed(() => {
  if (commits.selectedHash !== prevHash.value) {
    prevHash.value = commits.selectedHash
    collapsed.value = new Set()
  }
})
</script>

<template>
  <aside v-if="commits.selectedHash" class="detail-panel">
    <!-- Commit header -->
    <div v-if="selectedRow" class="commit-meta">
      <div class="meta-row">
        <span class="meta-hash">{{ selectedRow.shortHash }}</span>
        <span
          v-for="l in selectedRow.labels"
          :key="l.name"
          class="label"
          :class="`label--${l.type}`"
        >{{ l.type === 'remote' ? `${l.remote}/${l.name}` : l.name }}</span>
      </div>
      <div class="meta-subject">{{ selectedRow.subject }}</div>
      <div class="meta-info">
        <span>{{ selectedRow.author }}</span>
        <span>{{ selectedRow.date }}</span>
      </div>
    </div>

    <div v-if="commits.diffLoading" class="loading">Loading diff…</div>

    <div v-else class="diff-list">
      <div v-if="commits.diff.length === 0" class="no-changes">No changes</div>

      <div v-for="(file, fi) in commits.diff" :key="fi" class="file-diff">
        <!-- File header — always visible, click to collapse -->
        <button class="file-header" @click="toggle(fi)">
          <span class="collapse-icon">{{ collapsed.has(fi) ? '▶' : '▼' }}</span>
          <span class="file-status">
            {{ !file.oldPath ? '+' : !file.newPath || file.newPath === file.oldPath ? (file.hunks.length ? '~' : '') : '→' }}
          </span>
          <span class="file-path">{{ file.newPath || file.oldPath }}</span>
          <span v-if="file.isBinary" class="file-badge">binary</span>
          <span class="file-stats">
            <span class="stat-add">+{{ file.hunks.flatMap(h => h.lines).filter(l => l.type === 'add').length }}</span>
            <span class="stat-del">−{{ file.hunks.flatMap(h => h.lines).filter(l => l.type === 'del').length }}</span>
          </span>
        </button>

        <!-- Hunks — hidden when collapsed -->
        <template v-if="!collapsed.has(fi)">
          <div v-if="file.isBinary" class="binary-notice">Binary file not shown</div>

          <div v-for="(hunk, hi) in file.hunks" :key="hi" class="hunk">
            <div class="hunk-header">{{ hunk.header }}</div>
            <div
              v-for="(line, li) in hunk.lines"
              :key="li"
              class="diff-line"
              :class="`diff-line--${line.type}`"
            >
              <span class="diff-gutter">{{ line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' ' }}</span>
              <span class="diff-lineno old">{{ line.oldLine || '' }}</span>
              <span class="diff-lineno new">{{ line.newLine || '' }}</span>
              <span class="diff-content">{{ line.content }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.detail-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 12px;
  background: #0d0d18;
  border-left: 1px solid #1e1e36;
  min-width: 200px;
  height: 100%;
}

.commit-meta {
  padding: 10px 12px;
  border-bottom: 1px solid #1e1e36;
  flex-shrink: 0;
}

.meta-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 5px; }

.meta-hash { font-family: monospace; font-size: 11px; color: #555; }

.label { padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 500; }
.label--head   { background: #4f8ef7; color: #fff; }
.label--branch { background: #2a3a5e; color: #7aadff; border: 1px solid #3a5080; }
.label--remote { background: #2a4a3a; color: #7affb8; border: 1px solid #3a6050; }
.label--tag    { background: #4a3a20; color: #ffcc66; border: 1px solid #6a5030; }

.meta-subject { font-size: 13px; color: #e0e0e0; font-weight: 500; margin-bottom: 3px; }
.meta-info { display: flex; gap: 12px; color: #666; font-size: 11px; }

.loading, .no-changes { padding: 16px; color: #555; text-align: center; }

.diff-list { flex: 1; overflow-y: auto; }

.file-diff { border-bottom: 1px solid #161628; }

.file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #111124;
  width: 100%;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #aaa;
}
.file-header:hover { background: #16162e; }

.collapse-icon { font-size: 8px; color: #444; flex-shrink: 0; }
.file-status { font-size: 11px; color: #666; width: 10px; flex-shrink: 0; }
.file-path { font-family: monospace; font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-badge { font-size: 10px; background: #2a2a3e; color: #666; padding: 1px 4px; border-radius: 3px; flex-shrink: 0; }

.file-stats { display: flex; gap: 6px; flex-shrink: 0; font-size: 11px; font-family: monospace; }
.stat-add { color: #4ff7a0; }
.stat-del { color: #f74f4f; }

.binary-notice { padding: 8px 12px; color: #555; font-size: 11px; font-style: italic; }

.hunk-header {
  padding: 2px 10px;
  font-family: monospace;
  font-size: 11px;
  color: #5577aa;
  background: #0e0e20;
  border-top: 1px solid #1a1a30;
  border-bottom: 1px solid #1a1a30;
}

.diff-line {
  display: flex;
  font-family: monospace;
  font-size: 11px;
  line-height: 18px;
  white-space: pre;
}
.diff-line--add     { background: rgba(79, 247, 160, 0.06); }
.diff-line--del     { background: rgba(247, 79, 79, 0.08); }
.diff-line--context { color: #555; }

.diff-gutter { width: 14px; text-align: center; flex-shrink: 0; color: #333; user-select: none; }
.diff-line--add .diff-gutter { color: #4ff7a0; }
.diff-line--del .diff-gutter { color: #f74f4f; }

.diff-lineno {
  width: 36px;
  text-align: right;
  padding-right: 6px;
  color: #333;
  flex-shrink: 0;
  user-select: none;
  font-size: 10px;
  line-height: 18px;
}
.diff-line--add .diff-lineno.old { color: transparent; }
.diff-line--del .diff-lineno.new { color: transparent; }

.diff-content { padding-left: 6px; color: #ccc; overflow: visible; }
.diff-line--add .diff-content { color: #9effd0; }
.diff-line--del .diff-content { color: #ff9090; }
</style>
