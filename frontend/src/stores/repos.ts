import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  OpenRepository,
  CloseRepository,
  ListRecentRepositories,
  PickDirectory,
  LoadSession,
  SaveSession,
} from '../../wailsjs/go/main/App';

export interface RepoTab {
  path: string
  name: string
}

export const useReposStore = defineStore('repos', () => {
  const tabs = ref<RepoTab[]>([]);
  const activeIndex = ref(0);
  const recentRepos = ref<{ path: string; name: string }[]>([]);

  const activeRepo = computed(() => tabs.value[activeIndex.value] ?? null);

  async function loadRecents() {
    recentRepos.value = await ListRecentRepositories();
  }

  function persistSession() {
    SaveSession(tabs.value.map(t => ({ path: t.path, name: t.name })), activeIndex.value);
  }

  async function restoreSession() {
    let session: { tabs: { path: string; name: string }[]; activeIndex: number };
    try {
      session = await LoadSession();
    } catch {
      return;
    }
    for (const tab of session.tabs) {
      try {
        await OpenRepository(tab.path);
        if (!tabs.value.find(t => t.path === tab.path)) {
          tabs.value.push({ path: tab.path, name: tab.name });
        }
      } catch {
        // repo no longer accessible, skip
      }
    }
    if (tabs.value.length > 0) {
      activeIndex.value = Math.max(0, Math.min(session.activeIndex, tabs.value.length - 1));
    }
  }

  async function openRepo(path: string) {
    await OpenRepository(path);
    const name = path.split('/').pop() ?? path;
    const existing = tabs.value.findIndex(t => t.path === path);
    if (existing >= 0) {
      activeIndex.value = existing;
    } else {
      tabs.value.push({ path, name });
      activeIndex.value = tabs.value.length - 1;
    }
    persistSession();
  }

  async function pickAndOpen() {
    const path = await PickDirectory();
    if (path) {
      await openRepo(path);
    }
  }

  function closeTab(index: number) {
    const tab = tabs.value[index];
    if (tab) {
      CloseRepository(tab.path);
    }
    tabs.value.splice(index, 1);
    if (activeIndex.value >= tabs.value.length) {
      activeIndex.value = Math.max(0, tabs.value.length - 1);
    }
    persistSession();
  }

  function setActive(index: number) {
    activeIndex.value = index;
    persistSession();
  }

  return {
    tabs, activeIndex, activeRepo, recentRepos,
    loadRecents, restoreSession, openRepo, pickAndOpen, closeTab, setActive,
  };
});
