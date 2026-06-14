# gitgood — Development Reference

GitKraken replacement. Single-binary desktop app: **Wails v2** (Go backend + Vue 3 frontend, no HTTP server, direct Go↔Vue bindings via auto-generated TypeScript).

## Commands

```bash
wails dev        # hot-reload dev build (regenerates TS bindings automatically)
wails build      # production .app bundle → build/bin/gitgood.app
go build ./...   # Go-only compile check
```

After adding Go methods to `App` or new structs crossing the boundary, `wails dev` / `wails build` regenerates `frontend/wailsjs/go/main/App.d.ts` and `frontend/wailsjs/go/models.ts`. Never edit those files by hand.

## Architecture

### Hybrid git rule
- **go-git** for reads: log, branches, refs, commit objects, tree diffs
- **system `git` (shell-out via `internal/gitcli/`)** for writes and complex ops: staging, hunk apply, rebase, non-FF merge, fetch/pull/push

### Layers
```
app.go              ← thin Wails-bound coordinator; all methods call manager
internal/repo/      ← Manager (open repos map), business logic methods
internal/gitcli/    ← pure exec.Command wrappers; no business logic
internal/graph/     ← lane assignment algorithm (no external deps)
frontend/src/stores/     ← Pinia stores (one per domain)
frontend/src/components/ ← Vue components, grouped by feature
```

### Wails binding rules
- Every Go struct that crosses the boundary needs `json:"camelCase"` tags on every field
- Methods on `*App` in `app.go` are auto-bound; keep `app.go` thin — real logic lives in `internal/repo/`
- TypeScript imports: methods from `wailsjs/go/main/App`, types from `wailsjs/go/models`

## File Map

```
app.go                              All bound methods
internal/gitcli/
  runner.go                         Run() / RunWithInput() — exec.Command wrapper
  staging.go                        StageFile, UnstageFile, ApplyPatch, DiscardFile
  remote.go                         FetchAll, Pull, Push
internal/repo/
  manager.go                        Manager{map[string]*git.Repository}; Open/Close/Get
                                    RecentEntry → ~/Library/Application Support/gitgood/repos.json
  branches.go                       ListBranches via go-git r.References()
  commits.go                        GetCommitGraph (go-git Log, All:true), GetCommitDiff
                                    buildHunks() — context-limited unified diff (3-line context)
  diff.go                           GetStatus (git status --porcelain), GetWorkingDiff
                                    parseUnifiedDiff() — parses git diff output → []FileDiff
  staging.go                        StageHunk/UnstageHunk (accept patch string from frontend)
                                    BuildHunkPatch, FetchAll, PullBranch
internal/graph/
  layout.go                         BuildGraph() — greedy lane assignment
                                    GraphRow{hash, column, color, edgesIn, edges, maxColumn}
frontend/src/
  App.vue                           Root: TabBar + resizable Sidebar + main panel
                                    viewMode ref ('commits'|'staging') — view tab switcher
  stores/
    repos.ts                        tabs[], activeRepo, openRepo, pickAndOpen, closeTab
    branches.ts                     local[], remote[] — loaded on activeRepo change
    commits.ts                      rows[], selectedHash, diff[] — GetCommitGraph(limit=2000)
    staging.ts                      files[], unstagedFiles, stagedFiles, diff[]
                                    buildHunkPatch() — constructs patch string for git apply
  components/
    layout/TabBar.vue               Repo tabs (open/close/switch)
    layout/Sidebar.vue              Branch list — width set by App.vue via :style
    graph/CommitGraph.vue           @tanstack/vue-virtual virtualizer; canvas-per-row
    graph/CommitRow.vue             Single row: canvas + shortHash + labels + subject
    graph/CommitDetail.vue          Commit diff view; collapsible files; hunk display
    graph/graphRenderer.ts          drawGraphCell() — CELL_W=14, bezier curves for diagonals
    staging/StagingView.vue         File list (unstaged/staged/conflicts) + merge banner + ConflictView/HunkSelector
    staging/HunkSelector.vue        Per-hunk Stage/Unstage buttons; reuses same diff-line CSS
    staging/ConflictView.vue        Conflict resolution: parse markers → per-conflict Accept Ours/Theirs
```

## Key Implementation Details

### Commit graph layout (`internal/graph/layout.go`)
Greedy topological walk. Each commit finds/creates its lane column. When first parent is already in another lane (merge convergence), current lane is freed and a diagonal edge is drawn. Second pass: `rows[i].EdgesIn = rows[i-1].Edges` so canvas-per-row rendering works in virtual scroll context.

### Virtual scroll (`CommitGraph.vue`)
Uses `useVirtualizer(computed(() => ({ count, getScrollElement, estimateSize, overscan })))` — the entire options object must be wrapped in `computed()`, not just `count`. Uses `item.index` for `:key`, not `item.key`.

### Hunk staging flow
1. `GetWorkingDiff(repoPath, path, staged)` → `[]FileDiff`
2. User clicks "Stage Hunk" — frontend calls `buildHunkPatch(path, hunk)` in `stores/staging.ts`
3. `StageHunk(repoPath, patchString)` → `git apply --cached`
4. For unstage: `UnstageHunk` → `git apply --cached --reverse`
Frontend builds the patch (not backend) so the applied patch exactly matches what the user saw.

### Unified diff parsing (`internal/repo/diff.go`)
`parseUnifiedDiff()` handles: `diff --git` headers, `--- /dev/null` / `+++ /dev/null` (new/deleted files), `Binary files` lines, `\ No newline at end of file`, hunk headers `@@ -n,m +n,m @@`. Untracked files use `git diff --no-index /dev/null <path>` (exit code 1 = differences found, not an error).

### Resizable panels
`makeResizer(width: Ref<number>, min, max, direction)` in `App.vue` — returns a mousedown handler. Direction `'right'` = delta is +x; `'left'` = delta is −x (for right-edge panels). Each component that needs local resize (e.g. `StagingView`) defines its own inline version.

### Color theme
Background hierarchy: `#0a0a14` (deepest) → `#0f0f1a` → `#0d0d18` → `#111124` → `#16213e` (sidebar). Accent: `#4f8ef7` (blue). Status colors: M=orange, A=green, D=red, R=blue, untracked=cyan.

## Phase Status

- **Phase 1** ✅ — Wails scaffold, repo manager, recent repos, tab bar, sidebar with branches
- **Phase 2** ✅ — Commit graph with lane layout, virtual scroll, commit diff viewer
- **Phase 3** ✅ — Working tree status/diff, stage/unstage files and hunks, fetch/pull, Staging view
- **Phase 4** ✅ — Conflict resolution: merge banner, conflicted file list, ConflictView (Accept Ours/Theirs per chunk), AbortMerge, merge message pre-fill
- **Phase 5** ✅ — Rebasing: StartRebase/ContinueRebase/AbortRebase, rebase banner in Working Tree, conflict resolution reuses ConflictView, sidebar branch context menu "Rebase onto X"
- **Phase 6A** 🔄 — Branch context menu (quick wins): Delete branch, Rename branch, Copy branch name, Push branch
- **Phase 6B** ⬜ — Branch context menu (medium): Create branch from here, Merge into current, Set upstream, Create tag here

### Conflict resolution flow (`internal/repo/conflict.go`)
`IsInMerge()` checks for `MERGE_HEAD` / `CHERRY_PICK_HEAD`. `GetConflictContent()` calls `git show :1:/:2:/:3:` for base/ours/theirs plus reads the working file (with markers). `ResolveConflict()` writes the file and stages it. `AbortMerge()` runs `git merge --abort`.

Frontend parses `<<<<<<< / ======= / >>>>>>>` markers into context + conflict chunks. Each conflict chunk has Accept Ours / Accept Theirs buttons. "Save & Stage" assembles accepted chunks and calls `ResolveConflict`. Merge message auto-fills commit summary when `isInMerge` becomes true.

### Rebase flow (`internal/gitcli/rebase.go`)
`StartRebase(onto)` → `git rebase <onto>`. `ContinueRebase()` → `git rebase --continue`. `AbortRebase()` → `git rebase --abort`. Working Tree view shows a rebase banner with step/total progress, reuses ConflictView for mid-rebase conflicts.

### Branch context menu (Phase 6A/6B, `Sidebar.vue` + `internal/gitcli/branches.go`)
Context menu is teleported to `<body>` to escape sidebar overflow clipping. Positioned via `getBoundingClientRect()`.

**Phase 6A** items (all gitcli shell-outs):
- **Delete**: `git branch -d <name>`; on failure offer force-delete (`-D`) via confirmation
- **Rename**: `git branch -m <old> <new>`; name input via inline prompt
- **Copy name**: `navigator.clipboard.writeText()`
- **Push**: reuse existing `Push(repoPath, branch)` from `internal/gitcli/remote.go`

**Phase 6B** items:
- **Create branch from here**: `git checkout -b <name> <base>` — needs name input modal
- **Merge into current**: `git merge <branch>` — conflicts land in Working Tree view
- **Set upstream**: `git branch --set-upstream-to=origin/<name>`
- **Create tag**: `git tag <name> <hash>` — needs name input modal

## Pending Small Items

- HTTPS auth via go-keyring for push/pull on private repos (SSH agent already works)
