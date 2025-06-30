#!/bin/bash

# Setup script for data extraction and validation
echo "========================================"
echo "Golf Parlay Picker Data Migration Setup"
echo "========================================"

# Check Node.js version
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required. Current version: $(node --version)"
    exit 1
fi
echo "✅ Node.js version: $(node --version)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from data-extraction directory"
    echo "Run: cd migrations/schema-v2/data-extraction && ./setup.sh"
    exit 1
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed successfully"

# Set up environment variables
echo ""
echo "Setting up environment variables..."

# Check if main .env.local exists
main_env="../../../.env.local"
if [ -f "$main_env" ]; then
    cp "$main_env" "./.env.local"
    echo "✅ Environment variables copied from main project"
else
    echo "⚠️  Main .env.local not found. Creating template..."
    cat > ./.env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# OR use anon key (less preferred)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Migration Settings (optional)
MIGRATION_DRY_RUN=false
MIGRATION_BATCH_SIZE=1000
EOF
    echo "❌ Please edit .env.local with your Supabase credentials"
    echo "   Copy values from your main project's .env.local file"
fi

# Create output directories
echo ""
echo "Creating output directories..."
mkdir -p migration-output
mkdir -p migration-backup
echo "✅ Output directories created"

# Make scripts executable
echo ""
echo "Setting script permissions..."
chmod +x *.js
echo "✅ Script permissions set"

# Test database connection
echo ""
echo "Testing database connection..."
node --input-type=module -e "
import { supabase } from './config.js';
const test = async () => {
  try {
    const { data, error } = await supabase.from('tournaments').select('count(*)').single();
    if (error) throw error;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('   Please check your environment variables in .env.local');
    process.exit(1);
  }
};
test();
" || {
    echo "⚠️  Database connection test failed but continuing..."
    echo "   The analysis scripts will test the connection themselves"
}

echo ""
echo "========================================"
echo "✅ Setup completed successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Run full analysis: npm run analyze"
echo "2. Or run individual scripts:"
echo "   - npm run extract    (extract data)"
echo "   - npm run validate   (validate data)"
echo "   - node analyze-score-formats.js  (analyze scores)"
echo ""
echo "Output will be saved to:"
echo "  - migration-output/   (main results)"
echo "  - migration-backup/   (timestamped backups)"
echo ""
echo "Happy migrating! 🚀"