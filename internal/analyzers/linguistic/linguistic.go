package linguistic

import (
	"context"
	"math"
	"regexp"
	"strings"
	"unicode"

	"github.com/abadojack/whatlanggo"
	"github.com/ruvnet/alienator/internal/models"
)

// LinguisticAnalyzer analyzes linguistic patterns in text
type LinguisticAnalyzer struct {
	name string
	// Language detection
	languageDetector *whatlanggo.Info
	// Grammar patterns
	commonWords     map[string]float64
	functionWords   map[string]bool
	// Structural analysis thresholds
	vowelRatioMin   float64
	vowelRatioMax   float64
	wordLengthMin   float64
	wordLengthMax   float64
	// Perplexity calculation
	bigramFreqs     map[string]float64
	trigramFreqs    map[string]float64
	// Non-anthropic patterns
	aiPatterns      []string
	botPatterns     []string
}

// NewLinguisticAnalyzer creates a new linguistic analyzer
func NewLinguisticAnalyzer() *LinguisticAnalyzer {
	// Common English words for frequency analysis
	commonWords := map[string]float64{
		"the": 0.0483, "of": 0.0270, "and": 0.0261, "a": 0.0230, "to": 0.0216,
		"in": 0.0199, "is": 0.0124, "it": 0.0110, "you": 0.0108, "that": 0.0101,
		"he": 0.0093, "was": 0.0091, "for": 0.0088, "on": 0.0078, "are": 0.0076,
		"as": 0.0072, "with": 0.0072, "his": 0.0067, "they": 0.0063, "i": 0.0062,
	}
	
	// Function words (articles, prepositions, conjunctions)
	functionWords := map[string]bool{
		"the": true, "a": true, "an": true, "and": true, "or": true, "but": true,
		"in": true, "on": true, "at": true, "to": true, "for": true, "of": true,
		"with": true, "by": true, "from": true, "up": true, "about": true,
		"into": true, "through": true, "during": true, "before": true, "after": true,
		"above": true, "below": true, "is": true, "are": true, "was": true, "were": true,
		"be": true, "been": true, "being": true, "have": true, "has": true, "had": true,
		"do": true, "does": true, "did": true, "will": true, "would": true, "could": true,
		"should": true, "may": true, "might": true, "must": true, "can": true,
	}
	
	// AI-generated text patterns
	aiPatterns := []string{
		"as an ai", "i'm an ai", "as a language model", "i don't have personal",
		"i cannot", "i'm not able to", "i don't have access", "i can't provide",
		"it's important to note", "however, it's worth noting", "in conclusion",
		"to summarize", "first and foremost", "it should be noted that",
		"furthermore", "moreover", "nevertheless", "nonetheless", "consequently",
	}
	
	// Bot-like patterns
	botPatterns := []string{
		"please try again", "i understand your concern", "thank you for your patience",
		"i apologize for any", "if you have any questions", "feel free to ask",
		"i'm here to help", "how may i assist", "is there anything else",
	}
	
	return &LinguisticAnalyzer{
		name:          "linguistic",
		commonWords:   commonWords,
		functionWords: functionWords,
		vowelRatioMin: 0.35,
		vowelRatioMax: 0.50,
		wordLengthMin: 4.0,
		wordLengthMax: 6.0,
		aiPatterns:    aiPatterns,
		botPatterns:   botPatterns,
		bigramFreqs:   make(map[string]float64),
		trigramFreqs:  make(map[string]float64),
	}
}

// Name returns the analyzer name
func (la *LinguisticAnalyzer) Name() string {
	return la.name
}

// Analyze performs linguistic analysis on the text
func (la *LinguisticAnalyzer) Analyze(ctx context.Context, text string) (*models.AnalysisResult, error) {
	if len(text) == 0 {
		return &models.AnalysisResult{
			Score:      0.0,
			Confidence: 0.0,
			Metadata:   map[string]interface{}{},
		}, nil
	}

	// Language detection
	languageInfo := whatlanggo.Detect(text)
	language := "English" // Default to English, could enhance with proper language names
	if languageInfo.IsReliable() {
		language = string(languageInfo.Lang)
	}
	langConfidence := languageInfo.Confidence
	
	// Calculate perplexity
	perplexity := la.calculatePerplexity(text)
	
	// Grammar and structure checking
	grammarScore := la.checkGrammarPatterns(text)
	
	// Non-anthropic pattern detection
	aiPatternScore := la.detectAIPatterns(text)
	botPatternScore := la.detectBotPatterns(text)
	
	// Structural heuristics
	vowelRatio := la.calculateVowelRatio(text)
	wordLengthVariance := la.calculateWordLengthVariance(text)
	functionWordRatio := la.calculateFunctionWordRatio(text)
	sentenceComplexity := la.calculateSentenceComplexity(text)
	
	// Original features
	avgSentenceLength := la.calculateAverageSentenceLength(text)
	avgWordLength := la.calculateAverageWordLength(text)
	punctuationDensity := la.calculatePunctuationDensity(text)
	capitalRatio := la.calculateCapitalizationRatio(text)
	repetitionScore := la.calculateRepetitionScore(text)
	vocabularyRichness := la.calculateVocabularyRichness(text)
	transitionSmoothness := la.calculateTransitionSmoothness(text)
	
	// Combine all features into anomaly score
	score := la.calculateEnhancedAnomalyScore(
		avgSentenceLength, avgWordLength, punctuationDensity, capitalRatio,
		repetitionScore, vocabularyRichness, transitionSmoothness,
		perplexity, grammarScore, aiPatternScore, botPatternScore,
		vowelRatio, wordLengthVariance, functionWordRatio, sentenceComplexity,
		langConfidence)
	
	// Calculate enhanced confidence
	confidence := la.calculateEnhancedConfidence(text, language, langConfidence,
		perplexity, grammarScore)
	
	return &models.AnalysisResult{
		Score:      score,
		Confidence: confidence,
		Metadata: map[string]interface{}{
			"detected_language":      language,
			"language_confidence":    langConfidence,
			"perplexity":             perplexity,
			"grammar_score":          grammarScore,
			"ai_pattern_score":       aiPatternScore,
			"bot_pattern_score":      botPatternScore,
			"vowel_ratio":            vowelRatio,
			"word_length_variance":   wordLengthVariance,
			"function_word_ratio":    functionWordRatio,
			"sentence_complexity":    sentenceComplexity,
			"avg_sentence_length":    avgSentenceLength,
			"avg_word_length":        avgWordLength,
			"punctuation_density":    punctuationDensity,
			"capitalization_ratio":   capitalRatio,
			"repetition_score":       repetitionScore,
			"vocabulary_richness":    vocabularyRichness,
			"transition_smoothness":  transitionSmoothness,
		},
	}, nil
}

// calculateAverageSentenceLength calculates the average sentence length
func (la *LinguisticAnalyzer) calculateAverageSentenceLength(text string) float64 {
	sentenceRegex := regexp.MustCompile(`[.!?]+`)
	sentences := sentenceRegex.Split(text, -1)
	
	if len(sentences) == 0 {
		return 0
	}
	
	totalWords := 0
	validSentences := 0
	
	for _, sentence := range sentences {
		words := strings.Fields(strings.TrimSpace(sentence))
		if len(words) > 0 {
			totalWords += len(words)
			validSentences++
		}
	}
	
	if validSentences == 0 {
		return 0
	}
	
	return float64(totalWords) / float64(validSentences)
}

// calculateAverageWordLength calculates the average word length
func (la *LinguisticAnalyzer) calculateAverageWordLength(text string) float64 {
	words := strings.Fields(text)
	if len(words) == 0 {
		return 0
	}
	
	totalChars := 0
	for _, word := range words {
		// Remove punctuation for word length calculation
		cleanWord := regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(word, "")
		totalChars += len(cleanWord)
	}
	
	return float64(totalChars) / float64(len(words))
}

// calculatePunctuationDensity calculates the density of punctuation marks
func (la *LinguisticAnalyzer) calculatePunctuationDensity(text string) float64 {
	if len(text) == 0 {
		return 0
	}
	
	punctCount := 0
	for _, char := range text {
		if unicode.IsPunct(char) {
			punctCount++
		}
	}
	
	return float64(punctCount) / float64(len(text))
}

// calculateCapitalizationRatio calculates the ratio of uppercase to total letters
func (la *LinguisticAnalyzer) calculateCapitalizationRatio(text string) float64 {
	upperCount := 0
	letterCount := 0
	
	for _, char := range text {
		if unicode.IsLetter(char) {
			letterCount++
			if unicode.IsUpper(char) {
				upperCount++
			}
		}
	}
	
	if letterCount == 0 {
		return 0
	}
	
	return float64(upperCount) / float64(letterCount)
}

// calculateRepetitionScore analyzes repetition patterns
func (la *LinguisticAnalyzer) calculateRepetitionScore(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) < 2 {
		return 0
	}
	
	// Count adjacent word repetitions
	adjacentRepetitions := 0
	for i := 1; i < len(words); i++ {
		if words[i] == words[i-1] {
			adjacentRepetitions++
		}
	}
	
	// Count phrase repetitions (2-4 word phrases)
	phraseRepetitions := 0
	for phraseLen := 2; phraseLen <= 4 && phraseLen < len(words); phraseLen++ {
		seen := make(map[string]int)
		
		for i := 0; i <= len(words)-phraseLen; i++ {
			phrase := strings.Join(words[i:i+phraseLen], " ")
			seen[phrase]++
		}
		
		for _, count := range seen {
			if count > 1 {
				phraseRepetitions += count - 1
			}
		}
	}
	
	totalRepetitions := adjacentRepetitions + phraseRepetitions
	return float64(totalRepetitions) / float64(len(words))
}

// calculateVocabularyRichness calculates type-token ratio
func (la *LinguisticAnalyzer) calculateVocabularyRichness(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) == 0 {
		return 0
	}
	
	uniqueWords := make(map[string]bool)
	for _, word := range words {
		// Clean word of punctuation
		cleanWord := regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(word, "")
		if len(cleanWord) > 0 {
			uniqueWords[cleanWord] = true
		}
	}
	
	return float64(len(uniqueWords)) / float64(len(words))
}

// calculateTransitionSmoothness analyzes sentence-to-sentence transitions
func (la *LinguisticAnalyzer) calculateTransitionSmoothness(text string) float64 {
	sentenceRegex := regexp.MustCompile(`[.!?]+`)
	sentences := sentenceRegex.Split(text, -1)
	
	if len(sentences) < 2 {
		return 1.0 // No transitions to analyze
	}
	
	smoothTransitions := 0
	totalTransitions := 0
	
	for i := 1; i < len(sentences); i++ {
		prevWords := strings.Fields(strings.TrimSpace(sentences[i-1]))
		currWords := strings.Fields(strings.TrimSpace(sentences[i]))
		
		if len(prevWords) > 0 && len(currWords) > 0 {
			// Check for word overlap between adjacent sentences
			prevSet := make(map[string]bool)
			for _, word := range prevWords {
				prevSet[strings.ToLower(word)] = true
			}
			
			overlap := 0
			for _, word := range currWords {
				if prevSet[strings.ToLower(word)] {
					overlap++
				}
			}
			
			// Consider transition smooth if there's some overlap
			if overlap > 0 {
				smoothTransitions++
			}
			totalTransitions++
		}
	}
	
	if totalTransitions == 0 {
		return 1.0
	}
	
	return float64(smoothTransitions) / float64(totalTransitions)
}

// calculateAnomalyScore combines linguistic features into an anomaly score
func (la *LinguisticAnalyzer) calculateAnomalyScore(avgSentenceLength, avgWordLength, punctuationDensity, 
	capitalRatio, repetitionScore, vocabularyRichness, transitionSmoothness float64) float64 {
	
	score := 0.0
	
	// AI text often has more consistent sentence lengths
	sentenceLengthScore := la.normalizeFeature(avgSentenceLength, 10, 25, true) // AI tends to be more consistent
	
	// AI text may have different word length patterns
	wordLengthScore := la.normalizeFeature(avgWordLength, 3, 7, false)
	
	// AI text may have different punctuation patterns
	punctuationScore := la.normalizeFeature(punctuationDensity, 0.02, 0.15, false)
	
	// AI text may have more consistent capitalization
	capitalScore := la.normalizeFeature(capitalRatio, 0.02, 0.12, true)
	
	// AI text may have less natural repetition
	repetitionScoreNorm := la.normalizeFeature(repetitionScore, 0.0, 0.1, true)
	
	// AI text may have less vocabulary richness
	vocabScore := la.normalizeFeature(vocabularyRichness, 0.3, 0.8, false)
	
	// AI text may have overly smooth transitions
	transitionScore := la.normalizeFeature(transitionSmoothness, 0.2, 0.8, true)
	
	// Weighted combination
	score = (sentenceLengthScore*0.15 + wordLengthScore*0.1 + punctuationScore*0.1 + 
		capitalScore*0.1 + repetitionScoreNorm*0.2 + vocabScore*0.2 + transitionScore*0.15)
	
	return math.Max(0.0, math.Min(1.0, score))
}

// normalizeFeature normalizes a feature value to 0-1 range
func (la *LinguisticAnalyzer) normalizeFeature(value, min, max float64, invert bool) float64 {
	if max == min {
		return 0.5
	}
	
	normalized := (value - min) / (max - min)
	normalized = math.Max(0.0, math.Min(1.0, normalized))
	
	if invert {
		normalized = 1.0 - normalized
	}
	
	return normalized
}

// calculateConfidence determines confidence in the linguistic analysis
func (la *LinguisticAnalyzer) calculateConfidence(text string, avgSentenceLength, vocabularyRichness float64) float64 {
	words := strings.Fields(text)
	wordCount := len(words)
	
	// Base confidence on text length
	lengthConfidence := math.Min(1.0, float64(wordCount)/100.0)
	
	// Higher confidence for texts with reasonable sentence structure
	sentenceConfidence := 1.0
	if avgSentenceLength < 3 || avgSentenceLength > 50 {
		sentenceConfidence = 0.5
	}
	
	// Higher confidence for texts with reasonable vocabulary
	vocabConfidence := 1.0
	if vocabularyRichness < 0.1 || vocabularyRichness > 0.95 {
		vocabConfidence = 0.5
	}
	
	return lengthConfidence * 0.6 + sentenceConfidence * 0.2 + vocabConfidence * 0.2
}

// calculatePerplexity calculates text perplexity based on n-gram frequencies
func (la *LinguisticAnalyzer) calculatePerplexity(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) < 3 {
		return 0.0
	}
	
	// Build bigram and trigram models
	la.buildNgramModels(words)
	
	// Calculate perplexity using trigrams with bigram backoff
	logProb := 0.0
	trigramCount := 0
	
	for i := 2; i < len(words); i++ {
		trigram := words[i-2] + " " + words[i-1] + " " + words[i]
		bigram := words[i-1] + " " + words[i]
		
		var prob float64
		if trigramProb, exists := la.trigramFreqs[trigram]; exists && trigramProb > 0 {
			prob = trigramProb
		} else if bigramProb, exists := la.bigramFreqs[bigram]; exists && bigramProb > 0 {
			prob = bigramProb * 0.1 // Backoff with discount
		} else {
			prob = 1e-10 // Smoothing for unknown n-grams
		}
		
		logProb += math.Log(prob)
		trigramCount++
	}
	
	if trigramCount == 0 {
		return 0.0
	}
	
	avgLogProb := logProb / float64(trigramCount)
	perplexity := math.Exp(-avgLogProb)
	
	// Normalize perplexity (typical range 10-1000, normalize to 0-1)
	return math.Min(1.0, perplexity/1000.0)
}

// buildNgramModels builds bigram and trigram frequency models
func (la *LinguisticAnalyzer) buildNgramModels(words []string) {
	// Count bigrams
	bigramCounts := make(map[string]int)
	for i := 1; i < len(words); i++ {
		bigram := words[i-1] + " " + words[i]
		bigramCounts[bigram]++
	}
	
	// Count trigrams
	trigramCounts := make(map[string]int)
	for i := 2; i < len(words); i++ {
		trigram := words[i-2] + " " + words[i-1] + " " + words[i]
		trigramCounts[trigram]++
	}
	
	// Convert counts to probabilities
	bigramTotal := len(words) - 1
	for bigram, count := range bigramCounts {
		la.bigramFreqs[bigram] = float64(count) / float64(bigramTotal)
	}
	
	trigramTotal := len(words) - 2
	for trigram, count := range trigramCounts {
		la.trigramFreqs[trigram] = float64(count) / float64(trigramTotal)
	}
}

// checkGrammarPatterns checks for grammatical structures and coherence
func (la *LinguisticAnalyzer) checkGrammarPatterns(text string) float64 {
	grammarScore := 0.0
	sentences := regexp.MustCompile(`[.!?]+`).Split(text, -1)
	
	validSentences := 0
	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if len(sentence) == 0 {
			continue
		}
		
		words := strings.Fields(sentence)
		if len(words) == 0 {
			continue
		}
		
		validSentences++
		sentenceScore := 0.0
		
		// Check for proper sentence structure
		if unicode.IsUpper(rune(sentence[0])) { // Proper capitalization
			sentenceScore += 0.2
		}
		
		// Check for reasonable verb/noun distribution
		nounLikeWords := 0
		verbLikeWords := 0
		for _, word := range words {
			cleanWord := strings.ToLower(regexp.MustCompile(`[^a-zA-Z]`).ReplaceAllString(word, ""))
			if len(cleanWord) > 0 {
				// Simple heuristics for word types
				if strings.HasSuffix(cleanWord, "ing") || strings.HasSuffix(cleanWord, "ed") {
					verbLikeWords++
				} else if strings.HasSuffix(cleanWord, "tion") || strings.HasSuffix(cleanWord, "ness") {
					nounLikeWords++
				}
			}
		}
		
		// Reasonable distribution of word types
		if len(words) > 0 {
			verbRatio := float64(verbLikeWords) / float64(len(words))
			nounRatio := float64(nounLikeWords) / float64(len(words))
			if verbRatio > 0.1 && verbRatio < 0.4 {
				sentenceScore += 0.3
			}
			if nounRatio > 0.1 && nounRatio < 0.5 {
				sentenceScore += 0.3
			}
		}
		
		// Check function word usage
		functionWords := 0
		for _, word := range words {
			cleanWord := strings.ToLower(regexp.MustCompile(`[^a-zA-Z]`).ReplaceAllString(word, ""))
			if la.functionWords[cleanWord] {
				functionWords++
			}
		}
		
		if len(words) > 0 {
			functionRatio := float64(functionWords) / float64(len(words))
			if functionRatio > 0.2 && functionRatio < 0.6 { // Reasonable function word usage
				sentenceScore += 0.2
			}
		}
		
		grammarScore += sentenceScore
	}
	
	if validSentences == 0 {
		return 0.5
	}
	
	return grammarScore / float64(validSentences)
}

// detectAIPatterns detects patterns commonly found in AI-generated text
func (la *LinguisticAnalyzer) detectAIPatterns(text string) float64 {
	lowerText := strings.ToLower(text)
	totalPatterns := 0
	matchedPatterns := 0
	
	for _, pattern := range la.aiPatterns {
		totalPatterns++
		if strings.Contains(lowerText, pattern) {
			matchedPatterns++
		}
	}
	
	// Also check for over-formal language patterns
	formalPhrases := []string{
		"it is important to", "one should note", "it must be emphasized",
		"in order to", "with regard to", "it is worth mentioning",
		"furthermore", "moreover", "consequently", "nevertheless",
	}
	
	formalMatches := 0
	for _, phrase := range formalPhrases {
		if strings.Contains(lowerText, phrase) {
			formalMatches++
		}
	}
	
	// Calculate AI pattern score
	aiScore := float64(matchedPatterns) / float64(totalPatterns)
	formalScore := math.Min(1.0, float64(formalMatches)/10.0)
	
	return (aiScore*0.7 + formalScore*0.3)
}

// detectBotPatterns detects bot-like conversational patterns
func (la *LinguisticAnalyzer) detectBotPatterns(text string) float64 {
	lowerText := strings.ToLower(text)
	totalPatterns := 0
	matchedPatterns := 0
	
	for _, pattern := range la.botPatterns {
		totalPatterns++
		if strings.Contains(lowerText, pattern) {
			matchedPatterns++
		}
	}
	
	return float64(matchedPatterns) / float64(totalPatterns)
}

// calculateVowelRatio calculates the ratio of vowels to consonants
func (la *LinguisticAnalyzer) calculateVowelRatio(text string) float64 {
	vowels := 0
	consonants := 0
	vowelSet := map[rune]bool{'a': true, 'e': true, 'i': true, 'o': true, 'u': true}
	
	for _, char := range text {
		if unicode.IsLetter(char) {
			char = unicode.ToLower(char)
			if vowelSet[char] {
				vowels++
			} else {
				consonants++
			}
		}
	}
	
	if vowels+consonants == 0 {
		return 0.0
	}
	
	return float64(vowels) / float64(vowels+consonants)
}

// calculateWordLengthVariance calculates variance in word lengths
func (la *LinguisticAnalyzer) calculateWordLengthVariance(text string) float64 {
	words := strings.Fields(text)
	if len(words) == 0 {
		return 0.0
	}
	
	lengths := make([]float64, len(words))
	total := 0.0
	
	for i, word := range words {
		cleanWord := regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(word, "")
		length := float64(len(cleanWord))
		lengths[i] = length
		total += length
	}
	
	mean := total / float64(len(lengths))
	
	variance := 0.0
	for _, length := range lengths {
		diff := length - mean
		variance += diff * diff
	}
	
	return variance / float64(len(lengths))
}

// calculateFunctionWordRatio calculates the ratio of function words
func (la *LinguisticAnalyzer) calculateFunctionWordRatio(text string) float64 {
	words := strings.Fields(strings.ToLower(text))
	if len(words) == 0 {
		return 0.0
	}
	
	functionWords := 0
	for _, word := range words {
		cleanWord := regexp.MustCompile(`[^a-zA-Z]`).ReplaceAllString(word, "")
		if la.functionWords[cleanWord] {
			functionWords++
		}
	}
	
	return float64(functionWords) / float64(len(words))
}

// calculateSentenceComplexity calculates average syntactic complexity
func (la *LinguisticAnalyzer) calculateSentenceComplexity(text string) float64 {
	sentences := regexp.MustCompile(`[.!?]+`).Split(text, -1)
	if len(sentences) == 0 {
		return 0.0
	}
	
	totalComplexity := 0.0
	validSentences := 0
	
	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if len(sentence) == 0 {
			continue
		}
		
		words := strings.Fields(sentence)
		if len(words) == 0 {
			continue
		}
		
		validSentences++
		complexity := 0.0
		
		// Count clauses (rough approximation using commas and conjunctions)
		clauses := 1 + strings.Count(sentence, ",")
		for _, word := range words {
			cleanWord := strings.ToLower(regexp.MustCompile(`[^a-zA-Z]`).ReplaceAllString(word, ""))
			if cleanWord == "and" || cleanWord == "but" || cleanWord == "because" || 
			   cleanWord == "although" || cleanWord == "while" || cleanWord == "since" {
				clauses++
			}
		}
		
		// Complexity based on sentence length and clause count
		complexity = float64(len(words)) * float64(clauses) / 100.0
		totalComplexity += complexity
	}
	
	if validSentences == 0 {
		return 0.0
	}
	
	return totalComplexity / float64(validSentences)
}

// calculateEnhancedAnomalyScore combines all linguistic features
func (la *LinguisticAnalyzer) calculateEnhancedAnomalyScore(
	avgSentenceLength, avgWordLength, punctuationDensity, capitalRatio,
	repetitionScore, vocabularyRichness, transitionSmoothness,
	perplexity, grammarScore, aiPatternScore, botPatternScore,
	vowelRatio, wordLengthVariance, functionWordRatio, sentenceComplexity,
	langConfidence float64) float64 {
	
	score := 0.0
	
	// Original linguistic features (reduced weights)
	sentenceLengthScore := la.normalizeFeature(avgSentenceLength, 10, 25, true)
	wordLengthScore := la.normalizeFeature(avgWordLength, 3, 7, false)
	punctuationScoreNorm := la.normalizeFeature(punctuationDensity, 0.02, 0.15, false)
	capitalScoreNorm := la.normalizeFeature(capitalRatio, 0.02, 0.12, true)
	repetitionScoreNorm := la.normalizeFeature(repetitionScore, 0.0, 0.1, true)
	vocabScore := la.normalizeFeature(vocabularyRichness, 0.3, 0.8, false)
	transitionScore := la.normalizeFeature(transitionSmoothness, 0.2, 0.8, true)
	
	// Enhanced features
	perplexityScore := la.normalizeFeature(perplexity, 0.1, 1.0, false) // Lower perplexity = more predictable = higher anomaly
	grammarScoreNorm := 1.0 - grammarScore // Poor grammar might indicate AI
	
	// AI/Bot patterns (direct scores)
	aiScore := aiPatternScore
	botScore := botPatternScore
	
	// Structural heuristics
	vowelScore := 0.0
	if vowelRatio < la.vowelRatioMin || vowelRatio > la.vowelRatioMax {
		vowelScore = 0.3
	}
	
	wordVarianceScore := la.normalizeFeature(wordLengthVariance, 2.0, 10.0, true) // Less variance might indicate AI
	functionWordScore := la.normalizeFeature(functionWordRatio, 0.2, 0.6, true) // Unusual ratios might indicate AI
	complexityScore := la.normalizeFeature(sentenceComplexity, 0.5, 3.0, false)
	
	// Language confidence (low confidence might indicate non-native generation)
	langScore := 1.0 - langConfidence
	
	// Weighted combination - emphasizing AI-specific features
	score = (sentenceLengthScore*0.06 + wordLengthScore*0.04 + punctuationScoreNorm*0.04 +
			 capitalScoreNorm*0.04 + repetitionScoreNorm*0.06 + vocabScore*0.08 +
			 transitionScore*0.06 + perplexityScore*0.12 + grammarScoreNorm*0.08 +
			 aiScore*0.15 + botScore*0.10 + vowelScore*0.03 + wordVarianceScore*0.05 +
			 functionWordScore*0.04 + complexityScore*0.03 + langScore*0.02)
	
	return math.Max(0.0, math.Min(1.0, score))
}

// calculateEnhancedConfidence determines confidence with language detection
func (la *LinguisticAnalyzer) calculateEnhancedConfidence(text, language string, 
	langConfidence, perplexity, grammarScore float64) float64 {
	
	words := strings.Fields(text)
	wordCount := len(words)
	
	// Base confidence on text length
	lengthConfidence := math.Min(1.0, float64(wordCount)/100.0)
	
	// Language detection confidence
	langDetectionConfidence := langConfidence
	if language != "English" {
		langDetectionConfidence *= 0.7 // Lower confidence for non-English
	}
	
	// Perplexity confidence (reasonable perplexity suggests reliable analysis)
	perplexityConfidence := 1.0
	if perplexity < 0.01 || perplexity > 0.9 {
		perplexityConfidence = 0.5
	}
	
	// Grammar confidence
	grammarConfidence := grammarScore
	
	// Statistical confidence based on text characteristics
	statisticalConfidence := 1.0
	if wordCount < 20 {
		statisticalConfidence = 0.3
	} else if wordCount < 50 {
		statisticalConfidence = 0.6
	}
	
	return lengthConfidence*0.3 + langDetectionConfidence*0.25 + 
		   perplexityConfidence*0.2 + grammarConfidence*0.15 + statisticalConfidence*0.1
}