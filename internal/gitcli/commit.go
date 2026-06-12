package gitcli

func Commit(repoPath, message string, amend bool) error {
	var args []string
	switch {
	case amend && message == "":
		args = []string{"commit", "--amend", "--no-edit"}
	case amend:
		args = []string{"commit", "--amend", "-m", message}
	default:
		args = []string{"commit", "-m", message}
	}
	_, err := Run(repoPath, args...)
	return err
}
