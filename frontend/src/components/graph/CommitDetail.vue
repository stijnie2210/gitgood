<script setup lang="ts">
import { computed } from 'vue';
import { useCommitsStore } from '../../stores/commits';
import CommitFileList from './CommitFileList.vue';

const commits = useCommitsStore();

const selectedRow = computed(
  () => commits.rows.find((r) => r.hash === commits.selectedHash) ?? null
);
</script>

<template>
  <aside v-if="commits.selectedHash" class="detail-panel">
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

    <div v-if="commits.diffLoading" class="loading">Loading…</div>
    <CommitFileList v-else />
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

.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 5px;
}

.meta-hash {
  font-family: monospace;
  font-size: 11px;
  color: #555;
}

.label {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
}
.label--head {
  background: #4f8ef7;
  color: #fff;
}
.label--branch {
  background: #2a3a5e;
  color: #7aadff;
  border: 1px solid #3a5080;
}
.label--remote {
  background: #2a4a3a;
  color: #7affb8;
  border: 1px solid #3a6050;
}
.label--tag {
  background: #4a3a20;
  color: #ffcc66;
  border: 1px solid #6a5030;
}

.meta-subject {
  font-size: 13px;
  color: #e0e0e0;
  font-weight: 500;
  margin-bottom: 3px;
}
.meta-info {
  display: flex;
  gap: 12px;
  color: #666;
  font-size: 11px;
}

.loading {
  padding: 16px;
  color: #555;
  text-align: center;
}
</style>
