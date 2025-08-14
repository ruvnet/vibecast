package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	Server   ServerConfig   `json:"server"`
	Database DatabaseConfig `json:"database"`
	Redis    RedisConfig    `json:"redis"`
	Detector DetectorConfig `json:"detector"`
	Auth     AuthConfig     `json:"auth"`
	Logging  LoggingConfig  `json:"logging"`
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port         int           `json:"port"`
	Host         string        `json:"host"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Driver   string `json:"driver"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	SSLMode  string `json:"ssl_mode"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Password string `json:"password"`
	Database int    `json:"database"`
}

// DetectorConfig holds anomaly detector configuration
type DetectorConfig struct {
	Threshold       float64       `json:"threshold"`
	WindowSize      int           `json:"window_size"`
	MinSamples      int           `json:"min_samples"`
	UpdateInterval  time.Duration `json:"update_interval"`
	EnableML        bool          `json:"enable_ml"`
	ModelPath       string        `json:"model_path"`
	FeatureCount    int           `json:"feature_count"`
	BatchSize       int           `json:"batch_size"`
	LearningRate    float64       `json:"learning_rate"`
	EnableCrypto    bool          `json:"enable_crypto"`
	CryptoAlgorithm string        `json:"crypto_algorithm"`
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWTSecret     string        `json:"jwt_secret"`
	TokenExpiry   time.Duration `json:"token_expiry"`
	RefreshExpiry time.Duration `json:"refresh_expiry"`
	EnableAuth    bool          `json:"enable_auth"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level      string `json:"level"`
	Format     string `json:"format"`
	OutputPath string `json:"output_path"`
}

// Load loads configuration from environment variables with defaults
func Load() (*Config, error) {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			Host:         getEnvString("SERVER_HOST", "0.0.0.0"),
			ReadTimeout:  time.Duration(getEnvInt("SERVER_READ_TIMEOUT", 10)) * time.Second,
			WriteTimeout: time.Duration(getEnvInt("SERVER_WRITE_TIMEOUT", 10)) * time.Second,
			IdleTimeout:  time.Duration(getEnvInt("SERVER_IDLE_TIMEOUT", 60)) * time.Second,
		},
		Database: DatabaseConfig{
			Driver:   getEnvString("DB_DRIVER", "postgres"),
			Host:     getEnvString("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			Database: getEnvString("DB_DATABASE", "anomaly_detector"),
			Username: getEnvString("DB_USERNAME", "postgres"),
			Password: getEnvString("DB_PASSWORD", "password"),
			SSLMode:  getEnvString("DB_SSL_MODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnvString("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnvString("REDIS_PASSWORD", ""),
			Database: getEnvInt("REDIS_DATABASE", 0),
		},
		Detector: DetectorConfig{
			Threshold:       getEnvFloat("DETECTOR_THRESHOLD", 0.8),
			WindowSize:      getEnvInt("DETECTOR_WINDOW_SIZE", 100),
			MinSamples:      getEnvInt("DETECTOR_MIN_SAMPLES", 10),
			UpdateInterval:  time.Duration(getEnvInt("DETECTOR_UPDATE_INTERVAL", 5)) * time.Second,
			EnableML:        getEnvBool("DETECTOR_ENABLE_ML", true),
			ModelPath:       getEnvString("DETECTOR_MODEL_PATH", "models/"),
			FeatureCount:    getEnvInt("DETECTOR_FEATURE_COUNT", 10),
			BatchSize:       getEnvInt("DETECTOR_BATCH_SIZE", 32),
			LearningRate:    getEnvFloat("DETECTOR_LEARNING_RATE", 0.001),
			EnableCrypto:    getEnvBool("DETECTOR_ENABLE_CRYPTO", true),
			CryptoAlgorithm: getEnvString("DETECTOR_CRYPTO_ALGORITHM", "AES-256-GCM"),
		},
		Auth: AuthConfig{
			JWTSecret:     getEnvString("JWT_SECRET", "your-secret-key"),
			TokenExpiry:   time.Duration(getEnvInt("JWT_TOKEN_EXPIRY", 24)) * time.Hour,
			RefreshExpiry: time.Duration(getEnvInt("JWT_REFRESH_EXPIRY", 168)) * time.Hour,
			EnableAuth:    getEnvBool("ENABLE_AUTH", false),
		},
		Logging: LoggingConfig{
			Level:      getEnvString("LOG_LEVEL", "info"),
			Format:     getEnvString("LOG_FORMAT", "json"),
			OutputPath: getEnvString("LOG_OUTPUT_PATH", "stdout"),
		},
	}, nil
}

// Helper functions to get environment variables with defaults
func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
