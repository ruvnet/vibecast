package unit

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/ruvnet/alienator/internal/models"
)

// ModelsTestSuite provides comprehensive test coverage for model structs
type ModelsTestSuite struct {
	suite.Suite
}

func (suite *ModelsTestSuite) TestAnalysisResult_Creation() {
	result := &models.AnalysisResult{
		Score:      0.85,
		Confidence: 0.92,
		Metadata: map[string]interface{}{
			"analyzer_name":   "test-analyzer",
			"processing_time": 150.5,
			"features":        []string{"entropy", "frequency"},
		},
	}

	assert.Equal(suite.T(), 0.85, result.Score)
	assert.Equal(suite.T(), 0.92, result.Confidence)
	assert.NotNil(suite.T(), result.Metadata)
	assert.Equal(suite.T(), "test-analyzer", result.Metadata["analyzer_name"])
}

func (suite *ModelsTestSuite) TestAnalysisResult_JSONSerialization() {
	original := &models.AnalysisResult{
		Score:      0.75,
		Confidence: 0.88,
		Metadata: map[string]interface{}{
			"test_field":    "test_value",
			"numeric_field": 42.0,
		},
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(original)
	require.NoError(suite.T(), err)

	// Deserialize from JSON
	var deserialized models.AnalysisResult
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), original.Score, deserialized.Score)
	assert.Equal(suite.T(), original.Confidence, deserialized.Confidence)
	assert.Equal(suite.T(), original.Metadata["test_field"], deserialized.Metadata["test_field"])
	assert.Equal(suite.T(), original.Metadata["numeric_field"], deserialized.Metadata["numeric_field"])
}

func (suite *ModelsTestSuite) TestAnomalyResult_Creation() {
	timestamp := time.Now()
	details := map[string]*models.AnalysisResult{
		"entropy": {
			Score:      0.6,
			Confidence: 0.8,
			Metadata:   map[string]interface{}{"type": "entropy"},
		},
		"linguistic": {
			Score:      0.7,
			Confidence: 0.9,
			Metadata:   map[string]interface{}{"type": "linguistic"},
		},
	}

	result := &models.AnomalyResult{
		Score:       0.8,
		Confidence:  0.85,
		IsAnomalous: true,
		Details:     details,
		Timestamp:   timestamp,
	}

	assert.Equal(suite.T(), 0.8, result.Score)
	assert.Equal(suite.T(), 0.85, result.Confidence)
	assert.True(suite.T(), result.IsAnomalous)
	assert.Equal(suite.T(), timestamp, result.Timestamp)
	assert.Len(suite.T(), result.Details, 2)
	assert.Contains(suite.T(), result.Details, "entropy")
	assert.Contains(suite.T(), result.Details, "linguistic")
}

func (suite *ModelsTestSuite) TestAnomalyResult_JSONSerialization() {
	timestamp := time.Now().UTC()
	original := &models.AnomalyResult{
		Score:       0.72,
		Confidence:  0.86,
		IsAnomalous: true,
		Details: map[string]*models.AnalysisResult{
			"test_analyzer": {
				Score:      0.65,
				Confidence: 0.8,
				Metadata:   map[string]interface{}{"key": "value"},
			},
		},
		Timestamp: timestamp,
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(original)
	require.NoError(suite.T(), err)

	// Deserialize from JSON
	var deserialized models.AnomalyResult
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), original.Score, deserialized.Score)
	assert.Equal(suite.T(), original.Confidence, deserialized.Confidence)
	assert.Equal(suite.T(), original.IsAnomalous, deserialized.IsAnomalous)
	assert.Len(suite.T(), deserialized.Details, 1)
	assert.WithinDuration(suite.T(), original.Timestamp, deserialized.Timestamp, time.Second)
}

func (suite *ModelsTestSuite) TestAnalysisRequest_Validation() {
	testCases := []struct {
		name    string
		request models.AnalysisRequest
		isValid bool
	}{
		{
			name: "valid_request",
			request: models.AnalysisRequest{
				ID:   "test-123",
				Text: "This is test text",
				Options: map[string]string{
					"analyzer": "entropy",
				},
				Priority: 1,
			},
			isValid: true,
		},
		{
			name: "minimal_valid_request",
			request: models.AnalysisRequest{
				ID:   "test-456",
				Text: "Test",
			},
			isValid: true,
		},
		{
			name: "empty_id_valid",
			request: models.AnalysisRequest{
				Text: "Test text without ID",
			},
			isValid: true,
		},
		{
			name: "empty_text_invalid",
			request: models.AnalysisRequest{
				ID:   "test-789",
				Text: "",
			},
			isValid: false,
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			// JSON validation test
			jsonData, err := json.Marshal(tc.request)
			require.NoError(t, err)

			var deserialized models.AnalysisRequest
			err = json.Unmarshal(jsonData, &deserialized)
			require.NoError(t, err)

			if tc.isValid {
				assert.Equal(t, tc.request.ID, deserialized.ID)
				assert.Equal(t, tc.request.Text, deserialized.Text)
				assert.Equal(t, tc.request.Priority, deserialized.Priority)
			}

			// Basic validation
			if tc.isValid {
				assert.NotEmpty(t, deserialized.Text, "Valid request should have non-empty text")
			}
		})
	}
}

func (suite *ModelsTestSuite) TestAnalysisResponse_Creation() {
	result := &models.AnomalyResult{
		Score:       0.7,
		Confidence:  0.8,
		IsAnomalous: true,
		Timestamp:   time.Now(),
	}

	response := &models.AnalysisResponse{
		ID:       "response-123",
		Result:   result,
		Duration: 250 * time.Millisecond,
	}

	assert.Equal(suite.T(), "response-123", response.ID)
	assert.Equal(suite.T(), result, response.Result)
	assert.Equal(suite.T(), 250*time.Millisecond, response.Duration)
	assert.Empty(suite.T(), response.Error)
}

func (suite *ModelsTestSuite) TestAnalysisResponse_WithError() {
	response := &models.AnalysisResponse{
		ID:       "error-response-456",
		Error:    "Analysis failed due to invalid input",
		Duration: 50 * time.Millisecond,
	}

	assert.Equal(suite.T(), "error-response-456", response.ID)
	assert.Nil(suite.T(), response.Result)
	assert.Equal(suite.T(), "Analysis failed due to invalid input", response.Error)
	assert.Equal(suite.T(), 50*time.Millisecond, response.Duration)
}

func (suite *ModelsTestSuite) TestAnalysisResponse_JSONSerialization() {
	original := &models.AnalysisResponse{
		ID: "json-test-789",
		Result: &models.AnomalyResult{
			Score:       0.65,
			Confidence:  0.75,
			IsAnomalous: false,
			Timestamp:   time.Now().UTC(),
		},
		Duration: 180 * time.Millisecond,
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(original)
	require.NoError(suite.T(), err)

	// Deserialize from JSON
	var deserialized models.AnalysisResponse
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), original.ID, deserialized.ID)
	assert.Equal(suite.T(), original.Duration, deserialized.Duration)
	assert.Equal(suite.T(), original.Result.Score, deserialized.Result.Score)
	assert.Equal(suite.T(), original.Result.Confidence, deserialized.Result.Confidence)
	assert.Equal(suite.T(), original.Result.IsAnomalous, deserialized.Result.IsAnomalous)
}

func (suite *ModelsTestSuite) TestTextSample_Creation() {
	timestamp := time.Now()
	sample := &models.TextSample{
		ID:     "sample-123",
		Text:   "This is a sample text for testing",
		Label:  "human",
		Source: "test-dataset",
		Metadata: map[string]string{
			"author":     "test-user",
			"difficulty": "easy",
		},
		CreatedAt: timestamp,
		UpdatedAt: timestamp,
	}

	assert.Equal(suite.T(), "sample-123", sample.ID)
	assert.Equal(suite.T(), "This is a sample text for testing", sample.Text)
	assert.Equal(suite.T(), "human", sample.Label)
	assert.Equal(suite.T(), "test-dataset", sample.Source)
	assert.Equal(suite.T(), "test-user", sample.Metadata["author"])
	assert.Equal(suite.T(), timestamp, sample.CreatedAt)
	assert.Equal(suite.T(), timestamp, sample.UpdatedAt)
}

func (suite *ModelsTestSuite) TestTextSample_Labels() {
	validLabels := []string{"human", "ai", "unknown"}

	for _, label := range validLabels {
		sample := &models.TextSample{
			ID:    "test-" + label,
			Text:  "Test text",
			Label: label,
		}

		assert.Equal(suite.T(), label, sample.Label)
		assert.Contains(suite.T(), validLabels, sample.Label)
	}
}

func (suite *ModelsTestSuite) TestModelMetrics_Creation() {
	metrics := &models.ModelMetrics{
		Accuracy:    0.92,
		Precision:   0.89,
		Recall:      0.94,
		F1Score:     0.915,
		AUC:         0.96,
		SampleCount: 1000,
		LastUpdated: time.Now(),
	}

	assert.Equal(suite.T(), 0.92, metrics.Accuracy)
	assert.Equal(suite.T(), 0.89, metrics.Precision)
	assert.Equal(suite.T(), 0.94, metrics.Recall)
	assert.Equal(suite.T(), 0.915, metrics.F1Score)
	assert.Equal(suite.T(), 0.96, metrics.AUC)
	assert.Equal(suite.T(), 1000, metrics.SampleCount)
}

func (suite *ModelsTestSuite) TestModelMetrics_Validation() {
	metrics := &models.ModelMetrics{
		Accuracy:    0.95,
		Precision:   0.93,
		Recall:      0.97,
		F1Score:     0.95,
		AUC:         0.98,
		SampleCount: 500,
		LastUpdated: time.Now(),
	}

	// All metrics should be between 0 and 1
	assert.GreaterOrEqual(suite.T(), metrics.Accuracy, 0.0)
	assert.LessOrEqual(suite.T(), metrics.Accuracy, 1.0)
	assert.GreaterOrEqual(suite.T(), metrics.Precision, 0.0)
	assert.LessOrEqual(suite.T(), metrics.Precision, 1.0)
	assert.GreaterOrEqual(suite.T(), metrics.Recall, 0.0)
	assert.LessOrEqual(suite.T(), metrics.Recall, 1.0)
	assert.GreaterOrEqual(suite.T(), metrics.F1Score, 0.0)
	assert.LessOrEqual(suite.T(), metrics.F1Score, 1.0)
	assert.GreaterOrEqual(suite.T(), metrics.AUC, 0.0)
	assert.LessOrEqual(suite.T(), metrics.AUC, 1.0)

	// Sample count should be non-negative
	assert.GreaterOrEqual(suite.T(), metrics.SampleCount, 0)
}

func (suite *ModelsTestSuite) TestModelMetrics_JSONSerialization() {
	timestamp := time.Now().UTC()
	original := &models.ModelMetrics{
		Accuracy:    0.88,
		Precision:   0.85,
		Recall:      0.91,
		F1Score:     0.88,
		AUC:         0.93,
		SampleCount: 750,
		LastUpdated: timestamp,
	}

	// Serialize to JSON
	jsonData, err := json.Marshal(original)
	require.NoError(suite.T(), err)

	// Deserialize from JSON
	var deserialized models.ModelMetrics
	err = json.Unmarshal(jsonData, &deserialized)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), original.Accuracy, deserialized.Accuracy)
	assert.Equal(suite.T(), original.Precision, deserialized.Precision)
	assert.Equal(suite.T(), original.Recall, deserialized.Recall)
	assert.Equal(suite.T(), original.F1Score, deserialized.F1Score)
	assert.Equal(suite.T(), original.AUC, deserialized.AUC)
	assert.Equal(suite.T(), original.SampleCount, deserialized.SampleCount)
	assert.WithinDuration(suite.T(), original.LastUpdated, deserialized.LastUpdated, time.Second)
}

func TestModelsTestSuite(t *testing.T) {
	suite.Run(t, new(ModelsTestSuite))
}

// Test edge cases and boundary conditions
func TestModels_EdgeCases(t *testing.T) {
	t.Run("zero_values", func(t *testing.T) {
		result := &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}

		assert.Equal(t, 0.0, result.Score)
		assert.Equal(t, 0.0, result.Confidence)
		assert.NotNil(t, result.Metadata)
	})

	t.Run("maximum_values", func(t *testing.T) {
		result := &models.AnalysisResult{
			Score:      1.0,
			Confidence: 1.0,
			Metadata:   map[string]interface{}{},
		}

		assert.Equal(t, 1.0, result.Score)
		assert.Equal(t, 1.0, result.Confidence)
	})

	t.Run("nil_metadata", func(t *testing.T) {
		result := &models.AnalysisResult{
			Score:      0.5,
			Confidence: 0.5,
			Metadata:   nil,
		}

		// Should handle nil metadata gracefully
		jsonData, err := json.Marshal(result)
		require.NoError(t, err)

		var deserialized models.AnalysisResult
		err = json.Unmarshal(jsonData, &deserialized)
		require.NoError(t, err)

		assert.Equal(t, result.Score, deserialized.Score)
		assert.Equal(t, result.Confidence, deserialized.Confidence)
	})

	t.Run("empty_strings", func(t *testing.T) {
		sample := &models.TextSample{
			ID:     "",
			Text:   "",
			Label:  "",
			Source: "",
		}

		// Should handle empty strings
		jsonData, err := json.Marshal(sample)
		require.NoError(t, err)

		var deserialized models.TextSample
		err = json.Unmarshal(jsonData, &deserialized)
		require.NoError(t, err)

		assert.Equal(t, sample.ID, deserialized.ID)
		assert.Equal(t, sample.Text, deserialized.Text)
		assert.Equal(t, sample.Label, deserialized.Label)
		assert.Equal(t, sample.Source, deserialized.Source)
	})

	t.Run("large_metadata", func(t *testing.T) {
		// Test with large metadata object
		largeMetadata := make(map[string]interface{})
		for i := 0; i < 1000; i++ {
			largeMetadata[fmt.Sprintf("key_%d", i)] = fmt.Sprintf("value_%d", i)
		}

		result := &models.AnalysisResult{
			Score:      0.5,
			Confidence: 0.5,
			Metadata:   largeMetadata,
		}

		jsonData, err := json.Marshal(result)
		require.NoError(t, err)

		var deserialized models.AnalysisResult
		err = json.Unmarshal(jsonData, &deserialized)
		require.NoError(t, err)

		assert.Equal(t, result.Score, deserialized.Score)
		assert.Equal(t, result.Confidence, deserialized.Confidence)
		assert.Len(t, deserialized.Metadata, 1000)
	})
}

// Test data integrity and constraints
func TestModels_DataIntegrity(t *testing.T) {
	t.Run("score_bounds", func(t *testing.T) {
		// Scores should typically be between 0 and 1
		validScores := []float64{0.0, 0.5, 1.0, 0.123, 0.999}
		for _, score := range validScores {
			result := &models.AnalysisResult{Score: score, Confidence: 0.5}
			assert.GreaterOrEqual(t, result.Score, 0.0)
			assert.LessOrEqual(t, result.Score, 1.0)
		}
	})

	t.Run("confidence_bounds", func(t *testing.T) {
		// Confidence should be between 0 and 1
		validConfidences := []float64{0.0, 0.25, 0.5, 0.75, 1.0}
		for _, confidence := range validConfidences {
			result := &models.AnalysisResult{Score: 0.5, Confidence: confidence}
			assert.GreaterOrEqual(t, result.Confidence, 0.0)
			assert.LessOrEqual(t, result.Confidence, 1.0)
		}
	})

	t.Run("timestamp_consistency", func(t *testing.T) {
		now := time.Now()
		sample := &models.TextSample{
			CreatedAt: now,
			UpdatedAt: now.Add(time.Hour),
		}

		// UpdatedAt should be after or equal to CreatedAt
		assert.True(t, sample.UpdatedAt.After(sample.CreatedAt) || sample.UpdatedAt.Equal(sample.CreatedAt))
	})

	t.Run("model_metrics_relationships", func(t *testing.T) {
		metrics := &models.ModelMetrics{
			Precision: 0.8,
			Recall:    0.9,
		}

		// F1 score should be harmonic mean of precision and recall
		expectedF1 := 2 * (metrics.Precision * metrics.Recall) / (metrics.Precision + metrics.Recall)
		metrics.F1Score = expectedF1

		assert.InDelta(t, expectedF1, metrics.F1Score, 0.001)
	})
}

// Benchmark tests for serialization performance
func BenchmarkAnalysisResult_JSONMarshal(b *testing.B) {
	result := &models.AnalysisResult{
		Score:      0.75,
		Confidence: 0.88,
		Metadata: map[string]interface{}{
			"entropy":    4.2,
			"word_count": 150,
			"char_count": 750,
			"complexity": 0.65,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := json.Marshal(result)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAnomalyResult_JSONMarshal(b *testing.B) {
	result := &models.AnomalyResult{
		Score:       0.72,
		Confidence:  0.86,
		IsAnomalous: true,
		Details: map[string]*models.AnalysisResult{
			"entropy":    {Score: 0.65, Confidence: 0.8},
			"linguistic": {Score: 0.79, Confidence: 0.92},
		},
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := json.Marshal(result)
		if err != nil {
			b.Fatal(err)
		}
	}
}
