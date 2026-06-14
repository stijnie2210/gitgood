package gitcli

import "strings"

func DeleteBranch(repoPath, name string, force bool) error {
	flag := "-d"
	if force {
		flag = "-D"
	}
	_, err := Run(repoPath, "branch", flag, name)
	return err
}

func RenameBranch(repoPath, oldName, newName string) error {
	_, err := Run(repoPath, "branch", "-m", oldName, newName)
	return err
}

// PushNamedBranch pushes a specific local branch to origin.
// For untracked branches this sets the upstream automatically (-u).
func PushNamedBranch(repoPath, name string) error {
	_, err := Run(repoPath, "push", "-u", "origin", name)
	if err != nil {
		// Trim verbose git push output from error message
		msg := err.Error()
		if idx := strings.Index(msg, "\n"); idx > 0 {
			return &ExitError{Code: 1, Stderr: strings.TrimSpace(msg[idx+1:])}
		}
	}
	return err
}
