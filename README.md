# gitgood

A desktop Git client built as a single binary using [Wails v2](https://wails.io) (Go backend + Vue 3 frontend). No HTTP server — the Go layer is bound directly to the TypeScript frontend via auto-generated type-safe bindings.

## Features

- **Commit graph** — visual branch graph with lane layout and virtual scrolling, handles thousands of commits
- **Staging** — file-level and hunk-level stage/unstage, discard, and diff viewer
- **Branch switching** — smart checkout that carries over non-conflicting changes; auto-stashes when git refuses, then pops the stash after the switch
- **Conflict resolution** — per-conflict Accept Ours / Accept Theirs UI for merge and rebase conflicts
- **Rebasing** — start a rebase onto any branch from the sidebar context menu; continue or abort from the staging view while conflicts are surfaced inline
- **Remote operations** — fetch, pull, push with SSH agent support
- **Recent repositories** — persisted to `~/Library/Application Support/gitgood/repos.json`

## Installing (Linux)

The AppImage release requires WebKit2GTK 4.1. Install it before running:

```bash
# Fedora / RHEL
sudo dnf install webkit2gtk4.1

# Ubuntu / Debian
sudo apt install libwebkit2gtk-4.1-0

# Arch Linux
sudo pacman -S webkit2gtk-4.1
```

Then make the AppImage executable and run it:

```bash
chmod +x gitgood-linux-amd64.AppImage
./gitgood-linux-amd64.AppImage
```

## Requirements (building from source)

- Go 1.24+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2
- Node.js 18+

## Development

```bash
wails dev        # hot-reload dev build; regenerates TypeScript bindings automatically
wails build      # production .app bundle → build/bin/gitgood.app
go build ./...   # Go-only compile check
```

After adding or changing Go methods on `App` or structs that cross the boundary, run `wails dev` or `wails build` to regenerate `frontend/wailsjs/go/main/App.d.ts` and `frontend/wailsjs/go/models.ts`. Never edit those files by hand.

## Architecture

### Hybrid git strategy

- **go-git** for reads: log, branches, refs, commit objects, tree diffs
- **System `git` (shell-out)** for writes and complex operations: staging, hunk apply, rebase, merge, fetch/pull/push

This keeps reads fast and dependency-light while delegating anything state-changing to the real git binary.

### Layer overview

```
app.go                    Thin Wails-bound coordinator; all methods delegate to manager
internal/repo/            Manager (open repos map) and all business logic
internal/gitcli/          Pure exec.Command wrappers — no business logic
internal/graph/           Lane assignment algorithm for the commit graph
frontend/src/stores/      Pinia stores, one per domain
frontend/src/components/  Vue components grouped by feature
```

### Key implementation notes

**Commit graph** — greedy topological walk assigns each commit to a lane. Merge convergence frees the current lane and draws a diagonal edge. Rendered with `@tanstack/vue-virtual` virtual scroll and a canvas element per row.

**Hunk staging** — the frontend builds the patch string from what the user sees, then calls `git apply --cached` (or `--cached --reverse` to unstage). This ensures the applied patch exactly matches the displayed diff.

**Branch switching** — attempts a direct `git checkout` first; if git refuses due to conflicting changes it auto-stashes, switches, then pops the stash. If the stash pop produces conflicts they are surfaced in the staging view.

**Conflict resolution** — works identically for merges and rebases. The staging view parses `<<<<<<< / ======= / >>>>>>>` markers into context and conflict chunks; each conflict chunk has Accept Ours / Accept Theirs buttons. Save & Stage calls `ResolveConflict` on the backend.

**Rebasing** — `git rebase <onto>` is started from the sidebar context menu (right-click any branch). If conflicts are hit, the staging view shows a rebase banner with step progress and the current commit message. Continuing calls `git -c core.editor=true rebase --continue` to avoid opening an editor prompt.

## Project structure

```
app.go
internal/
  gitcli/
    runner.go       Run() / RunWithInput() — exec.Command wrapper
    staging.go      StageFile, UnstageFile, ApplyPatch, DiscardFile
    stash.go        Stash, StashPop, StashPushNamed
    remote.go       FetchAll, Pull, Push
    rebase.go       StartRebase, ContinueRebase, AbortRebase
  repo/
    manager.go      Manager{map[string]*git.Repository}; Open/Close/Get
    branches.go     ListBranches, GetAheadBehind
    commits.go      GetCommitGraph, GetCommitDiff
    diff.go         GetStatus, GetWorkingDiff, parseUnifiedDiff
    staging.go      StageHunk, UnstageHunk, Commit
    conflict.go     IsInMerge, GetConflictContent, ResolveConflict, AbortMerge
    checkout.go     SwitchBranch (smart stash logic), SwitchResult
    rebase.go       IsInRebase, GetRebaseState, StartRebase, ContinueRebase, AbortRebase
  graph/
    layout.go       BuildGraph() — greedy lane assignment
frontend/src/
  App.vue
  stores/
    repos.ts        Tabs, active repo, open/close
    branches.ts     Local/remote branch list, switchBranch
    commits.ts      Commit graph rows, selected commit diff
    staging.ts      File status, diff, merge/rebase state
    toast.ts        Notification toasts
  components/
    layout/
      TabBar.vue
      Sidebar.vue         Branch list with click-to-switch and right-click context menu
      ToolBar.vue
    graph/
      CommitGraph.vue     Virtual-scroll commit graph
      CommitRow.vue
      CommitDetail.vue
      graphRenderer.ts    Canvas drawing
    staging/
      StagingView.vue     File list, merge/rebase banners, commit panel
      HunkSelector.vue    Per-hunk stage/unstage
      ConflictView.vue    Per-conflict Accept Ours/Theirs
```
