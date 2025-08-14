package unit

import (
	"context"
	"math"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/ruvnet/alienator/internal/analyzers/entropy"
)

// EntropyAnalyzerTestSuite provides comprehensive test coverage for EntropyAnalyzer
type EntropyAnalyzerTestSuite struct {
	suite.Suite
	analyzer *entropy.EntropyAnalyzer
}

func (suite *EntropyAnalyzerTestSuite) SetupTest() {
	suite.analyzer = entropy.NewEntropyAnalyzer()
}

func (suite *EntropyAnalyzerTestSuite) TestNewEntropyAnalyzer() {
	analyzer := entropy.NewEntropyAnalyzer()

	assert.NotNil(suite.T(), analyzer)
	assert.Equal(suite.T(), "entropy", analyzer.Name())
}

func (suite *EntropyAnalyzerTestSuite) TestName() {
	assert.Equal(suite.T(), "entropy", suite.analyzer.Name())
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_EmptyText() {
	result, err := suite.analyzer.Analyze(context.Background(), "")

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 0.0, result.Score)
	assert.Equal(suite.T(), 0.0, result.Confidence)
	assert.NotNil(suite.T(), result.Metadata)
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_SimpleText() {
	text := "This is a simple test text."

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.GreaterOrEqual(suite.T(), result.Score, 0.0)
	assert.LessOrEqual(suite.T(), result.Score, 1.0)
	assert.GreaterOrEqual(suite.T(), result.Confidence, 0.0)
	assert.LessOrEqual(suite.T(), result.Confidence, 1.0)

	// Check metadata presence
	metadata := result.Metadata
	assert.Contains(suite.T(), metadata, "shannon_entropy")
	assert.Contains(suite.T(), metadata, "word_entropy")
	assert.Contains(suite.T(), metadata, "line_entropy")
	assert.Contains(suite.T(), metadata, "chi_square_statistic")
	assert.Contains(suite.T(), metadata, "chi_square_p_value")
	assert.Contains(suite.T(), metadata, "runs_test_statistic")
	assert.Contains(suite.T(), metadata, "runs_test_p_value")
	assert.Contains(suite.T(), metadata, "baseline_deviation")
	assert.Contains(suite.T(), metadata, "kolmogorov_complexity")
	assert.Contains(suite.T(), metadata, "english_entropy")
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_HighEntropyText() {
	// Random-like text with high entropy
	text := "qjxz vbkl mnpw ghty rfed zcxv bnjm kqwp ltyg hfed"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	shannonEntropy := result.Metadata["shannon_entropy"].(float64)
	assert.Greater(suite.T(), shannonEntropy, 3.0, "High entropy text should have Shannon entropy > 3.0")
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_LowEntropyText() {
	// Repetitive text with low entropy
	text := "aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	shannonEntropy := result.Metadata["shannon_entropy"].(float64)
	assert.Less(suite.T(), shannonEntropy, 3.0, "Low entropy text should have Shannon entropy < 3.0")

	// Low entropy should result in higher anomaly score
	assert.Greater(suite.T(), result.Score, 0.5, "Low entropy should indicate potential AI generation")
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_EnglishText() {
	// Typical English text
	text := "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet at least once."

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	baselineDeviation := result.Metadata["baseline_deviation"].(float64)
	assert.Less(suite.T(), baselineDeviation, 0.5, "English text should have low baseline deviation")
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_NonEnglishText() {
	// Non-English character distribution
	text := "zzzzz qqqqq xxxxx jjjjj zzzzz qqqqq xxxxx jjjjj"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	chiSquarePValue := result.Metadata["chi_square_p_value"].(float64)
	assert.Less(suite.T(), chiSquarePValue, 0.05, "Non-English distribution should have low chi-square p-value")
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_UnicodeText() {
	// Unicode text with various characters
	text := "こんにちは世界 🌍 émojis and spëcial chars: αβγδε ñáéíóú"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.GreaterOrEqual(suite.T(), result.Score, 0.0)
	assert.LessOrEqual(suite.T(), result.Score, 1.0)
}

func (suite *EntropyAnalyzerTestSuite) TestAnalyze_MultilineText() {
	text := `This is line one.
This is line two.
This is line three.
This is line four.`

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	lineEntropy := result.Metadata["line_entropy"].(float64)
	assert.Greater(suite.T(), lineEntropy, 0.0, "Multiline text should have line entropy > 0")
}

func (suite *EntropyAnalyzerTestSuite) TestCalculateShannonEntropy_Uniform() {
	// Text with uniform character distribution
	text := "abcdefghijklmnopqrstuvwxyz"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	shannonEntropy := result.Metadata["shannon_entropy"].(float64)

	// Uniform distribution should have high entropy (close to log2(26) ≈ 4.7)
	assert.Greater(suite.T(), shannonEntropy, 4.0)
}

func (suite *EntropyAnalyzerTestSuite) TestCalculateShannonEntropy_SingleChar() {
	text := "aaaaaaaaaa"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	shannonEntropy := result.Metadata["shannon_entropy"].(float64)

	// Single character should have entropy = 0
	assert.Equal(suite.T(), 0.0, shannonEntropy)
}

func (suite *EntropyAnalyzerTestSuite) TestWordEntropy() {
	// Text with repeated words
	text := "hello world hello world hello world"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)
	wordEntropy := result.Metadata["word_entropy"].(float64)

	// Should have entropy = 1 (two equally likely words)
	assert.InDelta(suite.T(), 1.0, wordEntropy, 0.01)
}

func (suite *EntropyAnalyzerTestSuite) TestChiSquareTest() {
	// Text that deviates significantly from English
	text := strings.Repeat("z", 1000)

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)

	chiSquare := result.Metadata["chi_square_statistic"].(float64)
	chiSquarePValue := result.Metadata["chi_square_p_value"].(float64)

	assert.Greater(suite.T(), chiSquare, 0.0)
	assert.GreaterOrEqual(suite.T(), chiSquarePValue, 0.0)
	assert.LessOrEqual(suite.T(), chiSquarePValue, 1.0)

	// Text with only 'z' should have very low p-value
	assert.Less(suite.T(), chiSquarePValue, 0.01)
}

func (suite *EntropyAnalyzerTestSuite) TestRunsTest() {
	// Alternating pattern
	text := "aeaeaeaeaeaeaeaeae"

	result, err := suite.analyzer.Analyze(context.Background(), text)

	require.NoError(suite.T(), err)

	runsTestStat := result.Metadata["runs_test_statistic"].(float64)
	runsTestPValue := result.Metadata["runs_test_p_value"].(float64)

	assert.NotEqual(suite.T(), 0.0, runsTestStat)
	assert.GreaterOrEqual(suite.T(), runsTestPValue, 0.0)
	assert.LessOrEqual(suite.T(), runsTestPValue, 1.0)
}

func (suite *EntropyAnalyzerTestSuite) TestKolmogorovComplexity() {
	// Highly repetitive text (low complexity)
	simpleText := strings.Repeat("abc", 100)

	result1, err := suite.analyzer.Analyze(context.Background(), simpleText)
	require.NoError(suite.T(), err)

	// Random-like text (high complexity)
	complexText := "qwertyuiopasdfghjklzxcvbnm1234567890"

	result2, err := suite.analyzer.Analyze(context.Background(), complexText)
	require.NoError(suite.T(), err)

	complexity1 := result1.Metadata["kolmogorov_complexity"].(float64)
	complexity2 := result2.Metadata["kolmogorov_complexity"].(float64)

	// Repetitive text should have lower complexity
	assert.Less(suite.T(), complexity1, complexity2)
}

func (suite *EntropyAnalyzerTestSuite) TestConfidenceCalculation() {
	// Short text should have lower confidence
	shortText := "hi"
	result1, err := suite.analyzer.Analyze(context.Background(), shortText)
	require.NoError(suite.T(), err)

	// Long text should have higher confidence
	longText := strings.Repeat("This is a longer text for testing confidence calculation. ", 10)
	result2, err := suite.analyzer.Analyze(context.Background(), longText)
	require.NoError(suite.T(), err)

	assert.Less(suite.T(), result1.Confidence, result2.Confidence)
}

func TestEntropyAnalyzerTestSuite(t *testing.T) {
	suite.Run(t, new(EntropyAnalyzerTestSuite))
}

// Benchmark tests for entropy analyzer performance
func BenchmarkEntropyAnalyzer_Analyze_Short(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	text := "This is a short test text."

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := analyzer.Analyze(context.Background(), text)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkEntropyAnalyzer_Analyze_Medium(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	text := strings.Repeat("This is a medium length test text for benchmarking purposes. ", 50)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := analyzer.Analyze(context.Background(), text)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkEntropyAnalyzer_Analyze_Long(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	text := strings.Repeat("This is a very long test text for benchmarking the entropy analyzer performance with large inputs. ", 1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := analyzer.Analyze(context.Background(), text)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkEntropyAnalyzer_ShannonEntropy(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	text := "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet."

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Direct test of Shannon entropy calculation would require exposing the method
		// For now, we benchmark the full analysis
		_, err := analyzer.Analyze(context.Background(), text)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Edge case tests
func TestEntropyAnalyzer_EdgeCases(t *testing.T) {
	analyzer := entropy.NewEntropyAnalyzer()

	testCases := []struct {
		name string
		text string
	}{
		{"empty_string", ""},
		{"single_char", "a"},
		{"whitespace_only", "   \t\n   "},
		{"numbers_only", "1234567890"},
		{"punctuation_only", "!@#$%^&*()"},
		{"mixed_case", "AaAaAaAa"},
		{"very_long_single_word", strings.Repeat("a", 10000)},
		{"unicode_emoji", "😀😃😄😁😆😅😂🤣"},
		{"mixed_scripts", "Hello مرحبا こんにちは 你好"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := analyzer.Analyze(context.Background(), tc.text)

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.GreaterOrEqual(t, result.Score, 0.0)
			assert.LessOrEqual(t, result.Score, 1.0)
			assert.GreaterOrEqual(t, result.Confidence, 0.0)
			assert.LessOrEqual(t, result.Confidence, 1.0)
			assert.NotNil(t, result.Metadata)
		})
	}
}

// Test mathematical properties
func TestEntropyAnalyzer_MathematicalProperties(t *testing.T) {
	analyzer := entropy.NewEntropyAnalyzer()

	t.Run("entropy_monotonicity", func(t *testing.T) {
		// More varied character distribution should generally have higher entropy
		lowVariety := "aaaaabbbbbccccc"
		highVariety := "abcdefghijklmno"

		result1, err := analyzer.Analyze(context.Background(), lowVariety)
		require.NoError(t, err)

		result2, err := analyzer.Analyze(context.Background(), highVariety)
		require.NoError(t, err)

		entropy1 := result1.Metadata["shannon_entropy"].(float64)
		entropy2 := result2.Metadata["shannon_entropy"].(float64)

		assert.Less(t, entropy1, entropy2, "Higher character variety should have higher entropy")
	})

	t.Run("entropy_bounds", func(t *testing.T) {
		// Test entropy bounds for known cases
		singleChar := "aaaaa"
		result, err := analyzer.Analyze(context.Background(), singleChar)
		require.NoError(t, err)

		entropy := result.Metadata["shannon_entropy"].(float64)
		assert.Equal(t, 0.0, entropy, "Single character should have zero entropy")
	})

	t.Run("chi_square_properties", func(t *testing.T) {
		// Chi-square statistic should be non-negative
		text := "This is a test of chi-square properties"
		result, err := analyzer.Analyze(context.Background(), text)
		require.NoError(t, err)

		chiSquare := result.Metadata["chi_square_statistic"].(float64)
		assert.GreaterOrEqual(t, chiSquare, 0.0, "Chi-square statistic should be non-negative")
	})

	t.Run("probability_bounds", func(t *testing.T) {
		// P-values should be between 0 and 1
		text := "Testing probability bounds for statistical tests"
		result, err := analyzer.Analyze(context.Background(), text)
		require.NoError(t, err)

		chiSquarePValue := result.Metadata["chi_square_p_value"].(float64)
		runsTestPValue := result.Metadata["runs_test_p_value"].(float64)

		assert.GreaterOrEqual(t, chiSquarePValue, 0.0)
		assert.LessOrEqual(t, chiSquarePValue, 1.0)
		assert.GreaterOrEqual(t, runsTestPValue, 0.0)
		assert.LessOrEqual(t, runsTestPValue, 1.0)
	})
}

// Test statistical significance
func TestEntropyAnalyzer_StatisticalSignificance(t *testing.T) {
	analyzer := entropy.NewEntropyAnalyzer()

	// Generate texts with known statistical properties
	t.Run("uniform_distribution", func(t *testing.T) {
		// Create text with approximately uniform character distribution
		chars := "abcdefghijklmnopqrstuvwxyz"
		text := ""
		for i := 0; i < 1000; i++ {
			text += string(chars[i%26])
		}

		result, err := analyzer.Analyze(context.Background(), text)
		require.NoError(t, err)

		chiSquarePValue := result.Metadata["chi_square_p_value"].(float64)
		// Uniform distribution should not be significantly different from English
		// (though this is a rough approximation)
		assert.Greater(t, chiSquarePValue, 0.01, "Uniform distribution should have reasonable p-value")
	})

	t.Run("highly_skewed_distribution", func(t *testing.T) {
		// Text heavily skewed towards one character
		text := strings.Repeat("z", 950) + strings.Repeat("a", 50)

		result, err := analyzer.Analyze(context.Background(), text)
		require.NoError(t, err)

		chiSquarePValue := result.Metadata["chi_square_p_value"].(float64)
		// Highly skewed distribution should be significantly different
		assert.Less(t, chiSquarePValue, 0.05, "Highly skewed distribution should have low p-value")
	})
}
