package models

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/mat"
	"gonum.org/v1/gonum/stat"
)

// PatternRecognitionModel implements ML models for anomaly pattern recognition
type PatternRecognitionModel struct {
	mu                 sync.RWMutex
	timeSeriesModel    *TimeSeriesModel
	clusteringModel    *ClusteringModel
	ensembleModel      *EnsembleModel
	neuralNetwork      *NeuralNetwork
	isTraining         bool
	lastUpdate         time.Time
	confidenceThreshold float64
}

// TimeSeriesModel for temporal pattern recognition
type TimeSeriesModel struct {
	seasonalWindows []float64
	trendCoeffs     []float64
	residuals       []float64
	period          int
	smoothingFactor float64
}

// ClusteringModel for grouping similar patterns
type ClusteringModel struct {
	centroids    [][]float64
	clusters     []int
	k            int
	maxIter      int
	tolerance    float64
}

// EnsembleModel combines multiple models
type EnsembleModel struct {
	models   []AnomalyModel
	weights  []float64
	strategy EnsembleStrategy
}

// NeuralNetwork for deep pattern learning
type NeuralNetwork struct {
	layers       []*Layer
	weights      []*mat.Dense
	biases       []*mat.VecDense
	learningRate float64
	epochs       int
}

// Layer represents a neural network layer
type Layer struct {
	size       int
	activation ActivationFunc
	neurons    []float64
}

type ActivationFunc func(float64) float64
type EnsembleStrategy int

const (
	WeightedAverage EnsembleStrategy = iota
	Voting
	Stacking
)

// AnomalyModel interface for different ML models
type AnomalyModel interface {
	Train(data [][]float64) error
	Predict(input []float64) (float64, error)
	GetConfidence() float64
}

// NewPatternRecognitionModel creates a new pattern recognition model
func NewPatternRecognitionModel(config *ModelConfig) *PatternRecognitionModel {
	return &PatternRecognitionModel{
		timeSeriesModel: &TimeSeriesModel{
			period:          config.SeasonalPeriod,
			smoothingFactor: config.SmoothingFactor,
		},
		clusteringModel: &ClusteringModel{
			k:         config.ClusterCount,
			maxIter:   config.MaxIterations,
			tolerance: config.Tolerance,
		},
		ensembleModel: &EnsembleModel{
			strategy: WeightedAverage,
		},
		neuralNetwork: &NeuralNetwork{
			learningRate: config.LearningRate,
			epochs:       config.Epochs,
		},
		confidenceThreshold: config.ConfidenceThreshold,
	}
}

// ModelConfig holds configuration for ML models
type ModelConfig struct {
	SeasonalPeriod      int     `json:"seasonal_period"`
	SmoothingFactor     float64 `json:"smoothing_factor"`
	ClusterCount        int     `json:"cluster_count"`
	MaxIterations       int     `json:"max_iterations"`
	Tolerance           float64 `json:"tolerance"`
	LearningRate        float64 `json:"learning_rate"`
	Epochs              int     `json:"epochs"`
	ConfidenceThreshold float64 `json:"confidence_threshold"`
}

// Train trains all models with the provided data
func (prm *PatternRecognitionModel) Train(ctx context.Context, data [][]float64) error {
	prm.mu.Lock()
	defer prm.mu.Unlock()

	prm.isTraining = true
	defer func() { prm.isTraining = false }()

	// Train time series model
	if err := prm.trainTimeSeries(data); err != nil {
		return fmt.Errorf("time series training failed: %w", err)
	}

	// Train clustering model
	if err := prm.trainClustering(data); err != nil {
		return fmt.Errorf("clustering training failed: %w", err)
	}

	// Train neural network
	if err := prm.trainNeuralNetwork(data); err != nil {
		return fmt.Errorf("neural network training failed: %w", err)
	}

	prm.lastUpdate = time.Now()
	return nil
}

// Predict returns anomaly score for given input
func (prm *PatternRecognitionModel) Predict(input []float64) (*PredictionResult, error) {
	prm.mu.RLock()
	defer prm.mu.RUnlock()

	if prm.isTraining {
		return nil, fmt.Errorf("model is currently training")
	}

	// Get predictions from all models
	tsScore, err := prm.predictTimeSeries(input)
	if err != nil {
		return nil, fmt.Errorf("time series prediction failed: %w", err)
	}

	clusterScore, err := prm.predictClustering(input)
	if err != nil {
		return nil, fmt.Errorf("clustering prediction failed: %w", err)
	}

	nnScore, err := prm.predictNeuralNetwork(input)
	if err != nil {
		return nil, fmt.Errorf("neural network prediction failed: %w", err)
	}

	// Ensemble prediction
	ensembleScore := prm.combineScores([]float64{tsScore, clusterScore, nnScore})

	return &PredictionResult{
		AnomalyScore:    ensembleScore,
		Confidence:      prm.calculateConfidence([]float64{tsScore, clusterScore, nnScore}),
		IsAnomalous:     ensembleScore > prm.confidenceThreshold,
		ModelScores:     map[string]float64{
			"time_series": tsScore,
			"clustering":  clusterScore,
			"neural_net":  nnScore,
		},
		Timestamp: time.Now(),
	}, nil
}

// PredictionResult contains prediction details
type PredictionResult struct {
	AnomalyScore float64            `json:"anomaly_score"`
	Confidence   float64            `json:"confidence"`
	IsAnomalous  bool               `json:"is_anomalous"`
	ModelScores  map[string]float64 `json:"model_scores"`
	Timestamp    time.Time          `json:"timestamp"`
}

// trainTimeSeries implements time series anomaly detection training
func (prm *PatternRecognitionModel) trainTimeSeries(data [][]float64) error {
	if len(data) == 0 {
		return fmt.Errorf("no training data provided")
	}

	// Extract time series from multi-dimensional data
	timeSeries := make([]float64, len(data))
	for i, point := range data {
		timeSeries[i] = floats.Sum(point) // Simple aggregation
	}

	// Seasonal decomposition
	period := prm.timeSeriesModel.period
	if period <= 0 {
		period = min(24, len(timeSeries)/4) // Default period
	}

	// Calculate seasonal components
	prm.timeSeriesModel.seasonalWindows = make([]float64, period)
	for i := 0; i < period; i++ {
		var seasonalSum float64
		var count int
		for j := i; j < len(timeSeries); j += period {
			seasonalSum += timeSeries[j]
			count++
		}
		if count > 0 {
			prm.timeSeriesModel.seasonalWindows[i] = seasonalSum / float64(count)
		}
	}

	// Calculate trend using exponential smoothing
	alpha := prm.timeSeriesModel.smoothingFactor
	if alpha <= 0 {
		alpha = 0.3 // Default smoothing factor
	}

	smoothed := make([]float64, len(timeSeries))
	smoothed[0] = timeSeries[0]
	for i := 1; i < len(timeSeries); i++ {
		smoothed[i] = alpha*timeSeries[i] + (1-alpha)*smoothed[i-1]
	}

	// Calculate residuals
	prm.timeSeriesModel.residuals = make([]float64, len(timeSeries))
	for i := range timeSeries {
		seasonal := prm.timeSeriesModel.seasonalWindows[i%period]
		prm.timeSeriesModel.residuals[i] = timeSeries[i] - smoothed[i] - seasonal
	}

	return nil
}

// trainClustering implements k-means clustering for pattern groups
func (prm *PatternRecognitionModel) trainClustering(data [][]float64) error {
	if len(data) == 0 {
		return fmt.Errorf("no training data provided")
	}

	k := prm.clusteringModel.k
	if k <= 0 {
		k = min(5, len(data)/10) // Default cluster count
	}

	dimensions := len(data[0])
	
	// Initialize centroids randomly
	prm.clusteringModel.centroids = make([][]float64, k)
	for i := range prm.clusteringModel.centroids {
		prm.clusteringModel.centroids[i] = make([]float64, dimensions)
		for j := range prm.clusteringModel.centroids[i] {
			prm.clusteringModel.centroids[i][j] = data[i%len(data)][j] // Simple initialization
		}
	}

	// K-means algorithm
	prm.clusteringModel.clusters = make([]int, len(data))
	
	for iter := 0; iter < prm.clusteringModel.maxIter; iter++ {
		// Assign points to nearest centroids
		changed := false
		for i, point := range data {
			minDist := math.Inf(1)
			bestCluster := 0
			
			for j, centroid := range prm.clusteringModel.centroids {
				dist := euclideanDistance(point, centroid)
				if dist < minDist {
					minDist = dist
					bestCluster = j
				}
			}
			
			if prm.clusteringModel.clusters[i] != bestCluster {
				changed = true
				prm.clusteringModel.clusters[i] = bestCluster
			}
		}

		if !changed {
			break
		}

		// Update centroids
		clusterSums := make([][]float64, k)
		clusterCounts := make([]int, k)
		
		for i := range clusterSums {
			clusterSums[i] = make([]float64, dimensions)
		}
		
		for i, point := range data {
			cluster := prm.clusteringModel.clusters[i]
			for j, val := range point {
				clusterSums[cluster][j] += val
			}
			clusterCounts[cluster]++
		}
		
		for i := range prm.clusteringModel.centroids {
			if clusterCounts[i] > 0 {
				for j := range prm.clusteringModel.centroids[i] {
					prm.clusteringModel.centroids[i][j] = clusterSums[i][j] / float64(clusterCounts[i])
				}
			}
		}
	}

	return nil
}

// trainNeuralNetwork implements neural network training
func (prm *PatternRecognitionModel) trainNeuralNetwork(data [][]float64) error {
	if len(data) == 0 {
		return fmt.Errorf("no training data provided")
	}

	inputSize := len(data[0])
	hiddenSize := max(10, inputSize/2)
	outputSize := 1

	// Initialize network architecture
	prm.neuralNetwork.layers = []*Layer{
		{size: inputSize, activation: identity},
		{size: hiddenSize, activation: relu},
		{size: outputSize, activation: sigmoid},
	}

	// Initialize weights and biases
	prm.neuralNetwork.weights = make([]*mat.Dense, len(prm.neuralNetwork.layers)-1)
	prm.neuralNetwork.biases = make([]*mat.VecDense, len(prm.neuralNetwork.layers)-1)

	for i := 0; i < len(prm.neuralNetwork.layers)-1; i++ {
		rows := prm.neuralNetwork.layers[i+1].size
		cols := prm.neuralNetwork.layers[i].size
		
		weights := mat.NewDense(rows, cols, nil)
		// Xavier initialization
		scale := math.Sqrt(2.0 / float64(cols))
		for r := 0; r < rows; r++ {
			for c := 0; c < cols; c++ {
				weights.Set(r, c, (2*math.Sin(float64(r*cols+c))-1)*scale)
			}
		}
		prm.neuralNetwork.weights[i] = weights
		
		bias := mat.NewVecDense(rows, nil)
		prm.neuralNetwork.biases[i] = bias
	}

	// Training loop with simple autoencoder approach
	for epoch := 0; epoch < prm.neuralNetwork.epochs; epoch++ {
		totalLoss := 0.0
		
		for _, input := range data {
			// Forward pass
			output := prm.forwardPass(input)
			
			// Calculate reconstruction loss (autoencoder)
			loss := 0.0
			for i, val := range input {
				if i < len(output) {
					loss += math.Pow(val-output[i], 2)
				}
			}
			loss /= float64(len(input))
			totalLoss += loss
			
			// Backward pass (simplified)
			prm.backwardPass(input, output, loss)
		}
		
		// Early stopping if loss is small enough
		if totalLoss/float64(len(data)) < 0.001 {
			break
		}
	}

	return nil
}

// Prediction methods
func (prm *PatternRecognitionModel) predictTimeSeries(input []float64) (float64, error) {
	if len(prm.timeSeriesModel.residuals) == 0 {
		return 0, fmt.Errorf("model not trained")
	}

	// Calculate anomaly score based on deviation from expected pattern
	aggregated := floats.Sum(input)
	
	// Compare with seasonal pattern
	period := prm.timeSeriesModel.period
	if period <= 0 {
		period = 24
	}
	
	expectedSeasonal := 0.0
	if len(prm.timeSeriesModel.seasonalWindows) > 0 {
		seasonalIndex := int(time.Now().Hour()) % len(prm.timeSeriesModel.seasonalWindows)
		expectedSeasonal = prm.timeSeriesModel.seasonalWindows[seasonalIndex]
	}
	
	// Calculate z-score using residuals statistics
	residualMean := stat.Mean(prm.timeSeriesModel.residuals, nil)
	residualStd := stat.StdDev(prm.timeSeriesModel.residuals, nil)
	
	if residualStd == 0 {
		residualStd = 1.0 // Avoid division by zero
	}
	
	deviation := aggregated - expectedSeasonal
	zScore := math.Abs((deviation - residualMean) / residualStd)
	
	// Convert z-score to anomaly probability
	return math.Min(zScore/3.0, 1.0), nil
}

func (prm *PatternRecognitionModel) predictClustering(input []float64) (float64, error) {
	if len(prm.clusteringModel.centroids) == 0 {
		return 0, fmt.Errorf("model not trained")
	}

	// Find minimum distance to any centroid
	minDist := math.Inf(1)
	for _, centroid := range prm.clusteringModel.centroids {
		dist := euclideanDistance(input, centroid)
		if dist < minDist {
			minDist = dist
		}
	}

	// Normalize distance to anomaly score
	maxExpectedDist := 5.0 // Configurable threshold
	return math.Min(minDist/maxExpectedDist, 1.0), nil
}

func (prm *PatternRecognitionModel) predictNeuralNetwork(input []float64) (float64, error) {
	if len(prm.neuralNetwork.layers) == 0 {
		return 0, fmt.Errorf("model not trained")
	}

	// Forward pass to get reconstruction
	output := prm.forwardPass(input)
	
	// Calculate reconstruction error as anomaly score
	mse := 0.0
	for i, val := range input {
		if i < len(output) {
			mse += math.Pow(val-output[i], 2)
		}
	}
	mse /= float64(len(input))
	
	// Normalize to [0,1]
	return math.Min(mse, 1.0), nil
}

// Helper methods
func (prm *PatternRecognitionModel) combineScores(scores []float64) float64 {
	if len(scores) == 0 {
		return 0
	}
	
	// Simple weighted average
	weights := []float64{0.4, 0.3, 0.3} // TS, Clustering, NN
	
	if len(weights) != len(scores) {
		// Fallback to simple average
		return floats.Sum(scores) / float64(len(scores))
	}
	
	weighted := 0.0
	for i, score := range scores {
		weighted += score * weights[i]
	}
	
	return weighted
}

func (prm *PatternRecognitionModel) calculateConfidence(scores []float64) float64 {
	if len(scores) == 0 {
		return 0
	}
	
	// Confidence based on agreement between models
	mean := floats.Sum(scores) / float64(len(scores))
	variance := 0.0
	for _, score := range scores {
		variance += math.Pow(score-mean, 2)
	}
	variance /= float64(len(scores))
	
	// Higher agreement (lower variance) = higher confidence
	return math.Max(0, 1.0-variance)
}

func (prm *PatternRecognitionModel) forwardPass(input []float64) []float64 {
	current := input
	
	for i := 0; i < len(prm.neuralNetwork.weights); i++ {
		// Matrix multiplication: weights * input + bias
		inputVec := mat.NewVecDense(len(current), current)
		outputVec := mat.NewVecDense(prm.neuralNetwork.weights[i].RawMatrix().Rows, nil)
		
		outputVec.MulVec(prm.neuralNetwork.weights[i], inputVec)
		outputVec.AddVec(outputVec, prm.neuralNetwork.biases[i])
		
		// Apply activation function
		result := make([]float64, outputVec.Len())
		for j := 0; j < outputVec.Len(); j++ {
			result[j] = prm.neuralNetwork.layers[i+1].activation(outputVec.AtVec(j))
		}
		
		current = result
	}
	
	return current
}

func (prm *PatternRecognitionModel) backwardPass(input, output []float64, loss float64) {
	// Simplified backpropagation - in production, use proper gradient calculation
	lr := prm.neuralNetwork.learningRate
	
	for i := len(prm.neuralNetwork.weights) - 1; i >= 0; i-- {
		// Update weights based on loss (simplified)
		rows, cols := prm.neuralNetwork.weights[i].Dims()
		for r := 0; r < rows; r++ {
			for c := 0; c < cols; c++ {
				currentWeight := prm.neuralNetwork.weights[i].At(r, c)
				gradient := loss * lr * 0.01 // Simplified gradient
				prm.neuralNetwork.weights[i].Set(r, c, currentWeight-gradient)
			}
		}
	}
}

// Utility functions
func euclideanDistance(a, b []float64) float64 {
	if len(a) != len(b) {
		return math.Inf(1)
	}
	
	sum := 0.0
	for i := range a {
		sum += math.Pow(a[i]-b[i], 2)
	}
	return math.Sqrt(sum)
}

// Activation functions
func relu(x float64) float64 {
	return math.Max(0, x)
}

func sigmoid(x float64) float64 {
	return 1.0 / (1.0 + math.Exp(-x))
}

func identity(x float64) float64 {
	return x
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// GetModelStatus returns current model status
func (prm *PatternRecognitionModel) GetModelStatus() *ModelStatus {
	prm.mu.RLock()
	defer prm.mu.RUnlock()
	
	return &ModelStatus{
		IsTraining:          prm.isTraining,
		LastUpdate:          prm.lastUpdate,
		ConfidenceThreshold: prm.confidenceThreshold,
		ModelDetails: map[string]interface{}{
			"time_series_period":    prm.timeSeriesModel.period,
			"clustering_k":          prm.clusteringModel.k,
			"neural_network_layers": len(prm.neuralNetwork.layers),
		},
	}
}

// ModelStatus represents current model state
type ModelStatus struct {
	IsTraining          bool                   `json:"is_training"`
	LastUpdate          time.Time              `json:"last_update"`
	ConfidenceThreshold float64                `json:"confidence_threshold"`
	ModelDetails        map[string]interface{} `json:"model_details"`
}