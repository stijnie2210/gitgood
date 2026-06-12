package gitcli

func FetchAll(repoPath string) error {
	_, err := Run(repoPath, "fetch", "--all")
	return err
}

func Pull(repoPath string) error {
	_, err := Run(repoPath, "pull")
	return err
}

func Push(repoPath string) error {
	_, err := Run(repoPath, "push")
	return err
}
