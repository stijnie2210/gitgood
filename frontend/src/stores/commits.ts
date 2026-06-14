import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { GetCommitGraph, GetCommitDiff } from '../../wailsjs/go/main/App';
import type { graph, repo } from '../../wailsjs/go/models';

export type GraphRow = graph.GraphRow
export type FileDiff = repo.FileDiff

const INITIAL_LIMIT = 2000;
const BATCH_SIZE = 2000;

export const useCommitsStore = defineStore('commits', () => {
  const rows = ref<GraphRow[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(false);
  const loadedLimit = ref(INITIAL_LIMIT);
  const error = ref<string | null>(null);
  const selectedHash = ref<string | null>(null);
  const diff = ref<FileDiff[]>([]);
  const diffLoading = ref(false);
  const currentRepoPath = ref<string | null>(null);

  const maxColumn = computed(() =>
    rows.value.reduce((m, r) => Math.max(m, r.maxColumn), 0)
  );

  async function load(repoPath: string) {
    if (!repoPath) {return;}
    loading.value = true;
    loadedLimit.value = INITIAL_LIMIT;
    hasMore.value = false;
    error.value = null;
    selectedHash.value = null;
    diff.value = [];
    currentRepoPath.value = repoPath;
    try {
      const result = await GetCommitGraph(repoPath, INITIAL_LIMIT);
      rows.value = result;
      hasMore.value = result.length === INITIAL_LIMIT;
    } catch (e) {
      error.value = String(e);
      rows.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadMore() {
    if (loadingMore.value || !hasMore.value || !currentRepoPath.value) {return;}
    loadingMore.value = true;
    const nextLimit = loadedLimit.value + BATCH_SIZE;
    try {
      const result = await GetCommitGraph(currentRepoPath.value, nextLimit);
      rows.value = result;
      loadedLimit.value = nextLimit;
      hasMore.value = result.length === nextLimit;
    } finally {
      loadingMore.value = false;
    }
  }

  async function selectCommit(repoPath: string, hash: string) {
    selectedHash.value = hash;
    diffLoading.value = true;
    diff.value = [];
    try {
      diff.value = await GetCommitDiff(repoPath, hash);
    } finally {
      diffLoading.value = false;
    }
  }

  function clear() {
    rows.value = [];
    error.value = null;
    selectedHash.value = null;
    diff.value = [];
    hasMore.value = false;
    currentRepoPath.value = null;
  }

  return {
    rows, loading, loadingMore, hasMore, error,
    selectedHash, diff, diffLoading, maxColumn,
    load, loadMore, selectCommit, clear,
  };
});
