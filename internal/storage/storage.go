package storage

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
	"go.uber.org/zap"

	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/pkg/models"
)

// Storage represents the data storage interface
type Storage interface {
	// DataPoints
	CreateDataPoint(ctx context.Context, dataPoint *models.DataPoint) error
	GetDataPoint(ctx context.Context, id string) (*models.DataPoint, error)
	ListDataPoints(ctx context.Context, limit, offset int) ([]*models.DataPoint, error)
	UpdateDataPoint(ctx context.Context, dataPoint *models.DataPoint) error
	DeleteDataPoint(ctx context.Context, id string) error

	// Anomalies
	CreateAnomaly(ctx context.Context, anomaly *models.Anomaly) error
	GetAnomaly(ctx context.Context, id string) (*models.Anomaly, error)
	ListAnomalies(ctx context.Context, limit, offset int) ([]*models.Anomaly, error)
	UpdateAnomaly(ctx context.Context, anomaly *models.Anomaly) error
	DeleteAnomaly(ctx context.Context, id string) error

	// Feedback
	CreateFeedback(ctx context.Context, feedback *models.Feedback) error
	GetFeedbackByPrediction(ctx context.Context, predictionID string) ([]*models.Feedback, error)
	
	// Users
	CreateUser(ctx context.Context, user *models.User) error
	GetUser(ctx context.Context, id string) (*models.User, error)
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	
	// Close closes the storage connection
	Close() error
}

// postgresStorage implements Storage interface using PostgreSQL
type postgresStorage struct {
	db     *sql.DB
	logger *zap.Logger
}

// New creates a new storage instance
func New(cfg config.DatabaseConfig) (Storage, error) {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.Username, cfg.Password, cfg.Database, cfg.SSLMode)

	db, err := sql.Open(cfg.Driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	logger, _ := zap.NewProduction()

	return &postgresStorage{
		db:     db,
		logger: logger,
	}, nil
}

// CreateDataPoint creates a new data point
func (s *postgresStorage) CreateDataPoint(ctx context.Context, dataPoint *models.DataPoint) error {
	query := `
		INSERT INTO data_points (id, timestamp, source, features, labels, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)`

	// In a real implementation, you would serialize features, labels, and metadata to JSON
	// For now, this is a placeholder
	_, err := s.db.ExecContext(ctx, query, 
		dataPoint.ID, dataPoint.Timestamp, dataPoint.Source, 
		"{}", "{}", "{}")
	
	if err != nil {
		s.logger.Error("Failed to create data point", zap.Error(err))
		return fmt.Errorf("failed to create data point: %w", err)
	}

	return nil
}

// GetDataPoint retrieves a data point by ID
func (s *postgresStorage) GetDataPoint(ctx context.Context, id string) (*models.DataPoint, error) {
	query := `
		SELECT id, timestamp, source, features, labels, metadata
		FROM data_points 
		WHERE id = $1`

	row := s.db.QueryRowContext(ctx, query, id)

	var dataPoint models.DataPoint
	var features, labels, metadata string

	err := row.Scan(&dataPoint.ID, &dataPoint.Timestamp, &dataPoint.Source,
		&features, &labels, &metadata)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("data point not found")
		}
		s.logger.Error("Failed to get data point", zap.Error(err))
		return nil, fmt.Errorf("failed to get data point: %w", err)
	}

	// In a real implementation, deserialize JSON fields
	dataPoint.Features = make(map[string]float64)
	dataPoint.Labels = make(map[string]string)
	dataPoint.Metadata = make(map[string]interface{})

	return &dataPoint, nil
}

// ListDataPoints retrieves a list of data points
func (s *postgresStorage) ListDataPoints(ctx context.Context, limit, offset int) ([]*models.DataPoint, error) {
	query := `
		SELECT id, timestamp, source, features, labels, metadata
		FROM data_points
		ORDER BY timestamp DESC
		LIMIT $1 OFFSET $2`

	rows, err := s.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		s.logger.Error("Failed to list data points", zap.Error(err))
		return nil, fmt.Errorf("failed to list data points: %w", err)
	}
	defer rows.Close()

	var dataPoints []*models.DataPoint

	for rows.Next() {
		var dataPoint models.DataPoint
		var features, labels, metadata string

		err := rows.Scan(&dataPoint.ID, &dataPoint.Timestamp, &dataPoint.Source,
			&features, &labels, &metadata)
		
		if err != nil {
			s.logger.Error("Failed to scan data point", zap.Error(err))
			continue
		}

		// Initialize maps
		dataPoint.Features = make(map[string]float64)
		dataPoint.Labels = make(map[string]string)
		dataPoint.Metadata = make(map[string]interface{})

		dataPoints = append(dataPoints, &dataPoint)
	}

	return dataPoints, nil
}

// UpdateDataPoint updates a data point
func (s *postgresStorage) UpdateDataPoint(ctx context.Context, dataPoint *models.DataPoint) error {
	query := `
		UPDATE data_points 
		SET timestamp = $2, source = $3, features = $4, labels = $5, metadata = $6
		WHERE id = $1`

	// Placeholder implementation
	result, err := s.db.ExecContext(ctx, query,
		dataPoint.ID, dataPoint.Timestamp, dataPoint.Source,
		"{}", "{}", "{}")
	
	if err != nil {
		s.logger.Error("Failed to update data point", zap.Error(err))
		return fmt.Errorf("failed to update data point: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("data point not found")
	}

	return nil
}

// DeleteDataPoint deletes a data point
func (s *postgresStorage) DeleteDataPoint(ctx context.Context, id string) error {
	query := `DELETE FROM data_points WHERE id = $1`

	result, err := s.db.ExecContext(ctx, query, id)
	if err != nil {
		s.logger.Error("Failed to delete data point", zap.Error(err))
		return fmt.Errorf("failed to delete data point: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("data point not found")
	}

	return nil
}

// CreateAnomaly creates a new anomaly record
func (s *postgresStorage) CreateAnomaly(ctx context.Context, anomaly *models.Anomaly) error {
	query := `
		INSERT INTO anomalies (id, data_point_id, detected_at, score, confidence, 
			severity, model_used, features, metadata, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	now := time.Now()
	_, err := s.db.ExecContext(ctx, query,
		anomaly.ID, anomaly.DataPointID, anomaly.DetectedAt, anomaly.Score,
		anomaly.Confidence, anomaly.Severity, anomaly.ModelUsed,
		"{}", "{}", anomaly.Status, now, now)
	
	if err != nil {
		s.logger.Error("Failed to create anomaly", zap.Error(err))
		return fmt.Errorf("failed to create anomaly: %w", err)
	}

	return nil
}

// GetAnomaly retrieves an anomaly by ID
func (s *postgresStorage) GetAnomaly(ctx context.Context, id string) (*models.Anomaly, error) {
	query := `
		SELECT id, data_point_id, detected_at, score, confidence, severity,
			model_used, features, metadata, status, created_at, updated_at,
			resolved_at, resolved_by, resolution_note
		FROM anomalies 
		WHERE id = $1`

	row := s.db.QueryRowContext(ctx, query, id)

	var anomaly models.Anomaly
	var features, metadata string

	err := row.Scan(&anomaly.ID, &anomaly.DataPointID, &anomaly.DetectedAt,
		&anomaly.Score, &anomaly.Confidence, &anomaly.Severity,
		&anomaly.ModelUsed, &features, &metadata, &anomaly.Status,
		&anomaly.CreatedAt, &anomaly.UpdatedAt, &anomaly.ResolvedAt,
		&anomaly.ResolvedBy, &anomaly.ResolutionNote)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("anomaly not found")
		}
		s.logger.Error("Failed to get anomaly", zap.Error(err))
		return nil, fmt.Errorf("failed to get anomaly: %w", err)
	}

	// Initialize maps
	anomaly.Features = make(map[string]float64)
	anomaly.Metadata = make(map[string]interface{})

	return &anomaly, nil
}

// ListAnomalies retrieves a list of anomalies
func (s *postgresStorage) ListAnomalies(ctx context.Context, limit, offset int) ([]*models.Anomaly, error) {
	query := `
		SELECT id, data_point_id, detected_at, score, confidence, severity,
			model_used, features, metadata, status, created_at, updated_at
		FROM anomalies
		ORDER BY detected_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := s.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		s.logger.Error("Failed to list anomalies", zap.Error(err))
		return nil, fmt.Errorf("failed to list anomalies: %w", err)
	}
	defer rows.Close()

	var anomalies []*models.Anomaly

	for rows.Next() {
		var anomaly models.Anomaly
		var features, metadata string

		err := rows.Scan(&anomaly.ID, &anomaly.DataPointID, &anomaly.DetectedAt,
			&anomaly.Score, &anomaly.Confidence, &anomaly.Severity,
			&anomaly.ModelUsed, &features, &metadata, &anomaly.Status,
			&anomaly.CreatedAt, &anomaly.UpdatedAt)
		
		if err != nil {
			s.logger.Error("Failed to scan anomaly", zap.Error(err))
			continue
		}

		// Initialize maps
		anomaly.Features = make(map[string]float64)
		anomaly.Metadata = make(map[string]interface{})

		anomalies = append(anomalies, &anomaly)
	}

	return anomalies, nil
}

// UpdateAnomaly updates an anomaly
func (s *postgresStorage) UpdateAnomaly(ctx context.Context, anomaly *models.Anomaly) error {
	query := `
		UPDATE anomalies 
		SET score = $2, confidence = $3, severity = $4, status = $5, 
			resolved_at = $6, resolved_by = $7, resolution_note = $8, updated_at = $9
		WHERE id = $1`

	result, err := s.db.ExecContext(ctx, query,
		anomaly.ID, anomaly.Score, anomaly.Confidence, anomaly.Severity,
		anomaly.Status, anomaly.ResolvedAt, anomaly.ResolvedBy,
		anomaly.ResolutionNote, time.Now())
	
	if err != nil {
		s.logger.Error("Failed to update anomaly", zap.Error(err))
		return fmt.Errorf("failed to update anomaly: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("anomaly not found")
	}

	return nil
}

// DeleteAnomaly deletes an anomaly
func (s *postgresStorage) DeleteAnomaly(ctx context.Context, id string) error {
	query := `DELETE FROM anomalies WHERE id = $1`

	result, err := s.db.ExecContext(ctx, query, id)
	if err != nil {
		s.logger.Error("Failed to delete anomaly", zap.Error(err))
		return fmt.Errorf("failed to delete anomaly: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("anomaly not found")
	}

	return nil
}

// CreateFeedback creates a new feedback record
func (s *postgresStorage) CreateFeedback(ctx context.Context, feedback *models.Feedback) error {
	query := `
		INSERT INTO feedback (id, prediction_id, anomaly_id, is_correct, 
			actual_label, notes, provided_by, provided_at, weight, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err := s.db.ExecContext(ctx, query,
		feedback.ID, feedback.PredictionID, feedback.AnomalyID, feedback.IsCorrect,
		feedback.ActualLabel, feedback.Notes, feedback.ProvidedBy,
		feedback.ProvidedAt, feedback.Weight, time.Now())
	
	if err != nil {
		s.logger.Error("Failed to create feedback", zap.Error(err))
		return fmt.Errorf("failed to create feedback: %w", err)
	}

	return nil
}

// GetFeedbackByPrediction retrieves feedback for a prediction
func (s *postgresStorage) GetFeedbackByPrediction(ctx context.Context, predictionID string) ([]*models.Feedback, error) {
	query := `
		SELECT id, prediction_id, anomaly_id, is_correct, actual_label,
			notes, provided_by, provided_at, weight, created_at
		FROM feedback 
		WHERE prediction_id = $1
		ORDER BY provided_at DESC`

	rows, err := s.db.QueryContext(ctx, query, predictionID)
	if err != nil {
		s.logger.Error("Failed to get feedback", zap.Error(err))
		return nil, fmt.Errorf("failed to get feedback: %w", err)
	}
	defer rows.Close()

	var feedbackList []*models.Feedback

	for rows.Next() {
		var feedback models.Feedback
		err := rows.Scan(&feedback.ID, &feedback.PredictionID, &feedback.AnomalyID,
			&feedback.IsCorrect, &feedback.ActualLabel, &feedback.Notes,
			&feedback.ProvidedBy, &feedback.ProvidedAt, &feedback.Weight,
			&feedback.CreatedAt)
		
		if err != nil {
			s.logger.Error("Failed to scan feedback", zap.Error(err))
			continue
		}

		feedbackList = append(feedbackList, &feedback)
	}

	return feedbackList, nil
}

// CreateUser creates a new user
func (s *postgresStorage) CreateUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, username, email, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	now := time.Now()
	_, err := s.db.ExecContext(ctx, query,
		user.ID, user.Username, user.Email, user.Role, user.IsActive, now, now)
	
	if err != nil {
		s.logger.Error("Failed to create user", zap.Error(err))
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetUser retrieves a user by ID
func (s *postgresStorage) GetUser(ctx context.Context, id string) (*models.User, error) {
	query := `
		SELECT id, username, email, role, is_active, last_login, created_at, updated_at
		FROM users 
		WHERE id = $1`

	row := s.db.QueryRowContext(ctx, query, id)

	var user models.User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.Role,
		&user.IsActive, &user.LastLogin, &user.CreatedAt, &user.UpdatedAt)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		s.logger.Error("Failed to get user", zap.Error(err))
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetUserByUsername retrieves a user by username
func (s *postgresStorage) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	query := `
		SELECT id, username, email, role, is_active, last_login, created_at, updated_at
		FROM users 
		WHERE username = $1`

	row := s.db.QueryRowContext(ctx, query, username)

	var user models.User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.Role,
		&user.IsActive, &user.LastLogin, &user.CreatedAt, &user.UpdatedAt)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		s.logger.Error("Failed to get user by username", zap.Error(err))
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}

	return &user, nil
}

// Close closes the database connection
func (s *postgresStorage) Close() error {
	return s.db.Close()
}