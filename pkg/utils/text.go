package utils

import (
	"regexp"
	"strings"
	"unicode"
)

// CleanText removes extra whitespace and normalizes text
func CleanText(text string) string {
	// Remove extra whitespace
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")

	// Trim leading/trailing whitespace
	text = strings.TrimSpace(text)

	return text
}

// NormalizeText performs basic text normalization
func NormalizeText(text string) string {
	// Convert to lowercase
	text = strings.ToLower(text)

	// Clean text
	text = CleanText(text)

	return text
}

// RemovePunctuation removes all punctuation from text
func RemovePunctuation(text string) string {
	var result strings.Builder

	for _, char := range text {
		if !unicode.IsPunct(char) {
			result.WriteRune(char)
		}
	}

	return result.String()
}

// WordCount returns the number of words in text
func WordCount(text string) int {
	return len(strings.Fields(text))
}

// CharCount returns the number of characters in text (excluding whitespace)
func CharCount(text string) int {
	count := 0
	for _, char := range text {
		if !unicode.IsSpace(char) {
			count++
		}
	}
	return count
}

// SentenceCount returns the approximate number of sentences in text
func SentenceCount(text string) int {
	sentenceRegex := regexp.MustCompile(`[.!?]+`)
	sentences := sentenceRegex.Split(text, -1)

	count := 0
	for _, sentence := range sentences {
		if len(strings.TrimSpace(sentence)) > 0 {
			count++
		}
	}

	return count
}

// ExtractNGrams extracts n-grams from text
func ExtractNGrams(text string, n int) []string {
	words := strings.Fields(NormalizeText(text))
	if len(words) < n {
		return []string{}
	}

	ngrams := make([]string, 0, len(words)-n+1)
	for i := 0; i <= len(words)-n; i++ {
		ngram := strings.Join(words[i:i+n], " ")
		ngrams = append(ngrams, ngram)
	}

	return ngrams
}

// CalculateJaccardSimilarity calculates Jaccard similarity between two texts
func CalculateJaccardSimilarity(text1, text2 string) float64 {
	words1 := make(map[string]bool)
	words2 := make(map[string]bool)

	for _, word := range strings.Fields(NormalizeText(text1)) {
		words1[word] = true
	}

	for _, word := range strings.Fields(NormalizeText(text2)) {
		words2[word] = true
	}

	intersection := 0
	union := len(words1)

	for word := range words2 {
		if words1[word] {
			intersection++
		} else {
			union++
		}
	}

	if union == 0 {
		return 0.0
	}

	return float64(intersection) / float64(union)
}

// TruncateText truncates text to a maximum length
func TruncateText(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}

	return text[:maxLen] + "..."
}

// IsASCII checks if text contains only ASCII characters
func IsASCII(text string) bool {
	for _, char := range text {
		if char > unicode.MaxASCII {
			return false
		}
	}
	return true
}
