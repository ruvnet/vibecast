package embedding

import (
	"context"
	"math"
	"sort"
	"strings"
	"unicode"

	"github.com/ruvnet/alienator/internal/models"
)

// EmbeddingAnalyzer analyzes text using embedding-based techniques
type EmbeddingAnalyzer struct {
	name string
	// Word embedding parameters
	embeddingDim   int
	vocabularySize int
	// Clustering parameters
	numClusters    int
	maxIterations  int
	convergenceThreshold float64
	// Outlier detection parameters
	outlierThreshold  float64
	distanceMetric    string
}

// WordEmbedding represents a simple word embedding
type WordEmbedding struct {
	Word   string
	Vector []float64
}

// ClusterResult represents clustering analysis results
type ClusterResult struct {
	ClusterID int
	Centroid  []float64
	Points    [][]float64
	Variance  float64
}

// NewEmbeddingAnalyzer creates a new embedding analyzer
func NewEmbeddingAnalyzer() *EmbeddingAnalyzer {
	return &EmbeddingAnalyzer{
		name:                 "embedding",
		embeddingDim:         50, // Reduced dimension for efficiency
		vocabularySize:       1000,
		numClusters:          5,
		maxIterations:        100,
		convergenceThreshold: 1e-4,
		outlierThreshold:     2.0, // Standard deviations
		distanceMetric:       "euclidean",
	}
}

// Name returns the analyzer name
func (ea *EmbeddingAnalyzer) Name() string {
	return ea.name
}

// Analyze performs embedding-based analysis on the text
func (ea *EmbeddingAnalyzer) Analyze(ctx context.Context, text string) (*models.AnalysisResult, error) {
	if len(text) == 0 {
		return &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil
	}

	// Generate text embeddings
	embeddings := ea.generateTextEmbeddings(text)
	if len(embeddings) == 0 {
		return &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil
	}

	// Perform k-means clustering
	clusters, clusterAssignments := ea.performKMeansClustering(embeddings)

	// Detect outliers
	outliers, outlierScore := ea.detectOutliers(embeddings, clusters, clusterAssignments)

	// Calculate centroid distances
	centroidDistances := ea.calculateCentroidDistances(embeddings, clusters, clusterAssignments)

	// Calculate embedding coherence
	coherenceScore := ea.calculateEmbeddingCoherence(embeddings)

	// Calculate semantic density
	semanticDensity := ea.calculateSemanticDensity(embeddings)

	// Calculate dimensional variance
	dimensionalVariance := ea.calculateDimensionalVariance(embeddings)

	// Combine metrics into anomaly score
	score := ea.calculateAnomalyScore(outlierScore, coherenceScore, semanticDensity, 
		dimensionalVariance, centroidDistances)

	// Calculate confidence
	confidence := ea.calculateConfidence(text, embeddings, outlierScore, coherenceScore)

	return &models.AnalysisResult{
		Score:      score,
		Confidence: confidence,
		Metadata: map[string]interface{}{
			"num_embeddings":        len(embeddings),
			"num_clusters":          len(clusters),
			"num_outliers":          len(outliers),
			"outlier_score":         outlierScore,
			"coherence_score":       coherenceScore,
			"semantic_density":      semanticDensity,
			"dimensional_variance":  dimensionalVariance,
			"avg_centroid_distance": ea.calculateMean(centroidDistances),
			"embedding_dimension":   ea.embeddingDim,
		},
	}, nil
}

// generateTextEmbeddings generates simple embeddings for text segments
func (ea *EmbeddingAnalyzer) generateTextEmbeddings(text string) [][]float64 {
	// Split text into sentences for embedding generation
	sentences := ea.splitIntoSentences(text)
	embeddings := make([][]float64, 0, len(sentences))

	for _, sentence := range sentences {
		if len(strings.TrimSpace(sentence)) == 0 {
			continue
		}
		
		embedding := ea.generateSentenceEmbedding(sentence)
		if embedding != nil {
			embeddings = append(embeddings, embedding)
		}
	}

	return embeddings
}

// splitIntoSentences splits text into sentences
func (ea *EmbeddingAnalyzer) splitIntoSentences(text string) []string {
	// Simple sentence splitting - could be enhanced with more sophisticated NLP
	sentences := strings.FieldsFunc(text, func(c rune) bool {
		return c == '.' || c == '!' || c == '?'
	})

	result := make([]string, 0, len(sentences))
	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if len(sentence) > 10 { // Filter very short sentences
			result = append(result, sentence)
		}
	}

	return result
}

// generateSentenceEmbedding generates a simple embedding for a sentence
func (ea *EmbeddingAnalyzer) generateSentenceEmbedding(sentence string) []float64 {
	words := strings.Fields(strings.ToLower(sentence))
	if len(words) == 0 {
		return nil
	}

	// Create a simple embedding based on word characteristics
	embedding := make([]float64, ea.embeddingDim)

	// Feature extraction for embedding generation
	for i, word := range words {
		cleanWord := ea.cleanWord(word)
		if len(cleanWord) == 0 {
			continue
		}

		// Generate features for this word
		wordFeatures := ea.extractWordFeatures(cleanWord, i, len(words))

		// Add word features to sentence embedding
		for j := 0; j < ea.embeddingDim && j < len(wordFeatures); j++ {
			embedding[j] += wordFeatures[j]
		}
	}

	// Normalize by sentence length
	if len(words) > 0 {
		for i := range embedding {
			embedding[i] /= float64(len(words))
		}
	}

	return embedding
}

// cleanWord removes punctuation and normalizes word
func (ea *EmbeddingAnalyzer) cleanWord(word string) string {
	cleaned := strings.Builder{}
	for _, char := range word {
		if unicode.IsLetter(char) || unicode.IsDigit(char) {
			cleaned.WriteRune(unicode.ToLower(char))
		}
	}
	return cleaned.String()
}

// extractWordFeatures extracts numerical features from a word
func (ea *EmbeddingAnalyzer) extractWordFeatures(word string, position, totalWords int) []float64 {
	features := make([]float64, ea.embeddingDim)
	
	if len(word) == 0 {
		return features
	}

	// Character-based features
	features[0] = float64(len(word))                                    // Word length
	features[1] = ea.calculateCharacterEntropy(word)                   // Character entropy
	features[2] = ea.countVowels(word) / float64(len(word))           // Vowel ratio
	features[3] = ea.countConsonants(word) / float64(len(word))       // Consonant ratio
	
	// Position features
	if totalWords > 1 {
		features[4] = float64(position) / float64(totalWords-1)        // Relative position
	}
	
	// Morphological features
	features[5] = ea.getWordComplexity(word)                          // Morphological complexity
	
	// Frequency-based features (simplified)
	features[6] = ea.estimateWordFrequency(word)                      // Estimated frequency
	
	// Character n-gram features
	for i := 7; i < ea.embeddingDim-10 && i-7 < len(word)-1; i++ {
		if i-7 < len(word) {
			features[i] = float64(word[i-7])                          // Character codes (normalized)
		}
	}
	
	// Hash-based features for remaining dimensions
	wordHash := ea.simpleHash(word)
	for i := ea.embeddingDim - 10; i < ea.embeddingDim; i++ {
		features[i] = float64((wordHash >> (i % 32)) & 1)
	}

	// Normalize features to [-1, 1] range
	for i := range features {
		features[i] = math.Tanh(features[i])
	}

	return features
}

// calculateCharacterEntropy calculates entropy of characters in a word
func (ea *EmbeddingAnalyzer) calculateCharacterEntropy(word string) float64 {
	if len(word) == 0 {
		return 0
	}

	freq := make(map[rune]int)
	for _, char := range word {
		freq[char]++
	}

	entropy := 0.0
	length := float64(len(word))
	for _, count := range freq {
		if count > 0 {
			p := float64(count) / length
			entropy -= p * math.Log2(p)
		}
	}

	return entropy
}

// countVowels counts vowels in a word
func (ea *EmbeddingAnalyzer) countVowels(word string) float64 {
	vowels := "aeiou"
	count := 0
	for _, char := range word {
		if strings.ContainsRune(vowels, unicode.ToLower(char)) {
			count++
		}
	}
	return float64(count)
}

// countConsonants counts consonants in a word
func (ea *EmbeddingAnalyzer) countConsonants(word string) float64 {
	vowels := "aeiou"
	count := 0
	for _, char := range word {
		if unicode.IsLetter(char) && !strings.ContainsRune(vowels, unicode.ToLower(char)) {
			count++
		}
	}
	return float64(count)
}

// getWordComplexity estimates morphological complexity
func (ea *EmbeddingAnalyzer) getWordComplexity(word string) float64 {
	complexity := 0.0
	
	// Common suffixes that increase complexity
	suffixes := []string{"ing", "ed", "er", "est", "ly", "tion", "ness", "ment", "able", "ible"}
	for _, suffix := range suffixes {
		if strings.HasSuffix(word, suffix) {
			complexity += 1.0
		}
	}
	
	// Common prefixes that increase complexity
	prefixes := []string{"un", "re", "pre", "dis", "mis", "over", "under", "out", "up"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(word, prefix) {
			complexity += 1.0
		}
	}
	
	return complexity
}

// estimateWordFrequency provides a rough frequency estimate
func (ea *EmbeddingAnalyzer) estimateWordFrequency(word string) float64 {
	// Simple frequency estimation based on word length and characteristics
	// This is a crude approximation - real implementation would use frequency dictionaries
	baseFreq := 1.0 / math.Pow(float64(len(word)), 1.5)
	
	// Common short words are more frequent
	if len(word) <= 3 {
		baseFreq *= 10.0
	}
	
	// Words with common patterns are more frequent
	if strings.Contains(word, "th") || strings.Contains(word, "er") || strings.Contains(word, "in") {
		baseFreq *= 2.0
	}
	
	return math.Min(1.0, baseFreq)
}

// simpleHash generates a simple hash for a word
func (ea *EmbeddingAnalyzer) simpleHash(word string) uint32 {
	hash := uint32(0)
	for _, char := range word {
		hash = hash*31 + uint32(char)
	}
	return hash
}

// performKMeansClustering performs k-means clustering on embeddings
func (ea *EmbeddingAnalyzer) performKMeansClustering(embeddings [][]float64) ([]ClusterResult, []int) {
	if len(embeddings) < ea.numClusters {
		// Not enough data points for clustering
		clusters := make([]ClusterResult, 1)
		clusters[0] = ClusterResult{
			ClusterID: 0,
			Centroid:  ea.calculateMeanVector(embeddings),
			Points:    embeddings,
			Variance:  ea.calculateClusterVariance(embeddings, ea.calculateMeanVector(embeddings)),
		}
		assignments := make([]int, len(embeddings))
		return clusters, assignments
	}

	k := ea.numClusters
	dim := len(embeddings[0])

	// Initialize centroids randomly
	centroids := ea.initializeCentroids(embeddings, k)
	assignments := make([]int, len(embeddings))
	
	for iteration := 0; iteration < ea.maxIterations; iteration++ {
		changed := false

		// Assign points to nearest centroid
		for i, point := range embeddings {
			newAssignment := ea.findNearestCentroid(point, centroids)
			if newAssignment != assignments[i] {
				changed = true
				assignments[i] = newAssignment
			}
		}

		if !changed {
			break
		}

		// Update centroids
		newCentroids := make([][]float64, k)
		for i := range newCentroids {
			newCentroids[i] = make([]float64, dim)
		}

		clusterCounts := make([]int, k)
		
		for i, point := range embeddings {
			cluster := assignments[i]
			clusterCounts[cluster]++
			for j := range point {
				newCentroids[cluster][j] += point[j]
			}
		}

		// Average the centroids
		for i, count := range clusterCounts {
			if count > 0 {
				for j := range newCentroids[i] {
					newCentroids[i][j] /= float64(count)
				}
			}
		}

		// Check for convergence
		converged := true
		for i := range centroids {
			distance := ea.euclideanDistance(centroids[i], newCentroids[i])
			if distance > ea.convergenceThreshold {
				converged = false
				break
			}
		}

		centroids = newCentroids

		if converged {
			break
		}
	}

	// Build cluster results
	clusters := make([]ClusterResult, k)
	for i := 0; i < k; i++ {
		clusterPoints := make([][]float64, 0)
		for j, assignment := range assignments {
			if assignment == i {
				clusterPoints = append(clusterPoints, embeddings[j])
			}
		}
		
		clusters[i] = ClusterResult{
			ClusterID: i,
			Centroid:  centroids[i],
			Points:    clusterPoints,
			Variance:  ea.calculateClusterVariance(clusterPoints, centroids[i]),
		}
	}

	return clusters, assignments
}

// initializeCentroids initializes k centroids using k-means++ method
func (ea *EmbeddingAnalyzer) initializeCentroids(embeddings [][]float64, k int) [][]float64 {
	centroids := make([][]float64, k)
	dim := len(embeddings[0])

	// Choose first centroid randomly
	centroids[0] = make([]float64, dim)
	copy(centroids[0], embeddings[0]) // Simple initialization

	// Choose remaining centroids using k-means++
	for i := 1; i < k; i++ {
		distances := make([]float64, len(embeddings))
		sum := 0.0

		for j, point := range embeddings {
			minDist := math.Inf(1)
			for l := 0; l < i; l++ {
				dist := ea.euclideanDistance(point, centroids[l])
				if dist < minDist {
					minDist = dist
				}
			}
			distances[j] = minDist * minDist
			sum += distances[j]
		}

		// Choose next centroid probabilistically
		if sum > 0 {
			target := sum * 0.5 // Simplified selection
			cumSum := 0.0
			for j, dist := range distances {
				cumSum += dist
				if cumSum >= target {
					centroids[i] = make([]float64, dim)
					copy(centroids[i], embeddings[j])
					break
				}
			}
		} else {
			centroids[i] = make([]float64, dim)
			copy(centroids[i], embeddings[i%len(embeddings)])
		}
	}

	return centroids
}

// findNearestCentroid finds the nearest centroid for a point
func (ea *EmbeddingAnalyzer) findNearestCentroid(point []float64, centroids [][]float64) int {
	minDistance := math.Inf(1)
	nearest := 0

	for i, centroid := range centroids {
		distance := ea.euclideanDistance(point, centroid)
		if distance < minDistance {
			minDistance = distance
			nearest = i
		}
	}

	return nearest
}

// euclideanDistance calculates Euclidean distance between two vectors
func (ea *EmbeddingAnalyzer) euclideanDistance(a, b []float64) float64 {
	if len(a) != len(b) {
		return math.Inf(1)
	}

	sum := 0.0
	for i := range a {
		diff := a[i] - b[i]
		sum += diff * diff
	}

	return math.Sqrt(sum)
}

// calculateMeanVector calculates the mean of a set of vectors
func (ea *EmbeddingAnalyzer) calculateMeanVector(vectors [][]float64) []float64 {
	if len(vectors) == 0 {
		return nil
	}

	dim := len(vectors[0])
	mean := make([]float64, dim)

	for _, vector := range vectors {
		for i, val := range vector {
			mean[i] += val
		}
	}

	for i := range mean {
		mean[i] /= float64(len(vectors))
	}

	return mean
}

// calculateClusterVariance calculates variance within a cluster
func (ea *EmbeddingAnalyzer) calculateClusterVariance(points [][]float64, centroid []float64) float64 {
	if len(points) == 0 {
		return 0.0
	}

	variance := 0.0
	for _, point := range points {
		distance := ea.euclideanDistance(point, centroid)
		variance += distance * distance
	}

	return variance / float64(len(points))
}

// detectOutliers detects outlier points using statistical methods
func (ea *EmbeddingAnalyzer) detectOutliers(embeddings [][]float64, clusters []ClusterResult, assignments []int) ([]int, float64) {
	outliers := make([]int, 0)

	// Calculate distances from each point to its cluster centroid
	distances := make([]float64, len(embeddings))
	for i, embedding := range embeddings {
		cluster := assignments[i]
		distances[i] = ea.euclideanDistance(embedding, clusters[cluster].Centroid)
	}

	// Calculate mean and standard deviation of distances
	mean := ea.calculateMean(distances)
	stdDev := ea.calculateStdDev(distances, mean)

	// Identify outliers using threshold
	threshold := mean + ea.outlierThreshold*stdDev
	outlierCount := 0

	for i, distance := range distances {
		if distance > threshold {
			outliers = append(outliers, i)
			outlierCount++
		}
	}

	outlierScore := float64(outlierCount) / float64(len(embeddings))
	return outliers, outlierScore
}

// calculateMean calculates the mean of a slice of float64 values
func (ea *EmbeddingAnalyzer) calculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	sum := 0.0
	for _, val := range values {
		sum += val
	}

	return sum / float64(len(values))
}

// calculateStdDev calculates standard deviation
func (ea *EmbeddingAnalyzer) calculateStdDev(values []float64, mean float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	variance := 0.0
	for _, val := range values {
		diff := val - mean
		variance += diff * diff
	}

	return math.Sqrt(variance / float64(len(values)))
}

// calculateCentroidDistances calculates distances from points to centroids
func (ea *EmbeddingAnalyzer) calculateCentroidDistances(embeddings [][]float64, clusters []ClusterResult, assignments []int) []float64 {
	distances := make([]float64, len(embeddings))

	for i, embedding := range embeddings {
		cluster := assignments[i]
		distances[i] = ea.euclideanDistance(embedding, clusters[cluster].Centroid)
	}

	return distances
}

// calculateEmbeddingCoherence measures how coherent the embeddings are
func (ea *EmbeddingAnalyzer) calculateEmbeddingCoherence(embeddings [][]float64) float64 {
	if len(embeddings) < 2 {
		return 1.0
	}

	// Calculate pairwise similarities
	similarities := make([]float64, 0)
	
	for i := 0; i < len(embeddings); i++ {
		for j := i + 1; j < len(embeddings); j++ {
			similarity := ea.cosineSimilarity(embeddings[i], embeddings[j])
			similarities = append(similarities, similarity)
		}
	}

	// Return average similarity as coherence measure
	return ea.calculateMean(similarities)
}

// cosineSimilarity calculates cosine similarity between two vectors
func (ea *EmbeddingAnalyzer) cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0.0
	}

	dotProduct := 0.0
	normA := 0.0
	normB := 0.0

	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0.0 || normB == 0.0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// calculateSemanticDensity measures semantic density of embeddings
func (ea *EmbeddingAnalyzer) calculateSemanticDensity(embeddings [][]float64) float64 {
	if len(embeddings) < 2 {
		return 0.0
	}

	// Calculate average distance between all pairs
	totalDistance := 0.0
	pairCount := 0

	for i := 0; i < len(embeddings); i++ {
		for j := i + 1; j < len(embeddings); j++ {
			distance := ea.euclideanDistance(embeddings[i], embeddings[j])
			totalDistance += distance
			pairCount++
		}
	}

	avgDistance := totalDistance / float64(pairCount)
	
	// Semantic density is inversely related to average distance
	// Normalize to 0-1 range
	maxPossibleDistance := math.Sqrt(float64(ea.embeddingDim)) * 2
	density := 1.0 - (avgDistance / maxPossibleDistance)
	
	return math.Max(0.0, math.Min(1.0, density))
}

// calculateDimensionalVariance calculates variance across embedding dimensions
func (ea *EmbeddingAnalyzer) calculateDimensionalVariance(embeddings [][]float64) float64 {
	if len(embeddings) == 0 {
		return 0.0
	}

	dim := len(embeddings[0])
	dimensionVariances := make([]float64, dim)

	// Calculate variance for each dimension
	for d := 0; d < dim; d++ {
		values := make([]float64, len(embeddings))
		for i, embedding := range embeddings {
			values[i] = embedding[d]
		}
		
		mean := ea.calculateMean(values)
		variance := 0.0
		for _, val := range values {
			diff := val - mean
			variance += diff * diff
		}
		dimensionVariances[d] = variance / float64(len(values))
	}

	// Return average variance across dimensions
	return ea.calculateMean(dimensionVariances)
}

// calculateAnomalyScore combines embedding metrics into final anomaly score
func (ea *EmbeddingAnalyzer) calculateAnomalyScore(outlierScore, coherenceScore, 
	semanticDensity, dimensionalVariance float64, centroidDistances []float64) float64 {

	score := 0.0

	// High outlier score suggests anomalous patterns
	outlierAnomalyScore := outlierScore

	// Very high or very low coherence might indicate artificial patterns
	coherenceAnomalyScore := 0.0
	if coherenceScore < 0.1 || coherenceScore > 0.9 {
		coherenceAnomalyScore = 0.6
	} else {
		coherenceAnomalyScore = math.Abs(coherenceScore - 0.5) * 2.0
	}

	// Unusual semantic density might indicate AI generation
	densityAnomalyScore := 0.0
	if semanticDensity < 0.2 || semanticDensity > 0.8 {
		densityAnomalyScore = 0.7
	} else {
		densityAnomalyScore = math.Abs(semanticDensity - 0.5) * 2.0
	}

	// Very low or very high dimensional variance might indicate artificial patterns
	varianceAnomalyScore := 0.0
	if dimensionalVariance < 0.01 {
		varianceAnomalyScore = 0.8 // Too uniform
	} else if dimensionalVariance > 1.0 {
		varianceAnomalyScore = 0.6 // Too random
	} else {
		varianceAnomalyScore = 0.2
	}

	// Large centroid distances might indicate inconsistent generation
	centroidAnomalyScore := 0.0
	if len(centroidDistances) > 0 {
		avgCentroidDistance := ea.calculateMean(centroidDistances)
		stdDevCentroidDistance := ea.calculateStdDev(centroidDistances, avgCentroidDistance)
		
		if stdDevCentroidDistance > avgCentroidDistance {
			centroidAnomalyScore = 0.6 // High variance in distances
		} else {
			centroidAnomalyScore = 0.3
		}
	}

	// Weighted combination
	score = (outlierAnomalyScore*0.25 + coherenceAnomalyScore*0.25 + 
		     densityAnomalyScore*0.25 + varianceAnomalyScore*0.15 + 
		     centroidAnomalyScore*0.10)

	return math.Max(0.0, math.Min(1.0, score))
}

// calculateConfidence determines confidence in the embedding analysis
func (ea *EmbeddingAnalyzer) calculateConfidence(text string, embeddings [][]float64, 
	outlierScore, coherenceScore float64) float64 {

	textLength := len(text)
	numEmbeddings := len(embeddings)

	// Base confidence on text length and number of embeddings
	lengthConfidence := math.Min(1.0, float64(textLength)/500.0)
	embeddingConfidence := math.Min(1.0, float64(numEmbeddings)/10.0)

	// Higher confidence when outlier detection is decisive
	outlierConfidence := 0.5
	if outlierScore < 0.1 || outlierScore > 0.3 {
		outlierConfidence = 0.8
	}

	// Higher confidence when coherence is reasonable
	coherenceConfidence := 1.0
	if coherenceScore < 0.0 || coherenceScore > 1.0 {
		coherenceConfidence = 0.3
	}

	// Statistical confidence based on sample size
	statisticalConfidence := 1.0
	if numEmbeddings < 5 {
		statisticalConfidence = 0.4
	} else if numEmbeddings < 10 {
		statisticalConfidence = 0.7
	}

	return lengthConfidence*0.25 + embeddingConfidence*0.2 + outlierConfidence*0.2 + 
		   coherenceConfidence*0.15 + statisticalConfidence*0.2
}