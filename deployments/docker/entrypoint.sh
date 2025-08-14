#!/bin/sh

# Exit on error
set -e

echo "Starting Vibecast Server..."

# Run database migrations if enabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    ./vibecast-server migrate up
fi

# Start the server
exec ./vibecast-server server