#!/bin/bash

echo "🚀 Setting up Communiqué development environment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Please create a .env file with your Supabase Postgres connection string:"
    echo "SUPABASE_DATABASE_URL=\"your_supabase_postgres_connection_string\""
    echo "❌ .env file required - setup cannot continue"
    exit 1
else
    echo "✅ .env file found"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run db:generate

# Push schema to database
echo "🗄️ Pushing database schema to Supabase (Postgres)..."
npm run db:push

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Run 'npm run db:studio' to open Prisma Studio"
echo "3. Once you create API routes with Prisma, run 'npm run db:seed' to add sample data" 