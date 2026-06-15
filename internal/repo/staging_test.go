package repo

import (
	"strings"
	"testing"
)

func TestBuildHunkPatch_AddLines(t *testing.T) {
	hunk := Hunk{
		Header: "@@ -0,0 +1,2 @@",
		Lines: []HunkLine{
			{Type: "add", Content: "first line", NewLine: 1},
			{Type: "add", Content: "second line", NewLine: 2},
		},
	}
	patch := BuildHunkPatch("foo.go", hunk)

	if !strings.Contains(patch, "diff --git a/foo.go b/foo.go") {
		t.Error("patch missing diff --git header")
	}
	if !strings.Contains(patch, "--- a/foo.go") {
		t.Error("patch missing --- header")
	}
	if !strings.Contains(patch, "+++ b/foo.go") {
		t.Error("patch missing +++ header")
	}
	if !strings.Contains(patch, "@@ -0,0 +1,2 @@") {
		t.Error("patch missing hunk header")
	}
	if !strings.Contains(patch, "+first line") {
		t.Error("patch missing +first line")
	}
	if !strings.Contains(patch, "+second line") {
		t.Error("patch missing +second line")
	}
}

func TestBuildHunkPatch_DeleteLines(t *testing.T) {
	hunk := Hunk{
		Header: "@@ -1,2 +0,0 @@",
		Lines: []HunkLine{
			{Type: "del", Content: "remove me", OldLine: 1},
		},
	}
	patch := BuildHunkPatch("bar.go", hunk)

	if !strings.Contains(patch, "-remove me") {
		t.Error("patch missing -remove me")
	}
	if strings.Contains(patch, "+remove me") {
		t.Error("patch should not contain +remove me")
	}
}

func TestBuildHunkPatch_ContextLines(t *testing.T) {
	hunk := Hunk{
		Header: "@@ -1,3 +1,3 @@",
		Lines: []HunkLine{
			{Type: "context", Content: "before", OldLine: 1, NewLine: 1},
			{Type: "del", Content: "old", OldLine: 2},
			{Type: "add", Content: "new", NewLine: 2},
			{Type: "context", Content: "after", OldLine: 3, NewLine: 3},
		},
	}
	patch := BuildHunkPatch("baz.go", hunk)

	if !strings.Contains(patch, " before") {
		t.Error("context line should start with space")
	}
	if !strings.Contains(patch, "-old") {
		t.Error("del line should start with -")
	}
	if !strings.Contains(patch, "+new") {
		t.Error("add line should start with +")
	}
	if !strings.Contains(patch, " after") {
		t.Error("context line should start with space")
	}
}

func TestBuildHunkPatch_EndsWithNewline(t *testing.T) {
	hunk := Hunk{
		Header: "@@ -1,1 +1,1 @@",
		Lines:  []HunkLine{{Type: "add", Content: "x", NewLine: 1}},
	}
	patch := BuildHunkPatch("f.go", hunk)

	if !strings.HasSuffix(patch, "\n") {
		t.Error("patch should end with newline (required by git apply)")
	}
}

func TestBuildHunkPatch_PathWithSubdir(t *testing.T) {
	hunk := Hunk{
		Header: "@@ -1,1 +1,1 @@",
		Lines:  []HunkLine{{Type: "add", Content: "x", NewLine: 1}},
	}
	patch := BuildHunkPatch("internal/repo/foo.go", hunk)

	if !strings.Contains(patch, "diff --git a/internal/repo/foo.go b/internal/repo/foo.go") {
		t.Error("patch should contain the full sub-directory path")
	}
}
