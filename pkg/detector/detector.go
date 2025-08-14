package detector

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/ruvnet/alienator/pkg/models"
)

// Detector represents an anomaly detection engine
type Detector struct {
	config    Config
	logger    *zap.Logger
	models    map[string]Model
	mu        sync.RWMutex
	isRunning bool
	stopChan  chan struct{}
}

// Config holds detector configuration
type Config struct {
	Threshold       float64       `json:"threshold"`
	WindowSize      int           `json:"window_size"`
	MinSamples      int           `json:"min_samples"`
	UpdateInterval  time.Duration `json:"update_interval"`
	EnableML        bool          `json:"enable_ml"`
	ModelPath       string        `json:"model_path"`
	FeatureCount    int           `json:"feature_count"`
	BatchSize       int           `json:"batch_size"`
	LearningRate    float64       `json:"learning_rate"`
	EnableCrypto    bool          `json:"enable_crypto"`
	CryptoAlgorithm string        `json:"crypto_algorithm"`
}

// Model represents a machine learning model interface
type Model interface {
	Train(ctx context.Context, data []models.DataPoint) error
	Predict(ctx context.Context, data []models.DataPoint) ([]models.Prediction, error)
	UpdateWeights(ctx context.Context, feedback []models.Feedback) error
	GetMetrics() models.ModelMetrics
}

// Result represents the detection result
type Result struct {
	IsAnomaly      bool               `json:"is_anomaly"`
	Score          float64            `json:"score"`
	Confidence     float64            `json:"confidence"`
	Timestamp      time.Time          `json:"timestamp"`
	Features       map[string]float64 `json:"features"`
	ModelUsed      string             `json:"model_used"`
	ProcessingTime time.Duration      `json:"processing_time"`
}

// New creates a new anomaly detector
func New(config Config, logger *zap.Logger) *Detector {
	return &Detector{
		config:   config,
		logger:   logger,
		models:   make(map[string]Model),
		stopChan: make(chan struct{}),
	}
}

// Start starts the anomaly detector
func (d *Detector) Start(ctx context.Context) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.isRunning {
		return fmt.Errorf("detector is already running")
	}

	d.logger.Info("Starting anomaly detector",
		zap.Float64("threshold", d.config.Threshold),
		zap.Int("window_size", d.config.WindowSize),
		zap.Bool("enable_ml", d.config.EnableML),
	)

	// Initialize models if ML is enabled
	if d.config.EnableML {
		if err := d.initializeModels(ctx); err != nil {
			return fmt.Errorf("failed to initialize models: %w", err)
		}
	}

	d.isRunning = true

	// Start background workers
	go d.modelUpdateWorker(ctx)
	go d.metricsWorker(ctx)

	return nil
}

// Stop stops the anomaly detector
func (d *Detector) Stop() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if !d.isRunning {
		return fmt.Errorf("detector is not running")
	}

	d.logger.Info("Stopping anomaly detector")

	close(d.stopChan)
	d.isRunning = false

	return nil
}

// Detect performs anomaly detection on the given data points
func (d *Detector) Detect(ctx context.Context, dataPoints []models.DataPoint) ([]Result, error) {
	startTime := time.Now()

	d.mu.RLock()
	defer d.mu.RUnlock()

	if !d.isRunning {
		return nil, fmt.Errorf("detector is not running")
	}

	if len(dataPoints) == 0 {
		return nil, fmt.Errorf("no data points provided")
	}

	results := make([]Result, 0, len(dataPoints))

	// Statistical detection (always enabled)
	statResults, err := d.detectStatistical(ctx, dataPoints)
	if err != nil {
		d.logger.Error("Statistical detection failed", zap.Error(err))
		return nil, fmt.Errorf("statistical detection failed: %w", err)
	}

	// ML detection (if enabled)
	var mlResults []Result
	if d.config.EnableML && len(d.models) > 0 {
		mlResults, err = d.detectML(ctx, dataPoints)
		if err != nil {
			d.logger.Warn("ML detection failed, falling back to statistical", zap.Error(err))
			mlResults = make([]Result, len(dataPoints))
		}
	}

	// Combine results
	for i, dataPoint := range dataPoints {
		result := Result{
			Timestamp:      dataPoint.Timestamp,
			Features:       dataPoint.Features,
			ProcessingTime: time.Since(startTime),
		}

		// Use statistical result as base
		if i < len(statResults) {
			result.IsAnomaly = statResults[i].IsAnomaly
			result.Score = statResults[i].Score
			result.Confidence = statResults[i].Confidence
			result.ModelUsed = "statistical"
		}

		// Enhance with ML results if available
		if d.config.EnableML && i < len(mlResults) && mlResults[i].Score > 0 {
			// Weighted combination of statistical and ML scores
			combinedScore := (result.Score + mlResults[i].Score) / 2
			result.Score = combinedScore
			result.IsAnomaly = combinedScore > d.config.Threshold
			result.Confidence = (result.Confidence + mlResults[i].Confidence) / 2
			result.ModelUsed = "hybrid"
		}

		results = append(results, result)
	}

	d.logger.Debug("Detection completed",
		zap.Int("data_points", len(dataPoints)),
		zap.Int("anomalies", d.countAnomalies(results)),
		zap.Duration("processing_time", time.Since(startTime)),
	)

	return results, nil
}

// TrainModel trains a specific model with the provided data
func (d *Detector) TrainModel(ctx context.Context, modelName string, data []models.DataPoint) error {
	d.mu.RLock()
	model, exists := d.models[modelName]
	d.mu.RUnlock()

	if !exists {
		return fmt.Errorf("model %s not found", modelName)
	}

	d.logger.Info("Training model", zap.String("model", modelName), zap.Int("samples", len(data)))

	if err := model.Train(ctx, data); err != nil {
		return fmt.Errorf("failed to train model %s: %w", modelName, err)
	}

	return nil
}

// GetMetrics returns detector metrics
func (d *Detector) GetMetrics() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	metrics := map[string]interface{}{
		"is_running":    d.isRunning,
		"models_count":  len(d.models),
		"threshold":     d.config.Threshold,
		"window_size":   d.config.WindowSize,
		"enable_ml":     d.config.EnableML,
		"enable_crypto": d.config.EnableCrypto,
	}

	// Add model-specific metrics
	modelMetrics := make(map[string]models.ModelMetrics)
	for name, model := range d.models {
		modelMetrics[name] = model.GetMetrics()
	}
	metrics["models"] = modelMetrics

	return metrics
}

// detectStatistical performs statistical anomaly detection
func (d *Detector) detectStatistical(ctx context.Context, dataPoints []models.DataPoint) ([]Result, error) {
	results := make([]Result, len(dataPoints))

	for i, dataPoint := range dataPoints {
		score := d.calculateStatisticalScore(dataPoint)

		results[i] = Result{
			IsAnomaly:  score > d.config.Threshold,
			Score:      score,
			Confidence: d.calculateConfidence(score, "statistical"),
			Timestamp:  dataPoint.Timestamp,
			Features:   dataPoint.Features,
			ModelUsed:  "statistical",
		}
	}

	return results, nil
}

// detectML performs machine learning based anomaly detection
func (d *Detector) detectML(ctx context.Context, dataPoints []models.DataPoint) ([]Result, error) {
	if len(d.models) == 0 {
		return nil, fmt.Errorf("no ML models available")
	}

	// Use the first available model (can be enhanced to use ensemble)
	var model Model
	var modelName string
	for name, m := range d.models {
		model = m
		modelName = name
		break
	}

	predictions, err := model.Predict(ctx, dataPoints)
	if err != nil {
		return nil, err
	}

	results := make([]Result, len(dataPoints))
	for i, prediction := range predictions {
		if i < len(dataPoints) {
			results[i] = Result{
				IsAnomaly:  prediction.Score > d.config.Threshold,
				Score:      prediction.Score,
				Confidence: prediction.Confidence,
				Timestamp:  dataPoints[i].Timestamp,
				Features:   dataPoints[i].Features,
				ModelUsed:  modelName,
			}
		}
	}

	return results, nil
}

// calculateStatisticalScore calculates anomaly score using statistical methods
func (d *Detector) calculateStatisticalScore(dataPoint models.DataPoint) float64 {
	// Simple implementation - can be enhanced with more sophisticated algorithms
	// For now, use a basic threshold-based approach on feature values

	var totalScore float64
	var featureCount int

	for _, value := range dataPoint.Features {
		// Normalize feature value (assuming values are between 0 and 1)
		normalizedValue := value
		if normalizedValue > 1.0 {
			normalizedValue = 1.0
		}
		if normalizedValue < 0.0 {
			normalizedValue = 0.0
		}

		// Score based on deviation from expected normal range (0.4-0.6)
		if normalizedValue < 0.4 || normalizedValue > 0.6 {
			deviation := 0.0
			if normalizedValue < 0.4 {
				deviation = 0.4 - normalizedValue
			} else {
				deviation = normalizedValue - 0.6
			}
			totalScore += deviation * 2.5 // Amplify the score
		}
		featureCount++
	}

	if featureCount == 0 {
		return 0.0
	}

	avgScore := totalScore / float64(featureCount)
	if avgScore > 1.0 {
		avgScore = 1.0
	}

	return avgScore
}

// calculateConfidence calculates confidence based on score and method
func (d *Detector) calculateConfidence(score float64, method string) float64 {
	// Simple confidence calculation based on how far the score is from threshold
	diff := score - d.config.Threshold
	if diff < 0 {
		diff = -diff
	}

	confidence := 0.5 + (diff * 0.5)
	if confidence > 1.0 {
		confidence = 1.0
	}

	return confidence
}

// countAnomalies counts the number of anomalies in results
func (d *Detector) countAnomalies(results []Result) int {
	count := 0
	for _, result := range results {
		if result.IsAnomaly {
			count++
		}
	}
	return count
}

// initializeModels initializes ML models
func (d *Detector) initializeModels(ctx context.Context) error {
	// Placeholder for model initialization
	// In a real implementation, this would load pre-trained models or initialize new ones
	d.logger.Info("Initializing ML models", zap.String("model_path", d.config.ModelPath))

	// For now, we'll just log that models would be initialized here
	// Real models would be added to d.models map

	return nil
}

// modelUpdateWorker runs background model updates
func (d *Detector) modelUpdateWorker(ctx context.Context) {
	ticker := time.NewTicker(d.config.UpdateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.stopChan:
			return
		case <-ticker.C:
			d.updateModels(ctx)
		}
	}
}

// metricsWorker collects and logs metrics periodically
func (d *Detector) metricsWorker(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.stopChan:
			return
		case <-ticker.C:
			metrics := d.GetMetrics()
			d.logger.Debug("Detector metrics", zap.Any("metrics", metrics))
		}
	}
}

// updateModels performs periodic model updates
func (d *Detector) updateModels(ctx context.Context) {
	d.logger.Debug("Updating ML models")
	// Placeholder for model updates
	// In a real implementation, this would retrain models with new data
}
