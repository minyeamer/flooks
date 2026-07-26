package manifest

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/flooks/flooks/internal/domain"
)

func LoadDirectory(path string) ([]domain.DatasetManifest, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var manifests []domain.DatasetManifest
	for _, entry := range entries {
		if entry.IsDir() || (!strings.HasSuffix(entry.Name(), ".yaml") && !strings.HasSuffix(entry.Name(), ".yml")) {
			continue
		}
		payload, err := os.ReadFile(filepath.Join(path, entry.Name()))
		if err != nil {
			return nil, err
		}
		var item domain.DatasetManifest
		if err := yaml.Unmarshal(payload, &item); err != nil {
			return nil, fmt.Errorf("%s: %w", entry.Name(), err)
		}
		if item.Version != 1 || item.Key == "" || item.Connector == "" {
			return nil, fmt.Errorf("%s: version, key and connector are required", entry.Name())
		}
		manifests = append(manifests, item)
	}
	if len(manifests) == 0 {
		return nil, fmt.Errorf("no dataset manifests found in %s", path)
	}
	return manifests, nil
}
