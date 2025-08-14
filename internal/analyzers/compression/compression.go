package compression

import (
	"bytes"
	"compress/gzip"
	"compress/lzw"
	"compress/zlib"
	"context"
	"math"

	"github.com/andybalholm/brotli"
	"github.com/ruvnet/alienator/internal/models"
)

// CompressionAnalyzer analyzes text compressibility patterns
type CompressionAnalyzer struct {
	name string
	// Compression algorithm weights
	gzipWeight   float64
	zlibWeight   float64
	lzwWeight    float64
	brotliWeight float64
	// Pattern detection parameters
	minPatternLength int
	maxPatternLength int
	repetitionThreshold float64
}

// NewCompressionAnalyzer creates a new compression analyzer
func NewCompressionAnalyzer() *CompressionAnalyzer {
	return &CompressionAnalyzer{
		name:                "compression",
		gzipWeight:          0.3,
		zlibWeight:          0.25,
		lzwWeight:           0.2,
		brotliWeight:        0.25,
		minPatternLength:    3,
		maxPatternLength:    20,
		repetitionThreshold: 0.1,
	}
}

// Name returns the analyzer name
func (ca *CompressionAnalyzer) Name() string {
	return ca.name
}

// Analyze performs compression analysis on the text
func (ca *CompressionAnalyzer) Analyze(ctx context.Context, text string) (*models.AnalysisResult, error) {
	if len(text) == 0 {
		return &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil
	}

	// Calculate compression ratios with multiple algorithms
	gzipRatio := ca.calculateGzipRatio(text)
	zlibRatio := ca.calculateZlibRatio(text)
	lzwRatio := ca.calculateLZWRatio(text)
	brotliRatio := ca.calculateBrotliRatio(text)
	
	// Calculate Normalized Compression Distance (NCD)
	ncdScore := ca.calculateNCD(text)
	
	// Estimate Kolmogorov complexity
	kolmogorovComplexity := ca.estimateKolmogorovComplexity(text)
	
	// Detect repetitive patterns
	repetitivePatterns := ca.detectRepetitivePatterns(text)
	
	// Calculate pattern entropy
	patternEntropy := ca.calculatePatternEntropy(text)
	
	// Combine ratios with weights
	combinedRatio := (gzipRatio*ca.gzipWeight + zlibRatio*ca.zlibWeight + 
			         lzwRatio*ca.lzwWeight + brotliRatio*ca.brotliWeight)
	
	// Convert to anomaly score
	score := ca.calculateAnomalyScore(combinedRatio, ncdScore, kolmogorovComplexity, 
								   repetitivePatterns, patternEntropy)
	
	// Calculate confidence
	confidence := ca.calculateAdvancedConfidence(text, gzipRatio, zlibRatio, 
									        lzwRatio, brotliRatio, ncdScore)
	
	return &models.AnalysisResult{
		Score:      score,
		Confidence: confidence,
		Metadata: map[string]interface{}{
			"gzip_ratio":            gzipRatio,
			"zlib_ratio":            zlibRatio,
			"lzw_ratio":             lzwRatio,
			"brotli_ratio":          brotliRatio,
			"combined_ratio":        combinedRatio,
			"ncd_score":             ncdScore,
			"kolmogorov_complexity": kolmogorovComplexity,
			"repetitive_patterns":   repetitivePatterns,
			"pattern_entropy":       patternEntropy,
			"original_length":       len(text),
		},
	}, nil
}

// calculateGzipRatio calculates the gzip compression ratio
func (ca *CompressionAnalyzer) calculateGzipRatio(text string) float64 {
	originalSize := len(text)
	if originalSize == 0 {
		return 1.0
	}
	
	var buf bytes.Buffer
	gzipWriter := gzip.NewWriter(&buf)
	
	_, err := gzipWriter.Write([]byte(text))
	if err != nil {
		return 1.0
	}
	
	err = gzipWriter.Close()
	if err != nil {
		return 1.0
	}
	
	compressedSize := buf.Len()
	return float64(compressedSize) / float64(originalSize)
}

// calculateZlibRatio calculates the zlib compression ratio
func (ca *CompressionAnalyzer) calculateZlibRatio(text string) float64 {
	originalSize := len(text)
	if originalSize == 0 {
		return 1.0
	}
	
	var buf bytes.Buffer
	zlibWriter := zlib.NewWriter(&buf)
	
	_, err := zlibWriter.Write([]byte(text))
	if err != nil {
		return 1.0
	}
	
	err = zlibWriter.Close()
	if err != nil {
		return 1.0
	}
	
	compressedSize := buf.Len()
	return float64(compressedSize) / float64(originalSize)
}

// calculateLZWRatio calculates LZW compression ratio
func (ca *CompressionAnalyzer) calculateLZWRatio(text string) float64 {
	originalSize := len(text)
	if originalSize == 0 {
		return 1.0
	}
	
	var buf bytes.Buffer
	lzwWriter := lzw.NewWriter(&buf, lzw.LSB, 8)
	
	_, err := lzwWriter.Write([]byte(text))
	if err != nil {
		return 1.0
	}
	
	err = lzwWriter.Close()
	if err != nil {
		return 1.0
	}
	
	compressedSize := buf.Len()
	return float64(compressedSize) / float64(originalSize)
}

// calculateBrotliRatio calculates Brotli compression ratio
func (ca *CompressionAnalyzer) calculateBrotliRatio(text string) float64 {
	originalSize := len(text)
	if originalSize == 0 {
		return 1.0
	}
	
	var buf bytes.Buffer
	brotliWriter := brotli.NewWriter(&buf)
	
	_, err := brotliWriter.Write([]byte(text))
	if err != nil {
		return 1.0
	}
	
	err = brotliWriter.Close()
	if err != nil {
		return 1.0
	}
	
	compressedSize := buf.Len()
	return float64(compressedSize) / float64(originalSize)
}

// calculateNCD calculates Normalized Compression Distance
func (ca *CompressionAnalyzer) calculateNCD(text string) float64 {
	if len(text) < 10 {
		return 0.0
	}
	
	// Split text into two halves for NCD calculation
	mid := len(text) / 2
	text1 := text[:mid]
	text2 := text[mid:]
	
	// Compress individual parts
	c1 := ca.calculateGzipSize(text1)
	c2 := ca.calculateGzipSize(text2)
	
	// Compress concatenated text
	combined := text1 + text2
	c12 := ca.calculateGzipSize(combined)
	
	// Calculate NCD
	minC := math.Min(float64(c1), float64(c2))
	maxC := math.Max(float64(c1), float64(c2))
	
	if maxC == 0 {
		return 0.0
	}
	
	ncd := (float64(c12) - minC) / maxC
	return math.Max(0.0, math.Min(1.0, ncd))
}

// calculateGzipSize returns compressed size without storing the data
func (ca *CompressionAnalyzer) calculateGzipSize(text string) int {
	var buf bytes.Buffer
	gzipWriter := gzip.NewWriter(&buf)
	gzipWriter.Write([]byte(text))
	gzipWriter.Close()
	return buf.Len()
}

// estimateKolmogorovComplexity estimates Kolmogorov complexity
func (ca *CompressionAnalyzer) estimateKolmogorovComplexity(text string) float64 {
	if len(text) == 0 {
		return 0.0
	}
	
	// Use best compression ratio as complexity estimate
	ratios := []float64{
		ca.calculateGzipRatio(text),
		ca.calculateZlibRatio(text),
		ca.calculateLZWRatio(text),
		ca.calculateBrotliRatio(text),
	}
	
	// Find minimum ratio (best compression)
	minRatio := ratios[0]
	for _, ratio := range ratios {
		if ratio < minRatio {
			minRatio = ratio
		}
	}
	
	// Complexity is inversely related to compression
	return minRatio * float64(len(text))
}

// detectRepetitivePatterns detects repetitive patterns in text
func (ca *CompressionAnalyzer) detectRepetitivePatterns(text string) float64 {
	if len(text) < ca.minPatternLength {
		return 0.0
	}
	
	patternCounts := make(map[string]int)
	totalPatterns := 0
	repetitiveChars := 0
	
	// Detect patterns of various lengths
	for length := ca.minPatternLength; length <= ca.maxPatternLength && length <= len(text)/2; length++ {
		for i := 0; i <= len(text)-length; i++ {
			pattern := text[i : i+length]
			patternCounts[pattern]++
			totalPatterns++
		}
	}
	
	// Count repetitive characters
	for pattern, count := range patternCounts {
		if count > 1 {
			repetitiveChars += len(pattern) * (count - 1)
		}
	}
	
	if len(text) == 0 {
		return 0.0
	}
	
	return float64(repetitiveChars) / float64(len(text))
}

// calculatePatternEntropy calculates entropy of patterns
func (ca *CompressionAnalyzer) calculatePatternEntropy(text string) float64 {
	if len(text) < ca.minPatternLength {
		return 0.0
	}
	
	patternCounts := make(map[string]int)
	totalPatterns := 0
	
	// Count patterns of fixed length
	patternLength := 4
	for i := 0; i <= len(text)-patternLength; i++ {
		pattern := text[i : i+patternLength]
		patternCounts[pattern]++
		totalPatterns++
	}
	
	if totalPatterns == 0 {
		return 0.0
	}
	
	// Calculate Shannon entropy of patterns
	entropy := 0.0
	for _, count := range patternCounts {
		if count > 0 {
			p := float64(count) / float64(totalPatterns)
			entropy -= p * math.Log2(p)
		}
	}
	
	return entropy
}

// calculateAnomalyScore combines compression metrics into anomaly score
func (ca *CompressionAnalyzer) calculateAnomalyScore(combinedRatio, ncdScore, 
	kolmogorovComplexity, repetitivePatterns, patternEntropy float64) float64 {
	
	score := 0.0
	
	// Low compression ratio suggests predictable patterns (AI-like)
	ratioScore := ca.ratioToAnomalyScore(combinedRatio)
	
	// NCD close to 0 suggests high similarity (repetitive, AI-like)
	ncdAnomalyScore := 1.0 - ncdScore
	
	// Low Kolmogorov complexity suggests predictable text
	complexityScore := math.Max(0.0, 1.0 - kolmogorovComplexity/float64(100))
	
	// High repetitive patterns suggest AI generation
	repetitionScore := math.Min(1.0, repetitivePatterns * 5.0)
	
	// Low pattern entropy suggests predictable patterns
	entropyScore := 0.0
	if patternEntropy < 3.0 {
		entropyScore = 0.8
	} else if patternEntropy > 6.0 {
		entropyScore = 0.2
	} else {
		entropyScore = 0.5
	}
	
	// Weighted combination
	score = (ratioScore*0.3 + ncdAnomalyScore*0.2 + complexityScore*0.2 + 
		     repetitionScore*0.15 + entropyScore*0.15)
	
	return math.Max(0.0, math.Min(1.0, score))
}

// ratioToAnomalyScore converts compression ratio to anomaly score
func (ca *CompressionAnalyzer) ratioToAnomalyScore(ratio float64) float64 {
	// Lower compression ratio (more compressible) suggests more patterns/predictability
	// AI text often has more predictable patterns than human text
	// Lower ratio = higher anomaly score
	
	// Typical compression ratios range from 0.3 to 0.9
	// Normalize and invert
	normalizedRatio := math.Max(0.0, math.Min(1.0, (ratio-0.2)/0.7))
	
	// Invert: lower ratio = higher anomaly score
	return 1.0 - normalizedRatio
}

// calculateAdvancedConfidence determines confidence with multiple algorithms
func (ca *CompressionAnalyzer) calculateAdvancedConfidence(text string, gzipRatio, 
	zlibRatio, lzwRatio, brotliRatio, ncdScore float64) float64 {
	
	textLength := len(text)
	
	// Base confidence on text length
	lengthConfidence := math.Min(1.0, float64(textLength)/500.0)
	
	// Check consistency between compression methods
	ratios := []float64{gzipRatio, zlibRatio, lzwRatio, brotliRatio}
	consistencyConfidence := ca.calculateConsistency(ratios)
	
	// Higher confidence when compression is meaningful
	compressionConfidence := 1.0
	avgRatio := (gzipRatio + zlibRatio + lzwRatio + brotliRatio) / 4.0
	if avgRatio > 0.95 || avgRatio < 0.1 {
		compressionConfidence = 0.3
	}
	
	// NCD should be reasonable
	ncdConfidence := 1.0
	if ncdScore < 0.0 || ncdScore > 1.0 {
		ncdConfidence = 0.5
	}
	
	// Combine confidences
	return lengthConfidence*0.4 + consistencyConfidence*0.3 + 
		   compressionConfidence*0.2 + ncdConfidence*0.1
}

// calculateConsistency measures consistency across compression ratios
func (ca *CompressionAnalyzer) calculateConsistency(ratios []float64) float64 {
	if len(ratios) == 0 {
		return 0.0
	}
	
	// Calculate mean
	mean := 0.0
	for _, ratio := range ratios {
		mean += ratio
	}
	mean /= float64(len(ratios))
	
	// Calculate variance
	variance := 0.0
	for _, ratio := range ratios {
		diff := ratio - mean
		variance += diff * diff
	}
	variance /= float64(len(ratios))
	
	// Lower variance = higher consistency
	stdDev := math.Sqrt(variance)
	return 1.0 / (1.0 + stdDev*10)
}