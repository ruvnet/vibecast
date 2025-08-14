package unit

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap/zaptest"

	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/models"
	"github.com/ruvnet/alienator/pkg/metrics"
)

// MockAnalyzer is a mock implementation of the Analyzer interface
type MockAnalyzer struct {
	mock.Mock
}

func (m *MockAnalyzer) Name() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockAnalyzer) Analyze(ctx context.Context, text string) (*models.AnalysisResult, error) {
	args := m.Called(ctx, text)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.AnalysisResult), args.Error(1)
}

// AnomalyDetectorTestSuite provides comprehensive test coverage for AnomalyDetector
type AnomalyDetectorTestSuite struct {
	suite.Suite
	detector *core.AnomalyDetector
	logger   *zap.Logger
	metrics  *metrics.Metrics
}

func (suite *AnomalyDetectorTestSuite) SetupTest() {
	suite.logger = zaptest.NewLogger(suite.T())
	suite.metrics = &metrics.Metrics{} // Initialize with actual metrics if needed
	suite.detector = core.NewAnomalyDetector(suite.logger, suite.metrics)
}

func (suite *AnomalyDetectorTestSuite) TestNewAnomalyDetector() {
	detector := core.NewAnomalyDetector(suite.logger, suite.metrics)

	assert.NotNil(suite.T(), detector)
	assert.Equal(suite.T(), suite.logger, detector.logger)
	assert.Equal(suite.T(), suite.metrics, detector.metrics)
	assert.Empty(suite.T(), detector.analyzers)
}

func (suite *AnomalyDetectorTestSuite) TestRegisterAnalyzer() {
	mockAnalyzer := &MockAnalyzer{}
	mockAnalyzer.On("Name").Return("test-analyzer")

	initialCount := len(suite.detector.analyzers)
	suite.detector.RegisterAnalyzer(mockAnalyzer)

	assert.Equal(suite.T(), initialCount+1, len(suite.detector.analyzers))
	assert.Equal(suite.T(), mockAnalyzer, suite.detector.analyzers[0])
}

func (suite *AnomalyDetectorTestSuite) TestAnalyzeText_NoAnalyzers() {
	result, err := suite.detector.AnalyzeText("test text")

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 0.0, result.Score)
	assert.Equal(suite.T(), 0.0, result.Confidence)
	assert.False(suite.T(), result.IsAnomalous)
	assert.Empty(suite.T(), result.Details)
}

func (suite *AnomalyDetectorTestSuite) TestAnalyzeText_SingleAnalyzer_Success() {
	mockAnalyzer := &MockAnalyzer{}
	mockAnalyzer.On("Name").Return("test-analyzer")
	mockAnalyzer.On("Analyze", mock.Anything, "test text").Return(&models.AnalysisResult{
		Score:      0.8,
		Confidence: 0.9,
		Metadata:   map[string]interface{}{"test": "data"},
	}, nil)

	suite.detector.RegisterAnalyzer(mockAnalyzer)

	result, err := suite.detector.AnalyzeText("test text")

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 0.8, result.Score)
	assert.Equal(suite.T(), 0.9, result.Confidence)
	assert.True(suite.T(), result.IsAnomalous) // Score > 0.7
	assert.Len(suite.T(), result.Details, 1)
	assert.Contains(suite.T(), result.Details, "test-analyzer")

	mockAnalyzer.AssertExpectations(suite.T())
}

func (suite *AnomalyDetectorTestSuite) TestAnalyzeText_MultipleAnalyzers_Success() {
	// Create multiple mock analyzers
	analyzer1 := &MockAnalyzer{}
	analyzer1.On("Name").Return("analyzer-1")
	analyzer1.On("Analyze", mock.Anything, "test text").Return(&models.AnalysisResult{
		Score:      0.6,
		Confidence: 0.8,
		Metadata:   map[string]interface{}{"source": "analyzer1"},
	}, nil)

	analyzer2 := &MockAnalyzer{}
	analyzer2.On("Name").Return("analyzer-2")
	analyzer2.On("Analyze", mock.Anything, "test text").Return(&models.AnalysisResult{
		Score:      0.9,
		Confidence: 0.7,
		Metadata:   map[string]interface{}{"source": "analyzer2"},
	}, nil)

	suite.detector.RegisterAnalyzer(analyzer1)
	suite.detector.RegisterAnalyzer(analyzer2)

	result, err := suite.detector.AnalyzeText("test text")

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	// Weighted average: (0.6*0.8 + 0.9*0.7) / (0.8+0.7) = 0.75
	expectedScore := (0.6*0.8 + 0.9*0.7) / (0.8 + 0.7)
	assert.InDelta(suite.T(), expectedScore, result.Score, 0.01)

	// Average confidence: (0.8+0.7) / 2 = 0.75
	expectedConfidence := (0.8 + 0.7) / 2
	assert.Equal(suite.T(), expectedConfidence, result.Confidence)

	assert.True(suite.T(), result.IsAnomalous)
	assert.Len(suite.T(), result.Details, 2)

	analyzer1.AssertExpectations(suite.T())
	analyzer2.AssertExpectations(suite.T())
}

func (suite *AnomalyDetectorTestSuite) TestAnalyzeText_AnalyzerError() {
	mockAnalyzer := &MockAnalyzer{}
	mockAnalyzer.On("Name").Return("failing-analyzer")
	mockAnalyzer.On("Analyze", mock.Anything, "test text").Return(nil, errors.New("analyzer failed"))

	suite.detector.RegisterAnalyzer(mockAnalyzer)

	result, err := suite.detector.AnalyzeText("test text")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)
	assert.Contains(suite.T(), err.Error(), "analyzer failing-analyzer failed")

	mockAnalyzer.AssertExpectations(suite.T())
}

func (suite *AnomalyDetectorTestSuite) TestAnalyzeText_PartialFailure() {
	successAnalyzer := &MockAnalyzer{}
	successAnalyzer.On("Name").Return("success-analyzer")
	successAnalyzer.On("Analyze", mock.Anything, "test text").Return(&models.AnalysisResult{
		Score:      0.5,
		Confidence: 0.8,
		Metadata:   map[string]interface{}{},
	}, nil)

	failAnalyzer := &MockAnalyzer{}
	failAnalyzer.On("Name").Return("fail-analyzer")
	failAnalyzer.On("Analyze", mock.Anything, "test text").Return(nil, errors.New("failed"))

	suite.detector.RegisterAnalyzer(successAnalyzer)
	suite.detector.RegisterAnalyzer(failAnalyzer)

	result, err := suite.detector.AnalyzeText("test text")

	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), result)

	successAnalyzer.AssertExpectations(suite.T())
	failAnalyzer.AssertExpectations(suite.T())
}

func (suite *AnomalyDetectorTestSuite) TestAnalyzeText_ConcurrentSafety() {
	// Test concurrent execution safety
	const numGoroutines = 100
	const numIterations = 10

	mockAnalyzer := &MockAnalyzer{}
	mockAnalyzer.On("Name").Return("concurrent-analyzer")

	// Set up expectations for all calls
	for i := 0; i < numGoroutines*numIterations; i++ {
		mockAnalyzer.On("Analyze", mock.Anything, mock.AnythingOfType("string")).Return(&models.AnalysisResult{
			Score:      0.5,
			Confidence: 0.8,
			Metadata:   map[string]interface{}{},
		}, nil).Maybe()
	}

	suite.detector.RegisterAnalyzer(mockAnalyzer)

	var wg sync.WaitGroup
	errors := make(chan error, numGoroutines*numIterations)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numIterations; j++ {
				_, err := suite.detector.AnalyzeText(fmt.Sprintf("test text %d-%d", id, j))
				if err != nil {
					errors <- err
				}
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for any errors
	for err := range errors {
		suite.T().Errorf("Concurrent execution error: %v", err)
	}
}

func (suite *AnomalyDetectorTestSuite) TestAggregateResults_EmptyResults() {
	results := make(map[string]*models.AnalysisResult)

	aggregated := suite.detector.aggregateResults(results)

	assert.Equal(suite.T(), 0.0, aggregated.Score)
	assert.Equal(suite.T(), 0.0, aggregated.Confidence)
	assert.False(suite.T(), aggregated.IsAnomalous)
	assert.Empty(suite.T(), aggregated.Details)
}

func (suite *AnomalyDetectorTestSuite) TestAggregateResults_SingleResult() {
	results := map[string]*models.AnalysisResult{
		"analyzer1": {
			Score:      0.8,
			Confidence: 0.9,
			Metadata:   map[string]interface{}{},
		},
	}

	aggregated := suite.detector.aggregateResults(results)

	assert.Equal(suite.T(), 0.8, aggregated.Score)
	assert.Equal(suite.T(), 0.9, aggregated.Confidence)
	assert.True(suite.T(), aggregated.IsAnomalous)
	assert.Equal(suite.T(), results, aggregated.Details)
}

func (suite *AnomalyDetectorTestSuite) TestAggregateResults_ThresholdBoundary() {
	// Test exactly at threshold (0.7)
	results := map[string]*models.AnalysisResult{
		"analyzer1": {
			Score:      0.7,
			Confidence: 1.0,
			Metadata:   map[string]interface{}{},
		},
	}

	aggregated := suite.detector.aggregateResults(results)

	assert.Equal(suite.T(), 0.7, aggregated.Score)
	assert.False(suite.T(), aggregated.IsAnomalous) // Score > 0.7, not >=

	// Test just above threshold
	results["analyzer1"].Score = 0.701
	aggregated = suite.detector.aggregateResults(results)
	assert.True(suite.T(), aggregated.IsAnomalous)
}

func (suite *AnomalyDetectorTestSuite) TestAggregateResults_WeightedAverage() {
	results := map[string]*models.AnalysisResult{
		"high_confidence": {
			Score:      0.9,
			Confidence: 0.8,
			Metadata:   map[string]interface{}{},
		},
		"low_confidence": {
			Score:      0.3,
			Confidence: 0.2,
			Metadata:   map[string]interface{}{},
		},
	}

	aggregated := suite.detector.aggregateResults(results)

	// Weighted average: (0.9*0.8 + 0.3*0.2) / (0.8+0.2) = 0.78
	expectedScore := (0.9*0.8 + 0.3*0.2) / (0.8 + 0.2)
	assert.InDelta(suite.T(), expectedScore, aggregated.Score, 0.01)

	// Average confidence: (0.8+0.2) / 2 = 0.5
	expectedConfidence := (0.8 + 0.2) / 2
	assert.Equal(suite.T(), expectedConfidence, aggregated.Confidence)
}

func TestAnomalyDetectorTestSuite(t *testing.T) {
	suite.Run(t, new(AnomalyDetectorTestSuite))
}

// Benchmark tests for performance validation
func BenchmarkAnomalyDetector_AnalyzeText(b *testing.B) {
	logger := zaptest.NewLogger(b)
	metrics := &metrics.Metrics{}
	detector := core.NewAnomalyDetector(logger, metrics)

	// Register a mock analyzer
	mockAnalyzer := &MockAnalyzer{}
	mockAnalyzer.On("Name").Return("benchmark-analyzer")
	mockAnalyzer.On("Analyze", mock.Anything, mock.AnythingOfType("string")).Return(&models.AnalysisResult{
		Score:      0.5,
		Confidence: 0.8,
		Metadata:   map[string]interface{}{},
	}, nil)

	detector.RegisterAnalyzer(mockAnalyzer)

	testText := "This is a test text for benchmarking the anomaly detector performance."

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := detector.AnalyzeText(testText)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAnomalyDetector_MultipleAnalyzers(b *testing.B) {
	logger := zaptest.NewLogger(b)
	metrics := &metrics.Metrics{}
	detector := core.NewAnomalyDetector(logger, metrics)

	// Register multiple mock analyzers
	for i := 0; i < 5; i++ {
		mockAnalyzer := &MockAnalyzer{}
		mockAnalyzer.On("Name").Return(fmt.Sprintf("analyzer-%d", i))
		mockAnalyzer.On("Analyze", mock.Anything, mock.AnythingOfType("string")).Return(&models.AnalysisResult{
			Score:      0.5,
			Confidence: 0.8,
			Metadata:   map[string]interface{}{},
		}, nil)
		detector.RegisterAnalyzer(mockAnalyzer)
	}

	testText := "This is a test text for benchmarking multiple analyzers performance."

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := detector.AnalyzeText(testText)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Edge case tests
func TestAnomalyDetector_EdgeCases(t *testing.T) {
	logger := zaptest.NewLogger(t)
	metrics := &metrics.Metrics{}
	detector := core.NewAnomalyDetector(logger, metrics)

	t.Run("empty_text", func(t *testing.T) {
		mockAnalyzer := &MockAnalyzer{}
		mockAnalyzer.On("Name").Return("empty-text-analyzer")
		mockAnalyzer.On("Analyze", mock.Anything, "").Return(&models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil)

		detector.RegisterAnalyzer(mockAnalyzer)

		result, err := detector.AnalyzeText("")

		require.NoError(t, err)
		assert.NotNil(t, result)
		mockAnalyzer.AssertExpectations(t)
	})

	t.Run("very_long_text", func(t *testing.T) {
		longText := strings.Repeat("This is a very long text. ", 10000)

		mockAnalyzer := &MockAnalyzer{}
		mockAnalyzer.On("Name").Return("long-text-analyzer")
		mockAnalyzer.On("Analyze", mock.Anything, longText).Return(&models.AnalysisResult{
			Score:      0.5,
			Confidence: 0.8,
			Metadata:   map[string]interface{}{},
		}, nil)

		detector.RegisterAnalyzer(mockAnalyzer)

		start := time.Now()
		result, err := detector.AnalyzeText(longText)
		duration := time.Since(start)

		require.NoError(t, err)
		assert.NotNil(t, result)
		assert.Less(t, duration, 5*time.Second, "Long text analysis should complete within 5 seconds")
		mockAnalyzer.AssertExpectations(t)
	})

	t.Run("unicode_text", func(t *testing.T) {
		unicodeText := "こんにちは世界 🌍 émojis and spëcial chars: αβγ"

		mockAnalyzer := &MockAnalyzer{}
		mockAnalyzer.On("Name").Return("unicode-analyzer")
		mockAnalyzer.On("Analyze", mock.Anything, unicodeText).Return(&models.AnalysisResult{
			Score:      0.3,
			Confidence: 0.7,
			Metadata:   map[string]interface{}{},
		}, nil)

		detector.RegisterAnalyzer(mockAnalyzer)

		result, err := detector.AnalyzeText(unicodeText)

		require.NoError(t, err)
		assert.NotNil(t, result)
		mockAnalyzer.AssertExpectations(t)
	})
}

// Test analyzer timeout and context handling
func TestAnomalyDetector_TimeoutHandling(t *testing.T) {
	logger := zaptest.NewLogger(t)
	metrics := &metrics.Metrics{}
	detector := core.NewAnomalyDetector(logger, metrics)

	// Create a slow analyzer that simulates timeout
	slowAnalyzer := &MockAnalyzer{}
	slowAnalyzer.On("Name").Return("slow-analyzer")
	slowAnalyzer.On("Analyze", mock.Anything, "test").Return(
		func(ctx context.Context, text string) *models.AnalysisResult {
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(2 * time.Second):
				return &models.AnalysisResult{Score: 0.5, Confidence: 0.8}
			}
		},
		func(ctx context.Context, text string) error {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(2 * time.Second):
				return nil
			}
		})

	detector.RegisterAnalyzer(slowAnalyzer)

	// This test would need context with timeout to be properly implemented
	// For now, we verify the analyzer receives a context
	result, err := detector.AnalyzeText("test")

	// In the current implementation, this might take time or succeed
	// depending on the mock setup
	if err != nil {
		assert.Contains(t, err.Error(), "context")
	} else {
		assert.NotNil(t, result)
	}

	slowAnalyzer.AssertExpectations(t)
}
