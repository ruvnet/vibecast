package ml

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/ruvnet/alienator/internal/analyzers"
)

// NeuralNetwork represents a simple feedforward neural network
type NeuralNetwork struct {
	inputSize    int
	hiddenSize   int
	outputSize   int
	weights1     [][]float64 // Input to hidden
	weights2     [][]float64 // Hidden to output
	biases1      []float64   // Hidden layer biases
	biases2      []float64   // Output layer biases
	learningRate float64
}

// TrainingData represents training samples
type TrainingData struct {
	Inputs  []float64
	Outputs []float64
}

// NeuralDetector implements ML-based anomaly detection using a simple neural network
type NeuralDetector struct {
	config       *analyzers.Configuration
	network      *NeuralNetwork
	isTrained    bool
	trainingData []TrainingData
	scaler       *MinMaxScaler
	windowSize   int
	threshold    float64
	mu           sync.RWMutex
}

// MinMaxScaler for data normalization
type MinMaxScaler struct {
	min    []float64
	max    []float64
	fitted bool
}

// NewNeuralDetector creates a new neural network-based anomaly detector
func NewNeuralDetector(config *analyzers.Configuration) (*NeuralDetector, error) {
	if config == nil {
		config = analyzers.DefaultConfiguration()
	}

	windowSize := config.WindowSize
	if windowSize < 10 {
		windowSize = 10
	}

	detector := &NeuralDetector{
		config:       config,
		windowSize:   windowSize,
		threshold:    0.5, // Anomaly threshold
		scaler:       &MinMaxScaler{},
		trainingData: make([]TrainingData, 0),
	}

	// Initialize neural network
	detector.network = NewNeuralNetwork(windowSize, windowSize/2, 1, 0.01)

	return detector, nil
}

// NewNeuralNetwork creates a new neural network
func NewNeuralNetwork(inputSize, hiddenSize, outputSize int, learningRate float64) *NeuralNetwork {
	nn := &NeuralNetwork{
		inputSize:    inputSize,
		hiddenSize:   hiddenSize,
		outputSize:   outputSize,
		learningRate: learningRate,
	}

	// Initialize weights and biases randomly
	nn.weights1 = make([][]float64, inputSize)
	for i := range nn.weights1 {
		nn.weights1[i] = make([]float64, hiddenSize)
		for j := range nn.weights1[i] {
			nn.weights1[i][j] = rand.Float64()*2 - 1 // Random between -1 and 1
		}
	}

	nn.weights2 = make([][]float64, hiddenSize)
	for i := range nn.weights2 {
		nn.weights2[i] = make([]float64, outputSize)
		for j := range nn.weights2[i] {
			nn.weights2[i][j] = rand.Float64()*2 - 1
		}
	}

	nn.biases1 = make([]float64, hiddenSize)
	nn.biases2 = make([]float64, outputSize)
	for i := range nn.biases1 {
		nn.biases1[i] = rand.Float64()*2 - 1
	}
	for i := range nn.biases2 {
		nn.biases2[i] = rand.Float64()*2 - 1
	}

	return nn
}

// Name returns the analyzer name
func (d *NeuralDetector) Name() string {
	return "neural-detector"
}

// Type returns the analyzer type
func (d *NeuralDetector) Type() analyzers.AnomalyType {
	return analyzers.AnomalyTypeML
}

// Analyze performs ML-based anomaly detection
func (d *NeuralDetector) Analyze(ctx context.Context, data *analyzers.TimeSeries) (*analyzers.AnalysisResult, error) {
	start := time.Now()

	if len(data.DataPoints) < d.config.MinDataPoints {
		return &analyzers.AnalysisResult{
			Anomalies: []analyzers.Anomaly{},
			Score:     0.0,
			Metadata: map[string]interface{}{
				"error":    "insufficient data points",
				"required": d.config.MinDataPoints,
				"actual":   len(data.DataPoints),
			},
			Duration: time.Since(start),
		}, nil
	}

	if !d.isTrained {
		// Auto-train if not trained yet
		if err := d.autoTrain(data); err != nil {
			return nil, fmt.Errorf("failed to auto-train: %w", err)
		}
	}

	// Convert data points to float64 values
	values, err := d.extractValues(data.DataPoints)
	if err != nil {
		return nil, fmt.Errorf("failed to extract values: %w", err)
	}

	// Scale values
	scaledValues := d.scaler.Transform(values)

	// Create sliding windows for prediction
	windows := d.createWindows(scaledValues)

	// Detect anomalies
	anomalies := d.detectAnomalies(data.DataPoints, windows)

	// Calculate overall score
	score := d.calculateOverallScore(anomalies)

	duration := time.Since(start)

	metadata := map[string]interface{}{
		"model_trained":       d.isTrained,
		"training_samples":    len(d.trainingData),
		"window_size":         d.windowSize,
		"threshold":           d.threshold,
		"windows_analyzed":    len(windows),
		"network_input_size":  d.network.inputSize,
		"network_hidden_size": d.network.hiddenSize,
		"processing_time_ms":  duration.Milliseconds(),
	}

	return &analyzers.AnalysisResult{
		Anomalies: anomalies,
		Score:     score,
		Metadata:  metadata,
		Duration:  duration,
	}, nil
}

// Configure updates the detector configuration
func (d *NeuralDetector) Configure(config map[string]interface{}) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if threshold, ok := config["threshold"].(float64); ok {
		d.threshold = threshold
	}

	if windowSize, ok := config["window_size"].(int); ok {
		d.windowSize = windowSize
		// Reinitialize network with new window size
		d.network = NewNeuralNetwork(windowSize, windowSize/2, 1, d.network.learningRate)
		d.isTrained = false // Need to retrain with new architecture
	}

	if learningRate, ok := config["learning_rate"].(float64); ok {
		d.network.learningRate = learningRate
	}

	return nil
}

// IsReady returns true if the detector is trained and ready
func (d *NeuralDetector) IsReady() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.isTrained
}

// IsTrained returns true if the detector has been trained
func (d *NeuralDetector) IsTrained() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.isTrained
}

// Train trains the neural network with the given data
func (d *NeuralDetector) Train(ctx context.Context, data []*analyzers.TimeSeries) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Prepare training data from all time series
	var allValues []float64
	for _, ts := range data {
		values, err := d.extractValues(ts.DataPoints)
		if err != nil {
			return fmt.Errorf("failed to extract values from %s: %w", ts.Name, err)
		}
		allValues = append(allValues, values...)
	}

	if len(allValues) < d.windowSize*2 {
		return fmt.Errorf("insufficient data for training: need at least %d points, got %d", d.windowSize*2, len(allValues))
	}

	// Fit scaler
	d.scaler.Fit(allValues)

	// Scale values
	scaledValues := d.scaler.Transform(allValues)

	// Create training samples (autoencoder approach)
	d.trainingData = make([]TrainingData, 0)
	for i := 0; i <= len(scaledValues)-d.windowSize; i++ {
		window := scaledValues[i : i+d.windowSize]

		// For autoencoder, input and output are the same (reconstruction)
		// But we'll predict the next value instead for anomaly detection
		if i < len(scaledValues)-d.windowSize {
			nextValue := scaledValues[i+d.windowSize]
			d.trainingData = append(d.trainingData, TrainingData{
				Inputs:  window,
				Outputs: []float64{nextValue},
			})
		}
	}

	if len(d.trainingData) == 0 {
		return fmt.Errorf("no training samples generated")
	}

	// Train the network
	epochs := 100
	if customEpochs, ok := d.config.Metadata["epochs"].(int); ok {
		epochs = customEpochs
	}

	for epoch := 0; epoch < epochs; epoch++ {
		var totalLoss float64

		for _, sample := range d.trainingData {
			// Forward pass
			prediction := d.network.Forward(sample.Inputs)

			// Calculate loss (mean squared error)
			loss := 0.0
			for i, target := range sample.Outputs {
				diff := prediction[i] - target
				loss += diff * diff
			}
			loss /= float64(len(sample.Outputs))
			totalLoss += loss

			// Backward pass
			d.network.Backward(sample.Inputs, sample.Outputs, prediction)
		}

		// Optional: Log training progress
		if epoch%20 == 0 {
			avgLoss := totalLoss / float64(len(d.trainingData))
			_ = avgLoss // Could log this in a real implementation
		}

		// Check for context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}

	d.isTrained = true
	return nil
}

// Close cleans up resources
func (d *NeuralDetector) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.trainingData = nil
	d.network = nil
	d.isTrained = false
	return nil
}

// autoTrain performs automatic training on the given data
func (d *NeuralDetector) autoTrain(data *analyzers.TimeSeries) error {
	// Use the current data for training (simplified approach)
	return d.Train(context.Background(), []*analyzers.TimeSeries{data})
}

// extractValues converts data points to float64 values
func (d *NeuralDetector) extractValues(dataPoints []analyzers.DataPoint) ([]float64, error) {
	values := make([]float64, len(dataPoints))

	for i, point := range dataPoints {
		switch v := point.Value.(type) {
		case float64:
			values[i] = v
		case float32:
			values[i] = float64(v)
		case int:
			values[i] = float64(v)
		case int32:
			values[i] = float64(v)
		case int64:
			values[i] = float64(v)
		default:
			return nil, fmt.Errorf("unsupported value type: %T", v)
		}
	}

	return values, nil
}

// createWindows creates sliding windows from the scaled values
func (d *NeuralDetector) createWindows(values []float64) [][]float64 {
	if len(values) < d.windowSize {
		return nil
	}

	windows := make([][]float64, 0)
	for i := 0; i <= len(values)-d.windowSize; i++ {
		window := make([]float64, d.windowSize)
		copy(window, values[i:i+d.windowSize])
		windows = append(windows, window)
	}

	return windows
}

// detectAnomalies identifies anomalies using the trained network
func (d *NeuralDetector) detectAnomalies(dataPoints []analyzers.DataPoint, windows [][]float64) []analyzers.Anomaly {
	var anomalies []analyzers.Anomaly

	for i, window := range windows {
		// Predict next value
		prediction := d.network.Forward(window)

		// Calculate reconstruction error / prediction error
		if i+d.windowSize < len(dataPoints) {
			actualIndex := i + d.windowSize
			actualValue, err := d.toFloat64(dataPoints[actualIndex].Value)
			if err != nil {
				continue
			}

			// Scale the actual value for comparison
			scaledActual := d.scaler.TransformSingle(actualValue)

			// Calculate error
			predictionError := math.Abs(prediction[0] - scaledActual)

			// Classify as anomaly if error exceeds threshold
			if predictionError > d.threshold {
				severity := d.calculateSeverity(predictionError)

				anomaly := analyzers.Anomaly{
					ID:        fmt.Sprintf("ml_%d_%d", dataPoints[actualIndex].Timestamp.Unix(), i),
					Type:      analyzers.AnomalyTypeML,
					Severity:  severity,
					Score:     predictionError,
					Timestamp: dataPoints[actualIndex].Timestamp,
					Value:     actualValue,
					Expected:  d.scaler.InverseTransformSingle(prediction[0]),
					Source:    d.Name(),
					Message:   "ML model detected anomalous pattern",
					Metadata: map[string]interface{}{
						"prediction_error": predictionError,
						"predicted_value":  d.scaler.InverseTransformSingle(prediction[0]),
						"window_index":     i,
						"raw_prediction":   prediction[0],
						"scaled_actual":    scaledActual,
					},
				}
				anomalies = append(anomalies, anomaly)
			}
		}
	}

	return anomalies
}

// calculateSeverity determines anomaly severity based on prediction error
func (d *NeuralDetector) calculateSeverity(error float64) analyzers.Severity {
	if error >= d.threshold*4 {
		return analyzers.SeverityCritical
	} else if error >= d.threshold*2.5 {
		return analyzers.SeverityHigh
	} else if error >= d.threshold*1.5 {
		return analyzers.SeverityMedium
	}
	return analyzers.SeverityLow
}

// calculateOverallScore calculates the overall anomaly score
func (d *NeuralDetector) calculateOverallScore(anomalies []analyzers.Anomaly) float64 {
	if len(anomalies) == 0 {
		return 0.0
	}

	var totalScore float64
	for _, anomaly := range anomalies {
		totalScore += anomaly.Score
	}

	avgScore := totalScore / float64(len(anomalies))
	return avgScore * d.config.Sensitivity
}

// toFloat64 converts interface{} to float64
func (d *NeuralDetector) toFloat64(value interface{}) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", value)
	}
}

// Neural Network methods

// Forward performs forward propagation
func (nn *NeuralNetwork) Forward(inputs []float64) []float64 {
	if len(inputs) != nn.inputSize {
		return nil
	}

	// Hidden layer
	hidden := make([]float64, nn.hiddenSize)
	for j := 0; j < nn.hiddenSize; j++ {
		sum := nn.biases1[j]
		for i := 0; i < nn.inputSize; i++ {
			sum += inputs[i] * nn.weights1[i][j]
		}
		hidden[j] = sigmoid(sum)
	}

	// Output layer
	outputs := make([]float64, nn.outputSize)
	for k := 0; k < nn.outputSize; k++ {
		sum := nn.biases2[k]
		for j := 0; j < nn.hiddenSize; j++ {
			sum += hidden[j] * nn.weights2[j][k]
		}
		outputs[k] = sigmoid(sum)
	}

	return outputs
}

// Backward performs backpropagation
func (nn *NeuralNetwork) Backward(inputs, targets, predictions []float64) {
	// Calculate output layer errors
	outputErrors := make([]float64, nn.outputSize)
	for k := 0; k < nn.outputSize; k++ {
		outputErrors[k] = (targets[k] - predictions[k]) * sigmoidDerivative(predictions[k])
	}

	// Calculate hidden layer values (needed for backprop)
	hidden := make([]float64, nn.hiddenSize)
	for j := 0; j < nn.hiddenSize; j++ {
		sum := nn.biases1[j]
		for i := 0; i < nn.inputSize; i++ {
			sum += inputs[i] * nn.weights1[i][j]
		}
		hidden[j] = sigmoid(sum)
	}

	// Calculate hidden layer errors
	hiddenErrors := make([]float64, nn.hiddenSize)
	for j := 0; j < nn.hiddenSize; j++ {
		sum := 0.0
		for k := 0; k < nn.outputSize; k++ {
			sum += outputErrors[k] * nn.weights2[j][k]
		}
		hiddenErrors[j] = sum * sigmoidDerivative(hidden[j])
	}

	// Update weights and biases (output layer)
	for j := 0; j < nn.hiddenSize; j++ {
		for k := 0; k < nn.outputSize; k++ {
			nn.weights2[j][k] += nn.learningRate * outputErrors[k] * hidden[j]
		}
	}
	for k := 0; k < nn.outputSize; k++ {
		nn.biases2[k] += nn.learningRate * outputErrors[k]
	}

	// Update weights and biases (hidden layer)
	for i := 0; i < nn.inputSize; i++ {
		for j := 0; j < nn.hiddenSize; j++ {
			nn.weights1[i][j] += nn.learningRate * hiddenErrors[j] * inputs[i]
		}
	}
	for j := 0; j < nn.hiddenSize; j++ {
		nn.biases1[j] += nn.learningRate * hiddenErrors[j]
	}
}

// MinMaxScaler methods

// Fit calculates min and max values for scaling
func (s *MinMaxScaler) Fit(data []float64) {
	if len(data) == 0 {
		return
	}

	s.min = []float64{data[0]}
	s.max = []float64{data[0]}

	for _, value := range data {
		if value < s.min[0] {
			s.min[0] = value
		}
		if value > s.max[0] {
			s.max[0] = value
		}
	}

	s.fitted = true
}

// Transform scales the data to [0, 1] range
func (s *MinMaxScaler) Transform(data []float64) []float64 {
	if !s.fitted || len(data) == 0 {
		return data
	}

	scaled := make([]float64, len(data))
	range_ := s.max[0] - s.min[0]

	if range_ == 0 {
		// All values are the same
		for i := range scaled {
			scaled[i] = 0.5 // Middle value
		}
		return scaled
	}

	for i, value := range data {
		scaled[i] = (value - s.min[0]) / range_
	}

	return scaled
}

// TransformSingle scales a single value
func (s *MinMaxScaler) TransformSingle(value float64) float64 {
	if !s.fitted {
		return value
	}

	range_ := s.max[0] - s.min[0]
	if range_ == 0 {
		return 0.5
	}

	return (value - s.min[0]) / range_
}

// InverseTransformSingle inverse transforms a single scaled value
func (s *MinMaxScaler) InverseTransformSingle(scaledValue float64) float64 {
	if !s.fitted {
		return scaledValue
	}

	range_ := s.max[0] - s.min[0]
	return scaledValue*range_ + s.min[0]
}

// Activation functions

func sigmoid(x float64) float64 {
	return 1.0 / (1.0 + math.Exp(-x))
}

func sigmoidDerivative(y float64) float64 {
	return y * (1.0 - y)
}
