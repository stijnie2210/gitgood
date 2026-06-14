<script setup lang="ts">
import { watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { clampMenuPosition } from '../../composables/useContextMenu'
import { useReposStore } from '../../stores/repos'
import { useBranchesStore } from '../../stores/branches'
import { useCommitsStore } from '../../stores/commits'
import { useStagingStore } from '../../stores/staging'
import { useToastStore } from '../../stores/toast'
import { StartRebase, DeleteBranch, RenameBranch, PushNamedBranch } from '../../../wailsjs/go/main/App'

const repos = useReposStore()
const branches = useBranchesStore()
const commits = useCommitsStore()
const staging = useStagingStore()
const toast = useToastStore()

watch(
  () => repos.activeRepo?.path,
  path => {
    if (path) {
      branches.load(path)
    } else {
      branches.clear()
    }
  },
  { immediate: true }
)

async function switchTo(target: string, trackRemote: boolean) {
  const repoPath = repos.activeRepo?.path
  if (!repoPath) {
    return
  }

  if (!trackRemote) {
    const current = branches.local.find(b => b.isCurrent)
    if (current?.name === target) {
      return
    }
  }

  try {
    const result = await branches.switchBranch(repoPath, target, trackRemote)
    await Promise.all([
      branches.load(repoPath),
      commits.load(repoPath),
      staging.load(repoPath),
    ])
    if (result.conflictFiles && result.conflictFiles.length > 0) {
      toast.error(result.message + ': ' + result.conflictFiles.join(', '))
    } else {
      toast.success(result.message)
    }
  } catch (e: unknown) {
    toast.error(String(e))
  }
}

// ── Context menu ──────────────────────────────────────────────────────────

type CtxMode = 'default' | 'rename' | 'confirm-delete'

interface CtxMenu {
  x: number
  y: number
  target: string
  label: string
  isLocal: boolean
  isCurrent: boolean
  mode: CtxMode
  renameValue: string
}

const ctxMenu = ref<CtxMenu | null>(null)
const renameInputRef = ref<HTMLInputElement | null>(null)

async function openCtxMenu(e: MouseEvent, target: string, label: string, isLocal: boolean, isCurrent: boolean) {
  e.preventDefault()
  e.stopPropagation()
  ctxMenu.value = { x: e.clientX, y: e.clientY, target, label, isLocal, isCurrent, mode: 'default', renameValue: label }
  await nextTick()
  const menu = document.getElementById('branch-ctx-menu')
  if (menu && ctxMenu.value) {
    const { x, y } = clampMenuPosition(menu, e.clientX, e.clientY)
    ctxMenu.value = { ...ctxMenu.value, x, y }
  }
}

function closeCtxMenu() {
  ctxMenu.value = null
}

function onWindowMouseDown(e: MouseEvent) {
  const menu = document.getElementById('branch-ctx-menu')
  if (menu && !menu.contains(e.target as Node)) {
    closeCtxMenu()
  }
}

onMounted(() => window.addEventListener('mousedown', onWindowMouseDown))
onUnmounted(() => window.removeEventListener('mousedown', onWindowMouseDown))

async function rebaseOnto(target: string) {
  closeCtxMenu()
  const repoPath = repos.activeRepo?.path
  if (!repoPath) {
    return
  }
  try {
    await StartRebase(repoPath, target)
    await Promise.all([branches.load(repoPath), commits.load(repoPath), staging.load(repoPath)])
    toast.success('Rebased onto ' + target)
  } catch {
    await staging.load(repoPath)
    if (staging.isInRebase) {
      await Promise.all([branches.load(repoPath), commits.load(repoPath)])
      toast.success('Rebase started — switch to Working Tree to resolve conflicts')
    } else {
      await staging.load(repoPath)
      toast.error('Rebase failed — check Working Tree view for details')
    }
  }
}

async function pushBranch() {
  const menu = ctxMenu.value
  const repoPath = repos.activeRepo?.path
  closeCtxMenu()
  if (!menu || !repoPath) {
    return
  }
  try {
    await PushNamedBranch(repoPath, menu.target)
    toast.success('Pushed ' + menu.label)
  } catch (e: unknown) {
    toast.error(String(e))
  }
}

async function copyBranchName() {
  const menu = ctxMenu.value
  closeCtxMenu()
  if (!menu) {
    return
  }
  await navigator.clipboard.writeText(menu.label)
  toast.success('Copied: ' + menu.label)
}

function startRename() {
  if (!ctxMenu.value) {
    return
  }
  ctxMenu.value.mode = 'rename'
  ctxMenu.value.renameValue = ctxMenu.value.target
  nextTick(() => {
    renameInputRef.value?.select()
  })
}

async function confirmRename() {
  const menu = ctxMenu.value
  const repoPath = repos.activeRepo?.path
  if (!menu || !repoPath) {
    closeCtxMenu()
    return
  }
  const newName = menu.renameValue.trim()
  if (!newName || newName === menu.target) {
    closeCtxMenu()
    return
  }
  closeCtxMenu()
  try {
    await RenameBranch(repoPath, menu.target, newName)
    await branches.load(repoPath)
    toast.success('Renamed to ' + newName)
  } catch (e: unknown) {
    toast.error(String(e))
  }
}

function startDelete() {
  if (!ctxMenu.value) {
    return
  }
  ctxMenu.value.mode = 'confirm-delete'
}

async function confirmDelete(force: boolean) {
  const menu = ctxMenu.value
  const repoPath = repos.activeRepo?.path
  closeCtxMenu()
  if (!menu || !repoPath) {
    return
  }
  try {
    await DeleteBranch(repoPath, menu.target, force)
    await branches.load(repoPath)
    toast.success('Deleted ' + menu.label)
  } catch (e: unknown) {
    const msg = String(e)
    if (!force && msg.toLowerCase().includes('not fully merged')) {
      toast.error('"' + menu.label + '" is not fully merged. Use force delete if you\'re sure.')
    } else {
      toast.error(msg)
    }
  }
}
</script>

<template>
  <aside class="sidebar">
    <div v-if="!repos.activeRepo" class="empty-state">
      <p>No repository open</p>
      <button @click="repos.pickAndOpen()">Open Repository</button>
    </div>

    <template v-else>
      <section class="branch-section">
        <h3 class="section-title">Local Branches</h3>
        <ul class="branch-list">
          <li
            v-for="b in branches.local"
            :key="b.name"
            class="branch-item"
            :class="{ current: b.isCurrent }"
            :title="b.isCurrent ? b.name + ' (current)' : 'Double-click to switch to ' + b.name"
            @dblclick="switchTo(b.name, false)"
            @contextmenu="openCtxMenu($event, b.name, b.name, true, b.isCurrent)"
          >
            <span class="branch-icon">{{ b.isCurrent ? '●' : '○' }}</span>
            <span class="branch-name">{{ b.name }}</span>
            <template v-if="b.isCurrent">
              <span
                v-if="branches.aheadBehind.ahead > 0"
                class="sync-badge ahead"
                title="Commits to push"
              >↑{{ branches.aheadBehind.ahead }}</span>
              <span
                v-if="branches.aheadBehind.behind > 0"
                class="sync-badge behind"
                title="Commits to pull"
              >↓{{ branches.aheadBehind.behind }}</span>
            </template>
          </li>
        </ul>
      </section>

      <section class="branch-section">
        <h3 class="section-title">Remote Branches</h3>
        <ul class="branch-list">
          <li
            v-for="b in branches.remote"
            :key="`${b.remote}/${b.name}`"
            class="branch-item remote"
            :title="'Double-click to check out ' + b.remote + '/' + b.name"
            @dblclick="switchTo(b.remote + '/' + b.name, true)"
            @contextmenu="openCtxMenu($event, b.remote + '/' + b.name, b.remote + '/' + b.name, false, false)"
          >
            <span class="branch-icon">↑</span>
            <span class="remote-label">{{ b.remote }}</span>/{{ b.name }}
          </li>
        </ul>
      </section>
    </template>
  </aside>

  <!-- Context menu (teleported so it renders above sidebar overflow) -->
  <Teleport to="body">
    <div
      v-if="ctxMenu"
      id="branch-ctx-menu"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
    >
      <div class="ctx-menu-label">{{ ctxMenu.label }}</div>

      <!-- Default actions -->
      <template v-if="ctxMenu.mode === 'default'">
        <button
          v-if="!ctxMenu.isCurrent"
          class="ctx-menu-item ctx-menu-item-primary"
          @click="switchTo(ctxMenu!.target, !ctxMenu!.isLocal); closeCtxMenu()"
        >
          Checkout
        </button>
        <button v-if="ctxMenu.isLocal" class="ctx-menu-item" @click="pushBranch()">
          Push
        </button>
        <button class="ctx-menu-item" @click="copyBranchName()">
          Copy branch name
        </button>
        <button class="ctx-menu-item" @click="rebaseOnto(ctxMenu!.target)">
          Rebase current branch onto this
        </button>
        <template v-if="ctxMenu.isLocal">
          <div class="ctx-menu-divider" />
          <button class="ctx-menu-item" @click="startRename()">
            Rename
          </button>
          <button
            class="ctx-menu-item ctx-menu-item-danger"
            :disabled="ctxMenu.isCurrent"
            :title="ctxMenu.isCurrent ? 'Cannot delete the current branch' : ''"
            @click="startDelete()"
          >
            Delete
          </button>
        </template>
      </template>

      <!-- Rename mode -->
      <template v-else-if="ctxMenu.mode === 'rename'">
        <div class="ctx-menu-rename">
          <input
            ref="renameInputRef"
            v-model="ctxMenu.renameValue"
            class="ctx-menu-input"
            placeholder="New branch name"
            @keydown.enter="confirmRename()"
            @keydown.esc="closeCtxMenu()"
          />
          <div class="ctx-menu-row">
            <button class="ctx-menu-btn-primary" @click="confirmRename()">Rename</button>
            <button class="ctx-menu-btn" @click="closeCtxMenu()">Cancel</button>
          </div>
        </div>
      </template>

      <!-- Delete confirmation mode -->
      <template v-else-if="ctxMenu.mode === 'confirm-delete'">
        <div class="ctx-menu-confirm">
          <p class="ctx-menu-confirm-text">Delete "{{ ctxMenu.label }}"?</p>
          <button class="ctx-menu-item ctx-menu-item-danger" @click="confirmDelete(false)">Delete</button>
          <button class="ctx-menu-item ctx-menu-item-danger" @click="confirmDelete(true)">Force Delete</button>
          <button class="ctx-menu-item" @click="closeCtxMenu()">Cancel</button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  background: #16213e;
  border-right: 1px solid #2d2d4e;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: #666;
  font-size: 13px;
}

.empty-state button {
  margin-top: 12px;
  padding: 6px 14px;
  background: #4f8ef7;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 13px;
}

.branch-section { padding: 8px 0; }

.section-title {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #7a8899;
  margin: 0;
}

.branch-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 13px;
  color: #aaa;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
}

.branch-item:hover { background: #1e2d50; color: #ddd; }
.branch-item.current { color: #4f8ef7; font-weight: 500; cursor: default; }
.branch-item.remote { color: #9aaabb; }

.branch-icon { font-size: 10px; color: #7a8899; flex-shrink: 0; }
.branch-item.current .branch-icon { color: #4f8ef7; }

.branch-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 8px;
  font-family: monospace;
}

.sync-badge.ahead {
  background: rgba(79, 247, 160, 0.12);
  color: #4ff7a0;
  border: 1px solid rgba(79, 247, 160, 0.25);
}

.sync-badge.behind {
  background: rgba(247, 160, 79, 0.12);
  color: #f7a04f;
  border: 1px solid rgba(247, 160, 79, 0.25);
}

.remote-label { color: #7a8899; font-size: 11px; }
</style>

<!-- Context menu styles are global (it's teleported to body) -->
<style>
.ctx-menu {
  position: fixed;
  z-index: 9999;
  background: #1a1a2e;
  border: 1px solid #2d2d4e;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  min-width: 220px;
  padding: 4px 0;
}

.ctx-menu-label {
  padding: 5px 12px 4px;
  font-size: 10px;
  color: #556;
  font-family: monospace;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  border-bottom: 1px solid #252540;
  margin-bottom: 3px;
}

.ctx-menu-divider {
  height: 1px;
  background: #252540;
  margin: 3px 0;
}

.ctx-menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  background: transparent;
  border: none;
  color: #bbc;
  font-size: 12px;
  cursor: pointer;
}
.ctx-menu-item:hover:not(:disabled) { background: #1e2d50; color: #dde; }
.ctx-menu-item-primary { color: #4f8ef7; font-weight: 500; }
.ctx-menu-item:disabled { opacity: 0.35; cursor: default; }

.ctx-menu-item-danger { color: #f07070; }
.ctx-menu-item-danger:hover:not(:disabled) { background: rgba(240, 80, 80, 0.12); color: #f09090; }

/* Rename mode */
.ctx-menu-rename {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ctx-menu-input {
  width: 100%;
  background: #111124;
  border: 1px solid #2d2d4e;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
  font-family: monospace;
}
.ctx-menu-input:focus { border-color: #4f8ef7; }

.ctx-menu-row {
  display: flex;
  gap: 6px;
}

.ctx-menu-btn-primary {
  flex: 1;
  padding: 4px 0;
  background: #4f8ef7;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.ctx-menu-btn-primary:hover { background: #6aa3ff; }

.ctx-menu-btn {
  flex: 1;
  padding: 4px 0;
  background: #252540;
  border: none;
  border-radius: 4px;
  color: #aaa;
  font-size: 12px;
  cursor: pointer;
}
.ctx-menu-btn:hover { background: #2d2d50; color: #ccc; }

/* Delete confirm mode */
.ctx-menu-confirm {
  padding: 4px 0;
}

.ctx-menu-confirm-text {
  padding: 4px 12px 6px;
  font-size: 11px;
  color: #778;
}
</style>
