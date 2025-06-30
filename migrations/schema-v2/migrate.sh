#!/bin/bash

# Database Migration Runner for Golf Parlay Picker Schema v2
# Usage: ./migrate.sh [apply|rollback|status] [environment]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_FILE="$SCRIPT_DIR/V001__create_new_schema_complete.sql"
ROLLBACK_FILE="$SCRIPT_DIR/V001__create_new_schema_complete_rollback.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_usage() {
    echo "Usage: $0 [apply|rollback|status] [environment]"
    echo ""
    echo "Commands:"
    echo "  apply     - Apply the V001 migration (create new schema)"
    echo "  rollback  - Rollback the V001 migration (remove new schema)"
    echo "  status    - Check migration status"
    echo ""
    echo "Environment (optional):"
    echo "  local     - Use local Supabase (default)"
    echo "  staging   - Use staging database"
    echo "  prod      - Use production database"
    echo ""
    echo "Examples:"
    echo "  $0 apply local"
    echo "  $0 status"
    echo "  $0 rollback staging"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Golf Parlay Picker - Schema Migration${NC}"
    echo -e "${BLUE}========================================${NC}"
}

check_dependencies() {
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}Error: psql is not installed or not in PATH${NC}"
        echo "Please install PostgreSQL client tools"
        exit 1
    fi
    
    # Check if migration files exist
    if [[ ! -f "$MIGRATION_FILE" ]]; then
        echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
        exit 1
    fi
    
    if [[ ! -f "$ROLLBACK_FILE" ]]; then
        echo -e "${RED}Error: Rollback file not found: $ROLLBACK_FILE${NC}"
        exit 1
    fi
}

get_db_connection() {
    local env=${1:-local}
    
    case $env in
        local)
            # Use Supabase local connection
            echo "postgresql://postgres:postgres@localhost:54322/postgres"
            ;;
        staging)
            echo -e "${YELLOW}Staging database connection would go here${NC}"
            echo "postgresql://user:pass@staging-host:5432/dbname"
            ;;
        prod)
            echo -e "${RED}Production database connection would go here${NC}"
            echo "postgresql://user:pass@prod-host:5432/dbname"
            ;;
        *)
            echo -e "${RED}Unknown environment: $env${NC}"
            exit 1
            ;;
    esac
}

check_migration_status() {
    local db_url=$1
    
    echo -e "${BLUE}Checking migration status...${NC}"
    
    # Check if schema_migrations table exists
    local table_exists
    table_exists=$(psql "$db_url" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations');" 2>/dev/null || echo "f")
    
    if [[ "$table_exists" == " t" ]]; then
        echo -e "${GREEN}Migration tracking table exists${NC}"
        
        # Check if V001 is applied
        local v001_applied
        v001_applied=$(psql "$db_url" -t -c "SELECT EXISTS (SELECT FROM schema_migrations WHERE version = 'V001');" 2>/dev/null || echo "f")
        
        if [[ "$v001_applied" == " t" ]]; then
            local applied_at
            applied_at=$(psql "$db_url" -t -c "SELECT applied_at FROM schema_migrations WHERE version = 'V001';" 2>/dev/null)
            echo -e "${GREEN}✓ Migration V001 is applied (applied at:${applied_at})${NC}"
        else
            echo -e "${YELLOW}✗ Migration V001 is not applied${NC}"
        fi
    else
        echo -e "${YELLOW}Migration tracking table does not exist${NC}"
    fi
    
    # Check if v2 tables exist
    local v2_tables
    v2_tables=$(psql "$db_url" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE '%_v2';" 2>/dev/null || echo "0")
    
    echo -e "${BLUE}V2 tables found: ${v2_tables}${NC}"
    
    if [[ "$v2_tables" -gt 0 ]]; then
        echo -e "${GREEN}New schema tables are present${NC}"
        psql "$db_url" -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%_v2' ORDER BY table_name;" 2>/dev/null
    else
        echo -e "${YELLOW}No v2 schema tables found${NC}"
    fi
}

apply_migration() {
    local db_url=$1
    
    echo -e "${BLUE}Applying migration V001...${NC}"
    echo -e "${YELLOW}This will create the new schema with v2 tables${NC}"
    
    # Confirmation
    read -p "Are you sure you want to apply the migration? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Migration cancelled${NC}"
        exit 0
    fi
    
    # Apply migration
    echo -e "${BLUE}Executing migration...${NC}"
    if psql "$db_url" -f "$MIGRATION_FILE"; then
        echo -e "${GREEN}✓ Migration V001 applied successfully!${NC}"
    else
        echo -e "${RED}✗ Migration failed!${NC}"
        exit 1
    fi
}

rollback_migration() {
    local db_url=$1
    
    echo -e "${RED}Rolling back migration V001...${NC}"
    echo -e "${RED}WARNING: This will permanently delete all v2 schema data!${NC}"
    
    # Double confirmation for rollback
    read -p "Are you ABSOLUTELY sure you want to rollback? This cannot be undone! (yes/no): " -r
    if [[ ! $REPLY == "yes" ]]; then
        echo -e "${YELLOW}Rollback cancelled${NC}"
        exit 0
    fi
    
    # Execute rollback
    echo -e "${RED}Executing rollback...${NC}"
    if psql "$db_url" -f "$ROLLBACK_FILE"; then
        echo -e "${GREEN}✓ Migration V001 rolled back successfully!${NC}"
    else
        echo -e "${RED}✗ Rollback failed!${NC}"
        exit 1
    fi
}

# Main script
main() {
    local command=${1:-status}
    local environment=${2:-local}
    
    print_header
    check_dependencies
    
    local db_url
    db_url=$(get_db_connection "$environment")
    
    echo -e "${BLUE}Environment: $environment${NC}"
    echo -e "${BLUE}Database: $db_url${NC}"
    echo ""
    
    case $command in
        apply)
            apply_migration "$db_url"
            echo ""
            check_migration_status "$db_url"
            ;;
        rollback)
            rollback_migration "$db_url"
            echo ""
            check_migration_status "$db_url"
            ;;
        status)
            check_migration_status "$db_url"
            ;;
        *)
            print_usage
            exit 1
            ;;
    esac
}

# Run the script
main "$@"