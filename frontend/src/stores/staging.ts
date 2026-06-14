import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  GetStatus,
  GetWorkingDiff,
  StageFile,
  UnstageFile,
  StageHunk,
  UnstageHunk,
  DiscardFile,
  FetchAll,
  PullBranch,
  Commit,
  GetLastCommitSubject,
  IsInMerge,
  GetMergeMessage,
  IsInRebase,
  GetRebaseState,
} from '../../wailsjs/go/main/App'
import type { repo } from '../../wailsjs/go/models'

export type FileStatus = repo.FileStatus
export type FileDiff = repo.FileDiff
export type Hunk = repo.Hunk

export function buildHunkPatch(path: string, hunk: Hunk): string {
  const parts = [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    hunk.header,
    ...hunk.lines.map(l => {
      if (l.type === 'add') {
        return `+${l.content}`
      }
      if (l.type === 'del') {
        return `-${l.content}`
      }
      return ` ${l.content}`
    }),
  ]
  return parts.join('\n') + '\n'
}

export function isConflictedFile(f: FileStatus): boolean {
  return f.staged === 'U' || f.unstaged === 'U' ||
    (f.staged === 'A' && f.unstaged === 'A') ||
    (f.staged === 'D' && f.unstaged === 'D')
}

export const useStagingStore = defineStore('staging', () => {
  const files = ref<FileStatus[]>([])
  const loading = ref(false)
  const selectedPath = ref<string | null>(null)
  const selectedMode = ref<'staged' | 'unstaged'>('unstaged')
  const diff = ref<FileDiff[]>([])
  const diffLoading = ref(false)
  const isInMerge = ref(false)
  const mergeMessage = ref('')
  const isInRebase = ref(false)
  const rebaseState = ref<repo.RebaseState>({ step: 0, total: 0, message: '', onto: '' })

  const conflictedFiles = computed(() =>
    files.value.filter(isConflictedFile)
  )

  const unstagedFiles = computed(() =>
    files.value.filter(f => !isConflictedFile(f) && f.unstaged !== ' ' && f.unstaged !== '')
  )

  const stagedFiles = computed(() =>
    files.value.filter(f => !isConflictedFile(f) && f.staged !== ' ' && f.staged !== '?' && f.staged !== '')
  )

  const totalChanges = computed(() => files.value.length)

  async function load(repoPath: string) {
    if (!repoPath) {
      return
    }
    loading.value = true
    try {
      const [statusResult, mergeState, mergeMsg, rebaseActive, rebaseInfo] = await Promise.all([
        GetStatus(repoPath),
        IsInMerge(repoPath),
        GetMergeMessage(repoPath),
        IsInRebase(repoPath),
        GetRebaseState(repoPath),
      ])
      files.value = statusResult
      isInMerge.value = mergeState
      mergeMessage.value = mergeMsg
      isInRebase.value = rebaseActive
      rebaseState.value = rebaseInfo
    } finally {
      loading.value = false
    }
  }

  async function selectFile(repoPath: string, path: string, mode: 'staged' | 'unstaged') {
    selectedPath.value = path
    selectedMode.value = mode
    diffLoading.value = true
    diff.value = []
    try {
      diff.value = await GetWorkingDiff(repoPath, path, mode === 'staged')
    } finally {
      diffLoading.value = false
    }
  }

  async function stageFile(repoPath: string, path: string) {
    await StageFile(repoPath, path)
    await load(repoPath)
  }

  async function unstageFile(repoPath: string, path: string) {
    await UnstageFile(repoPath, path)
    await load(repoPath)
  }

  async function stageHunk(repoPath: string, path: string, hunk: Hunk) {
    const patch = buildHunkPatch(path, hunk)
    await StageHunk(repoPath, patch)
    await load(repoPath)
    if (selectedPath.value === path) {
      await selectFile(repoPath, path, 'unstaged')
    }
  }

  async function unstageHunk(repoPath: string, path: string, hunk: Hunk) {
    const patch = buildHunkPatch(path, hunk)
    await UnstageHunk(repoPath, patch)
    await load(repoPath)
    if (selectedPath.value === path) {
      await selectFile(repoPath, path, 'staged')
    }
  }

  async function discardFile(repoPath: string, path: string) {
    await DiscardFile(repoPath, path)
    await load(repoPath)
    if (selectedPath.value === path) {
      diff.value = []
      selectedPath.value = null
    }
  }

  async function fetchAll(repoPath: string) {
    await FetchAll(repoPath)
  }

  async function pullBranch(repoPath: string) {
    await PullBranch(repoPath)
    await load(repoPath)
  }

  async function commit(repoPath: string, message: string, amend: boolean) {
    await Commit(repoPath, message, amend)
    selectedPath.value = null
    diff.value = []
    await load(repoPath)
  }

  async function getLastCommitSubject(repoPath: string): Promise<string> {
    return GetLastCommitSubject(repoPath)
  }

  function clear() {
    files.value = []
    selectedPath.value = null
    diff.value = []
    isInMerge.value = false
    mergeMessage.value = ''
    isInRebase.value = false
    rebaseState.value = { step: 0, total: 0, message: '', onto: '' }
  }

  return {
    files, loading, selectedPath, selectedMode, diff, diffLoading,
    isInMerge, mergeMessage, isInRebase, rebaseState, conflictedFiles,
    unstagedFiles, stagedFiles, totalChanges,
    load, selectFile, stageFile, unstageFile, stageHunk, unstageHunk,
    discardFile, fetchAll, pullBranch, commit, getLastCommitSubject, clear,
  }
})
