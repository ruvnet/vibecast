package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"github.com/nats-io/nats.go"
	"golang.org/x/net/context"
)

type Config struct {
	Port         string
	PostgresURL  string
	RedisAddr    string
	NATSUrl      string
}

type TestMessage struct {
	ID        int       `json:"id" db:"id"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type APIService struct {
	db          *sql.DB
	redisClient *redis.Client
	natsConn    *nats.Conn
	upgrader    websocket.Upgrader
}

func loadConfig() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		PostgresURL: getEnv("POSTGRES_URL", "postgres://vibecast:vibecast123@localhost:5432/vibecast?sslmode=disable"),
		RedisAddr:   getEnv("REDIS_ADDR", "localhost:6379"),
		NATSUrl:     getEnv("NATS_URL", "nats://localhost:4222"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (s *APIService) initializeDatabase() error {
	// Create messages table if it doesn't exist
	createTable := `
	CREATE TABLE IF NOT EXISTS messages (
		id SERIAL PRIMARY KEY,
		content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT NOW()
	);`
	
	_, err := s.db.Exec(createTable)
	if err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}
	
	log.Println("Database initialized successfully")
	return nil
}

func main() {
	log.Println("Starting VibeCast Simple API Server...")
	
	config := loadConfig()
	
	// Initialize database
	db, err := sql.Open("postgres", config.PostgresURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	
	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to PostgreSQL database")
	
	// Initialize Redis
	redisClient := redis.NewClient(&redis.Options{
		Addr: config.RedisAddr,
	})
	
	// Test Redis connection
	ctx := context.Background()
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis")
	
	// Initialize NATS
	nc, err := nats.Connect(config.NATSUrl)
	if err != nil {
		log.Fatalf("Failed to connect to NATS: %v", err)
	}
	defer nc.Close()
	log.Println("Connected to NATS")
	
	// Initialize API service
	service := &APIService{
		db:          db,
		redisClient: redisClient,
		natsConn:    nc,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow connections from any origin
			},
		},
	}
	
	// Initialize database schema
	if err := service.initializeDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	
	// Setup HTTP server
	router := gin.Default()
	
	// Health check endpoint
	router.GET("/health", service.healthCheck)
	
	// Database test endpoints
	router.POST("/messages", service.createMessage)
	router.GET("/messages", service.getMessages)
	router.GET("/messages/:id", service.getMessage)
	
	// Redis test endpoints
	router.POST("/cache/:key", service.setCacheValue)
	router.GET("/cache/:key", service.getCacheValue)
	router.POST("/redis/publish", service.publishRedisMessage)
	
	// NATS test endpoints
	router.POST("/nats/publish", service.publishNATSMessage)
	router.GET("/nats/subscribe/:subject", service.subscribeNATSSubject)
	
	// WebSocket endpoint
	router.GET("/ws", service.handleWebSocket)
	
	// Start server
	log.Printf("Server starting on port %s", config.Port)
	log.Fatal(http.ListenAndServe(":"+config.Port, router))
}

func (s *APIService) healthCheck(c *gin.Context) {
	status := gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"services":  gin.H{},
	}
	
	// Check PostgreSQL
	if err := s.db.Ping(); err != nil {
		status["services"].(gin.H)["postgres"] = "unhealthy: " + err.Error()
	} else {
		status["services"].(gin.H)["postgres"] = "healthy"
	}
	
	// Check Redis
	ctx := context.Background()
	if _, err := s.redisClient.Ping(ctx).Result(); err != nil {
		status["services"].(gin.H)["redis"] = "unhealthy: " + err.Error()
	} else {
		status["services"].(gin.H)["redis"] = "healthy"
	}
	
	// Check NATS
	if s.natsConn.Status() != nats.CONNECTED {
		status["services"].(gin.H)["nats"] = "unhealthy"
	} else {
		status["services"].(gin.H)["nats"] = "healthy"
	}
	
	c.JSON(http.StatusOK, status)
}

func (s *APIService) createMessage(c *gin.Context) {
	var msg TestMessage
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	query := "INSERT INTO messages (content) VALUES ($1) RETURNING id, created_at"
	err := s.db.QueryRow(query, msg.Content).Scan(&msg.ID, &msg.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create message: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, msg)
}

func (s *APIService) getMessages(c *gin.Context) {
	rows, err := s.db.Query("SELECT id, content, created_at FROM messages ORDER BY created_at DESC LIMIT 10")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages: " + err.Error()})
		return
	}
	defer rows.Close()
	
	var messages []TestMessage
	for rows.Next() {
		var msg TestMessage
		if err := rows.Scan(&msg.ID, &msg.Content, &msg.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan message: " + err.Error()})
			return
		}
		messages = append(messages, msg)
	}
	
	if messages == nil {
		messages = []TestMessage{}
	}
	
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (s *APIService) getMessage(c *gin.Context) {
	id := c.Param("id")
	
	var msg TestMessage
	query := "SELECT id, content, created_at FROM messages WHERE id = $1"
	err := s.db.QueryRow(query, id).Scan(&msg.ID, &msg.Content, &msg.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get message: " + err.Error()})
		}
		return
	}
	
	c.JSON(http.StatusOK, msg)
}

func (s *APIService) setCacheValue(c *gin.Context) {
	key := c.Param("key")
	
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	value, ok := data["value"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "value must be a string"})
		return
	}
	
	ttl := 5 * time.Minute // Default TTL
	if ttlValue, exists := data["ttl"]; exists {
		if ttlSeconds, ok := ttlValue.(float64); ok {
			ttl = time.Duration(ttlSeconds) * time.Second
		}
	}
	
	ctx := context.Background()
	err := s.redisClient.Set(ctx, key, value, ttl).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set cache value: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"key": key, "value": value, "ttl": ttl.Seconds()})
}

func (s *APIService) getCacheValue(c *gin.Context) {
	key := c.Param("key")
	
	ctx := context.Background()
	value, err := s.redisClient.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Key not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cache value: " + err.Error()})
		}
		return
	}
	
	// Get TTL
	ttl, _ := s.redisClient.TTL(ctx, key).Result()
	
	c.JSON(http.StatusOK, gin.H{"key": key, "value": value, "ttl": ttl.Seconds()})
}

func (s *APIService) publishRedisMessage(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	channel, ok := data["channel"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "channel is required"})
		return
	}
	
	message, ok := data["message"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "message is required"})
		return
	}
	
	ctx := context.Background()
	result := s.redisClient.Publish(ctx, channel, message)
	if result.Err() != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to publish message: " + result.Err().Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"channel":     channel,
		"message":     message,
		"subscribers": result.Val(),
	})
}

func (s *APIService) publishNATSMessage(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	subject, ok := data["subject"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subject is required"})
		return
	}
	
	messageData, ok := data["data"]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "data is required"})
		return
	}
	
	// Marshal the message data to JSON
	messageBytes, err := json.Marshal(messageData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal message: " + err.Error()})
		return
	}
	
	err = s.natsConn.Publish(subject, messageBytes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to publish NATS message: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"subject": subject,
		"data":    messageData,
		"published": true,
	})
}

func (s *APIService) subscribeNATSSubject(c *gin.Context) {
	subject := c.Param("subject")
	
	// This is a simple implementation - in production you'd want to manage subscriptions differently
	messages := make(chan string, 10)
	
	sub, err := s.natsConn.Subscribe(subject, func(m *nats.Msg) {
		select {
		case messages <- string(m.Data):
		default:
			// Channel full, drop message
		}
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to subscribe: " + err.Error()})
		return
	}
	defer sub.Unsubscribe()
	
	// Wait for a message for up to 10 seconds
	select {
	case msg := <-messages:
		c.JSON(http.StatusOK, gin.H{
			"subject": subject,
			"message": msg,
		})
	case <-time.After(10 * time.Second):
		c.JSON(http.StatusRequestTimeout, gin.H{
			"subject": subject,
			"message": "No message received within timeout",
		})
	}
}

func (s *APIService) handleWebSocket(c *gin.Context) {
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()
	
	log.Println("WebSocket client connected")
	
	// Send welcome message
	welcome := map[string]interface{}{
		"type":      "welcome",
		"message":   "Connected to VibeCast WebSocket",
		"timestamp": time.Now().UTC(),
	}
	if err := conn.WriteJSON(welcome); err != nil {
		log.Printf("WebSocket write error: %v", err)
		return
	}
	
	// Read messages from client
	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		
		log.Printf("Received WebSocket message: %v", msg)
		
		// Echo the message back with additional info
		response := map[string]interface{}{
			"type":           "echo",
			"original":       msg,
			"timestamp":      time.Now().UTC(),
			"server_message": "Message received and processed",
		}
		
		if err := conn.WriteJSON(response); err != nil {
			log.Printf("WebSocket write error: %v", err)
			break
		}
	}
	
	log.Println("WebSocket client disconnected")
}