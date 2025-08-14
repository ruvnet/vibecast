package cryptographic

import (
	"context"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"hash"
	"math"
	"regexp"
	"sort"
	"strings"

	"github.com/ruvnet/alienator/internal/models"
	"golang.org/x/crypto/blake2b"
	"golang.org/x/crypto/blake2s"
	"golang.org/x/crypto/sha3"
)

// CryptographicAnalyzer analyzes cryptographic patterns in text
type CryptographicAnalyzer struct {
	name string
	// Hash pattern detection
	hashPatterns     map[string]*regexp.Regexp
	minHashLength    int
	maxHashLength    int
	// Algorithm analysis
	hashAlgorithms   []HashAlgorithm
	// Statistical thresholds
	entropyThreshold float64
	uniformityThreshold float64
	// Collision detection
	collisionThreshold int
}

// HashAlgorithm represents a hash algorithm for analysis
type HashAlgorithm struct {
	Name       string
	HashFunc   func() hash.Hash
	OutputSize int
}

// HashAnalysis represents analysis results for a hash
type HashAnalysis struct {
	Algorithm    string
	Entropy      float64
	Uniformity   float64
	IsValidHash  bool
	Collisions   int
	Pattern      string
}

// NewCryptographicAnalyzer creates a new cryptographic analyzer
func NewCryptographicAnalyzer() *CryptographicAnalyzer {
	// Define hash pattern regular expressions
	hashPatterns := map[string]*regexp.Regexp{
		"md5":     regexp.MustCompile(`\b[a-fA-F0-9]{32}\b`),
		"sha1":    regexp.MustCompile(`\b[a-fA-F0-9]{40}\b`),
		"sha256":  regexp.MustCompile(`\b[a-fA-F0-9]{64}\b`),
		"sha512":  regexp.MustCompile(`\b[a-fA-F0-9]{128}\b`),
		"sha3_256": regexp.MustCompile(`\b[a-fA-F0-9]{64}\b`), // Same length as SHA256
		"blake2b": regexp.MustCompile(`\b[a-fA-F0-9]{128}\b`), // 64-byte default
		"blake2s": regexp.MustCompile(`\b[a-fA-F0-9]{64}\b`),  // 32-byte default
		"base64":  regexp.MustCompile(`[A-Za-z0-9+/]{20,}={0,2}`),
		"base32":  regexp.MustCompile(`[A-Z2-7]{20,}={0,6}`),
		"hex":     regexp.MustCompile(`\b[a-fA-F0-9]{16,}\b`),
	}

	// Define hash algorithms for testing
	hashAlgorithms := []HashAlgorithm{
		{"md5", md5.New, 16},
		{"sha1", sha1.New, 20},
		{"sha256", sha256.New, 32},
		{"sha512", sha512.New, 64},
		{"sha3_256", sha3.New256, 32},
		{"blake2b", func() hash.Hash { h, _ := blake2b.New256(nil); return h }, 32},
		{"blake2s", func() hash.Hash { h, _ := blake2s.New256(nil); return h }, 32},
	}

	return &CryptographicAnalyzer{
		name:                "cryptographic",
		hashPatterns:        hashPatterns,
		minHashLength:       16,
		maxHashLength:       128,
		hashAlgorithms:      hashAlgorithms,
		entropyThreshold:    7.5, // High entropy expected for hashes
		uniformityThreshold: 0.1, // Low chi-square indicates uniform distribution
		collisionThreshold:  2,   // Maximum expected collisions for analysis
	}
}

// Name returns the analyzer name
func (ca *CryptographicAnalyzer) Name() string {
	return ca.name
}

// Analyze performs cryptographic analysis on the text
func (ca *CryptographicAnalyzer) Analyze(ctx context.Context, text string) (*models.AnalysisResult, error) {
	if len(text) == 0 {
		return &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil
	}

	// Detect hash patterns
	detectedHashes := ca.detectHashPatterns(text)

	// Analyze each detected hash
	hashAnalyses := make([]HashAnalysis, 0)
	for _, hashStr := range detectedHashes {
		analysis := ca.analyzeHash(hashStr)
		hashAnalyses = append(hashAnalyses, analysis)
	}

	// Detect collision patterns
	collisions := ca.detectCollisions(detectedHashes)

	// Calculate hash entropy distribution
	entropyDistribution := ca.calculateEntropyDistribution(detectedHashes)

	// Analyze encoding patterns (base64, base32, hex)
	encodingPatterns := ca.analyzeEncodingPatterns(text)

	// Calculate cryptographic randomness
	randomnessScore := ca.calculateCryptographicRandomness(text)

	// Detect structured data patterns
	structuredPatterns := ca.detectStructuredPatterns(text)

	// Calculate overall anomaly score
	score := ca.calculateAnomalyScore(hashAnalyses, collisions, entropyDistribution,
		encodingPatterns, randomnessScore, structuredPatterns)

	// Calculate confidence
	confidence := ca.calculateConfidence(text, detectedHashes, hashAnalyses)

	return &models.AnalysisResult{
		Score:      score,
		Confidence: confidence,
		Metadata: map[string]interface{}{
			"detected_hashes":      len(detectedHashes),
			"hash_analyses":        ca.summarizeHashAnalyses(hashAnalyses),
			"collisions_detected":  collisions,
			"entropy_distribution": entropyDistribution,
			"encoding_patterns":    encodingPatterns,
			"randomness_score":     randomnessScore,
			"structured_patterns":  structuredPatterns,
		},
	}, nil
}

// detectHashPatterns detects potential hash values in text
func (ca *CryptographicAnalyzer) detectHashPatterns(text string) []string {
	hashes := make([]string, 0)
	seen := make(map[string]bool)

	// Check each hash pattern
	for algorithm, pattern := range ca.hashPatterns {
		matches := pattern.FindAllString(text, -1)
		for _, match := range matches {
			// Filter by length constraints
			if len(match) >= ca.minHashLength && len(match) <= ca.maxHashLength {
				// Avoid duplicates
				if !seen[match] {
					seen[match] = true
					hashes = append(hashes, match)
				}
			}
		}
		_ = algorithm // Use algorithm for potential future filtering
	}

	return hashes
}

// analyzeHash performs detailed analysis on a potential hash
func (ca *CryptographicAnalyzer) analyzeHash(hashStr string) HashAnalysis {
	analysis := HashAnalysis{
		Algorithm:   ca.identifyHashAlgorithm(hashStr),
		Entropy:     ca.calculateHashEntropy(hashStr),
		Uniformity:  ca.calculateHashUniformity(hashStr),
		IsValidHash: ca.isValidHashFormat(hashStr),
		Collisions:  0, // Will be set by collision detection
		Pattern:     ca.detectHashPattern(hashStr),
	}

	return analysis
}

// identifyHashAlgorithm attempts to identify the hash algorithm
func (ca *CryptographicAnalyzer) identifyHashAlgorithm(hashStr string) string {
	length := len(hashStr)
	
	// Check if it's hexadecimal
	if matched, _ := regexp.MatchString("^[a-fA-F0-9]+$", hashStr); matched {
		switch length {
		case 32:
			return "MD5"
		case 40:
			return "SHA-1"
		case 64:
			return "SHA-256/SHA3-256/BLAKE2s"
		case 128:
			return "SHA-512/BLAKE2b"
		default:
			if length >= 16 && length%2 == 0 {
				return "Hex-encoded"
			}
		}
	}

	// Check for Base64 pattern
	if matched, _ := regexp.MatchString("^[A-Za-z0-9+/]+={0,2}$", hashStr); matched {
		return "Base64"
	}

	// Check for Base32 pattern
	if matched, _ := regexp.MatchString("^[A-Z2-7]+={0,6}$", hashStr); matched {
		return "Base32"
	}

	return "Unknown"
}

// calculateHashEntropy calculates Shannon entropy of the hash
func (ca *CryptographicAnalyzer) calculateHashEntropy(hashStr string) float64 {
	if len(hashStr) == 0 {
		return 0.0
	}

	frequency := make(map[rune]int)
	total := 0

	for _, char := range hashStr {
		frequency[char]++
		total++
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

// calculateHashUniformity calculates uniformity using chi-square test
func (ca *CryptographicAnalyzer) calculateHashUniformity(hashStr string) float64 {
	if len(hashStr) == 0 {
		return 0.0
	}

	// Count character frequencies
	frequency := make(map[rune]int)
	for _, char := range hashStr {
		frequency[char]++
	}

	// Expected frequency for uniform distribution
	totalChars := len(hashStr)
	uniqueChars := len(frequency)
	expectedFreq := float64(totalChars) / float64(uniqueChars)

	// Calculate chi-square statistic
	chiSquare := 0.0
	for _, observed := range frequency {
		diff := float64(observed) - expectedFreq
		chiSquare += (diff * diff) / expectedFreq
	}

	// Return normalized chi-square (lower values indicate more uniform distribution)
	return chiSquare / float64(uniqueChars)
}

// isValidHashFormat checks if the string follows valid hash format
func (ca *CryptographicAnalyzer) isValidHashFormat(hashStr string) bool {
	// Check common hash lengths and character sets
	length := len(hashStr)
	
	// Hexadecimal hashes
	if matched, _ := regexp.MatchString("^[a-fA-F0-9]+$", hashStr); matched {
		validLengths := []int{32, 40, 56, 64, 96, 128} // Common hash lengths
		for _, validLen := range validLengths {
			if length == validLen {
				return true
			}
		}
	}

	// Base64 encoded
	if matched, _ := regexp.MatchString("^[A-Za-z0-9+/]+={0,2}$", hashStr); matched && length >= 20 {
		return true
	}

	// Base32 encoded
	if matched, _ := regexp.MatchString("^[A-Z2-7]+={0,6}$", hashStr); matched && length >= 20 {
		return true
	}

	return false
}

// detectHashPattern detects structural patterns in the hash
func (ca *CryptographicAnalyzer) detectHashPattern(hashStr string) string {
	if len(hashStr) == 0 {
		return "empty"
	}

	// Check for repeated patterns
	if ca.hasRepeatedPatterns(hashStr) {
		return "repeated"
	}

	// Check for sequential patterns
	if ca.hasSequentialPatterns(hashStr) {
		return "sequential"
	}

	// Check for common weak patterns
	if ca.hasWeakPatterns(hashStr) {
		return "weak"
	}

	// Check entropy level
	entropy := ca.calculateHashEntropy(hashStr)
	if entropy < 3.0 {
		return "low_entropy"
	} else if entropy > 7.5 {
		return "high_entropy"
	}

	return "normal"
}

// hasRepeatedPatterns checks for repeated substrings
func (ca *CryptographicAnalyzer) hasRepeatedPatterns(hashStr string) bool {
	// Check for repeated 2-8 character patterns
	for patternLen := 2; patternLen <= 8 && patternLen < len(hashStr)/2; patternLen++ {
		seen := make(map[string]int)
		
		for i := 0; i <= len(hashStr)-patternLen; i++ {
			pattern := hashStr[i : i+patternLen]
			seen[pattern]++
			
			if seen[pattern] > 2 { // Pattern repeats more than twice
				return true
			}
		}
	}

	return false
}

// hasSequentialPatterns checks for sequential character patterns
func (ca *CryptographicAnalyzer) hasSequentialPatterns(hashStr string) bool {
	if len(hashStr) < 4 {
		return false
	}

	consecutiveCount := 1
	for i := 1; i < len(hashStr); i++ {
		if hashStr[i] == hashStr[i-1]+1 || hashStr[i] == hashStr[i-1]-1 {
			consecutiveCount++
			if consecutiveCount >= 4 { // 4+ consecutive characters
				return true
			}
		} else {
			consecutiveCount = 1
		}
	}

	return false
}

// hasWeakPatterns checks for commonly weak patterns
func (ca *CryptographicAnalyzer) hasWeakPatterns(hashStr string) bool {
	lowerHash := strings.ToLower(hashStr)
	
	weakPatterns := []string{
		"0000", "1111", "aaaa", "ffff",
		"1234", "abcd", "0123", "def0",
		"dead", "beef", "cafe", "babe",
		"face", "feed", "fade", "deed",
	}

	for _, pattern := range weakPatterns {
		if strings.Contains(lowerHash, pattern) {
			return true
		}
	}

	return false
}

// detectCollisions finds potential hash collisions
func (ca *CryptographicAnalyzer) detectCollisions(hashes []string) map[string]int {
	collisions := make(map[string]int)
	hashCounts := make(map[string]int)

	// Count occurrences of each hash
	for _, hash := range hashes {
		hashCounts[hash]++
	}

	// Identify collisions (same hash appearing multiple times)
	for hash, count := range hashCounts {
		if count > 1 {
			collisions[hash] = count
		}
	}

	return collisions
}

// calculateEntropyDistribution calculates entropy distribution across all hashes
func (ca *CryptographicAnalyzer) calculateEntropyDistribution(hashes []string) map[string]interface{} {
	if len(hashes) == 0 {
		return map[string]interface{}{
			"mean":     0.0,
			"variance": 0.0,
			"min":      0.0,
			"max":      0.0,
		}
	}

	entropies := make([]float64, len(hashes))
	sum := 0.0

	for i, hash := range hashes {
		entropy := ca.calculateHashEntropy(hash)
		entropies[i] = entropy
		sum += entropy
	}

	mean := sum / float64(len(entropies))

	// Calculate variance
	varianceSum := 0.0
	for _, entropy := range entropies {
		diff := entropy - mean
		varianceSum += diff * diff
	}
	variance := varianceSum / float64(len(entropies))

	// Find min and max
	sort.Float64s(entropies)

	return map[string]interface{}{
		"mean":     mean,
		"variance": variance,
		"min":      entropies[0],
		"max":      entropies[len(entropies)-1],
	}
}

// analyzeEncodingPatterns analyzes encoding patterns in text
func (ca *CryptographicAnalyzer) analyzeEncodingPatterns(text string) map[string]int {
	patterns := map[string]int{
		"base64":    0,
		"base32":    0,
		"hex":       0,
		"url_encoded": 0,
		"percent_encoded": 0,
	}

	// Base64 pattern
	base64Pattern := regexp.MustCompile(`[A-Za-z0-9+/]{20,}={0,2}`)
	patterns["base64"] = len(base64Pattern.FindAllString(text, -1))

	// Base32 pattern
	base32Pattern := regexp.MustCompile(`[A-Z2-7]{20,}={0,6}`)
	patterns["base32"] = len(base32Pattern.FindAllString(text, -1))

	// Hexadecimal pattern
	hexPattern := regexp.MustCompile(`\b[a-fA-F0-9]{16,}\b`)
	patterns["hex"] = len(hexPattern.FindAllString(text, -1))

	// URL encoding
	urlPattern := regexp.MustCompile(`%[0-9a-fA-F]{2}`)
	patterns["url_encoded"] = len(urlPattern.FindAllString(text, -1))

	// Percent encoding (broader)
	percentPattern := regexp.MustCompile(`%[0-9a-fA-F]{2}`)
	patterns["percent_encoded"] = len(percentPattern.FindAllString(text, -1))

	return patterns
}

// calculateCryptographicRandomness calculates randomness metrics
func (ca *CryptographicAnalyzer) calculateCryptographicRandomness(text string) float64 {
	if len(text) == 0 {
		return 0.0
	}

	// Extract potential cryptographic data (hex, base64, etc.)
	cryptoData := ca.extractCryptographicData(text)
	if len(cryptoData) == 0 {
		return 0.0
	}

	totalRandomness := 0.0
	count := 0

	for _, data := range cryptoData {
		// Calculate entropy
		entropy := ca.calculateHashEntropy(data)
		
		// Calculate runs test statistic
		runsTest := ca.calculateRunsTest(data)
		
		// Calculate frequency test
		frequencyTest := ca.calculateFrequencyTest(data)
		
		// Combine metrics
		randomness := (entropy/8.0)*0.5 + runsTest*0.3 + frequencyTest*0.2
		totalRandomness += randomness
		count++
	}

	if count == 0 {
		return 0.0
	}

	return totalRandomness / float64(count)
}

// extractCryptographicData extracts potential cryptographic data from text
func (ca *CryptographicAnalyzer) extractCryptographicData(text string) []string {
	data := make([]string, 0)

	// Extract hex strings
	hexPattern := regexp.MustCompile(`\b[a-fA-F0-9]{16,}\b`)
	hexMatches := hexPattern.FindAllString(text, -1)
	data = append(data, hexMatches...)

	// Extract base64 strings
	base64Pattern := regexp.MustCompile(`[A-Za-z0-9+/]{20,}={0,2}`)
	base64Matches := base64Pattern.FindAllString(text, -1)
	data = append(data, base64Matches...)

	return data
}

// calculateRunsTest performs a simple runs test for randomness
func (ca *CryptographicAnalyzer) calculateRunsTest(data string) float64 {
	if len(data) < 10 {
		return 0.5
	}

	// Convert to binary based on character value median
	median := ca.calculateMedianCharValue(data)
	binary := make([]bool, len(data))
	
	for i, char := range data {
		binary[i] = int(char) >= median
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
		return 0.0
	}

	// Calculate expected runs
	n := float64(len(binary))
	n1, n2 := float64(ones), float64(zeros)
	expectedRuns := (2*n1*n2)/n + 1

	// Normalize by expected value
	if expectedRuns == 0 {
		return 0.5
	}

	ratio := float64(runs) / expectedRuns
	if ratio > 1.0 {
		return 1.0 / ratio // Invert if too many runs
	}
	return ratio
}

// calculateMedianCharValue calculates median character value
func (ca *CryptographicAnalyzer) calculateMedianCharValue(data string) int {
	values := make([]int, len(data))
	for i, char := range data {
		values[i] = int(char)
	}

	sort.Ints(values)
	if len(values)%2 == 0 {
		return (values[len(values)/2-1] + values[len(values)/2]) / 2
	}
	return values[len(values)/2]
}

// calculateFrequencyTest performs frequency test for randomness
func (ca *CryptographicAnalyzer) calculateFrequencyTest(data string) float64 {
	if len(data) == 0 {
		return 0.0
	}

	frequency := make(map[rune]int)
	for _, char := range data {
		frequency[char]++
	}

	// Calculate chi-square statistic
	expectedFreq := float64(len(data)) / float64(len(frequency))
	chiSquare := 0.0

	for _, observed := range frequency {
		diff := float64(observed) - expectedFreq
		chiSquare += (diff * diff) / expectedFreq
	}

	// Normalize chi-square (lower values indicate better uniformity)
	normalizedChiSquare := chiSquare / float64(len(frequency))
	
	// Return inverse for randomness score (higher is better)
	return 1.0 / (1.0 + normalizedChiSquare)
}

// detectStructuredPatterns detects structured data patterns
func (ca *CryptographicAnalyzer) detectStructuredPatterns(text string) map[string]int {
	patterns := map[string]int{
		"json_like":    0,
		"xml_like":     0,
		"csv_like":     0,
		"key_value":    0,
		"bracketed":    0,
		"quoted":       0,
	}

	// JSON-like patterns
	jsonPattern := regexp.MustCompile(`\{[^{}]*"[^"]*"[^{}]*:[^{}]*\}`)
	patterns["json_like"] = len(jsonPattern.FindAllString(text, -1))

	// XML-like patterns
	xmlPattern := regexp.MustCompile(`<[^>]+>[^<]*</[^>]+>`)
	patterns["xml_like"] = len(xmlPattern.FindAllString(text, -1))

	// CSV-like patterns
	csvPattern := regexp.MustCompile(`[^,\n]+,[^,\n]+,[^,\n]+`)
	patterns["csv_like"] = len(csvPattern.FindAllString(text, -1))

	// Key-value patterns
	kvPattern := regexp.MustCompile(`[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]\s*[^\s,;]+`)
	patterns["key_value"] = len(kvPattern.FindAllString(text, -1))

	// Bracketed content
	bracketPattern := regexp.MustCompile(`\[[^\[\]]{10,}\]`)
	patterns["bracketed"] = len(bracketPattern.FindAllString(text, -1))

	// Quoted content
	quotedPattern := regexp.MustCompile(`"[^"]{10,}"`)
	patterns["quoted"] = len(quotedPattern.FindAllString(text, -1))

	return patterns
}

// calculateAnomalyScore combines all cryptographic metrics
func (ca *CryptographicAnalyzer) calculateAnomalyScore(hashAnalyses []HashAnalysis, 
	collisions map[string]int, entropyDistribution map[string]interface{},
	encodingPatterns map[string]int, randomnessScore float64, 
	structuredPatterns map[string]int) float64 {

	score := 0.0
	factors := 0

	// Hash analysis score
	if len(hashAnalyses) > 0 {
		hashScore := ca.calculateHashScore(hashAnalyses)
		score += hashScore * 0.3
		factors++
	}

	// Collision score - multiple collisions are suspicious
	if len(collisions) > 0 {
		collisionScore := math.Min(1.0, float64(len(collisions))/10.0)
		score += collisionScore * 0.2
		factors++
	}

	// Entropy distribution score
	if entropyDist, ok := entropyDistribution["variance"]; ok {
		if variance, ok := entropyDist.(float64); ok {
			// Very low variance might indicate generated hashes
			entropyScore := 0.0
			if variance < 0.1 {
				entropyScore = 0.8
			} else if variance > 2.0 {
				entropyScore = 0.6
			} else {
				entropyScore = 0.3
			}
			score += entropyScore * 0.15
			factors++
		}
	}

	// Encoding patterns score
	encodingScore := ca.calculateEncodingScore(encodingPatterns)
	score += encodingScore * 0.15
	factors++

	// Randomness score - very high or very low randomness can be suspicious
	randomnessAnomalyScore := 0.0
	if randomnessScore < 0.2 {
		randomnessAnomalyScore = 0.7 // Too predictable
	} else if randomnessScore > 0.95 {
		randomnessAnomalyScore = 0.6 // Too random (might be artificial)
	} else {
		randomnessAnomalyScore = 0.2
	}
	score += randomnessAnomalyScore * 0.1
	factors++

	// Structured patterns score
	structuredScore := ca.calculateStructuredScore(structuredPatterns)
	score += structuredScore * 0.1
	factors++

	if factors == 0 {
		return 0.0
	}

	return score / float64(factors)
}

// calculateHashScore calculates anomaly score based on hash analyses
func (ca *CryptographicAnalyzer) calculateHashScore(analyses []HashAnalysis) float64 {
	if len(analyses) == 0 {
		return 0.0
	}

	totalScore := 0.0
	for _, analysis := range analyses {
		hashScore := 0.0

		// Low entropy hashes are suspicious
		if analysis.Entropy < 3.0 {
			hashScore += 0.4
		} else if analysis.Entropy < 5.0 {
			hashScore += 0.2
		}

		// Poor uniformity is suspicious
		if analysis.Uniformity > 1.0 {
			hashScore += 0.3
		}

		// Invalid format is suspicious
		if !analysis.IsValidHash {
			hashScore += 0.2
		}

		// Weak patterns are suspicious
		if analysis.Pattern == "weak" || analysis.Pattern == "repeated" {
			hashScore += 0.3
		} else if analysis.Pattern == "low_entropy" {
			hashScore += 0.2
		}

		totalScore += hashScore
	}

	return totalScore / float64(len(analyses))
}

// calculateEncodingScore calculates anomaly score for encoding patterns
func (ca *CryptographicAnalyzer) calculateEncodingScore(patterns map[string]int) float64 {
	total := 0
	for _, count := range patterns {
		total += count
	}

	if total == 0 {
		return 0.0
	}

	// High concentration of encoded data might be suspicious
	score := 0.0
	if total > 20 {
		score = 0.8
	} else if total > 10 {
		score = 0.6
	} else if total > 5 {
		score = 0.4
	} else {
		score = 0.1
	}

	return score
}

// calculateStructuredScore calculates anomaly score for structured patterns
func (ca *CryptographicAnalyzer) calculateStructuredScore(patterns map[string]int) float64 {
	total := 0
	for _, count := range patterns {
		total += count
	}

	if total == 0 {
		return 0.0
	}

	// Some structured patterns might indicate data dumps or logs
	score := math.Min(1.0, float64(total)/50.0)
	return score
}

// summarizeHashAnalyses creates a summary of hash analyses for metadata
func (ca *CryptographicAnalyzer) summarizeHashAnalyses(analyses []HashAnalysis) map[string]interface{} {
	if len(analyses) == 0 {
		return map[string]interface{}{}
	}

	algorithms := make(map[string]int)
	patterns := make(map[string]int)
	validCount := 0
	totalEntropy := 0.0

	for _, analysis := range analyses {
		algorithms[analysis.Algorithm]++
		patterns[analysis.Pattern]++
		
		if analysis.IsValidHash {
			validCount++
		}
		
		totalEntropy += analysis.Entropy
	}

	return map[string]interface{}{
		"algorithms":     algorithms,
		"patterns":       patterns,
		"valid_count":    validCount,
		"average_entropy": totalEntropy / float64(len(analyses)),
	}
}

// calculateConfidence determines confidence in the cryptographic analysis
func (ca *CryptographicAnalyzer) calculateConfidence(text string, hashes []string, 
	analyses []HashAnalysis) float64 {

	textLength := len(text)
	hashCount := len(hashes)

	// Base confidence on text length
	lengthConfidence := math.Min(1.0, float64(textLength)/1000.0)

	// Higher confidence with more hashes to analyze
	hashConfidence := math.Min(1.0, float64(hashCount)/10.0)

	// Analysis quality confidence
	analysisConfidence := 1.0
	if len(analyses) > 0 {
		validCount := 0
		for _, analysis := range analyses {
			if analysis.IsValidHash {
				validCount++
			}
		}
		analysisConfidence = float64(validCount) / float64(len(analyses))
	} else {
		analysisConfidence = 0.5 // Neutral if no hashes found
	}

	// Statistical confidence based on sample size
	statisticalConfidence := 1.0
	if hashCount < 3 {
		statisticalConfidence = 0.5
	} else if hashCount < 10 {
		statisticalConfidence = 0.8
	}

	// Pattern confidence - diverse patterns increase confidence
	patternConfidence := 1.0
	if len(analyses) > 0 {
		uniquePatterns := make(map[string]bool)
		for _, analysis := range analyses {
			uniquePatterns[analysis.Pattern] = true
		}
		patternConfidence = math.Min(1.0, float64(len(uniquePatterns))/3.0)
	}

	return lengthConfidence*0.25 + hashConfidence*0.25 + analysisConfidence*0.2 + 
		   statisticalConfidence*0.15 + patternConfidence*0.15
}