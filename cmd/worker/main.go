package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/vibecast/anomaly-detector/internal/core"
	"github.com/vibecast/anomaly-detector/internal/queue"
	"github.com/vibecast/anomaly-detector/pkg/metrics"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Initialize metrics
	metrics := metrics.NewMetrics()

	// Initialize anomaly detector
	detector := core.NewAnomalyDetector(logger, metrics)

	// Initialize queue consumer
	consumer := queue.NewConsumer(detector, logger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start worker
	go func() {
		logger.Info("Starting anomaly detection worker")
		if err := consumer.Start(ctx); err != nil {
			logger.Fatal("Failed to start worker", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down worker...")

	cancel()
	logger.Info("Worker exited")
}