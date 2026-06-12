package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	git "github.com/go-git/go-git/v5"
)

type Manager struct {
	mu    sync.RWMutex
	repos map[string]*git.Repository // keyed by absolute path
}

func NewManager() *Manager {
	return &Manager{
		repos: make(map[string]*git.Repository),
	}
}

func (m *Manager) Open(path string) error {
	abs, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("resolving path: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.repos[abs]; ok {
		return nil
	}

	r, err := git.PlainOpen(abs)
	if err != nil {
		return fmt.Errorf("opening repo: %w", err)
	}

	m.repos[abs] = r
	return nil
}

func (m *Manager) Close(path string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.repos, path)
}

func (m *Manager) Get(path string) (*git.Repository, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	r, ok := m.repos[path]
	if !ok {
		return nil, fmt.Errorf("repo not open: %s", path)
	}
	return r, nil
}

func (m *Manager) OpenPaths() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	paths := make([]string, 0, len(m.repos))
	for p := range m.repos {
		paths = append(paths, p)
	}
	return paths
}

type recentEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

func recentReposPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "gitgood", "repos.json"), nil
}

func LoadRecentRepos() ([]recentEntry, error) {
	p, err := recentReposPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var entries []recentEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func SaveRecentRepo(path string) error {
	entries, _ := LoadRecentRepos()

	// Deduplicate — move to front if already present
	name := filepath.Base(path)
	filtered := []recentEntry{{Path: path, Name: name}}
	for _, e := range entries {
		if e.Path != path {
			filtered = append(filtered, e)
		}
	}
	if len(filtered) > 20 {
		filtered = filtered[:20]
	}

	p, err := recentReposPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0644)
}
