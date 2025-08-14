package unit

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/pkg/metrics"
	"go.uber.org/zap/zaptest"
)

func TestAnomalyDetector_New(t *testing.T) {
	logger := zaptest.NewLogger(t)
	metrics := metrics.NewMetrics()

	detector := core.NewAnomalyDetector(logger, metrics)

	assert.NotNil(t, detector)
}

func TestAnomalyDetector_AnalyzeText_Empty(t *testing.T) {
	logger := zaptest.NewLogger(t)
	metrics := metrics.NewMetrics()
	detector := core.NewAnomalyDetector(logger, metrics)

	result, err := detector.AnalyzeText("")

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 0.0, result.Score)
	assert.Equal(t, 0.0, result.Confidence)
	assert.False(t, result.IsAnomalous)
}

func TestAnomalyDetector_AnalyzeText_WithAnalyzers(t *testing.T) {
	logger := zaptest.NewLogger(t)
	metrics := metrics.NewMetrics()
	detector := core.NewAnomalyDetector(logger, metrics)

	// TODO: Add mock analyzers for testing

	result, err := detector.AnalyzeText("This is a sample text for testing.")

	require.NoError(t, err)
	assert.NotNil(t, result)
	// With no analyzers, should return default values
	assert.Equal(t, 0.0, result.Score)
	assert.False(t, result.IsAnomalous)
}
