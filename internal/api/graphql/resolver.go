package graphql

import (
	"context"
	"fmt"
)

// Resolver handles GraphQL queries and mutations
type Resolver struct{}

// Query returns the root query resolver
func (r *Resolver) Query() QueryResolver {
	return &queryResolver{r}
}

// Mutation returns the root mutation resolver
func (r *Resolver) Mutation() MutationResolver {
	return &mutationResolver{r}
}

type QueryResolver interface {
	Health(ctx context.Context) (string, error)
}

type MutationResolver interface {
	CreateBroadcast(ctx context.Context, input string) (string, error)
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) Health(ctx context.Context) (string, error) {
	return "healthy", nil
}

type mutationResolver struct{ *Resolver }

func (r *mutationResolver) CreateBroadcast(ctx context.Context, input string) (string, error) {
	return fmt.Sprintf("broadcast created: %s", input), nil
}