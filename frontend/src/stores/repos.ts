import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  OpenRepository,
  CloseRepository,
  ListOpenRepositories,
  ListRecentRepositories,
  PickDirectory,
} from '../../wailsjs/go/main/App'

export interface RepoTab {
  path: string
  name: string
}

export const useReposStore = defineStore('repos', () => {
  const tabs = ref<RepoTab[]>([])
  const activeIndex = ref(0)
  const recentRepos = ref<{ path: string; name: string }[]>([])

  const activeRepo = computed(() => tabs.value[activeIndex.value] ?? null)

  async function loadRecents() {
    recentRepos.value = await ListRecentRepositories()
  }

  async function openRepo(path: string) {
    await OpenRepository(path)
    const name = path.split('/').pop() ?? path
    const existing = tabs.value.findIndex(t => t.path === path)
    if (existing >= 0) {
      activeIndex.value = existing
    } else {
      tabs.value.push({ path, name })
      activeIndex.value = tabs.value.length - 1
    }
  }

  async function pickAndOpen() {
    const path = await PickDirectory()
    if (path) await openRepo(path)
  }

  function closeTab(index: number) {
    const tab = tabs.value[index]
    if (tab) CloseRepository(tab.path)
    tabs.value.splice(index, 1)
    if (activeIndex.value >= tabs.value.length) {
      activeIndex.value = Math.max(0, tabs.value.length - 1)
    }
  }

  function setActive(index: number) {
    activeIndex.value = index
  }

  return { tabs, activeIndex, activeRepo, recentRepos, loadRecents, openRepo, pickAndOpen, closeTab, setActive }
})
