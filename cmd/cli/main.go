package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/internal/models/proto"
	"github.com/ruvnet/alienator/internal/services"
	"github.com/ruvnet/alienator/pkg/metrics"
	"go.uber.org/zap"
)

var rootCmd = &cobra.Command{
	Use:   "alienator",
	Short: "Alienator detection system for non-human intelligence in AI outputs",
	Long:  "A command-line interface for the Alienator advanced detection system that identifies potential non-human intelligence signatures in AI-generated outputs.",
}

var analyzeCmd = &cobra.Command{
	Use:   "analyze [file]",
	Short: "Analyze AI output for non-human intelligence signatures",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		filename := args[0]

		logger, _ := zap.NewDevelopment()
		defer logger.Sync()

		metrics := metrics.NewMetrics()
		detector := core.NewAnomalyDetector(logger, metrics)

		content, err := os.ReadFile(filename)
		if err != nil {
			logger.Fatal("Failed to read file", zap.Error(err))
		}

		result, err := detector.AnalyzeText(string(content))
		if err != nil {
			logger.Fatal("Analysis failed", zap.Error(err))
		}

		fmt.Printf("👽 Anomaly Score: %.2f\n", result.Score)
		fmt.Printf("🎯 Confidence: %.2f\n", result.Confidence)
		fmt.Printf("🚨 Non-Human Signal Detected: %t\n", result.IsAnomalous)

		if len(result.Details) > 0 {
			fmt.Println("\n🔬 Detailed Analysis:")
			for analyzer, detail := range result.Details {
				fmt.Printf("  • %s: %.2f\n", analyzer, detail.Score)
			}
		}
	},
}

var broadcastCmd = &cobra.Command{
	Use:   "broadcast [channel] [message]",
	Short: "Broadcast detected anomaly alerts to a channel",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		channel := args[0]
		messageText := args[1]

		cfg, err := config.Load()
		if err != nil {
			fmt.Printf("Failed to load configuration: %v\n", err)
			os.Exit(1)
		}

		logger, _ := zap.NewDevelopment()
		defer logger.Sync()

		// Initialize message broker
		messageBroker, err := core.NewNATSBroker(cfg.NATS, logger)
		if err != nil {
			logger.Fatal("Failed to initialize message broker", zap.Error(err))
		}
		defer messageBroker.Close()

		eventBus := core.NewEventBus(logger)
		defer eventBus.Close()

		broadcastService := services.NewBroadcastService(messageBroker, eventBus, logger)

		ctx := context.Background()
		now := time.Now()
		msg := &proto.Message{
			ID:        fmt.Sprintf("msg_%d", time.Now().UnixNano()),
			Topic:     channel,
			Data:      []byte(messageText),
			Timestamp: &now,
			Headers:   map[string]string{"sender": "cli"},
		}

		if err := broadcastService.Broadcast(ctx, channel, msg); err != nil {
			logger.Fatal("Failed to broadcast message", zap.Error(err))
		}

		fmt.Printf("🛸 Anomaly alert broadcast to channel '%s' successfully\n", channel)
	},
}

var streamCmd = &cobra.Command{
	Use:   "stream [action] [streamId]",
	Short: "Manage AI output analysis streams (create, start, stop, status)",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		action := args[0]
		streamId := args[1]

		cfg, err := config.Load()
		if err != nil {
			fmt.Printf("Failed to load configuration: %v\n", err)
			os.Exit(1)
		}

		logger, _ := zap.NewDevelopment()
		defer logger.Sync()

		// Initialize message queue
		messageQueue, err := core.NewRedisQueue(cfg.Redis, logger)
		if err != nil {
			logger.Fatal("Failed to initialize message queue", zap.Error(err))
		}
		defer messageQueue.Close()

		eventBus := core.NewEventBus(logger)
		defer eventBus.Close()

		streamService := services.NewStreamService(messageQueue, eventBus, logger)

		ctx := context.Background()
		switch action {
		case "create":
			stream := &proto.Stream{
				Id:        streamId,
				Name:      fmt.Sprintf("Stream %s", streamId),
				Status:    "created",
				CreatedAt: time.Now().Unix(),
			}
			if err := streamService.CreateStream(ctx, stream); err != nil {
				logger.Fatal("Failed to create stream", zap.Error(err))
			}
			fmt.Printf("📡 Analysis stream '%s' created successfully\n", streamId)
		case "start":
			if err := streamService.StartStream(ctx, streamId); err != nil {
				logger.Fatal("Failed to start stream", zap.Error(err))
			}
			fmt.Printf("▶️ Analysis stream '%s' started successfully\n", streamId)
		case "stop":
			if err := streamService.StopStream(ctx, streamId); err != nil {
				logger.Fatal("Failed to stop stream", zap.Error(err))
			}
			fmt.Printf("⏹️ Analysis stream '%s' stopped successfully\n", streamId)
		case "status":
			status, err := streamService.GetStreamStatus(ctx, streamId)
			if err != nil {
				logger.Fatal("Failed to get stream status", zap.Error(err))
			}
			statusJSON, _ := json.MarshalIndent(status, "", "  ")
			fmt.Printf("📊 Analysis stream '%s' status:\n%s\n", streamId, statusJSON)
		default:
			fmt.Printf("Unknown action: %s. Use: create, start, stop, or status\n", action)
			os.Exit(1)
		}
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Get Alienator system status",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load()
		if err != nil {
			fmt.Printf("Failed to load configuration: %v\n", err)
			os.Exit(1)
		}

		logger, _ := zap.NewDevelopment()
		defer logger.Sync()

		// Initialize components
		messageBroker, err := core.NewNATSBroker(cfg.NATS, logger)
		if err != nil {
			fmt.Printf("❌ Message Broker: OFFLINE (%v)\n", err)
		} else {
			fmt.Println("✅ Message Broker: ONLINE")
			messageBroker.Close()
		}

		messageQueue, err := core.NewRedisQueue(cfg.Redis, logger)
		if err != nil {
			fmt.Printf("❌ Message Queue: OFFLINE (%v)\n", err)
		} else {
			fmt.Println("✅ Message Queue: ONLINE")
			messageQueue.Close()
		}

		fmt.Printf("🌌 Alienator configuration loaded successfully\n")
		fmt.Printf("🔗 API Server: %s:%d\n", cfg.Server.Host, cfg.Server.Port)
		fmt.Printf("🔧 Environment: %s\n", cfg.Logging.Level)
	},
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
	rootCmd.AddCommand(broadcastCmd)
	rootCmd.AddCommand(streamCmd)
	rootCmd.AddCommand(statusCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
