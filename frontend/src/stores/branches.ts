import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ListBranches, GetAheadBehind, SwitchBranch, FetchAll } from '../../wailsjs/go/main/App';

export interface BranchInfo {
  name: string
  isRemote: boolean
  remote: string
  isCurrent: boolean
  hash: string
}

export interface AheadBehind {
  ahead: number
  behind: number
}

export const useBranchesStore = defineStore('branches', () => {
  const local = ref<BranchInfo[]>([]);
  const remote = ref<BranchInfo[]>([]);
  const loading = ref(false);
  const aheadBehind = ref<AheadBehind>({ ahead: 0, behind: 0 });

  async function load(repoPath: string) {
    if (!repoPath) {
      return;
    }
    loading.value = true;
    try {
      const [all, ab] = await Promise.all([
        ListBranches(repoPath),
        GetAheadBehind(repoPath),
      ]);
      local.value = all.filter(b => !b.isRemote);
      remote.value = all.filter(b => b.isRemote);
      aheadBehind.value = ab;
    } finally {
      loading.value = false;
    }
  }

  async function silentFetchAndRefresh(repoPath: string) {
    if (!repoPath) {
      return;
    }
    try {
      await FetchAll(repoPath);
    } catch {
      // offline or no remote — ignore, still refresh local state
    }
    await load(repoPath);
  }

  function clear() {
    local.value = [];
    remote.value = [];
    aheadBehind.value = { ahead: 0, behind: 0 };
  }

  async function switchBranch(repoPath: string, target: string, trackRemote: boolean) {
    return SwitchBranch(repoPath, target, trackRemote);
  }

  return { local, remote, loading, aheadBehind, load, silentFetchAndRefresh, clear, switchBranch };
});
