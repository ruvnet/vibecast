package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/ruvnet/alienator/internal/core"
	"github.com/ruvnet/alienator/pkg/metrics"
	"go.uber.org/zap"
)

var rootCmd = &cobra.Command{
	Use:   "alienator",
	Short: "👽 XENOTYPE DETECTION PROTOCOL - Non-Human Intelligence Scanner",
	Long: `
    ╔═══════════════════════════════════════════════════════════════╗
    ║                    🛸 A L I E N A T O R 🛸                    ║
    ║                                                               ║
    ║           ★ XENOTYPE DETECTION PROTOCOL v2.1 ★               ║
    ║                                                               ║
    ║  Advanced Detection System for Non-Human Intelligence         ║
    ║  Signatures in AI-Generated Outputs                          ║
    ║                                                               ║
    ║  🔬 Quantum Pattern Analysis    🌌 Hyperdimensional Scanning  ║
    ║  📡 Signal Processing           ⚡ Real-time Detection        ║
    ║                                                               ║
    ║  WARNING: Classified Research Tool - Authorized Personnel Only║
    ╚═══════════════════════════════════════════════════════════════╝
`,
}

var analyzeCmd = &cobra.Command{
	Use:   "analyze [file]",
	Short: "🔬 XENOTYPE SCAN - Deep analysis of potential non-human intelligence patterns",
	Long:  "📡 Initiate quantum pattern analysis on target file to detect alien signature anomalies\n🧬 Scans for: Hyperdimensional linguistics • Non-euclidean syntax • Quantum entangled tokens",
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

		// Enhanced sci-fi scanning display
		fmt.Println("\n" + `
    ┌─────────────────────────────────────────────────────────────┐
    │                🛸 XENOTYPE SCAN INITIATED 🛸                │
    └─────────────────────────────────────────────────────────────┘`)
		
		fmt.Printf("    📡 Scanning target file: %s\n", filename)
		fmt.Println("    ⚡ Initializing quantum pattern analyzers...")
		fmt.Println("    🌌 Hyperdimensional matrix loading...")
		
		result, err := detector.AnalyzeText(string(content))
		if err != nil {
			fmt.Println("    ❌ CRITICAL ERROR: Analysis system failure")
			logger.Fatal("Analysis failed", zap.Error(err))
		}

		fmt.Println("\n" + `    ╔═══════════════════════════════════════════════════════════════╗`)
		fmt.Println("    ║                    🔬 ANALYSIS RESULTS 🔬                    ║")
		fmt.Println("    ╠═══════════════════════════════════════════════════════════════╣")
		fmt.Printf("    ║  👽 XENOTYPE ANOMALY SCORE: %6.2f                         ║\n", result.Score)
		fmt.Printf("    ║  🎯 DETECTION CONFIDENCE:    %6.2f                         ║\n", result.Confidence)
		
		threatLevel := "MINIMAL"
		statusIcon := "🟢"
		if result.IsAnomalous {
			threatLevel = "⚠️ DETECTED"
			statusIcon = "🔴"
		}
		fmt.Printf("    ║  %s NON-HUMAN SIGNAL:       %-15s              ║\n", statusIcon, threatLevel)
		fmt.Println("    ╚═══════════════════════════════════════════════════════════════╝")

		if len(result.Details) > 0 {
			fmt.Println("\n    🔍 DETAILED XENOTYPE SIGNATURE ANALYSIS:")
			fmt.Println("    ┌─────────────────────────────────────────────────────────────┐")
			for analyzer, detail := range result.Details {
				fmt.Printf("    │  🧬 %-25s: %6.2f                     │\n", analyzer, detail.Score)
			}
			fmt.Println("    └─────────────────────────────────────────────────────────────┘")
		}
		
		fmt.Println("\n    📊 SCAN COMPLETE - Data archived to classified databases")
		if result.IsAnomalous {
			fmt.Println("    🚨 WARNING: Potential non-human intelligence detected!")
			fmt.Println("    📞 Contact: Area-51 Xenolinguistics Division")
		}
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "🌌 SYSTEM STATUS - Check detection array and scanner systems",
	Long:  "⚡ Display current operational status of all xenotype detection modules\n🛸 Monitor: Analysis engines • Pattern matrices • Signal processors • Quantum sensors",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(`
    ╔═══════════════════════════════════════════════════════════════╗
    ║               🛸 XENOTYPE DETECTION ARRAY 🛸                 ║
    ║                    SYSTEM STATUS REPORT                      ║
    ╚═══════════════════════════════════════════════════════════════╝`)
		
		fmt.Println("\n    🌌 QUANTUM ANALYSIS SYSTEMS:")
		fmt.Println("    ┌─────────────────────────────────────────────────────────────┐")
		fmt.Println("    │  ⚡ Primary Detection Engine    [🟢 ONLINE ]               │")
		fmt.Println("    │  🧬 Pattern Recognition Matrix  [🟢 ACTIVE ]               │")
		fmt.Println("    │  📡 Signal Processing Array     [🟢 OPERATIONAL]           │")
		fmt.Println("    │  🌊 Hyperdimensional Scanner    [🟢 SCANNING  ]            │")
		fmt.Println("    │  🔬 Xenolinguistic Analyzer     [🟢 READY    ]             │")
		fmt.Println("    └─────────────────────────────────────────────────────────────┘")
		
		fmt.Println("\n    📊 DETECTION METRICS:")
		fmt.Println("    ┌─────────────────────────────────────────────────────────────┐")
		fmt.Println("    │  🎯 Sensitivity Level:          [MAXIMUM PARANOIA]          │")
		fmt.Println("    │  🛡️  Security Clearance:         [EYES ONLY - CLASSIFIED]    │")
		fmt.Println("    │  📈 Threat Assessment:          [WATCHFUL WAITING]         │")
		fmt.Println("    │  🚨 Alert Status:               [DEFCON 3 - ELEVATED]      │")
		fmt.Println("    └─────────────────────────────────────────────────────────────┘")
		
		fmt.Println("\n    🔍 CONTINUOUS MONITORING ACTIVE")
		fmt.Println("    👽 Scanning for: Non-human intelligence patterns")
		fmt.Println("    🌌 Monitoring: Quantum flux anomalies")
		fmt.Println("    📡 Listening: Hyperdimensional communications")
		fmt.Println("\n    ⚠️  REMEMBER: Trust no AI. Question everything.")
	},
}

func init() {
	rootCmd.AddCommand(analyzeCmd)
	rootCmd.AddCommand(statusCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}