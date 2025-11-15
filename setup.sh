#!/bin/bash

echo "🧠 Vibecast Research System - Setup Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created from .env.example"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your OPENROUTER_API_KEY"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/agentdb data/results
echo "✅ Data directories created"
echo ""

echo "=========================================="
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OPENROUTER_API_KEY"
echo "   Get your key at: https://openrouter.ai/keys"
echo ""
echo "2. Try the interactive mode:"
echo "   npm run dev"
echo ""
echo "3. Or run a research task:"
echo "   npm start -- research \"Your Topic Here\""
echo ""
echo "4. View system statistics:"
echo "   npm run stats"
echo ""
echo "For more information, see RESEARCH_SYSTEM.md"
echo "=========================================="
