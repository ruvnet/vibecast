package core

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// StorageConfig holds configuration for storage
type StorageConfig struct {
	Type               string        // "memory", "file", "redis", etc.
	MaxKeys            int           // Maximum number of keys to store
	DefaultTTL         time.Duration // Default TTL for keys
	CleanupInterval    time.Duration // How often to clean up expired keys
	CompressionEnabled bool          // Enable data compression
	BasePath           string        // Base path for file storage
}

// DefaultStorageConfig returns default storage configuration
func DefaultStorageConfig() *StorageConfig {
	return &StorageConfig{
		Type:               "memory",
		MaxKeys:            100000,
		DefaultTTL:         24 * time.Hour,
		CleanupInterval:    5 * time.Minute,
		CompressionEnabled: false,
		BasePath:           "./data",
	}
}

// storageItem represents an item in storage
type storageItem struct {
	Data      []byte
	ExpiresAt time.Time
	CreatedAt time.Time
}

// MemoryStorage implements the Storage interface using in-memory storage
type MemoryStorage struct {
	config *StorageConfig
	items  map[string]*storageItem
	mu     sync.RWMutex
	logger *zap.Logger
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewMemoryStorage creates a new memory storage
func NewMemoryStorage(config *StorageConfig, logger *zap.Logger) *MemoryStorage {
	if config == nil {
		config = DefaultStorageConfig()
	}
	
	ctx, cancel := context.WithCancel(context.Background())
	
	storage := &MemoryStorage{
		config: config,
		items:  make(map[string]*storageItem),
		logger: logger,
		ctx:    ctx,
		cancel: cancel,
	}
	
	// Start cleanup routine
	storage.wg.Add(1)
	go storage.cleanupRoutine()
	
	return storage
}

// Store stores data with the given key
func (ms *MemoryStorage) Store(ctx context.Context, key string, value interface{}) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}
	
	if value == nil {
		return fmt.Errorf("value cannot be nil")
	}
	
	// Marshal value to bytes
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}
	
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	// Check capacity
	if len(ms.items) >= ms.config.MaxKeys {
		// Try to free up space by cleaning expired items
		ms.performCleanup()
		
		if len(ms.items) >= ms.config.MaxKeys {
			return fmt.Errorf("storage capacity exceeded: %d", ms.config.MaxKeys)
		}
	}
	
	// Use default TTL
	ttl := ms.config.DefaultTTL
	
	now := time.Now()
	expiresAt := now.Add(ttl)
	
	// Optionally compress data
	finalData := data
	if ms.config.CompressionEnabled {
		// In a real implementation, you would compress the data here
		// For simplicity, we'll skip compression in this example
		finalData = data
	}
	
	ms.items[key] = &storageItem{
		Data:      finalData,
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}
	
	ms.logger.Debug("data stored",
		zap.String("key", key),
		zap.Int("size", len(data)),
		zap.Time("expires_at", expiresAt))
	
	return nil
}

// Retrieve retrieves data by key (interface method)
func (ms *MemoryStorage) Retrieve(ctx context.Context, key string, dest interface{}) error {
	data, err := ms.RetrieveBytes(ctx, key)
	if err != nil {
		return err
	}
	
	// Unmarshal data into dest
	if err := json.Unmarshal(data, dest); err != nil {
		return fmt.Errorf("failed to unmarshal data: %w", err)
	}
	
	return nil
}

// RetrieveBytes retrieves raw bytes by key
func (ms *MemoryStorage) RetrieveBytes(ctx context.Context, key string) ([]byte, error) {
	if key == "" {
		return nil, fmt.Errorf("key cannot be empty")
	}
	
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	
	item, exists := ms.items[key]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", key)
	}
	
	// Check expiration
	if time.Now().After(item.ExpiresAt) {
		// Item has expired - we'll clean it up in the next cleanup cycle
		return nil, fmt.Errorf("key expired: %s", key)
	}
	
	// Return a copy of the data to prevent external modifications
	result := make([]byte, len(item.Data))
	copy(result, item.Data)
	
	ms.logger.Debug("data retrieved",
		zap.String("key", key),
		zap.Int("size", len(result)))
	
	return result, nil
}

// Delete deletes data by key
func (ms *MemoryStorage) Delete(ctx context.Context, key string) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}
	
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	_, exists := ms.items[key]
	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}
	
	delete(ms.items, key)
	
	ms.logger.Debug("data deleted",
		zap.String("key", key))
	
	return nil
}

// List lists keys matching a pattern
func (ms *MemoryStorage) List(ctx context.Context, pattern string) ([]string, error) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	
	var result []string
	now := time.Now()
	
	for key, item := range ms.items {
		// Skip expired items
		if now.After(item.ExpiresAt) {
			continue
		}
		
		// Simple pattern matching - in production, use proper glob or regex
		if pattern == "*" || pattern == "" {
			result = append(result, key)
		} else if strings.Contains(key, pattern) {
			result = append(result, key)
		} else if matched, _ := filepath.Match(pattern, key); matched {
			result = append(result, key)
		}
	}
	
	ms.logger.Debug("keys listed",
		zap.String("pattern", pattern),
		zap.Int("count", len(result)))
	
	return result, nil
}

// Exists checks if a key exists
func (ms *MemoryStorage) Exists(ctx context.Context, key string) (bool, error) {
	if key == "" {
		return false, fmt.Errorf("key cannot be empty")
	}
	
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	
	item, exists := ms.items[key]
	if !exists {
		return false, nil
	}
	
	// Check expiration
	if time.Now().After(item.ExpiresAt) {
		return false, nil
	}
	
	return true, nil
}

// Close closes the storage
func (ms *MemoryStorage) Close() error {
	ms.logger.Info("closing memory storage")
	
	// Cancel context to stop routines
	ms.cancel()
	
	// Wait for all goroutines to finish
	ms.wg.Wait()
	
	// Clear all items
	ms.mu.Lock()
	ms.items = make(map[string]*storageItem)
	ms.mu.Unlock()
	
	ms.logger.Info("memory storage closed")
	return nil
}

// cleanupRoutine performs periodic cleanup of expired items
func (ms *MemoryStorage) cleanupRoutine() {
	defer ms.wg.Done()
	
	ticker := time.NewTicker(ms.config.CleanupInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			ms.mu.Lock()
			ms.performCleanup()
			ms.mu.Unlock()
		case <-ms.ctx.Done():
			return
		}
	}
}

// performCleanup removes expired items (called with lock held)
func (ms *MemoryStorage) performCleanup() {
	now := time.Now()
	keysToDelete := make([]string, 0)
	
	for key, item := range ms.items {
		if now.After(item.ExpiresAt) {
			keysToDelete = append(keysToDelete, key)
		}
	}
	
	for _, key := range keysToDelete {
		delete(ms.items, key)
	}
	
	if len(keysToDelete) > 0 {
		ms.logger.Debug("cleaned up expired items",
			zap.Int("count", len(keysToDelete)))
	}
}

// GetAllStats returns storage statistics
func (ms *MemoryStorage) GetAllStats() map[string]interface{} {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	
	totalSize := 0
	expiredCount := 0
	now := time.Now()
	
	for _, item := range ms.items {
		totalSize += len(item.Data)
		if now.After(item.ExpiresAt) {
			expiredCount++
		}
	}
	
	stats := map[string]interface{}{
		"total_keys":    len(ms.items),
		"max_keys":      ms.config.MaxKeys,
		"total_size":    totalSize,
		"expired_keys":  expiredCount,
		"cleanup_interval": ms.config.CleanupInterval.String(),
	}
	
	return stats
}

// Extend extends the TTL of a key
func (ms *MemoryStorage) Extend(ctx context.Context, key string, additionalTTL time.Duration) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}
	
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	item, exists := ms.items[key]
	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}
	
	// Check if not already expired
	if time.Now().After(item.ExpiresAt) {
		return fmt.Errorf("key already expired: %s", key)
	}
	
	// Extend expiration time
	item.ExpiresAt = item.ExpiresAt.Add(additionalTTL)
	
	ms.logger.Debug("key TTL extended",
		zap.String("key", key),
		zap.Duration("additional_ttl", additionalTTL),
		zap.Time("new_expires_at", item.ExpiresAt))
	
	return nil
}

// Update updates data for an existing key without changing TTL
func (ms *MemoryStorage) Update(ctx context.Context, key string, data []byte) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}
	
	if data == nil {
		return fmt.Errorf("data cannot be nil")
	}
	
	ms.mu.Lock()
	defer ms.mu.Unlock()
	
	item, exists := ms.items[key]
	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}
	
	// Check if not already expired
	if time.Now().After(item.ExpiresAt) {
		return fmt.Errorf("key already expired: %s", key)
	}
	
	// Optionally compress data
	finalData := data
	if ms.config.CompressionEnabled {
		// In a real implementation, you would compress the data here
		finalData = data
	}
	
	// Update data
	item.Data = finalData
	
	ms.logger.Debug("data updated",
		zap.String("key", key),
		zap.Int("size", len(data)))
	
	return nil
}