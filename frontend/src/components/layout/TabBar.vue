<script setup lang="ts">
import { useReposStore } from '../../stores/repos'

const repos = useReposStore()
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
    <button class="tab-add" @click="repos.pickAndOpen()" title="Open repository">+</button>
  </div>
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
