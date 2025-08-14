package metrics

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all metrics for the application
type Metrics struct {
	// Request metrics
	requestsTotal    prometheus.Counter
	requestDuration  prometheus.Histogram
	requestsInFlight prometheus.Gauge

	// Analysis metrics
	analysisTotal  *prometheus.CounterVec
	analysisErrors *prometheus.CounterVec
	analysisScores prometheus.Histogram

	// System metrics
	systemMemory prometheus.Gauge
	systemCPU    prometheus.Gauge

	mu sync.RWMutex
}

// NewMetrics creates a new metrics instance
func NewMetrics() *Metrics {
	return &Metrics{
		requestsTotal: promauto.NewCounter(prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		}),

		requestDuration: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		}),

		requestsInFlight: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Current number of HTTP requests being processed",
		}),

		analysisTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "analysis_requests_total",
				Help: "Total number of analysis requests",
			},
			[]string{"analyzer", "status"},
		),

		analysisErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "analysis_errors_total",
				Help: "Total number of analysis errors",
			},
			[]string{"analyzer", "error_type"},
		),

		analysisScores: promauto.NewHistogram(prometheus.HistogramOpts{
			Name:    "analysis_scores",
			Help:    "Distribution of anomaly scores",
			Buckets: []float64{0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		}),

		systemMemory: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "system_memory_usage_bytes",
			Help: "Current memory usage in bytes",
		}),

		systemCPU: promauto.NewGauge(prometheus.GaugeOpts{
			Name: "system_cpu_usage_percent",
			Help: "Current CPU usage percentage",
		}),
	}
}

// RecordRequest records a new HTTP request
func (m *Metrics) RecordRequest() {
	m.requestsTotal.Inc()
}

// RecordRequestDuration records the duration of an HTTP request
func (m *Metrics) RecordRequestDuration(duration time.Duration) {
	m.requestDuration.Observe(duration.Seconds())
}

// IncRequestsInFlight increments the in-flight requests counter
func (m *Metrics) IncRequestsInFlight() {
	m.requestsInFlight.Inc()
}

// DecRequestsInFlight decrements the in-flight requests counter
func (m *Metrics) DecRequestsInFlight() {
	m.requestsInFlight.Dec()
}

// RecordAnalysis records an analysis request
func (m *Metrics) RecordAnalysis(analyzer, status string) {
	m.analysisTotal.WithLabelValues(analyzer, status).Inc()
}

// RecordAnalysisError records an analysis error
func (m *Metrics) RecordAnalysisError(analyzer, errorType string) {
	m.analysisErrors.WithLabelValues(analyzer, errorType).Inc()
}

// RecordAnalysisScore records an anomaly score
func (m *Metrics) RecordAnalysisScore(score float64) {
	m.analysisScores.Observe(score)
}

// UpdateSystemMemory updates the system memory usage metric
func (m *Metrics) UpdateSystemMemory(bytes float64) {
	m.systemMemory.Set(bytes)
}

// UpdateSystemCPU updates the system CPU usage metric
func (m *Metrics) UpdateSystemCPU(percent float64) {
	m.systemCPU.Set(percent)
}

// GetRegistry returns the prometheus registry
func (m *Metrics) GetRegistry() prometheus.Gatherer {
	return prometheus.DefaultGatherer
}
