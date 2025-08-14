package entropy

import (
	"context"
	"math"
	"strings"
	"unicode"

	"github.com/ruvnet/alienator/internal/models"
)

// EntropyAnalyzer analyzes text entropy patterns
type EntropyAnalyzer struct {
	name string
	// English language baseline statistics
	englishCharFreq map[rune]float64
	englishEntropy  float64
	// Analysis thresholds
	lowEntropyThreshold  float64
	highEntropyThreshold float64
	chiSquareThreshold   float64
	runsTestThreshold    float64
}

// NewEntropyAnalyzer creates a new entropy analyzer
func NewEntropyAnalyzer() *EntropyAnalyzer {
	// English letter frequencies (approximate)
	englishFreq := map[rune]float64{
		'a': 0.0817, 'b': 0.0150, 'c': 0.0278, 'd': 0.0425, 'e': 0.1202, 'f': 0.0223,
		'g': 0.0202, 'h': 0.0609, 'i': 0.0697, 'j': 0.0015, 'k': 0.0077, 'l': 0.0403,
		'm': 0.0241, 'n': 0.0675, 'o': 0.0751, 'p': 0.0193, 'q': 0.0010, 'r': 0.0599,
		's': 0.0633, 't': 0.0906, 'u': 0.0276, 'v': 0.0098, 'w': 0.0236, 'x': 0.0015,
		'y': 0.0197, 'z': 0.0007, ' ': 0.1918,
	}

	// Calculate English entropy baseline
	englishEntropy := 0.0
	for _, freq := range englishFreq {
		if freq > 0 {
			englishEntropy -= freq * math.Log2(freq)
		}
	}

	return &EntropyAnalyzer{
		name:                 "entropy",
		englishCharFreq:      englishFreq,
		englishEntropy:       englishEntropy,
		lowEntropyThreshold:  3.0,
		highEntropyThreshold: 7.0,
		chiSquareThreshold:   0.05,
		runsTestThreshold:    0.05,
	}
}

// Name returns the analyzer name
func (ea *EntropyAnalyzer) Name() string {
	return ea.name
}

// Analyze performs entropy analysis on the text
func (ea *EntropyAnalyzer) Analyze(ctx context.Context, text string) (*models.AnalysisResult, error) {
	if len(text) == 0 {
		return &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil
	}

	// Calculate Shannon entropy
	charEntropy := ea.calculateShannonEntropy(text)
	wordEntropy := ea.calculateWordEntropy(text)
	lineEntropy := ea.calculateLineEntropy(text)

	// Chi-square test for character distribution
	chiSquare, chiSquarePValue := ea.chiSquareTest(text)

	// Runs test for randomness
	runsTest, runsTestPValue := ea.runsTest(text)

	// Baseline comparison against English
	baselineDeviation := ea.compareToEnglishBaseline(text)

	// Kolmogorov complexity estimation via compression
	kolmogorovComplexity := ea.estimateKolmogorovComplexity(text)

	// Combine measures into anomaly score
	score := ea.calculateAnomalyScore(charEntropy, wordEntropy, chiSquarePValue,
		runsTestPValue, baselineDeviation, kolmogorovComplexity)

	// Calculate confidence
	confidence := ea.calculateAdvancedConfidence(text, charEntropy, chiSquarePValue, runsTestPValue)

	return &models.AnalysisResult{
		Score:      score,
		Confidence: confidence,
		Metadata: map[string]interface{}{
			"shannon_entropy":       charEntropy,
			"word_entropy":          wordEntropy,
			"line_entropy":          lineEntropy,
			"chi_square_statistic":  chiSquare,
			"chi_square_p_value":    chiSquarePValue,
			"runs_test_statistic":   runsTest,
			"runs_test_p_value":     runsTestPValue,
			"baseline_deviation":    baselineDeviation,
			"kolmogorov_complexity": kolmogorovComplexity,
			"english_entropy":       ea.englishEntropy,
		},
	}, nil
}

// calculateShannonEntropy calculates Shannon entropy for characters
func (ea *EntropyAnalyzer) calculateShannonEntropy(text string) float64 {
	if len(text) == 0 {
		return 0
	}

	frequency := make(map[rune]int)
	total := 0

	for _, char := range text {
		if unicode.IsLetter(char) || unicode.IsDigit(char) || unicode.IsSpace(char) {
			frequency[unicode.ToLower(char)]++
			total++
		}
	}

	if total == 0 {
		return 0
	}

	entropy := 0.0
	for _, count := range frequency {
		if count > 0 {
			p := float64(count) / float64(total)
			entropy -= p * math.Log2(p)
		}
	}

	return entropy
}

// calculateWordEntropy calculates Shannon entropy for words
func (ea *EntropyAnalyzer) calculateWordEntropy(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) == 0 {
		return 0
	}

	frequency := make(map[string]int)
	for _, word := range words {
		// Clean word of punctuation
		cleanWord := strings.Trim(word, ".,!?;:\"'()[]{}...")
		if len(cleanWord) > 0 {
			frequency[cleanWord]++
		}
	}

	total := len(words)
	entropy := 0.0

	for _, count := range frequency {
		if count > 0 {
			p := float64(count) / float64(total)
			entropy -= p * math.Log2(p)
		}
	}

	return entropy
}

// calculateLineEntropy calculates entropy across lines
func (ea *EntropyAnalyzer) calculateLineEntropy(text string) float64 {
	lines := strings.Split(text, "\n")
	if len(lines) <= 1 {
		return 0
	}

	// Calculate length distribution
	lengthFreq := make(map[int]int)
	for _, line := range lines {
		length := len(strings.TrimSpace(line))
		lengthFreq[length]++
	}

	total := len(lines)
	entropy := 0.0

	for _, count := range lengthFreq {
		if count > 0 {
			p := float64(count) / float64(total)
			entropy -= p * math.Log2(p)
		}
	}

	return entropy
}

// normalizeEntropyToScore converts entropy to anomaly score
func (ea *EntropyAnalyzer) normalizeEntropyToScore(entropy float64) float64 {
	// AI text typically has lower entropy than human text
	// Higher entropy (more random) = lower anomaly score
	// Lower entropy (more predictable) = higher anomaly score

	// Assume typical entropy ranges from 3-8 bits
	// Normalize and invert
	normalizedEntropy := entropy / 8.0
	if normalizedEntropy > 1.0 {
		normalizedEntropy = 1.0
	}

	// Invert: low entropy = high anomaly score
	return 1.0 - normalizedEntropy
}

// calculateConfidence determines confidence in the entropy analysis
func (ea *EntropyAnalyzer) calculateConfidence(text string, charEntropy, wordEntropy, lineEntropy float64) float64 {
	textLength := len(text)
	wordCount := len(strings.Fields(text))

	// Base confidence on text length
	lengthConfidence := math.Min(1.0, float64(textLength)/1000.0)

	// Adjust for word count
	wordConfidence := math.Min(1.0, float64(wordCount)/100.0)

	// Check consistency between entropy measures
	entropyVariance := ea.calculateVariance([]float64{charEntropy, wordEntropy, lineEntropy})
	consistencyConfidence := 1.0 / (1.0 + entropyVariance)

	// Combine confidences
	return (lengthConfidence*0.4 + wordConfidence*0.3 + consistencyConfidence*0.3)
}

// calculateVariance calculates variance of a slice of float64 values
func (ea *EntropyAnalyzer) calculateVariance(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	mean := 0.0
	for _, v := range values {
		mean += v
	}
	mean /= float64(len(values))

	variance := 0.0
	for _, v := range values {
		diff := v - mean
		variance += diff * diff
	}

	return variance / float64(len(values))
}

// chiSquareTest performs chi-square test for character distribution
func (ea *EntropyAnalyzer) chiSquareTest(text string) (float64, float64) {
	if len(text) == 0 {
		return 0, 1.0
	}

	observed := make(map[rune]int)
	total := 0

	for _, char := range text {
		if unicode.IsLetter(char) || char == ' ' {
			char = unicode.ToLower(char)
			observed[char]++
			total++
		}
	}

	if total == 0 {
		return 0, 1.0
	}

	// Calculate chi-square statistic
	chiSquare := 0.0
	for char, expectedFreq := range ea.englishCharFreq {
		expectedCount := expectedFreq * float64(total)
		actualCount := float64(observed[char])

		if expectedCount > 0 {
			diff := actualCount - expectedCount
			chiSquare += (diff * diff) / expectedCount
		}
	}

	// Simple p-value approximation (degrees of freedom = 26 for English letters)
	// This is a rough approximation - in practice, use proper statistical library
	degreesOfFreedom := 26.0
	pValue := ea.approximateChiSquarePValue(chiSquare, degreesOfFreedom)

	return chiSquare, pValue
}

// approximateChiSquarePValue provides rough chi-square p-value approximation
func (ea *EntropyAnalyzer) approximateChiSquarePValue(chiSquare, df float64) float64 {
	// Very rough approximation using normal distribution for large df
	// In practice, use proper gamma function or lookup table
	if chiSquare <= df {
		return 0.5 + (df-chiSquare)/(2*df)
	}
	return math.Max(0.0, 0.5-math.Min(0.5, (chiSquare-df)/(4*df)))
}

// runsTest performs runs test for randomness
func (ea *EntropyAnalyzer) runsTest(text string) (float64, float64) {
	if len(text) < 10 {
		return 0, 1.0
	}

	// Convert text to binary sequence (vowel/consonant)
	binary := make([]bool, 0, len(text))
	vowels := map[rune]bool{'a': true, 'e': true, 'i': true, 'o': true, 'u': true}

	for _, char := range text {
		if unicode.IsLetter(char) {
			char = unicode.ToLower(char)
			binary = append(binary, vowels[char])
		}
	}

	if len(binary) < 10 {
		return 0, 1.0
	}

	// Count runs
	runs := 1
	for i := 1; i < len(binary); i++ {
		if binary[i] != binary[i-1] {
			runs++
		}
	}

	// Count ones and zeros
	ones := 0
	for _, b := range binary {
		if b {
			ones++
		}
	}
	zeros := len(binary) - ones

	if ones == 0 || zeros == 0 {
		return 0, 1.0
	}

	// Expected number of runs
	n := float64(len(binary))
	n1, n2 := float64(ones), float64(zeros)
	expectedRuns := (2*n1*n2)/n + 1

	// Variance of runs
	varianceRuns := (2 * n1 * n2 * (2*n1*n2 - n)) / (n * n * (n - 1))

	// Z-statistic
	if varianceRuns <= 0 {
		return 0, 1.0
	}

	zStat := (float64(runs) - expectedRuns) / math.Sqrt(varianceRuns)

	// Approximate p-value using normal distribution
	pValue := 2 * (1 - ea.normalCDF(math.Abs(zStat)))

	return zStat, pValue
}

// normalCDF approximates the cumulative distribution function of standard normal
func (ea *EntropyAnalyzer) normalCDF(x float64) float64 {
	return 0.5 * (1 + ea.erf(x/math.Sqrt2))
}

// erf approximates the error function
func (ea *EntropyAnalyzer) erf(x float64) float64 {
	// Abramowitz and Stegun approximation
	a1, a2, a3, a4, a5 := 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
	p := 0.3275911

	sign := 1.0
	if x < 0 {
		sign = -1.0
		x = -x
	}

	t := 1.0 / (1.0 + p*x)
	y := 1.0 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*math.Exp(-x*x)

	return sign * y
}

// compareToEnglishBaseline compares text entropy to English baseline
func (ea *EntropyAnalyzer) compareToEnglishBaseline(text string) float64 {
	textEntropy := ea.calculateShannonEntropy(text)
	if ea.englishEntropy == 0 {
		return 0
	}

	// Return absolute deviation from English baseline
	return math.Abs(textEntropy-ea.englishEntropy) / ea.englishEntropy
}

// estimateKolmogorovComplexity estimates complexity via compression ratio
func (ea *EntropyAnalyzer) estimateKolmogorovComplexity(text string) float64 {
	if len(text) == 0 {
		return 0
	}

	// Use simple LZ-style compression estimation
	seen := make(map[string]int)
	complexity := 0.0
	windowSize := 10

	for i := 0; i < len(text); i++ {
		for j := 1; j <= windowSize && i+j <= len(text); j++ {
			substring := text[i : i+j]
			seen[substring]++

			// Increment complexity for new patterns
			if seen[substring] == 1 {
				complexity += float64(j)
			}
		}
	}

	// Normalize by text length
	return complexity / float64(len(text))
}

// calculateAnomalyScore combines entropy measures into final score
func (ea *EntropyAnalyzer) calculateAnomalyScore(entropy, wordEntropy, chiSquarePValue,
	runsTestPValue, baselineDeviation, kolmogorovComplexity float64) float64 {

	score := 0.0

	// Low entropy suggests predictable (AI-like) text
	entropyScore := 0.0
	if entropy < ea.lowEntropyThreshold {
		entropyScore = 0.8
	} else if entropy > ea.highEntropyThreshold {
		entropyScore = 0.3
	} else {
		entropyScore = 0.5
	}

	// Chi-square test: low p-value suggests non-English distribution
	chiScore := 0.0
	if chiSquarePValue < ea.chiSquareThreshold {
		chiScore = 0.7
	} else {
		chiScore = 0.3
	}

	// Runs test: low p-value suggests non-random patterns
	runsScore := 0.0
	if runsTestPValue < ea.runsTestThreshold {
		runsScore = 0.8
	} else {
		runsScore = 0.2
	}

	// High baseline deviation suggests non-English-like patterns
	baselineScore := math.Min(1.0, baselineDeviation)

	// Lower complexity might suggest AI generation
	complexityScore := math.Max(0.0, 1.0-kolmogorovComplexity/2.0)

	// Weighted combination
	score = (entropyScore*0.25 + chiScore*0.2 + runsScore*0.2 +
		baselineScore*0.2 + complexityScore*0.15)

	return math.Max(0.0, math.Min(1.0, score))
}

// calculateAdvancedConfidence determines confidence with statistical tests
func (ea *EntropyAnalyzer) calculateAdvancedConfidence(text string, entropy, chiSquarePValue, runsTestPValue float64) float64 {
	textLength := len(text)

	// Base confidence on text length
	lengthConfidence := math.Min(1.0, float64(textLength)/500.0)

	// Higher confidence when statistical tests are conclusive
	statisticalConfidence := 0.5
	if chiSquarePValue < 0.01 || chiSquarePValue > 0.99 {
		statisticalConfidence += 0.2
	}
	if runsTestPValue < 0.01 || runsTestPValue > 0.99 {
		statisticalConfidence += 0.2
	}
	statisticalConfidence = math.Min(1.0, statisticalConfidence)

	// Higher confidence for reasonable entropy values
	entropyConfidence := 1.0
	if entropy < 1.0 || entropy > 8.0 {
		entropyConfidence = 0.6
	}

	return lengthConfidence*0.4 + statisticalConfidence*0.4 + entropyConfidence*0.2
}
