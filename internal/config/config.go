package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	Server    ServerConfig     `json:"server"`
	Database  DatabaseConfig  `json:"database"`
	Redis     RedisConfig     `json:"redis"`
	NATS      NATSConfig      `json:"nats"`
	Detector  DetectorConfig  `json:"detector"`
	Auth      AuthConfig      `json:"auth"`
	JWT       JWTConfig       `json:"jwt"`
	Logging   LoggingConfig   `json:"logging"`
	RateLimit RateLimitConfig `json:"rate_limit"`
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port         int           `json:"port"`
	Host         string        `json:"host"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
}

// DatabaseConfig contains database configuration
type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"dbname"`
	SSLMode  string `json:"ssl_mode"`
}

// RedisConfig contains Redis configuration
type RedisConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Password string `json:"password"`
	DB       int    `json:"db"`
}

// NATSConfig contains NATS configuration
type NATSConfig struct {
	URL string `json:"url"`
}

// DetectorConfig contains detector configuration
type DetectorConfig struct {
	Enabled bool `json:"enabled"`
}

// AuthConfig contains authentication configuration
type AuthConfig struct {
	JWTSecret string        `json:"jwt_secret"`
	TokenTTL  time.Duration `json:"token_ttl"`
}

// JWTConfig contains JWT configuration
type JWTConfig struct {
	Secret         string        `json:"secret"`
	ExpirationTime time.Duration `json:"expiration_time"`
	Issuer         string        `json:"issuer"`
}

// LoggingConfig contains logging configuration
type LoggingConfig struct {
	Level string `json:"level"`
}

// RateLimitConfig contains rate limiting configuration
type RateLimitConfig struct {
	RequestsPerMinute int `json:"requests_per_minute"`
	Burst             int `json:"burst"`
}

// BrokerConfig configuration
type BrokerConfig struct {
	MaxRetries   int           `json:"max_retries"`
	RetryDelay   time.Duration `json:"retry_delay"`
	BufferSize   int           `json:"buffer_size"`
	RetryAttempts int          `json:"retry_attempts"`
}

// QueueConfig configuration  
type QueueConfig struct {
	MaxSize    int           `json:"max_size"`
	Timeout    time.Duration `json:"timeout"`
	BufferSize int           `json:"buffer_size"`
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("PORT", 8080),
			Host:         getEnv("HOST", "0.0.0.0"),
			ReadTimeout:  time.Duration(getEnvInt("READ_timeout", 10)) * time.Second,
			WriteTimeout: time.Duration(getEnvInt("write_timeout", 10)) * time.Second,
			IdleTimeout:  time.Duration(getEnvInt("idle_timeout", 60)) * time.Second,
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "password"),
			DBName:   getEnv("DB_NAME", "vibecast"),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		NATS: NATSConfig{
			URL: getEnv("NATS_URL", "nats://localhost:4222"),
		},
		Auth: AuthConfig{
			JWTSecret: getEnv("JWT_SECRET", "your-secret-key"),
			TokenTTL:  time.Duration(getEnvInt("TOKEN_TTL", 24)) * time.Hour,
		},
		JWT: JWTConfig{
			Secret:         getEnv("JWT_SECRET", "your-secret-key"),
			ExpirationTime: time.Duration(getEnvInt("JWT_EXPIRATION_HOURS", 24)) * time.Hour,
			Issuer:         getEnv("JWT_ISSUER", "alienator-system"),
		},
		Logging: LoggingConfig{
			Level: getEnv("LOG_LEVEL", "info"),
		},
		RateLimit: RateLimitConfig{
			RequestsPerMinute: getEnvInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 1000),
			Burst:             getEnvInt("RATE_LIMIT_BURST", 100),
		},
	}
}

func getEnv(key, defaultValue string) string {
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