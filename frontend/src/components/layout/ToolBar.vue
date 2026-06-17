<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useReposStore } from '../../stores/repos';
import { useCommitsStore } from '../../stores/commits';
import { useStagingStore } from '../../stores/staging';
import { useBranchesStore } from '../../stores/branches';
import { useToastStore } from '../../stores/toast';
import { useStashStore } from '../../stores/stash';
import {
  PushBranch,
  Stash,
  StashPop,
  CreateBranch,
  OpenTerminal,
} from '../../../wailsjs/go/main/App';

const repos = useReposStore();
const commits = useCommitsStore();
const staging = useStagingStore();
const branches = useBranchesStore();
const toast = useToastStore();
const stash = useStashStore();

const repoPath = computed(() => repos.activeRepo?.path ?? '');
const disabled = computed(() => !repos.activeRepo);

const busy = ref<string | null>(null);

async function run(op: string, fn: () => Promise<void>, successMsg?: string) {
  if (busy.value) {
    return;
  }
  busy.value = op;
  try {
    await fn();
    if (successMsg) {
      toast.success(successMsg);
    }
  } catch (e: unknown) {
    toast.error(String(e));
  } finally {
    busy.value = null;
  }
}

async function onFetch() {
  await run(
    'fetch',
    async () => {
      await staging.fetchAll(repoPath.value);
      await commits.load(repoPath.value);
      branches.load(repoPath.value);
    },
    'Fetched successfully'
  );
}

async function onPull() {
  await run(
    'pull',
    async () => {
      await staging.pullBranch(repoPath.value);
      await commits.load(repoPath.value);
      staging.load(repoPath.value);
      branches.load(repoPath.value);
    },
    'Pulled successfully'
  );
}

async function onPush() {
  await run(
    'push',
    async () => {
      await PushBranch(repoPath.value);
      branches.load(repoPath.value);
    },
    'Pushed successfully'
  );
}

async function onStash() {
  await run(
    'stash',
    async () => {
      await Stash(repoPath.value);
      await Promise.all([
        staging.load(repoPath.value),
        stash.load(repoPath.value),
        commits.load(repoPath.value),
      ]);
    },
    'Changes stashed'
  );
}

async function onPop() {
  await run(
    'pop',
    async () => {
      await StashPop(repoPath.value);
      await Promise.all([
        staging.load(repoPath.value),
        stash.load(repoPath.value),
        commits.load(repoPath.value),
      ]);
    },
    'Stash applied'
  );
}

async function onTerminal() {
  await run('terminal', () => OpenTerminal(repoPath.value));
}

// Branch creation popover
const showBranchInput = ref(false);
const branchName = ref('');
const branchInputEl = ref<HTMLInputElement | null>(null);

async function openBranchInput() {
  if (disabled.value) {
    return;
  }
  showBranchInput.value = true;
  await nextTick();
  branchInputEl.value?.focus();
}

function cancelBranch() {
  showBranchInput.value = false;
  branchName.value = '';
}

async function confirmBranch() {
  const name = branchName.value.trim();
  if (!name) {
    return;
  }
  const captured = name;
  await run(
    'branch',
    async () => {
      await CreateBranch(repoPath.value, captured);
      branches.load(repoPath.value);
      commits.load(repoPath.value);
    },
    `Branch '${name}' created`
  );
  showBranchInput.value = false;
  branchName.value = '';
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-inner">
      <!-- Remote ops group -->
      <div class="btn-group">
        <button
          class="tbtn"
          :disabled="disabled"
          :class="{ loading: busy === 'fetch' }"
          @click="onFetch"
        >
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="4" y1="3" x2="14" y2="3" />
              <line x1="9" y1="5" x2="9" y2="13" />
              <polyline points="5,10 9,14 13,10" />
            </svg>
          </span>
          <span class="tbtn-label">Fetch</span>
        </button>
        <button
          class="tbtn"
          :disabled="disabled"
          :class="{ loading: busy === 'pull' }"
          @click="onPull"
        >
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="9" y1="3" x2="9" y2="13" />
              <polyline points="5,9 9,14 13,9" />
            </svg>
          </span>
          <span class="tbtn-label">Pull</span>
        </button>
        <button
          class="tbtn"
          :disabled="disabled"
          :class="{ loading: busy === 'push' }"
          @click="onPush"
        >
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="9" y1="15" x2="9" y2="5" />
              <polyline points="5,9 9,4 13,9" />
            </svg>
          </span>
          <span class="tbtn-label">Push</span>
        </button>
      </div>

      <div class="separator" />

      <!-- Branch group -->
      <div class="btn-group branch-group">
        <button
          class="tbtn"
          :disabled="disabled"
          :class="{ loading: busy === 'branch', active: showBranchInput }"
          @click="openBranchInput"
        >
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <circle cx="5" cy="4" r="1.8" />
              <circle cx="5" cy="14" r="1.8" />
              <circle cx="13" cy="4" r="1.8" />
              <line x1="5" y1="6" x2="5" y2="12" />
              <path d="M13 6 C13 10 5 10 5 12" />
            </svg>
          </span>
          <span class="tbtn-label">Branch</span>
        </button>

        <!-- Branch name popover -->
        <div v-if="showBranchInput" class="branch-popover">
          <input
            ref="branchInputEl"
            v-model="branchName"
            class="branch-input"
            placeholder="branch-name"
            @keydown.enter="confirmBranch"
            @keydown.escape="cancelBranch"
          />
          <button class="branch-confirm" @click="confirmBranch">Create</button>
          <button class="branch-cancel" @click="cancelBranch">✕</button>
        </div>
      </div>

      <div class="separator" />

      <!-- Stash group -->
      <div class="btn-group">
        <button
          class="tbtn"
          :disabled="disabled"
          :class="{ loading: busy === 'stash' }"
          @click="onStash"
        >
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="12" height="4" rx="1.5" />
              <line x1="9" y1="3" x2="9" y2="10" />
              <polyline points="6,7 9,10 12,7" />
            </svg>
          </span>
          <span class="tbtn-label">Stash</span>
        </button>
        <button
          class="tbtn"
          :disabled="disabled"
          :class="{ loading: busy === 'pop' }"
          @click="onPop"
        >
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="11" width="12" height="4" rx="1.5" />
              <line x1="9" y1="9" x2="9" y2="2" />
              <polyline points="6,5 9,2 12,5" />
            </svg>
          </span>
          <span class="tbtn-label">Pop</span>
        </button>
      </div>

      <div class="separator" />

      <!-- Terminal -->
      <div class="btn-group">
        <button class="tbtn" :disabled="disabled" @click="onTerminal">
          <span class="tbtn-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3,6 8,9 3,12" />
              <line x1="10" y1="12" x2="15" y2="12" />
            </svg>
          </span>
          <span class="tbtn-label">Terminal</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  flex-shrink: 0;
  background: #0c0c1a;
  border-bottom: 1px solid #1e1e36;
  user-select: none;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 8px;
  gap: 2px;
}

.btn-group {
  display: flex;
  align-items: center;
  position: relative;
}

.separator {
  width: 1px;
  height: 24px;
  background: #1e1e36;
  margin: 0 6px;
  flex-shrink: 0;
}

.tbtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 5px 10px;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: #778;
  cursor: pointer;
  min-width: 52px;
  transition:
    background 0.1s,
    color 0.1s;
}

.tbtn:hover:not(:disabled) {
  background: #14142a;
  color: #bbc;
}

.tbtn.active {
  background: #14142a;
  color: #4f8ef7;
}

.tbtn:disabled {
  opacity: 0.35;
  cursor: default;
}

.tbtn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.tbtn-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

/* Spin animation for loading state */
.tbtn.loading .tbtn-icon {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Branch popover */
.branch-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #1a1a2e;
  border: 1px solid #2d2d50;
  border-radius: 6px;
  padding: 6px 8px;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  min-width: 220px;
}

.branch-input {
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
.branch-input:focus {
  border-color: #4f8ef7;
}
.branch-input::placeholder {
  color: #667;
}

.branch-confirm {
  padding: 4px 10px;
  background: #4f8ef7;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.branch-confirm:hover {
  background: #6aa0f8;
}

.branch-cancel {
  padding: 4px 6px;
  background: transparent;
  border: 1px solid #445;
  border-radius: 4px;
  color: #889;
  font-size: 11px;
  cursor: pointer;
}
.branch-cancel:hover {
  color: #aab;
  border-color: #667;
}
</style>
