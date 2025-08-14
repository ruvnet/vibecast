// Package gateway provides API gateway functionality with routing and service discovery
package gateway

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ServiceInstance represents a backend service instance
type ServiceInstance struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Address string            `json:"address"`
	Port    int               `json:"port"`
	Health  string            `json:"health"`
	Tags    []string          `json:"tags"`
	Meta    map[string]string `json:"meta"`
	LastSeen time.Time        `json:"last_seen"`
}

// Route represents a routing rule
type Route struct {
	Path        string            `json:"path"`
	Service     string            `json:"service"`
	Methods     []string          `json:"methods"`
	StripPrefix bool              `json:"strip_prefix"`
	Middleware  []string          `json:"middleware"`
	Headers     map[string]string `json:"headers"`
	Timeout     time.Duration     `json:"timeout"`
}

// LoadBalancer defines load balancing strategies
type LoadBalancer interface {
	Select(instances []*ServiceInstance) *ServiceInstance
}

// RoundRobinBalancer implements round-robin load balancing
type RoundRobinBalancer struct {
	current int
	mutex   sync.Mutex
}

// Select returns the next instance using round-robin
func (rb *RoundRobinBalancer) Select(instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}

	rb.mutex.Lock()
	defer rb.mutex.Unlock()

	instance := instances[rb.current]
	rb.current = (rb.current + 1) % len(instances)
	return instance
}

// ServiceRegistry manages service discovery and health checking
type ServiceRegistry struct {
	services map[string][]*ServiceInstance
	mutex    sync.RWMutex
	logger   *zap.Logger
}

// NewServiceRegistry creates a new service registry
func NewServiceRegistry(logger *zap.Logger) *ServiceRegistry {
	registry := &ServiceRegistry{
		services: make(map[string][]*ServiceInstance),
		logger:   logger,
	}

	// Start health check routine
	go registry.healthCheckLoop()

	return registry
}

// Register adds a service instance to the registry
func (sr *ServiceRegistry) Register(instance *ServiceInstance) {
	sr.mutex.Lock()
	defer sr.mutex.Unlock()

	instance.LastSeen = time.Now()
	instance.Health = "healthy"

	if sr.services[instance.Name] == nil {
		sr.services[instance.Name] = make([]*ServiceInstance, 0)
	}

	// Check if instance already exists
	for i, existing := range sr.services[instance.Name] {
		if existing.ID == instance.ID {
			sr.services[instance.Name][i] = instance
			sr.logger.Info("Service instance updated",
				zap.String("service", instance.Name),
				zap.String("id", instance.ID),
				zap.String("address", fmt.Sprintf("%s:%d", instance.Address, instance.Port)),
			)
			return
		}
	}

	// Add new instance
	sr.services[instance.Name] = append(sr.services[instance.Name], instance)
	sr.logger.Info("Service instance registered",
		zap.String("service", instance.Name),
		zap.String("id", instance.ID),
		zap.String("address", fmt.Sprintf("%s:%d", instance.Address, instance.Port)),
	)
}

// Deregister removes a service instance from the registry
func (sr *ServiceRegistry) Deregister(serviceName, instanceID string) {
	sr.mutex.Lock()
	defer sr.mutex.Unlock()

	instances := sr.services[serviceName]
	for i, instance := range instances {
		if instance.ID == instanceID {
			sr.services[serviceName] = append(instances[:i], instances[i+1:]...)
			sr.logger.Info("Service instance deregistered",
				zap.String("service", serviceName),
				zap.String("id", instanceID),
			)
			break
		}
	}
}

// GetHealthyInstances returns healthy instances for a service
func (sr *ServiceRegistry) GetHealthyInstances(serviceName string) []*ServiceInstance {
	sr.mutex.RLock()
	defer sr.mutex.RUnlock()

	instances := sr.services[serviceName]
	healthy := make([]*ServiceInstance, 0)

	for _, instance := range instances {
		if instance.Health == "healthy" {
			healthy = append(healthy, instance)
		}
	}

	return healthy
}

// GetAllServices returns all registered services
func (sr *ServiceRegistry) GetAllServices() map[string][]*ServiceInstance {
	sr.mutex.RLock()
	defer sr.mutex.RUnlock()

	// Create a deep copy
	result := make(map[string][]*ServiceInstance)
	for service, instances := range sr.services {
		result[service] = make([]*ServiceInstance, len(instances))
		copy(result[service], instances)
	}

	return result
}

// healthCheckLoop performs periodic health checks
func (sr *ServiceRegistry) healthCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		sr.performHealthChecks()
		sr.cleanupStaleInstances()
	}
}

// performHealthChecks checks the health of all registered instances
func (sr *ServiceRegistry) performHealthChecks() {
	sr.mutex.Lock()
	defer sr.mutex.Unlock()

	for serviceName, instances := range sr.services {
		for _, instance := range instances {
			// Perform health check (simplified)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			
			healthURL := fmt.Sprintf("http://%s:%d/health", instance.Address, instance.Port)
			req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
			if err != nil {
				instance.Health = "unhealthy"
				cancel()
				continue
			}

			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			cancel()

			if err != nil || resp.StatusCode != http.StatusOK {
				instance.Health = "unhealthy"
				sr.logger.Warn("Service instance health check failed",
					zap.String("service", serviceName),
					zap.String("id", instance.ID),
					zap.Error(err),
				)
			} else {
				instance.Health = "healthy"
				instance.LastSeen = time.Now()
			}

			if resp != nil {
				resp.Body.Close()
			}
		}
	}
}

// cleanupStaleInstances removes instances that haven't been seen recently
func (sr *ServiceRegistry) cleanupStaleInstances() {
	sr.mutex.Lock()
	defer sr.mutex.Unlock()

	staleThreshold := time.Now().Add(-5 * time.Minute)

	for serviceName, instances := range sr.services {
		activeInstances := make([]*ServiceInstance, 0)
		
		for _, instance := range instances {
			if instance.LastSeen.After(staleThreshold) {
				activeInstances = append(activeInstances, instance)
			} else {
				sr.logger.Info("Removing stale service instance",
					zap.String("service", serviceName),
					zap.String("id", instance.ID),
					zap.Time("last_seen", instance.LastSeen),
				)
			}
		}
		
		sr.services[serviceName] = activeInstances
	}
}

// Gateway represents the API gateway
type Gateway struct {
	registry     *ServiceRegistry
	routes       []*Route
	balancer     LoadBalancer
	logger       *zap.Logger
	defaultRoutes map[string]string
}

// Config holds gateway configuration
type Config struct {
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// NewGateway creates a new API gateway
func NewGateway(logger *zap.Logger) *Gateway {
	registry := NewServiceRegistry(logger)
	
	// Default service routes
	defaultRoutes := map[string]string{
		"/api/v1/auth/":    "auth-service",
		"/api/v1/users/":   "user-service", 
		"/api/v1/anomaly/": "anomaly-service",
		"/api/v1/admin/":   "admin-service",
		"/health":          "health-service",
	}

	gateway := &Gateway{
		registry:      registry,
		routes:        make([]*Route, 0),
		balancer:      &RoundRobinBalancer{},
		logger:        logger,
		defaultRoutes: defaultRoutes,
	}

	// Initialize default routes
	gateway.initializeDefaultRoutes()

	return gateway
}

// initializeDefaultRoutes sets up default routing rules
func (gw *Gateway) initializeDefaultRoutes() {
	for path, service := range gw.defaultRoutes {
		route := &Route{
			Path:        path,
			Service:     service,
			Methods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH"},
			StripPrefix: false,
			Timeout:     30 * time.Second,
		}
		gw.routes = append(gw.routes, route)
	}
}

// AddRoute adds a routing rule
func (gw *Gateway) AddRoute(route *Route) {
	gw.routes = append(gw.routes, route)
	gw.logger.Info("Route added",
		zap.String("path", route.Path),
		zap.String("service", route.Service),
	)
}

// RegisterService registers a service instance
func (gw *Gateway) RegisterService(instance *ServiceInstance) {
	gw.registry.Register(instance)
}

// SetupRoutes configures the gateway routes
func (gw *Gateway) SetupRoutes(router *gin.Engine) {
	// Middleware for service discovery and load balancing
	router.Use(gw.routingMiddleware())

	// Health endpoint for the gateway itself
	router.GET("/gateway/health", func(c *gin.Context) {
		services := gw.registry.GetAllServices()
		healthyCount := 0
		totalCount := 0

		for _, instances := range services {
			for _, instance := range instances {
				totalCount++
				if instance.Health == "healthy" {
					healthyCount++
				}
			}
		}

		status := "healthy"
		if healthyCount == 0 && totalCount > 0 {
			status = "unhealthy"
		} else if healthyCount < totalCount {
			status = "degraded"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":         status,
			"healthy_services": healthyCount,
			"total_services":   totalCount,
			"services":       services,
			"timestamp":      time.Now(),
		})
	})

	// Service registry endpoints
	registry := router.Group("/gateway/registry")
	{
		registry.GET("/services", gw.listServices)
		registry.POST("/services", gw.registerServiceEndpoint)
		registry.DELETE("/services/:service/:id", gw.deregisterServiceEndpoint)
	}

	// Catch-all route for proxying
	router.NoRoute(gw.proxyHandler)
}

// routingMiddleware handles request routing logic
func (gw *Gateway) routingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Find matching route
		route := gw.findRoute(c.Request.URL.Path, c.Request.Method)
		if route != nil {
			c.Set("route", route)
			c.Set("service", route.Service)
		}
		c.Next()
	}
}

// findRoute finds a matching route for the given path and method
func (gw *Gateway) findRoute(path, method string) *Route {
	for _, route := range gw.routes {
		if gw.pathMatches(route.Path, path) && gw.methodMatches(route.Methods, method) {
			return route
		}
	}
	return nil
}

// pathMatches checks if a route path matches the request path
func (gw *Gateway) pathMatches(routePath, requestPath string) bool {
	// Simple prefix matching for now
	return strings.HasPrefix(requestPath, strings.TrimSuffix(routePath, "/"))
}

// methodMatches checks if the HTTP method is allowed for the route
func (gw *Gateway) methodMatches(allowedMethods []string, method string) bool {
	for _, allowed := range allowedMethods {
		if allowed == method {
			return true
		}
	}
	return false
}

// proxyHandler handles request proxying to backend services
func (gw *Gateway) proxyHandler(c *gin.Context) {
	route, exists := c.Get("route")
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No route found for this path",
			"path":  c.Request.URL.Path,
		})
		return
	}

	routeConfig := route.(*Route)
	instances := gw.registry.GetHealthyInstances(routeConfig.Service)

	if len(instances) == 0 {
		gw.logger.Warn("No healthy instances available",
			zap.String("service", routeConfig.Service),
			zap.String("path", c.Request.URL.Path),
		)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Service unavailable",
			"service": routeConfig.Service,
		})
		return
	}

	// Select an instance using load balancer
	instance := gw.balancer.Select(instances)
	if instance == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "No available service instance",
		})
		return
	}

	// For now, return service information (in a real implementation, you would proxy the request)
	c.JSON(http.StatusOK, gin.H{
		"message":     "Request would be proxied to service",
		"service":     routeConfig.Service,
		"instance":    instance,
		"path":        c.Request.URL.Path,
		"method":      c.Request.Method,
		"route_info": routeConfig,
	})
}

// API endpoints for service registry management

func (gw *Gateway) listServices(c *gin.Context) {
	services := gw.registry.GetAllServices()
	c.JSON(http.StatusOK, gin.H{
		"services": services,
		"timestamp": time.Now(),
	})
}

func (gw *Gateway) registerServiceEndpoint(c *gin.Context) {
	var instance ServiceInstance
	if err := c.ShouldBindJSON(&instance); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid service instance data",
		})
		return
	}

	gw.registry.Register(&instance)
	c.JSON(http.StatusCreated, gin.H{
		"message": "Service registered successfully",
		"instance": instance,
	})
}

func (gw *Gateway) deregisterServiceEndpoint(c *gin.Context) {
	serviceName := c.Param("service")
	instanceID := c.Param("id")

	gw.registry.Deregister(serviceName, instanceID)
	c.JSON(http.StatusOK, gin.H{
		"message": "Service deregistered successfully",
	})
}