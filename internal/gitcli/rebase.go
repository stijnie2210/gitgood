package gitcli

func StartRebase(repoPath, onto string) error {
	_, err := Run(repoPath, "rebase", onto)
	return err
}

func ContinueRebase(repoPath string) error {
	// -c core.editor=true prevents git from opening an editor for the commit message
	_, err := Run(repoPath, "-c", "core.editor=true", "rebase", "--continue")
	return err
}

func AbortRebase(repoPath string) error {
	_, err := Run(repoPath, "rebase", "--abort")
	return err
}
