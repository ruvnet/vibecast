package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"github.com/nats-io/nats.go"
)

type ValidationResult struct {
	Component string        `json:"component"`
	Status    string        `json:"status"`
	Details   interface{}   `json:"details,omitempty"`
	Error     string        `json:"error,omitempty"`
	Duration  time.Duration `json:"duration"`
}

func main() {
	results := []ValidationResult{}
	
	// Test Redis Connection
	start := time.Now()
	redisResult := testRedis()
	redisResult.Duration = time.Since(start)
	results = append(results, redisResult)
	
	// Test NATS Connection
	start = time.Now()
	natsResult := testNATS()
	natsResult.Duration = time.Since(start)
	results = append(results, natsResult)
	
	// Test PostgreSQL Connection
	start = time.Now()
	pgResult := testPostgreSQL()
	pgResult.Duration = time.Since(start)
	results = append(results, pgResult)
	
	// Test HTTP Server
	start = time.Now()
	httpResult := testHTTPServer()
	httpResult.Duration = time.Since(start)
	results = append(results, httpResult)
	
	// Print results
	fmt.Println("\n=== VibeCast Service Validation Report ===\n")
	for _, r := range results {
		status := "✅"
		if r.Status != "OK" {
			status = "❌"
		}
		fmt.Printf("%s %-15s: %-10s (%.2fms)\n", status, r.Component, r.Status, r.Duration.Seconds()*1000)
		if r.Error != "" {
			fmt.Printf("   Error: %s\n", r.Error)
		}
		if r.Details != nil {
			fmt.Printf("   Details: %v\n", r.Details)
		}
	}
	
	// Summary
	working := 0
	for _, r := range results {
		if r.Status == "OK" {
			working++
		}
	}
	fmt.Printf("\n=== Summary: %d/%d services operational ===\n", working, len(results))
}

func testRedis() ValidationResult {
	ctx := context.Background()
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	defer client.Close()
	
	// Test connection
	_, err := client.Ping(ctx).Result()
	if err != nil {
		return ValidationResult{
			Component: "Redis",
			Status:    "FAILED",
			Error:     err.Error(),
		}
	}
	
	// Test basic operations
	key := "test:validation"
	value := "test_value_" + time.Now().Format("15:04:05")
	
	err = client.Set(ctx, key, value, time.Second*10).Err()
	if err != nil {
		return ValidationResult{
			Component: "Redis",
			Status:    "PARTIAL",
			Error:     fmt.Sprintf("Set failed: %v", err),
		}
	}
	
	retrieved, err := client.Get(ctx, key).Result()
	if err != nil || retrieved != value {
		return ValidationResult{
			Component: "Redis",
			Status:    "PARTIAL",
			Error:     fmt.Sprintf("Get failed: %v", err),
		}
	}
	
	client.Del(ctx, key)
	
	return ValidationResult{
		Component: "Redis",
		Status:    "OK",
		Details:   map[string]string{"operations": "ping,set,get,del"},
	}
}

func testNATS() ValidationResult {
	nc, err := nats.Connect("nats://localhost:4222", nats.Timeout(2*time.Second))
	if err != nil {
		return ValidationResult{
			Component: "NATS",
			Status:    "FAILED",
			Error:     err.Error(),
		}
	}
	defer nc.Close()
	
	// Test pub/sub
	subject := "test.validation"
	received := make(chan bool, 1)
	
	sub, err := nc.Subscribe(subject, func(msg *nats.Msg) {
		if string(msg.Data) == "test_message" {
			received <- true
		}
	})
	if err != nil {
		return ValidationResult{
			Component: "NATS",
			Status:    "PARTIAL",
			Error:     fmt.Sprintf("Subscribe failed: %v", err),
		}
	}
	defer sub.Unsubscribe()
	
	err = nc.Publish(subject, []byte("test_message"))
	if err != nil {
		return ValidationResult{
			Component: "NATS",
			Status:    "PARTIAL",
			Error:     fmt.Sprintf("Publish failed: %v", err),
		}
	}
	
	select {
	case <-received:
		return ValidationResult{
			Component: "NATS",
			Status:    "OK",
			Details:   map[string]string{"operations": "connect,publish,subscribe"},
		}
	case <-time.After(time.Second):
		return ValidationResult{
			Component: "NATS",
			Status:    "PARTIAL",
			Error:     "Message not received within timeout",
		}
	}
}

func testPostgreSQL() ValidationResult {
	connStr := "host=localhost port=5432 user=postgres password=postgres dbname=postgres sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return ValidationResult{
			Component: "PostgreSQL",
			Status:    "FAILED",
			Error:     err.Error(),
		}
	}
	defer db.Close()
	
	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	
	err = db.PingContext(ctx)
	if err != nil {
		return ValidationResult{
			Component: "PostgreSQL",
			Status:    "FAILED",
			Error:     err.Error(),
		}
	}
	
	// Test query
	var version string
	err = db.QueryRowContext(ctx, "SELECT version()").Scan(&version)
	if err != nil {
		return ValidationResult{
			Component: "PostgreSQL",
			Status:    "PARTIAL",
			Error:     fmt.Sprintf("Query failed: %v", err),
		}
	}
	
	return ValidationResult{
		Component: "PostgreSQL",
		Status:    "OK",
		Details:   map[string]string{"operations": "ping,query", "version": version[:30] + "..."},
	}
}

func testHTTPServer() ValidationResult {
	// Try to start a simple HTTP server
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})
	
	server := &http.Server{
		Addr:    ":8081",
		Handler: mux,
	}
	
	// Start server in goroutine
	go func() {
		server.ListenAndServe()
	}()
	
	// Give server time to start
	time.Sleep(100 * time.Millisecond)
	
	// Test the endpoint
	resp, err := http.Get("http://localhost:8081/health")
	if err != nil {
		server.Close()
		return ValidationResult{
			Component: "HTTP Server",
			Status:    "FAILED",
			Error:     err.Error(),
		}
	}
	defer resp.Body.Close()
	
	server.Close()
	
	if resp.StatusCode == http.StatusOK {
		return ValidationResult{
			Component: "HTTP Server",
			Status:    "OK",
			Details:   map[string]interface{}{"port": 8081, "endpoint": "/health"},
		}
	}
	
	return ValidationResult{
		Component: "HTTP Server",
		Status:    "PARTIAL",
		Error:     fmt.Sprintf("Unexpected status code: %d", resp.StatusCode),
	}
}