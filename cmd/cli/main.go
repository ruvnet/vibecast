package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/vibecast/anomaly-detector/internal/core"
	"github.com/vibecast/anomaly-detector/pkg/metrics"
	"go.uber.org/zap"
)

var rootCmd = &cobra.Command{
	Use:   "anomaly-detector",
	Short: "A CLI tool for AI text anomaly detection",
	Long:  "A command-line interface for detecting anomalies in AI-generated text using multiple analysis techniques.",
}

var analyzeCmd = &cobra.Command{
	Use:   "analyze [file]",
	Short: "Analyze text for anomalies",
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

		fmt.Printf("Anomaly Score: %.2f\n", result.Score)
		fmt.Printf("Confidence: %.2f\n", result.Confidence)
		fmt.Printf("Is Anomalous: %t\n", result.IsAnomalous)
		
		if len(result.Details) > 0 {
			fmt.Println("\nDetailed Analysis:")
			for analyzer, detail := range result.Details {
				fmt.Printf("  %s: %.2f\n", analyzer, detail.Score)
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}