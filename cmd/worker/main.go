package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/queue"
	"github.com/ruvnet/alienator/internal/services"
	"github.com/ruvnet/alienator/pkg/metrics"
	"go.uber.org/zap"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("Failed to load configuration: %v", err))
	}

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Initialize metrics
	metrics := metrics.NewMetrics()

	// Initialize core messaging infrastructure
	messageBroker, err := core.NewNATSBroker(cfg.NATS, logger)
	if err != nil {
		logger.Fatal("Failed to initialize message broker", zap.Error(err))
	}
	defer messageBroker.Close()

	messageQueue, err := core.NewRedisQueue(cfg.Redis, logger)
	if err != nil {
		logger.Fatal("Failed to initialize message queue", zap.Error(err))
	}
	defer messageQueue.Close()

	eventBus := core.NewEventBus(logger)
	defer eventBus.Close()

	// Initialize services
	processingService := services.NewProcessingService(messageQueue, eventBus, logger)
	broadcastService := services.NewBroadcastService(messageBroker, eventBus, logger)
	streamService := services.NewStreamService(messageQueue, eventBus, logger)

	// Initialize anomaly detector
	detector := core.NewAnomalyDetector(logger, metrics)

	// Initialize queue consumers
	messageConsumer := queue.NewMessageConsumer(detector, processingService, logger)
	broadcastConsumer := queue.NewBroadcastConsumer(broadcastService, logger)
	streamConsumer := queue.NewStreamConsumer(streamService, logger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start workers
	var wg sync.WaitGroup

	// Start message processing worker
	wg.Add(1)
	go func() {
		defer wg.Done()
		logger.Info("Starting message processing worker")
		if err := messageConsumer.Start(ctx); err != nil {
			logger.Error("Message processing worker failed", zap.Error(err))
		}
	}()

	// Start broadcast worker
	wg.Add(1)
	go func() {
		defer wg.Done()
		logger.Info("Starting broadcast worker")
		if err := broadcastConsumer.Start(ctx); err != nil {
			logger.Error("Broadcast worker failed", zap.Error(err))
		}
	}()

	// Start stream worker
	wg.Add(1)
	go func() {
		defer wg.Done()
		logger.Info("Starting stream worker")
		if err := streamConsumer.Start(ctx); err != nil {
			logger.Error("Stream worker failed", zap.Error(err))
		}
	}()

	// Health check endpoint
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				logger.Info("VibeCast worker health check",
					zap.String("status", "running"),
					zap.Time("timestamp", time.Now()),
				)
			}
		}
	}()

	logger.Info("VibeCast worker started successfully")

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down VibeCast worker...")

	cancel()
	wg.Wait()

	logger.Info("VibeCast worker exited gracefully")
}
