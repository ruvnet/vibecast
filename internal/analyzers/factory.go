package analyzers

import (
	"fmt"

	"github.com/ruvnet/alienator/internal/analyzers/alerts"
	"github.com/ruvnet/alienator/internal/analyzers/ml"
	"github.com/ruvnet/alienator/internal/analyzers/pattern"
	"github.com/ruvnet/alienator/internal/analyzers/statistical"
	"github.com/ruvnet/alienator/internal/analyzers/threshold"
)

// AnalyzerType represents supported analyzer types
type AnalyzerType string

const (
	TypeStatistical AnalyzerType = "statistical"
	TypePattern     AnalyzerType = "pattern"
	TypeML          AnalyzerType = "ml"
	TypeThreshold   AnalyzerType = "threshold"
)

// Factory creates analyzers based on type and configuration
type Factory struct {
	alertManager *alerts.Manager
}

// NewFactory creates a new analyzer factory
func NewFactory(alertManager *alerts.Manager) *Factory {
	return &Factory{
		alertManager: alertManager,
	}
}

// CreateAnalyzer creates an analyzer of the specified type
func (f *Factory) CreateAnalyzer(analyzerType AnalyzerType, config *Configuration) (Analyzer, error) {
	if config == nil {
		config = DefaultConfiguration()
	}

	switch analyzerType {
	case TypeStatistical:
		return statistical.NewDetector(config)
	case TypePattern:
		return pattern.NewMatcher(config)
	case TypeML:
		return ml.NewNeuralDetector(config)
	case TypeThreshold:
		return threshold.NewMonitor(config)
	default:
		return nil, fmt.Errorf("unsupported analyzer type: %s", analyzerType)
	}
}

// CreateCompositeAnalyzer creates a composite analyzer that combines multiple analyzers
func (f *Factory) CreateCompositeAnalyzer(types []AnalyzerType, config *Configuration) (*CompositeAnalyzer, error) {
	analyzers := make([]Analyzer, 0, len(types))

	for _, analyzerType := range types {
		analyzer, err := f.CreateAnalyzer(analyzerType, config)
		if err != nil {
			return nil, fmt.Errorf("failed to create %s analyzer: %w", analyzerType, err)
		}
		analyzers = append(analyzers, analyzer)
	}

	return NewCompositeAnalyzer(analyzers, f.alertManager), nil
}

// GetSupportedTypes returns all supported analyzer types
func (f *Factory) GetSupportedTypes() []AnalyzerType {
	return []AnalyzerType{
		TypeStatistical,
		TypePattern,
		TypeML,
		TypeThreshold,
	}
}

// ValidateConfiguration validates analyzer configuration
func (f *Factory) ValidateConfiguration(analyzerType AnalyzerType, config *Configuration) error {
	if config == nil {
		return fmt.Errorf("configuration cannot be nil")
	}

	// Common validations
	if config.Sensitivity < 0 || config.Sensitivity > 1 {
		return fmt.Errorf("sensitivity must be between 0 and 1")
	}

	if config.WindowSize <= 0 {
		return fmt.Errorf("window size must be positive")
	}

	if config.MinDataPoints <= 0 {
		return fmt.Errorf("minimum data points must be positive")
	}

	if config.MaxDataPoints < config.MinDataPoints {
		return fmt.Errorf("maximum data points must be >= minimum data points")
	}

	// Type-specific validations
	switch analyzerType {
	case TypeStatistical:
		if config.Threshold <= 0 {
			return fmt.Errorf("threshold must be positive for statistical analyzer")
		}
	case TypeThreshold:
		if config.Threshold == 0 {
			return fmt.Errorf("threshold must be specified for threshold analyzer")
		}
	case TypeML:
		// ML-specific validations
		if config.WindowSize < 10 {
			return fmt.Errorf("ML analyzer requires window size >= 10")
		}
	case TypePattern:
		// Pattern-specific validations
		if config.WindowSize < 5 {
			return fmt.Errorf("pattern analyzer requires window size >= 5")
		}
	}

	return nil
}
