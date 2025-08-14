package benchmarks

import (
	"context"
	"testing"

	"github.com/ruvnet/alienator/internal/analyzers/entropy"
)

var sampleTexts = []string{
	"This is a short sample text.",
	"This is a longer sample text that contains multiple sentences. It has more content to analyze and should provide better insights into the entropy patterns. The text includes various punctuation marks and different word lengths.",
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
}

func BenchmarkEntropyAnalyzer_Analyze(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	ctx := context.Background()

	for _, text := range sampleTexts {
		b.Run(getLengthCategory(len(text)), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_, err := analyzer.Analyze(ctx, text)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkEntropyAnalyzer_CharacterEntropy(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()

	for _, text := range sampleTexts {
		b.Run(getLengthCategory(len(text)), func(b *testing.B) {
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				// This would require exposing the method or using reflection
				// For now, we'll benchmark the full Analyze method
				ctx := context.Background()
				_, err := analyzer.Analyze(ctx, text)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkEntropyAnalyzer_Parallel(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	ctx := context.Background()
	text := sampleTexts[2] // Use the longest text

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := analyzer.Analyze(ctx, text)
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

func getLengthCategory(length int) string {
	switch {
	case length < 50:
		return "short"
	case length < 200:
		return "medium"
	default:
		return "long"
	}
}

// Memory allocation benchmark
func BenchmarkEntropyAnalyzer_Memory(b *testing.B) {
	analyzer := entropy.NewEntropyAnalyzer()
	ctx := context.Background()
	text := sampleTexts[2]

	b.ReportAllocs()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := analyzer.Analyze(ctx, text)
		if err != nil {
			b.Fatal(err)
		}
	}
}
