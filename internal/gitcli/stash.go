package gitcli

import (
	"fmt"
	"strings"
	"time"
)

type StashEntry struct {
	Index   int    `json:"index"`
	Ref     string `json:"ref"`
	Message string `json:"message"`
	Branch  string `json:"branch"`
	Hash    string `json:"hash"`
	Date    string `json:"date"`
}

func ListStashes(repoPath string) ([]StashEntry, error) {
	result, err := Run(repoPath, "stash", "list", "--format=%gd\t%H\t%gs\t%ci")
	if err != nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(result.Stdout)
	if trimmed == "" {
		return nil, nil
	}

	var entries []StashEntry
	for i, line := range strings.Split(trimmed, "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 4)
		if len(parts) < 4 {
			continue
		}
		ref := parts[0]
		hash := parts[1]
		message := parts[2]
		dateStr := parts[3]

		branch := ""
		if rest, ok := strings.CutPrefix(message, "WIP on "); ok {
			if b, _, found := strings.Cut(rest, ":"); found {
				branch = b
			}
		} else if rest, ok := strings.CutPrefix(message, "On "); ok {
			if b, _, found := strings.Cut(rest, ":"); found {
				branch = b
			}
		}

		t, _ := time.Parse("2006-01-02 15:04:05 -0700", dateStr)
		date := dateStr
		if !t.IsZero() {
			date = t.Format("2 Jan 2006")
		}

		entries = append(entries, StashEntry{
			Index:   i,
			Ref:     ref,
			Hash:    hash,
			Message: message,
			Branch:  branch,
			Date:    date,
		})
	}
	return entries, nil
}

func ApplyStash(repoPath, ref string) error {
	_, err := Run(repoPath, "stash", "apply", ref)
	return err
}

func DropStash(repoPath, ref string) error {
	_, err := Run(repoPath, "stash", "drop", ref)
	return err
}

func PopStash(repoPath, ref string) error {
	_, err := Run(repoPath, "stash", "pop", ref)
	return err
}

func RenameStash(repoPath, ref, newMessage string) error {
	hashResult, err := Run(repoPath, "rev-parse", ref)
	if err != nil {
		return fmt.Errorf("could not resolve %s: %w", ref, err)
	}
	hash := strings.TrimSpace(hashResult.Stdout)
	if _, err = Run(repoPath, "stash", "drop", ref); err != nil {
		return err
	}
	_, err = Run(repoPath, "stash", "store", "-m", newMessage, hash)
	return err
}

func Stash(repoPath string) error {
	_, err := Run(repoPath, "stash")
	return err
}

func StashPop(repoPath string) error {
	_, err := Run(repoPath, "stash", "pop")
	return err
}

func StashPushNamed(repoPath, msg string) error {
	_, err := Run(repoPath, "stash", "push", "-m", msg)
	return err
}

func CreateBranch(repoPath, name string) error {
	_, err := Run(repoPath, "checkout", "-b", name)
	return err
}
