<script setup lang="ts">
import { onMounted, ref, watch, type Ref } from 'vue'
import TabBar from './components/layout/TabBar.vue'
import ToolBar from './components/layout/ToolBar.vue'
import Sidebar from './components/layout/Sidebar.vue'
import CommitGraph from './components/graph/CommitGraph.vue'
import CommitDetail from './components/graph/CommitDetail.vue'
import StagingView from './components/staging/StagingView.vue'
import ToastStack from './components/layout/ToastStack.vue'
import { useReposStore } from './stores/repos'
import { useCommitsStore } from './stores/commits'
import { useStagingStore } from './stores/staging'
import logoUrl from './assets/images/logo-icon.png'

const repos = useReposStore()
const commits = useCommitsStore()
const staging = useStagingStore()
onMounted(() => repos.loadRecents())

// Keep staging badge up-to-date regardless of which tab is active
watch(
  () => repos.activeRepo?.path,
  path => {
    if (path) staging.load(path)
    else staging.clear()
  },
  { immediate: true },
)

const viewMode = ref<'commits' | 'staging'>('commits')

// Generic resize helper
function makeResizer(
  width: Ref<number>,
  min: number,
  max: number,
  direction: 'right' | 'left' = 'right',
) {
  let startX = 0
  let startW = 0

  function onMove(e: MouseEvent) {
    const delta = e.clientX - startX
    width.value = Math.max(min, Math.min(max, startW + (direction === 'right' ? delta : -delta)))
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

const sidebarWidth = ref(220)
const detailWidth = ref(380)

const startSidebarResize = makeResizer(sidebarWidth, 140, 500, 'right')
const startDetailResize = makeResizer(detailWidth, 200, 800, 'left')
</script>

<template>
  <div class="app">
    <TabBar />
    <ToolBar />
    <ToastStack />
    <div class="workspace">
      <Sidebar :style="{ width: sidebarWidth + 'px' }" />
      <div class="resize-handle" @mousedown.prevent="startSidebarResize" />
      <main class="main-panel">
        <div v-if="!repos.activeRepo" class="welcome">
          <img :src="logoUrl" class="welcome-logo" alt="" />
          <h1 class="welcome-brand">git<span>good</span></h1>
          <p>Open a repository to get started.</p>
          <button @click="repos.pickAndOpen()">Open Repository</button>

          <div v-if="repos.recentRepos.length" class="recents">
            <h3>Recent</h3>
            <ul>
              <li
                v-for="r in repos.recentRepos"
                :key="r.path"
                @click="repos.openRepo(r.path)"
              >
                <strong>{{ r.name }}</strong>
                <span>{{ r.path }}</span>
              </li>
            </ul>
          </div>
        </div>

        <template v-else>
          <!-- View mode switcher -->
          <div class="view-tabs">
            <button
              class="view-tab"
              :class="{ active: viewMode === 'commits' }"
              @click="viewMode = 'commits'"
            >Commits</button>
            <button
              class="view-tab"
              :class="{ active: viewMode === 'staging' }"
              @click="viewMode = 'staging'"
            >
              Working Tree
              <span v-if="staging.totalChanges" class="view-tab-badge">
                {{ staging.totalChanges }}
              </span>
            </button>
          </div>

          <!-- Commits view -->
          <div v-if="viewMode === 'commits'" class="repo-view">
            <CommitGraph style="flex: 1; min-width: 300px;" />

            <template v-if="commits.selectedHash">
              <div class="resize-handle" @mousedown.prevent="startDetailResize" />
              <CommitDetail :style="{ width: detailWidth + 'px' }" />
            </template>
          </div>

          <!-- Staging view -->
          <StagingView v-else />
        </template>
      </main>
    </div>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0f0f1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-panel {
  flex: 1;
  overflow: hidden;
  background: #0f0f1a;
  display: flex;
  flex-direction: column;
}

.view-tabs {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  background: #0a0a14;
  border-bottom: 1px solid #1e1e36;
  flex-shrink: 0;
}

.view-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #555;
  font-size: 12px;
  cursor: pointer;
}
.view-tab:hover { color: #888; background: #111120; }
.view-tab.active { color: #ccc; background: #16162a; }

.view-tab-badge {
  background: #4f8ef7;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  line-height: 1.4;
}

.repo-view {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.resize-handle {
  width: 4px;
  flex-shrink: 0;
  background: #1e1e36;
  cursor: col-resize;
  transition: background 0.15s;
}
.resize-handle:hover { background: #4f8ef7; }

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #666;
}

.welcome-logo { width: 160px; }
.welcome-brand { font-size: 32px; font-weight: 700; color: #4f8ef7; margin-top: -4px; }
.welcome-brand span { color: #ccc; font-weight: 400; }
.welcome p { font-size: 15px; }

.welcome button {
  padding: 8px 20px;
  background: #4f8ef7;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.recents { margin-top: 24px; text-align: left; width: 400px; }
.recents h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #444; margin-bottom: 8px; }
.recents ul { list-style: none; }
.recents li {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  gap: 2px;
}
.recents li:hover { background: #1a1a2e; }
.recents li strong { font-size: 14px; color: #ccc; }
.recents li span { font-size: 11px; color: #555; }
</style>
