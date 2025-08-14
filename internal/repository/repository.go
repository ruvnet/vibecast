// Package repository provides data access layer
package repository

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/ruvnet/alienator/internal/config"
	"github.com/ruvnet/alienator/internal/models"
	"go.uber.org/zap"
)

// Repository interface defines data access methods
type Repository interface {
	// User methods
	CreateUser(user *models.User) error
	GetUserByID(id uuid.UUID) (*models.User, error)
	GetUserByEmail(email string) (*models.User, error)
	GetUserByUsername(username string) (*models.User, error)
	UpdateUser(id uuid.UUID, updates *models.UpdateUserRequest) error
	DeleteUser(id uuid.UUID) error
	ListUsers(page, limit int) ([]*models.User, int, error)

	// AnomalyData methods
	CreateAnomalyData(data *models.AnomalyData) error
	GetAnomalyDataByID(id uuid.UUID) (*models.AnomalyData, error)
	GetAnomalyDataByUserID(userID uuid.UUID, page, limit int) ([]*models.AnomalyData, int, error)
	ListAnomalyData(page, limit int) ([]*models.AnomalyData, int, error)
	DeleteAnomalyData(id uuid.UUID) error

	// Health check
	HealthCheck() error
	Close() error
}

// postgresRepository implements Repository interface
type postgresRepository struct {
	db     *sql.DB
	logger *zap.Logger
}

// NewRepository creates a new repository instance
func NewRepository(cfg *config.Config, logger *zap.Logger) Repository {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host, cfg.Database.Port, cfg.Database.User,
		cfg.Database.Password, cfg.Database.DBName, cfg.Database.SSLMode)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}

	if err := db.Ping(); err != nil {
		logger.Fatal("Failed to ping database", zap.Error(err))
	}

	repo := &postgresRepository{
		db:     db,
		logger: logger,
	}

	// Create tables if they don't exist
	if err := repo.createTables(); err != nil {
		logger.Fatal("Failed to create tables", zap.Error(err))
	}

	logger.Info("Database connection established")
	return repo
}

// createTables creates the necessary database tables
func (r *postgresRepository) createTables() error {
	queries := []string{
		`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			username VARCHAR(50) UNIQUE NOT NULL,
			first_name VARCHAR(100) NOT NULL,
			last_name VARCHAR(100) NOT NULL,
			password VARCHAR(255) NOT NULL,
			role VARCHAR(20) DEFAULT 'user',
			is_active BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS anomaly_data (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			data JSONB NOT NULL,
			score DECIMAL(10,8),
			is_anomaly BOOLEAN DEFAULT false,
			threshold DECIMAL(10,8),
			algorithm VARCHAR(50),
			processed_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE INDEX IF NOT EXISTS idx_anomaly_data_user_id ON anomaly_data(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_anomaly_data_is_anomaly ON anomaly_data(is_anomaly);`,
		`CREATE INDEX IF NOT EXISTS idx_anomaly_data_created_at ON anomaly_data(created_at);`,
	}

	for _, query := range queries {
		if _, err := r.db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query %s: %v", query, err)
		}
	}

	return nil
}

// User methods implementation

func (r *postgresRepository) CreateUser(user *models.User) error {
	query := `
		INSERT INTO users (email, username, first_name, last_name, password, role)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRow(query, user.Email, user.Username, user.FirstName,
		user.LastName, user.Password, user.Role).Scan(
		&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *postgresRepository) GetUserByID(id uuid.UUID) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at
		FROM users WHERE id = $1`

	err := r.db.QueryRow(query, id).Scan(
		&user.ID, &user.Email, &user.Username, &user.FirstName,
		&user.LastName, &user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return user, nil
}

func (r *postgresRepository) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, email, username, first_name, last_name, password, role, is_active, created_at, updated_at
		FROM users WHERE email = $1`

	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.Username, &user.FirstName,
		&user.LastName, &user.Password, &user.Role, &user.IsActive, 
		&user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return user, nil
}

func (r *postgresRepository) GetUserByUsername(username string) (*models.User, error) {
	user := &models.User{}
	query := `
		SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at
		FROM users WHERE username = $1`

	err := r.db.QueryRow(query, username).Scan(
		&user.ID, &user.Email, &user.Username, &user.FirstName,
		&user.LastName, &user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return user, nil
}

func (r *postgresRepository) UpdateUser(id uuid.UUID, updates *models.UpdateUserRequest) error {
	query := `
		UPDATE users 
		SET first_name = COALESCE($2, first_name),
			last_name = COALESCE($3, last_name),
			email = COALESCE($4, email),
			username = COALESCE($5, username),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	_, err := r.db.Exec(query, id, updates.FirstName, updates.LastName, 
		updates.Email, updates.Username)
	return err
}

func (r *postgresRepository) DeleteUser(id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *postgresRepository) ListUsers(page, limit int) ([]*models.User, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM users`
	if err := r.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get users
	query := `
		SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(&user.ID, &user.Email, &user.Username, &user.FirstName,
			&user.LastName, &user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}

	return users, total, nil
}

// AnomalyData methods implementation

func (r *postgresRepository) CreateAnomalyData(data *models.AnomalyData) error {
	query := `
		INSERT INTO anomaly_data (user_id, data, score, is_anomaly, threshold, algorithm, processed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`

	return r.db.QueryRow(query, data.UserID, data.Data, data.Score,
		data.IsAnomaly, data.Threshold, data.Algorithm, data.ProcessedAt).Scan(
		&data.ID, &data.CreatedAt)
}

func (r *postgresRepository) GetAnomalyDataByID(id uuid.UUID) (*models.AnomalyData, error) {
	data := &models.AnomalyData{}
	query := `
		SELECT id, user_id, data, score, is_anomaly, threshold, algorithm, processed_at, created_at
		FROM anomaly_data WHERE id = $1`

	err := r.db.QueryRow(query, id).Scan(
		&data.ID, &data.UserID, &data.Data, &data.Score, &data.IsAnomaly,
		&data.Threshold, &data.Algorithm, &data.ProcessedAt, &data.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("anomaly data not found")
		}
		return nil, err
	}

	return data, nil
}

func (r *postgresRepository) GetAnomalyDataByUserID(userID uuid.UUID, page, limit int) ([]*models.AnomalyData, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM anomaly_data WHERE user_id = $1`
	if err := r.db.QueryRow(countQuery, userID).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get data
	query := `
		SELECT id, user_id, data, score, is_anomaly, threshold, algorithm, processed_at, created_at
		FROM anomaly_data
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var anomalyData []*models.AnomalyData
	for rows.Next() {
		data := &models.AnomalyData{}
		err := rows.Scan(&data.ID, &data.UserID, &data.Data, &data.Score,
			&data.IsAnomaly, &data.Threshold, &data.Algorithm, &data.ProcessedAt, &data.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		anomalyData = append(anomalyData, data)
	}

	return anomalyData, total, nil
}

func (r *postgresRepository) ListAnomalyData(page, limit int) ([]*models.AnomalyData, int, error) {
	offset := (page - 1) * limit

	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM anomaly_data`
	if err := r.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get data
	query := `
		SELECT ad.id, ad.user_id, ad.data, ad.score, ad.is_anomaly, ad.threshold, 
			   ad.algorithm, ad.processed_at, ad.created_at,
			   u.email, u.username, u.first_name, u.last_name
		FROM anomaly_data ad
		LEFT JOIN users u ON ad.user_id = u.id
		ORDER BY ad.created_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var anomalyData []*models.AnomalyData
	for rows.Next() {
		data := &models.AnomalyData{User: &models.User{}}
		err := rows.Scan(&data.ID, &data.UserID, &data.Data, &data.Score,
			&data.IsAnomaly, &data.Threshold, &data.Algorithm, &data.ProcessedAt,
			&data.CreatedAt, &data.User.Email, &data.User.Username,
			&data.User.FirstName, &data.User.LastName)
		if err != nil {
			return nil, 0, err
		}
		anomalyData = append(anomalyData, data)
	}

	return anomalyData, total, nil
}

func (r *postgresRepository) DeleteAnomalyData(id uuid.UUID) error {
	query := `DELETE FROM anomaly_data WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// HealthCheck checks database connectivity
func (r *postgresRepository) HealthCheck() error {
	return r.db.Ping()
}

// Close closes the database connection
func (r *postgresRepository) Close() error {
	return r.db.Close()
}