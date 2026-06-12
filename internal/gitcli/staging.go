package gitcli

func StageFile(repoPath, path string) error {
	_, err := Run(repoPath, "add", "--", path)
	return err
}

func UnstageFile(repoPath, path string) error {
	_, err := Run(repoPath, "restore", "--staged", "--", path)
	return err
}

func ApplyPatch(repoPath string, patch []byte, reverse bool) error {
	args := []string{"apply", "--cached"}
	if reverse {
		args = append(args, "--reverse")
	}
	_, err := RunWithInput(repoPath, patch, args...)
	return err
}

func DiscardFile(repoPath, path string) error {
	_, err := Run(repoPath, "restore", "--", path)
	return err
}
