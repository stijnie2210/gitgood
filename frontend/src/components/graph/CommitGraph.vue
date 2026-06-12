<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useCommitsStore } from '../../stores/commits'
import { useReposStore } from '../../stores/repos'
import { CELL_W } from './graphRenderer'
import CommitRow from './CommitRow.vue'
import CommitContextMenu from './CommitContextMenu.vue'

const ROW_H = 28

const repos = useReposStore()
const commits = useCommitsStore()

const parentRef = ref<HTMLElement | null>(null)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: commits.rows.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => ROW_H,
    overscan: 15,
  }))
)

const items = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())
const graphWidth = computed(() => (commits.maxColumn + 2) * CELL_W)

watch(
  () => repos.activeRepo?.path,
  path => {
    if (path) commits.load(path)
    else commits.clear()
  },
  { immediate: true },
)

function onRowClick(index: number) {
  const row = commits.rows[index]
  if (row && repos.activeRepo) {
    commits.selectCommit(repos.activeRepo.path, row.hash)
  }
}

// Context menu
const menu = ref<{ x: number; y: number; index: number } | null>(null)

function onRowContextMenu(index: number, e: MouseEvent) {
  menu.value = { x: e.clientX, y: e.clientY, index }
}

function closeMenu() {
  menu.value = null
}

async function onMenuRefresh() {
  menu.value = null
  if (repos.activeRepo) {
    await commits.load(repos.activeRepo.path)
  }
}
</script>

<template>
  <div ref="parentRef" class="graph-scroller">
    <div v-if="commits.loading" class="loading">Loading commits…</div>

    <div v-else-if="commits.error" class="load-error">
      <span>Failed to load commits</span>
      <code>{{ commits.error }}</code>
    </div>

    <div v-else :style="{ height: `${totalSize}px`, position: 'relative' }">
      <div
        v-for="item in items"
        :key="item.index"
        :style="{
          position: 'absolute',
          top: 0,
          transform: `translateY(${item.start}px)`,
          width: '100%',
          height: `${ROW_H}px`,
        }"
        @click="onRowClick(item.index)"
        @contextmenu.prevent="onRowContextMenu(item.index, $event)"
      >
        <CommitRow
          v-if="commits.rows[item.index]"
          :row="commits.rows[item.index]"
          :graph-width="graphWidth"
          :row-h="ROW_H"
          :selected="commits.selectedHash === commits.rows[item.index].hash"
        />
      </div>
    </div>

    <CommitContextMenu
      v-if="menu && commits.rows[menu.index]"
      :row="commits.rows[menu.index]"
      :repo-path="repos.activeRepo?.path ?? ''"
      :x="menu.x"
      :y="menu.y"
      @close="closeMenu"
      @refresh="onMenuRefresh"
    />
  </div>
</template>

<style scoped>
.graph-scroller {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  background: #0f0f1a;
  min-height: 0;
}

.loading {
  padding: 24px;
  color: #555;
  text-align: center;
  font-size: 13px;
}

.load-error {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #f74f4f;
  font-size: 13px;
}
.load-error code {
  font-size: 11px;
  color: #a05050;
  word-break: break-all;
  font-family: monospace;
}
</style>
