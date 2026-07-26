package domain

type DatasetManifest struct {
	Version    int         `json:"version" yaml:"version"`
	Key        string      `json:"key" yaml:"key"`
	Label      string      `json:"label" yaml:"label"`
	Connector  string      `json:"connector" yaml:"connector"`
	Source     Source      `json:"source" yaml:"source"`
	Dimensions []Dimension `json:"dimensions" yaml:"dimensions"`
	Metrics    []Metric    `json:"metrics" yaml:"metrics"`
	Limits     LimitPolicy `json:"limits" yaml:"limits"`
	Cache      CachePolicy `json:"cache" yaml:"cache"`
}

type Source struct {
	Kind       string   `json:"kind" yaml:"kind"`
	Identifier string   `json:"identifier" yaml:"identifier"`
	Parameters []string `json:"parameters" yaml:"parameters"`
}

type Dimension struct {
	Key             string   `json:"key" yaml:"key"`
	Label           string   `json:"label" yaml:"label"`
	Type            string   `json:"type" yaml:"type"`
	Column          string   `json:"column" yaml:"column"`
	FilterOperators []string `json:"filterOperators" yaml:"filterOperators"`
}

type Metric struct {
	Key         string `json:"key" yaml:"key"`
	Label       string `json:"label" yaml:"label"`
	Type        string `json:"type" yaml:"type"`
	Column      string `json:"column,omitempty" yaml:"column,omitempty"`
	Numerator   string `json:"numerator,omitempty" yaml:"numerator,omitempty"`
	Denominator string `json:"denominator,omitempty" yaml:"denominator,omitempty"`
	Format      string `json:"format,omitempty" yaml:"format,omitempty"`
}

type LimitPolicy struct {
	DefaultRows    int `json:"defaultRows" yaml:"defaultRows"`
	MaxRows        int `json:"maxRows" yaml:"maxRows"`
	TimeoutSeconds int `json:"timeoutSeconds" yaml:"timeoutSeconds"`
}

type CachePolicy struct {
	TTLSeconds int `json:"ttlSeconds" yaml:"ttlSeconds"`
}

func (m DatasetManifest) Dimension(key string) (Dimension, bool) {
	for _, field := range m.Dimensions {
		if field.Key == key {
			return field, true
		}
	}
	return Dimension{}, false
}

func (m DatasetManifest) Metric(key string) (Metric, bool) {
	for _, field := range m.Metrics {
		if field.Key == key {
			return field, true
		}
	}
	return Metric{}, false
}
