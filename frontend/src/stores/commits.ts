import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GetCommitGraph, GetCommitDiff } from '../../wailsjs/go/main/App'
import type { graph, repo } from '../../wailsjs/go/models'

export type GraphRow = graph.GraphRow
export type FileDiff = repo.FileDiff

export const useCommitsStore = defineStore('commits', () => {
  const rows = ref<GraphRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedHash = ref<string | null>(null)
  const diff = ref<FileDiff[]>([])
  const diffLoading = ref(false)

  const maxColumn = computed(() =>
    rows.value.reduce((m, r) => Math.max(m, r.maxColumn), 0)
  )

  async function load(repoPath: string) {
    if (!repoPath) return
    loading.value = true
    error.value = null
    selectedHash.value = null
    diff.value = []
    try {
      rows.value = await GetCommitGraph(repoPath, 2000)
    } catch (e) {
      error.value = String(e)
      rows.value = []
    } finally {
      loading.value = false
    }
  }

  async function selectCommit(repoPath: string, hash: string) {
    selectedHash.value = hash
    diffLoading.value = true
    diff.value = []
    try {
      diff.value = await GetCommitDiff(repoPath, hash)
    } finally {
      diffLoading.value = false
    }
  }

  function clear() {
    rows.value = []
    error.value = null
    selectedHash.value = null
    diff.value = []
  }

  return { rows, loading, error, selectedHash, diff, diffLoading, maxColumn, load, selectCommit, clear }
})
