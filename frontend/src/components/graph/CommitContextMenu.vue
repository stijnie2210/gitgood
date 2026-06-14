<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { clampMenuPosition } from '../../composables/useContextMenu';
import type { GraphRow } from '../../stores/commits';
import { useToastStore } from '../../stores/toast';
import {
  CheckoutRef,
  CreateBranchAt,
  RevertCommit,
  CreateTag,
  ResetBranch,
} from '../../../wailsjs/go/main/App';

const props = defineProps<{
  row: GraphRow
  repoPath: string
  x: number
  y: number
}>();

const emit = defineEmits<{
  close: []
  refresh: []
}>();

const toast = useToastStore();

type Mode = 'menu' | 'branch' | 'tag' | 'revert-confirm'
const mode = ref<Mode>('menu');
const inputVal = ref('');
const inputEl = ref<HTMLInputElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);

const style = ref({ top: '0px', left: '0px' });

onMounted(() => {
  const el = menuEl.value;
  if (!el) {return;}
  const { x, y } = clampMenuPosition(el, props.x, props.y);
  style.value = { top: `${y}px`, left: `${x}px` };

  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onOutside, true);
  document.removeEventListener('keydown', onKey, true);
});

function onOutside(e: MouseEvent) {
  if (menuEl.value && !menuEl.value.contains(e.target as Node)) {
    emit('close');
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {emit('close');}
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function copyHash(full: boolean) {
  await navigator.clipboard.writeText(full ? props.row.hash : props.row.shortHash);
  toast.success(full ? 'Copied full SHA' : 'Copied short SHA');
  emit('close');
}

async function checkout() {
  try {
    await CheckoutRef(props.repoPath, props.row.hash);
    toast.success(`Checked out ${props.row.shortHash} (detached HEAD)`);
    emit('refresh');
  } catch (e) { toast.error(String(e)); }
  emit('close');
}

function openBranchInput() {
  mode.value = 'branch';
  inputVal.value = '';
  nextTick(() => inputEl.value?.focus());
}

async function confirmBranch() {
  const name = inputVal.value.trim();
  if (!name) {return;}
  try {
    await CreateBranchAt(props.repoPath, name, props.row.hash);
    toast.success(`Branch '${name}' created at ${props.row.shortHash}`);
    emit('refresh');
  } catch (e) { toast.error(String(e)); }
  emit('close');
}

function openRevertConfirm() {
  mode.value = 'revert-confirm';
}

async function revert(commitImmediately: boolean) {
  try {
    await RevertCommit(props.repoPath, props.row.hash, commitImmediately);
    toast.success(commitImmediately
      ? `Reverted ${props.row.shortHash} (new commit created)`
      : `Reverted ${props.row.shortHash} — changes staged, ready to commit`);
    emit('refresh');
  } catch (e) { toast.error(String(e)); }
  emit('close');
}

async function reset(resetMode: 'soft' | 'mixed' | 'hard') {
  try {
    await ResetBranch(props.repoPath, props.row.hash, resetMode);
    toast.success(`Branch reset (${resetMode}) to ${props.row.shortHash}`);
    emit('refresh');
  } catch (e) { toast.error(String(e)); }
  emit('close');
}

function openTagInput() {
  mode.value = 'tag';
  inputVal.value = '';
  nextTick(() => inputEl.value?.focus());
}

async function confirmTag() {
  const name = inputVal.value.trim();
  if (!name) {return;}
  try {
    await CreateTag(props.repoPath, name, props.row.hash);
    toast.success(`Tag '${name}' created at ${props.row.shortHash}`);
    emit('refresh');
  } catch (e) { toast.error(String(e)); }
  emit('close');
}
</script>

<template>
  <div ref="menuEl" class="ctx-menu" :style="style" @click.stop>

    <!-- ── Revert confirmation ──────────────────── -->
    <template v-if="mode === 'revert-confirm'">
      <div class="ctx-input-header">Revert {{ row.shortHash }}</div>
      <div class="ctx-confirm-question">Commit the reverted changes immediately?</div>
      <div class="ctx-confirm-row">
        <button class="ctx-confirm-btn ctx-confirm-btn--yes" @click="revert(true)">Yes</button>
        <button class="ctx-confirm-btn ctx-confirm-btn--no" @click="revert(false)">No</button>
        <button class="ctx-confirm-btn ctx-confirm-btn--cancel" @click="emit('close')">Cancel</button>
      </div>
    </template>

    <!-- ── Branch input ─────────────────────────── -->
    <template v-if="mode === 'branch'">
      <div class="ctx-input-header">Create branch at {{ row.shortHash }}</div>
      <div class="ctx-input-row">
        <input
          ref="inputEl"
          v-model="inputVal"
          class="ctx-input"
          placeholder="branch-name"
          @keydown.enter="confirmBranch"
          @keydown.escape="emit('close')"
        />
        <button class="ctx-confirm" @click="confirmBranch">Create</button>
      </div>
    </template>

    <!-- ── Tag input ────────────────────────────── -->
    <template v-else-if="mode === 'tag'">
      <div class="ctx-input-header">Create tag at {{ row.shortHash }}</div>
      <div class="ctx-input-row">
        <input
          ref="inputEl"
          v-model="inputVal"
          class="ctx-input"
          placeholder="tag-name"
          @keydown.enter="confirmTag"
          @keydown.escape="emit('close')"
        />
        <button class="ctx-confirm" @click="confirmTag">Create</button>
      </div>
    </template>

    <!-- ── Main menu ────────────────────────────── -->
    <template v-else>
      <div class="ctx-header">{{ row.shortHash }} — {{ row.subject }}</div>

      <div class="ctx-divider" />

      <button class="ctx-item" @click="copyHash(false)">Copy short SHA</button>
      <button class="ctx-item" @click="copyHash(true)">Copy full SHA</button>

      <div class="ctx-divider" />

      <button class="ctx-item" @click="checkout">Checkout commit</button>
      <button class="ctx-item" @click="openBranchInput">Create branch here…</button>

      <div class="ctx-divider" />

      <button class="ctx-item" @click="openRevertConfirm">Revert commit</button>

      <div class="ctx-divider" />

      <div class="ctx-group-label">Reset branch to here</div>
      <button class="ctx-item ctx-item--indent" @click="reset('soft')">Soft — keep staged</button>
      <button class="ctx-item ctx-item--indent" @click="reset('mixed')">Mixed — keep working tree</button>
      <button class="ctx-item ctx-item--indent ctx-item--danger" @click="reset('hard')">Hard — discard all changes</button>

      <div class="ctx-divider" />

      <button class="ctx-item" @click="openTagInput">Create tag here…</button>
    </template>

  </div>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 1000;
  min-width: 230px;
  background: #141428;
  border: 1px solid #2a2a50;
  border-radius: 7px;
  padding: 4px 0;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  user-select: none;
}

.ctx-header {
  padding: 6px 12px 5px;
  font-size: 10px;
  color: #445;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.ctx-divider {
  height: 1px;
  background: #1e1e38;
  margin: 3px 0;
}

.ctx-item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  background: none;
  border: none;
  text-align: left;
  color: #bbc;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-item:hover { background: #1e1e42; color: #eef; }

.ctx-item--indent { padding-left: 22px; color: #99a; font-size: 11px; }
.ctx-item--indent:hover { color: #ccd; }

.ctx-item--danger { color: #f08080; }
.ctx-item--danger:hover { background: #2a1818; color: #f74f4f; }

.ctx-group-label {
  padding: 5px 14px 2px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #445;
}

/* Revert confirm */
.ctx-confirm-question {
  padding: 4px 12px 8px;
  font-size: 12px;
  color: #bbc;
  line-height: 1.4;
}

.ctx-confirm-row {
  display: flex;
  gap: 6px;
  padding: 0 10px 10px;
}

.ctx-confirm-btn {
  flex: 1;
  padding: 5px 0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.ctx-confirm-btn--yes    { background: #1e3d28; color: #4ff7a0; border-color: #2a5a38; }
.ctx-confirm-btn--yes:hover { background: #254830; }
.ctx-confirm-btn--no     { background: #1a2848; color: #7aadff; border-color: #2a3a60; }
.ctx-confirm-btn--no:hover { background: #1e3060; }
.ctx-confirm-btn--cancel { background: transparent; color: #667; border-color: #334; }
.ctx-confirm-btn--cancel:hover { color: #889; border-color: #556; }

/* Input mode */
.ctx-input-header {
  padding: 8px 12px 4px;
  font-size: 11px;
  color: #667;
  font-family: monospace;
}

.ctx-input-row {
  display: flex;
  gap: 4px;
  padding: 4px 10px 8px;
}

.ctx-input {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #2d2d50;
  border-radius: 4px;
  color: #ccc;
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
  font-family: monospace;
}
.ctx-input:focus { border-color: #4f8ef7; }
.ctx-input::placeholder { color: #334; }

.ctx-confirm {
  padding: 4px 10px;
  background: #4f8ef7;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-confirm:hover { background: #6aa0f8; }
</style>
