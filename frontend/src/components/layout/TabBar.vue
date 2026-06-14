<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useReposStore } from '../../stores/repos';

const repos = useReposStore();

const showPicker = ref(false);
const pickerPos = ref({ x: 0, y: 0 });
const addBtnRef = ref<HTMLButtonElement | null>(null);

function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, '~');
}

async function openPicker() {
  if (showPicker.value) {
    showPicker.value = false;
    return;
  }
  await repos.loadRecents();
  if (addBtnRef.value) {
    const rect = addBtnRef.value.getBoundingClientRect();
    pickerPos.value = { x: rect.left, y: rect.bottom };
  }
  showPicker.value = true;
}

function closePicker() {
  showPicker.value = false;
}

async function openRecent(path: string) {
  closePicker();
  await repos.openRepo(path);
}

async function browseFolder() {
  closePicker();
  await repos.pickAndOpen();
}

function onWindowMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.repo-picker') && !target.closest('.tab-add')) {
    closePicker();
  }
}

onMounted(() => window.addEventListener('mousedown', onWindowMouseDown));
onUnmounted(() => window.removeEventListener('mousedown', onWindowMouseDown));
</script>

<template>
  <div class="tab-bar">
    <button
      v-for="(tab, i) in repos.tabs"
      :key="tab.path"
      class="tab"
      :class="{ active: repos.activeIndex === i }"
      @click="repos.setActive(i)"
    >
      <span class="tab-name">{{ tab.name }}</span>
      <span class="tab-close" @click.stop="repos.closeTab(i)">×</span>
    </button>
    <button ref="addBtnRef" class="tab-add" title="Open repository" @click="openPicker()">+</button>
  </div>

  <Teleport to="body">
    <div
      v-if="showPicker"
      class="repo-picker"
      :style="{ left: pickerPos.x + 'px', top: pickerPos.y + 'px' }"
    >
      <div class="picker-section-label">Recent</div>
      <div v-if="repos.recentRepos.length === 0" class="picker-empty">No recent repositories</div>
      <button
        v-for="r in repos.recentRepos"
        :key="r.path"
        class="picker-item"
        @click="openRecent(r.path)"
      >
        <span class="picker-item-name">{{ r.name }}</span>
        <span class="picker-item-path">{{ shortenPath(r.path) }}</span>
      </button>
      <div class="picker-divider" />
      <button class="picker-item picker-browse" @click="browseFolder()">
        Browse for folder...
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  background: #1a1a2e;
  border-bottom: 1px solid #2d2d4e;
  height: 36px;
  overflow-x: auto;
  flex-shrink: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 100%;
  background: none;
  border: none;
  border-right: 1px solid #2d2d4e;
  color: #888;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: background 0.1s;
}

.tab:hover { background: #22223a; color: #ccc; }
.tab.active { background: #16213e; color: #e0e0e0; border-bottom: 2px solid #4f8ef7; }

.tab-close {
  opacity: 0.4;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
}
.tab-close:hover { opacity: 1; color: #ff6b6b; }

.tab-add {
  padding: 0 12px;
  height: 100%;
  background: none;
  border: none;
  color: #889;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.tab-add:hover { color: #aaa; }
</style>

<style>
.repo-picker {
  position: fixed;
  z-index: 1000;
  min-width: 280px;
  max-width: 360px;
  background: #1a1a2e;
  border: 1px solid #2d2d4e;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  padding: 6px 0;
  max-height: 380px;
  overflow-y: auto;
}

.picker-section-label {
  padding: 4px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #556;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.picker-empty {
  padding: 6px 12px;
  font-size: 13px;
  color: #556;
}

.picker-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  gap: 1px;
}

.picker-item:hover {
  background: #22223a;
}

.picker-item-name {
  font-size: 13px;
  color: #c8cce0;
  font-weight: 500;
}

.picker-item-path {
  font-size: 11px;
  color: #556;
}

.picker-divider {
  height: 1px;
  background: #2d2d4e;
  margin: 4px 0;
}

.picker-browse {
  color: #4f8ef7;
  font-size: 13px;
  padding: 8px 12px;
}

.picker-browse:hover {
  background: #22223a;
}
</style>
