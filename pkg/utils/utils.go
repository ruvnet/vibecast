package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// GenerateID generates a random ID
func GenerateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// GenerateShortID generates a shorter random ID
func GenerateShortID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// TimeStampToString converts a timestamp to a string
func TimeStampToString(t time.Time) string {
	return t.Format(time.RFC3339)
}

// StringToTimeStamp converts a string to a timestamp
func StringToTimeStamp(s string) (time.Time, error) {
	return time.Parse(time.RFC3339, s)
}

// NormalizeFloat64 normalizes a float64 value to a range [0, 1]
func NormalizeFloat64(value, min, max float64) float64 {
	if max == min {
		return 0.0
	}
	normalized := (value - min) / (max - min)
	if normalized < 0 {
		return 0
	}
	if normalized > 1 {
		return 1
	}
	return normalized
}

// ClampFloat64 clamps a float64 value to a range [min, max]
func ClampFloat64(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// CalculateMean calculates the mean of a slice of float64 values
func CalculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// CalculateStandardDeviation calculates the standard deviation of a slice of float64 values
func CalculateStandardDeviation(values []float64) float64 {
	if len(values) <= 1 {
		return 0.0
	}

	mean := CalculateMean(values)
	var variance float64

	for _, v := range values {
		variance += math.Pow(v-mean, 2)
	}

	variance /= float64(len(values) - 1)
	return math.Sqrt(variance)
}

// CalculateZScore calculates the z-score for a value given mean and standard deviation
func CalculateZScore(value, mean, stdDev float64) float64 {
	if stdDev == 0 {
		return 0.0
	}
	return (value - mean) / stdDev
}

// IsValidEmail performs basic email validation
func IsValidEmail(email string) bool {
	parts := strings.Split(email, "@")
	return len(parts) == 2 && len(parts[0]) > 0 && len(parts[1]) > 0 && strings.Contains(parts[1], ".")
}

// IsValidURL performs basic URL validation
func IsValidURL(url string) bool {
	return strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")
}

// ParseFloat parses a string to float64 with error handling
func ParseFloat(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}

// ParseInt parses a string to int with error handling
func ParseInt(s string) (int, error) {
	return strconv.Atoi(s)
}

// FormatFloat formats a float64 to string with specified precision
func FormatFloat(f float64, precision int) string {
	return fmt.Sprintf("%."+strconv.Itoa(precision)+"f", f)
}

// Contains checks if a slice contains a specific value
func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// RemoveDuplicates removes duplicate strings from a slice
func RemoveDuplicates(slice []string) []string {
	keys := make(map[string]bool)
	var result []string

	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}

	return result
}

// ChunkSlice splits a slice into chunks of specified size
func ChunkSlice(slice []string, chunkSize int) [][]string {
	var chunks [][]string

	for i := 0; i < len(slice); i += chunkSize {
		end := i + chunkSize
		if end > len(slice) {
			end = len(slice)
		}
		chunks = append(chunks, slice[i:end])
	}

	return chunks
}

// SafeDivision performs division with zero check
func SafeDivision(numerator, denominator float64) float64 {
	if denominator == 0 {
		return 0.0
	}
	return numerator / denominator
}

// RoundToDecimalPlace rounds a float64 to specified decimal places
func RoundToDecimalPlace(value float64, places int) float64 {
	shift := math.Pow(10, float64(places))
	return math.Round(value*shift) / shift
}

// MinFloat64 returns the minimum of two float64 values
func MinFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// MaxFloat64 returns the maximum of two float64 values
func MaxFloat64(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// AbsFloat64 returns the absolute value of a float64
func AbsFloat64(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}

// MapKeys returns the keys of a map[string]float64
func MapKeys(m map[string]float64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// MapValues returns the values of a map[string]float64
func MapValues(m map[string]float64) []float64 {
	values := make([]float64, 0, len(m))
	for _, v := range m {
		values = append(values, v)
	}
	return values
}

// CopyStringMap creates a deep copy of a map[string]string
func CopyStringMap(original map[string]string) map[string]string {
	copy := make(map[string]string)
	for k, v := range original {
		copy[k] = v
	}
	return copy
}

// CopyFloat64Map creates a deep copy of a map[string]float64
func CopyFloat64Map(original map[string]float64) map[string]float64 {
	copy := make(map[string]float64)
	for k, v := range original {
		copy[k] = v
	}
	return copy
}
