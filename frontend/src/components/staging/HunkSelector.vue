<script setup lang="ts">
import { computed } from 'vue';
import type { FileDiff, Hunk } from '../../stores/staging';

const props = defineProps<{
  diffs: FileDiff[]
  mode: 'stage' | 'unstage'
  path: string
  diffLoading: boolean
}>();

const emit = defineEmits<{
  'stage-file': []
  'unstage-file': []
  'discard-file': []
  'stage-hunk': [hunk: Hunk]
  'unstage-hunk': [hunk: Hunk]
}>();

// Flatten hunks across all FileDiffs (usually just one for a single file)
const flatHunks = computed(() => {
  const result: Hunk[] = [];
  for (const fd of props.diffs) {
    for (const h of fd.hunks) {
      result.push(h);
    }
  }
  return result;
});

const isBinary = computed(() => props.diffs.some(d => d.isBinary));
</script>

<template>
  <div class="hunk-selector">
    <!-- File action bar -->
    <div class="file-action-bar">
      <span class="file-action-path" :title="path">{{ path }}</span>
      <div class="file-action-btns">
        <button v-if="mode === 'stage'" class="action-btn stage-btn" @click="emit('stage-file')">
          Stage File
        </button>
        <button v-if="mode === 'stage'" class="action-btn discard-btn" @click="emit('discard-file')">
          Discard
        </button>
        <button v-if="mode === 'unstage'" class="action-btn unstage-btn" @click="emit('unstage-file')">
          Unstage File
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="diffLoading" class="hunk-loading">Loading diff…</div>

    <!-- Binary file notice -->
    <div v-else-if="isBinary" class="hunk-empty">Binary file — no diff available</div>

    <!-- No hunks -->
    <div v-else-if="flatHunks.length === 0" class="hunk-empty">No diff to show</div>

    <!-- Hunks -->
    <div v-else class="hunks-scroll">
      <div v-for="(hunk, hi) in flatHunks" :key="hi" class="hunk-block">
        <div class="hunk-header-row">
          <span class="hunk-header-text">{{ hunk.header }}</span>
          <button
            v-if="mode === 'stage'"
            class="hunk-btn stage-btn"
            @click="emit('stage-hunk', hunk)"
          >Stage Hunk</button>
          <button
            v-else
            class="hunk-btn unstage-btn"
            @click="emit('unstage-hunk', hunk)"
          >Unstage Hunk</button>
        </div>
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
    </div>
  </div>
</template>

<style scoped>
.hunk-selector {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d0d18;
  font-size: 12px;
  min-width: 0;
}

.file-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #111124;
  border-bottom: 1px solid #1e1e36;
  flex-shrink: 0;
}

.file-action-path {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #ccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-action-btns {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11px;
  cursor: pointer;
  font-weight: 500;
}

.action-btn.stage-btn  { background: rgba(79,247,160,0.12); border-color: #3a8a60; color: #4ff7a0; }
.action-btn.stage-btn:hover  { background: rgba(79,247,160,0.22); }
.action-btn.unstage-btn { background: rgba(79,140,247,0.12); border-color: #3a5e8a; color: #7aadff; }
.action-btn.unstage-btn:hover { background: rgba(79,140,247,0.22); }
.action-btn.discard-btn { background: rgba(247,79,79,0.1); border-color: #7a3a3a; color: #f79090; }
.action-btn.discard-btn:hover { background: rgba(247,79,79,0.2); }

.hunk-loading,
.hunk-empty {
  padding: 24px;
  color: #778;
  text-align: center;
  font-size: 13px;
}

.hunks-scroll {
  flex: 1;
  overflow-y: auto;
}

.hunk-block {
  border-bottom: 1px solid #131328;
}

.hunk-header-row {
  display: flex;
  align-items: center;
  padding: 3px 10px;
  background: #0e0e20;
  border-top: 1px solid #1a1a30;
  border-bottom: 1px solid #1a1a30;
  gap: 8px;
}

.hunk-header-text {
  flex: 1;
  font-family: monospace;
  font-size: 11px;
  color: #5577aa;
}

.hunk-btn {
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid;
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
  font-weight: 500;
}
.hunk-btn.stage-btn   { background: rgba(79,247,160,0.08); border-color: #2a6040; color: #4ff7a0; }
.hunk-btn.stage-btn:hover   { background: rgba(79,247,160,0.18); }
.hunk-btn.unstage-btn { background: rgba(79,140,247,0.08); border-color: #2a4060; color: #7aadff; }
.hunk-btn.unstage-btn:hover { background: rgba(79,140,247,0.18); }

.diff-line {
  display: flex;
  font-family: monospace;
  font-size: 11px;
  line-height: 18px;
  white-space: pre;
}
.diff-line--add     { background: rgba(79,247,160,0.06); }
.diff-line--del     { background: rgba(247,79,79,0.08); }
.diff-line--context { color: #7788aa; }

.diff-gutter { width: 14px; text-align: center; flex-shrink: 0; color: #4a5570; user-select: none; }
.diff-line--add .diff-gutter { color: #4ff7a0; }
.diff-line--del .diff-gutter { color: #f74f4f; }

.diff-lineno {
  width: 36px;
  text-align: right;
  padding-right: 6px;
  color: #4a5570;
  flex-shrink: 0;
  user-select: none;
  font-size: 10px;
  line-height: 18px;
}
.diff-line--add .diff-lineno.old { color: transparent; }
.diff-line--del .diff-lineno.new { color: transparent; }

.diff-content { padding-left: 6px; color: #ccc; }
.diff-line--add .diff-content { color: #9effd0; }
.diff-line--del .diff-content { color: #ff9090; }
</style>
