<script setup lang="ts">
import { useCommitsStore } from '../../stores/commits';

const commits = useCommitsStore();

type FileDiff = (typeof commits.diff)[0];

function fileStatus(file: FileDiff): string {
  if (!file.oldPath) {
    return '+';
  }
  if (!file.newPath || file.newPath === file.oldPath) {
    return file.hunks.length ? '~' : '';
  }
  return '→';
}
</script>

<template>
  <div class="file-list">
    <div v-if="commits.diff.length === 0" class="no-changes">No changes</div>

    <button
      v-for="(file, fi) in commits.diff"
      :key="file.newPath ?? file.oldPath ?? fi"
      class="file-item"
      :class="{ active: fi === commits.selectedFileIndex }"
      @click="commits.selectFile(fi)"
    >
      <span
        class="file-status"
        :class="{
          'status-add': fileStatus(file) === '+',
          'status-mod': fileStatus(file) === '~',
          'status-ren': fileStatus(file) === '→',
        }"
      >{{ fileStatus(file) }}</span>
      <span class="file-path">{{ file.newPath || file.oldPath }}</span>
      <span v-if="file.isBinary" class="file-badge">binary</span>
      <span class="file-stats">
        <span class="stat-add">+{{ file.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'add').length }}</span>
        <span class="stat-del">−{{ file.hunks.flatMap((h) => h.lines).filter((l) => l.type === 'del').length }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.file-list {
  flex: 1;
  overflow-y: auto;
}

.no-changes {
  padding: 16px;
  color: #555;
  text-align: center;
  font-size: 12px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #aaa;
  width: 100%;
  font-size: 13px;
}
.file-item:hover {
  background: #111124;
  color: #ccc;
}
.file-item.active {
  background: #16213e;
  color: #ccc;
}

.file-status {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
  font-family: monospace;
}
.status-add {
  color: #4ff7a0;
}
.status-mod {
  color: #f7a04f;
}
.status-ren {
  color: #4f8ef7;
}

.file-path {
  font-family: monospace;
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-badge {
  font-size: 10px;
  background: #2a2a3e;
  color: #666;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.file-stats {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
  font-family: monospace;
}
.stat-add {
  color: #4ff7a0;
}
.stat-del {
  color: #f74f4f;
}
</style>
