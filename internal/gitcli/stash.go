package gitcli

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
