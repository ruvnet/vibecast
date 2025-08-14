package tests

import (
	"context"
	"testing"

	"github.com/ruvnet/alienator/internal/analyzers/compression"
	"github.com/ruvnet/alienator/internal/analyzers/cryptographic"
	"github.com/ruvnet/alienator/internal/analyzers/embedding"
	"github.com/ruvnet/alienator/internal/analyzers/entropy"
	"github.com/ruvnet/alienator/internal/analyzers/linguistic"
	"github.com/ruvnet/alienator/internal/models"
)

func TestEntropyAnalyzer(t *testing.T) {
	analyzer := entropy.NewEntropyAnalyzer()

	testText := "This is a sample text for testing the entropy analyzer functionality."
	result, err := analyzer.Analyze(context.Background(), testText)

	if err != nil {
		t.Errorf("Entropy analysis failed: %v", err)
	}

	if result.Score < 0 || result.Score > 1 {
		t.Errorf("Invalid score range: %f", result.Score)
	}

	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("Invalid confidence range: %f", result.Confidence)
	}

	t.Logf("Entropy Analyzer - Score: %f, Confidence: %f", result.Score, result.Confidence)
}

func TestCompressionAnalyzer(t *testing.T) {
	analyzer := compression.NewCompressionAnalyzer()

	testText := "This is a sample text for testing the compression analyzer with repeated patterns. " +
		"This is a sample text for testing the compression analyzer with repeated patterns."

	result, err := analyzer.Analyze(context.Background(), testText)

	if err != nil {
		t.Errorf("Compression analysis failed: %v", err)
	}

	if result.Score < 0 || result.Score > 1 {
		t.Errorf("Invalid score range: %f", result.Score)
	}

	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("Invalid confidence range: %f", result.Confidence)
	}

	t.Logf("Compression Analyzer - Score: %f, Confidence: %f", result.Score, result.Confidence)
}

func TestLinguisticAnalyzer(t *testing.T) {
	analyzer := linguistic.NewLinguisticAnalyzer()

	testText := "As an AI language model, I cannot provide personal opinions. However, it is important to note that " +
		"natural language processing involves complex algorithms. Furthermore, statistical analysis reveals " +
		"interesting patterns in text generation."

	result, err := analyzer.Analyze(context.Background(), testText)

	if err != nil {
		t.Errorf("Linguistic analysis failed: %v", err)
	}

	if result.Score < 0 || result.Score > 1 {
		t.Errorf("Invalid score range: %f", result.Score)
	}

	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("Invalid confidence range: %f", result.Confidence)
	}

	t.Logf("Linguistic Analyzer - Score: %f, Confidence: %f", result.Score, result.Confidence)
}

func TestEmbeddingAnalyzer(t *testing.T) {
	analyzer := embedding.NewEmbeddingAnalyzer()

	testText := "Machine learning algorithms process large datasets to identify patterns. " +
		"Neural networks utilize backpropagation for training optimization. " +
		"Deep learning models require substantial computational resources. " +
		"Artificial intelligence systems demonstrate remarkable capabilities."

	result, err := analyzer.Analyze(context.Background(), testText)

	if err != nil {
		t.Errorf("Embedding analysis failed: %v", err)
	}

	if result.Score < 0 || result.Score > 1 {
		t.Errorf("Invalid score range: %f", result.Score)
	}

	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("Invalid confidence range: %f", result.Confidence)
	}

	t.Logf("Embedding Analyzer - Score: %f, Confidence: %f", result.Score, result.Confidence)
}

func TestCryptographicAnalyzer(t *testing.T) {
	analyzer := cryptographic.NewCryptographicAnalyzer()

	testText := "Hash values: 5d41402abc4b2a76b9719d911017c592 and " +
		"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3 " +
		"Base64: SGVsbG8gV29ybGQ= " +
		"Another hash: 2cf24dba4f21d4288094c254b2e4e0e4e4b2e2b2b2b2b2b2b2b2b2b2b2b2b2"

	result, err := analyzer.Analyze(context.Background(), testText)

	if err != nil {
		t.Errorf("Cryptographic analysis failed: %v", err)
	}

	if result.Score < 0 || result.Score > 1 {
		t.Errorf("Invalid score range: %f", result.Score)
	}

	if result.Confidence < 0 || result.Confidence > 1 {
		t.Errorf("Invalid confidence range: %f", result.Confidence)
	}

	t.Logf("Cryptographic Analyzer - Score: %f, Confidence: %f", result.Score, result.Confidence)
}

func TestAnalyzersWithEmptyInput(t *testing.T) {
	analyzers := []struct {
		name     string
		analyzer interface {
			Analyze(ctx context.Context, text string) (*models.AnalysisResult, error)
		}
	}{
		{"entropy", entropy.NewEntropyAnalyzer()},
		{"compression", compression.NewCompressionAnalyzer()},
		{"linguistic", linguistic.NewLinguisticAnalyzer()},
		{"embedding", embedding.NewEmbeddingAnalyzer()},
		{"cryptographic", cryptographic.NewCryptographicAnalyzer()},
	}

	for _, tc := range analyzers {
		t.Run(tc.name, func(t *testing.T) {
			result, err := tc.analyzer.Analyze(context.Background(), "")
			if err != nil {
				t.Errorf("Analysis failed with empty input: %v", err)
			}
			if result.Score != 0.0 || result.Confidence != 0.0 {
				t.Errorf("Expected zero scores for empty input, got Score: %f, Confidence: %f",
					result.Score, result.Confidence)
			}
		})
	}
}
