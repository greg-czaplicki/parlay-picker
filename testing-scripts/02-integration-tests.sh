#!/bin/bash
# =============================================
# INTEGRATION TESTING SUITE
# =============================================
# End-to-end testing of complete migration process
# Tests full workflow from start to finish
# Generated: July 23, 2025

set -e
set -u

# =============================================
# CONFIGURATION
# =============================================

DB_NAME="${DB_NAME:-golf_parlay_db_test}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$TEST_DIR")"
MIGRATION_SCRIPTS_DIR="$PROJECT_ROOT/migration-scripts"

LOG_FILE="$TEST_DIR/integration_test_$(date +%Y%m%d_%H%M%S).log"

# =============================================
# HELPER FUNCTIONS
# =============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

run_sql_file() {
    local sql_file="$1"
    local description="$2"
    
    log "Executing: $description"
    log "File: $sql_file"
    
    if [[ ! -f "$sql_file" ]]; then
        error_exit "SQL file not found: $sql_file"
    fi
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
         -f "$sql_file" >> "$LOG_FILE" 2>&1 || {
        error_exit "SQL execution failed: $sql_file"
    }
    
    log "✅ Completed: $description"
}

run_sql_query() {
    local query="$1"
    local description="${2:-SQL Query}"
    
    log "Executing: $description"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
         -c "$query" >> "$LOG_FILE" 2>&1 || {
        error_exit "SQL query failed: $description"
    }
}

measure_execution_time() {
    local start_time=$(date +%s)
    "$@"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log "⏱️ Execution time: ${duration} seconds"
    echo "$duration"
}

validate_database_state() {
    local phase="$1"
    
    log "Validating database state: $phase"
    
    # Check database connectivity
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
         -c "SELECT 'Database accessible' as status;" >> "$LOG_FILE" 2>&1 || {
        error_exit "Database not accessible during $phase"
    }
    
    # Check table count
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                       -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    log "📊 Table count: $table_count"
    
    case "$phase" in
        "initial")
            [[ $table_count -ge 10 ]] || error_exit "Too few initial tables: $table_count"
            ;;
        "post-schema")
            [[ $table_count -ge 30 ]] || error_exit "Schema creation incomplete: $table_count tables"
            ;;
        "post-migration")
            [[ $table_count -ge 30 ]] || error_exit "Migration incomplete: $table_count tables"
            ;;
        "post-rollback")
            [[ $table_count -ge 10 ]] && [[ $table_count -le 20 ]] || error_exit "Rollback incomplete: $table_count tables"
            ;;
    esac
    
    log "✅ Database state validation passed: $phase"
}

# =============================================
# TEST SETUP
# =============================================

setup_test_environment() {
    log "Setting up integration test environment..."
    
    # Create test database
    log "Creating test database: $DB_NAME"
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" || {
        error_exit "Failed to create test database"
    }
    
    # Install required extensions
    log "Installing required extensions..."
    run_sql_query "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" "UUID extension"
    run_sql_query "CREATE EXTENSION IF NOT EXISTS \"timescaledb\" CASCADE;" "TimescaleDB extension"
    run_sql_query "CREATE EXTENSION IF NOT EXISTS \"vector\" CASCADE;" "Vector extension"
    run_sql_query "CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";" "pg_stat_statements extension"
    
    # Create sample legacy data structure
    log "Creating sample legacy data..."
    cat > "/tmp/create_legacy_data.sql" << 'EOF'
-- Create legacy tables structure
CREATE TABLE players_v2 (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tournaments_v2 (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER,
    start_date DATE,
    end_date DATE,
    purse DECIMAL(15,2),
    location TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE courses_v2 (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    par INTEGER,
    yardage INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tournament_results_v2 (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments_v2(id),
    player_id INTEGER REFERENCES players_v2(id),
    position INTEGER,
    score INTEGER,
    prize_money DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tournament_round_snapshots (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments_v2(id),
    player_id INTEGER REFERENCES players_v2(id),
    round_number INTEGER,
    score INTEGER,
    position INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE matchups_v2 (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments_v2(id),
    player1_id INTEGER REFERENCES players_v2(id),
    player2_id INTEGER REFERENCES players_v2(id),
    player1_odds DECIMAL(8,2),
    player2_odds DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE live_tournament_stats (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments_v2(id),
    player_id INTEGER REFERENCES players_v2(id),
    stat_name TEXT,
    stat_value DECIMAL(10,4),
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO players_v2 (name, country) VALUES
('Tiger Woods', 'USA'),
('Rory McIlroy', 'Northern Ireland'),
('Jon Rahm', 'Spain'),
('Scottie Scheffler', 'USA'),
('Justin Thomas', 'USA');

INSERT INTO tournaments_v2 (name, year, start_date, end_date, purse, location) VALUES
('Masters Tournament', 2024, '2024-04-11', '2024-04-14', 18000000, 'Augusta, GA'),
('PGA Championship', 2024, '2024-05-16', '2024-05-19', 18500000, 'Louisville, KY'),
('U.S. Open', 2024, '2024-06-13', '2024-06-16', 21500000, 'Pinehurst, NC');

INSERT INTO courses_v2 (name, location, par, yardage) VALUES
('Augusta National Golf Club', 'Augusta, GA', 72, 7435),
('Valhalla Golf Club', 'Louisville, KY', 72, 7542),
('Pinehurst No. 2', 'Pinehurst, NC', 70, 7690);

-- Insert performance data
INSERT INTO tournament_results_v2 (tournament_id, player_id, position, score, prize_money)
SELECT 
    t.id,
    p.id,
    floor(random() * 50) + 1,
    floor(random() * 20) - 10,
    case when floor(random() * 50) + 1 <= 10 then floor(random() * 1000000) else 0 end
FROM tournaments_v2 t
CROSS JOIN players_v2 p;

-- Insert round snapshots
INSERT INTO tournament_round_snapshots (tournament_id, player_id, round_number, score, position)
SELECT 
    tr.tournament_id,
    tr.player_id,
    round_num,
    floor(random() * 10) + 68,
    floor(random() * 50) + 1
FROM tournament_results_v2 tr
CROSS JOIN generate_series(1, 4) as round_num;

-- Insert matchup data
INSERT INTO matchups_v2 (tournament_id, player1_id, player2_id, player1_odds, player2_odds)
SELECT 
    t.id,
    p1.id,
    p2.id,
    random() * 2 + 1,
    random() * 2 + 1
FROM tournaments_v2 t
CROSS JOIN players_v2 p1
CROSS JOIN players_v2 p2
WHERE p1.id < p2.id
LIMIT 50;

-- Insert live stats
INSERT INTO live_tournament_stats (tournament_id, player_id, stat_name, stat_value)
SELECT 
    t.id,
    p.id,
    stat_name,
    random() * 100
FROM tournaments_v2 t
CROSS JOIN players_v2 p
CROSS JOIN (VALUES ('driving_distance'), ('fairways_hit'), ('greens_in_regulation'), ('putts_per_round')) as stats(stat_name);

-- Create migration log table for tracking
CREATE TABLE migration_log (
    id SERIAL PRIMARY KEY,
    migration_step TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    details JSONB DEFAULT '{}'::jsonb
);
EOF
    
    run_sql_file "/tmp/create_legacy_data.sql" "Sample legacy data creation"
    rm -f "/tmp/create_legacy_data.sql"
    
    validate_database_state "initial"
    
    log "✅ Test environment setup complete"
}

# =============================================
# MAIN INTEGRATION TESTS
# =============================================

test_complete_migration_workflow() {
    log "========================================"
    log "TESTING: Complete Migration Workflow"
    log "========================================"
    
    local total_start_time=$(date +%s)
    
    # Test Phase 1: Schema Creation
    log "Phase 1: Testing schema creation..."
    local schema_time=$(measure_execution_time run_sql_file \
        "$MIGRATION_SCRIPTS_DIR/01-create-new-schema.sql" \
        "Schema Creation")
    
    validate_database_state "post-schema"
    
    # Verify schema creation success
    local new_table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                           -t -c "SELECT COUNT(*) FROM information_schema.tables 
                                  WHERE table_schema = 'public' 
                                  AND table_name NOT LIKE '%_v2' 
                                  AND table_name NOT LIKE '%_backup';" 2>/dev/null | tr -d ' ')
    
    log "📊 New tables created: $new_table_count"
    [[ $new_table_count -ge 20 ]] || error_exit "Insufficient new tables created: $new_table_count"
    
    # Test Phase 2: Data Migration
    log "Phase 2: Testing data migration..."
    local migration_time=$(measure_execution_time run_sql_file \
        "$MIGRATION_SCRIPTS_DIR/02-data-migration-etl.sql" \
        "Data Migration ETL")
    
    validate_database_state "post-migration"
    
    # Verify data migration success
    local migrated_players=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                            -t -c "SELECT COUNT(*) FROM players;" 2>/dev/null | tr -d ' ')
    local original_players=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                            -t -c "SELECT COUNT(*) FROM players_v2;" 2>/dev/null | tr -d ' ')
    
    log "📊 Players migrated: $migrated_players (from $original_players)"
    
    local preservation_rate=$(echo "scale=2; $migrated_players * 100 / $original_players" | bc)
    log "📊 Data preservation rate: ${preservation_rate}%"
    
    [[ $(echo "$preservation_rate >= 80" | bc) -eq 1 ]] || error_exit "Data preservation rate too low: ${preservation_rate}%"
    
    # Test Phase 3: Validation
    log "Phase 3: Testing validation..."
    local validation_time=$(measure_execution_time run_sql_file \
        "$MIGRATION_SCRIPTS_DIR/03-validation-and-verification.sql" \
        "Validation and Verification")
    
    # Check validation results
    local validation_score=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                            -t -c "SELECT COALESCE(AVG(
                                CASE WHEN validation_result = 'PASS' THEN 100.0 ELSE 0.0 END
                            ), 0) FROM migration_validation_results;" 2>/dev/null | tr -d ' ')
    
    log "📊 Validation score: ${validation_score}%"
    [[ $(echo "$validation_score >= 85" | bc) -eq 1 ]] || error_exit "Validation score too low: ${validation_score}%"
    
    # Test Phase 4: Performance Optimization
    log "Phase 4: Testing performance optimization..."
    local optimization_time=$(measure_execution_time run_sql_file \
        "$MIGRATION_SCRIPTS_DIR/05-performance-optimization.sql" \
        "Performance Optimization")
    
    # Verify optimization success
    local index_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                       -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ')
    
    log "📊 Indexes created: $index_count"
    [[ $index_count -ge 25 ]] || error_exit "Insufficient indexes created: $index_count"
    
    local total_end_time=$(date +%s)
    local total_duration=$((total_end_time - total_start_time))
    
    log "⏱️ Total migration time: ${total_duration} seconds"
    log "⏱️ Schema creation: ${schema_time}s"
    log "⏱️ Data migration: ${migration_time}s"  
    log "⏱️ Validation: ${validation_time}s"
    log "⏱️ Optimization: ${optimization_time}s"
    
    # Verify total time is within acceptable range (should be < 2 hours = 7200 seconds)
    [[ $total_duration -lt 7200 ]] || error_exit "Migration took too long: ${total_duration} seconds"
    
    log "✅ Complete migration workflow test PASSED"
}

test_rollback_functionality() {
    log "========================================"
    log "TESTING: Rollback Functionality"
    log "========================================"
    
    # Create pre-rollback snapshot
    log "Creating pre-rollback snapshot..."
    run_sql_query "
        CREATE TABLE pre_rollback_snapshot AS
        SELECT 
            schemaname,
            tablename,
            n_live_tup as record_count
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public' AND tablename LIKE '%_v2';
    " "Pre-rollback snapshot"
    
    # Execute rollback
    log "Executing rollback procedure..."
    local rollback_time=$(measure_execution_time run_sql_file \
        "$MIGRATION_SCRIPTS_DIR/04-rollback-procedures.sql" \
        "Rollback Procedures")
    
    validate_database_state "post-rollback"
    
    # Verify rollback success
    local rollback_verification=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                                 -t -c "
        SELECT COUNT(*) 
        FROM pg_stat_user_tables p
        JOIN pre_rollback_snapshot pre ON pre.tablename = p.tablename
        WHERE p.schemaname = 'public'
        AND p.n_live_tup = pre.record_count;" 2>/dev/null | tr -d ' ')
    
    local original_table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                                -t -c "SELECT COUNT(*) FROM pre_rollback_snapshot;" 2>/dev/null | tr -d ' ')
    
    log "📊 Tables restored correctly: $rollback_verification (of $original_table_count)"
    log "⏱️ Rollback time: ${rollback_time} seconds"
    
    [[ $rollback_verification -eq $original_table_count ]] || error_exit "Rollback verification failed"
    [[ $rollback_time -lt 1800 ]] || error_exit "Rollback took too long: ${rollback_time} seconds"
    
    log "✅ Rollback functionality test PASSED"
}

test_performance_benchmarks() {
    log "========================================"
    log "TESTING: Performance Benchmarks"
    log "========================================"
    
    # Re-run migration for performance testing (rollback was done in previous test)
    log "Re-running migration for performance testing..."
    run_sql_file "$MIGRATION_SCRIPTS_DIR/01-create-new-schema.sql" "Schema Creation (Performance Test)"
    run_sql_file "$MIGRATION_SCRIPTS_DIR/02-data-migration-etl.sql" "Data Migration (Performance Test)"
    run_sql_file "$MIGRATION_SCRIPTS_DIR/05-performance-optimization.sql" "Performance Optimization"
    
    # Test query performance
    log "Testing query performance..."
    
    # Test 1: Player lookup query
    local start_time=$(date +%s%3N)
    run_sql_query "
        SELECT p.*, COUNT(ptp.id) as tournament_count
        FROM players p
        LEFT JOIN player_tournament_performance ptp ON p.id = ptp.player_id
        WHERE p.name ILIKE '%tiger%'
        GROUP BY p.id
        LIMIT 10;
    " "Player lookup performance test"
    local end_time=$(date +%s%3N)
    local player_query_time=$((end_time - start_time))
    
    log "📊 Player lookup query time: ${player_query_time}ms"
    [[ $player_query_time -lt 100 ]] || log "⚠️ Player lookup query slower than expected: ${player_query_time}ms"
    
    # Test 2: Tournament leaderboard query
    start_time=$(date +%s%3N)
    run_sql_query "
        SELECT 
            p.name,
            ptp.total_score,
            ptp.position,
            ptp.prize_money
        FROM player_tournament_performance ptp
        JOIN players p ON ptp.player_id = p.id
        JOIN tournaments t ON ptp.tournament_id = t.id
        WHERE t.year = 2024
        ORDER BY ptp.position
        LIMIT 50;
    " "Tournament leaderboard performance test"
    end_time=$(date +%s%3N)
    local leaderboard_query_time=$((end_time - start_time))
    
    log "📊 Leaderboard query time: ${leaderboard_query_time}ms"
    [[ $leaderboard_query_time -lt 200 ]] || log "⚠️ Leaderboard query slower than expected: ${leaderboard_query_time}ms"
    
    # Test 3: Betting markets query
    start_time=$(date +%s%3N)
    run_sql_query "
        SELECT 
            bm.market_type,
            p.name as player_name,
            COUNT(oh.id) as odds_updates
        FROM betting_markets bm
        JOIN players p ON bm.player_id = p.id
        LEFT JOIN odds_history oh ON bm.id = oh.market_id
        WHERE bm.tournament_id IS NOT NULL
        GROUP BY bm.id, bm.market_type, p.name
        ORDER BY odds_updates DESC
        LIMIT 100;
    " "Betting markets performance test"
    end_time=$(date +%s%3N)
    local betting_query_time=$((end_time - start_time))
    
    log "📊 Betting markets query time: ${betting_query_time}ms"
    [[ $betting_query_time -lt 150 ]] || log "⚠️ Betting query slower than expected: ${betting_query_time}ms"
    
    log "✅ Performance benchmarks test COMPLETED"
}

test_data_integrity() {
    log "========================================"
    log "TESTING: Data Integrity Validation"
    log "========================================"
    
    # Test foreign key constraints
    log "Testing foreign key constraints..."
    local fk_violations=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                         -t -c "
        -- Check for orphaned performance records
        SELECT COUNT(*) FROM player_tournament_performance ptp
        WHERE NOT EXISTS(SELECT 1 FROM players p WHERE p.id = ptp.player_id)
        OR NOT EXISTS(SELECT 1 FROM tournaments t WHERE t.id = ptp.tournament_id);
    " 2>/dev/null | tr -d ' ')
    
    log "📊 Foreign key violations: $fk_violations"
    [[ $fk_violations -eq 0 ]] || error_exit "Foreign key constraint violations found: $fk_violations"
    
    # Test data consistency
    log "Testing data consistency..."
    local consistency_issues=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                              -t -c "
        -- Check for invalid dates
        SELECT COUNT(*) FROM tournaments 
        WHERE end_date < start_date;
    " 2>/dev/null | tr -d ' ')
    
    log "📊 Data consistency issues: $consistency_issues"
    [[ $consistency_issues -eq 0 ]] || error_exit "Data consistency issues found: $consistency_issues"
    
    # Test data completeness
    log "Testing data completeness..."
    local incomplete_records=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                              -t -c "
        -- Check for players without names
        SELECT COUNT(*) FROM players WHERE name IS NULL OR name = '';
    " 2>/dev/null | tr -d ' ')
    
    log "📊 Incomplete player records: $incomplete_records"
    [[ $incomplete_records -eq 0 ]] || log "⚠️ Some player records incomplete: $incomplete_records"
    
    log "✅ Data integrity validation test PASSED"
}

# =============================================
# TEST CLEANUP
# =============================================

cleanup_test_environment() {
    log "Cleaning up test environment..."
    
    # Drop test database
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
    
    log "Test environment cleanup complete"
}

# =============================================
# MAIN EXECUTION
# =============================================

main() {
    log "========================================"
    log "STARTING INTEGRATION TEST SUITE"
    log "========================================"
    log "Database: $DB_NAME"
    log "Host: $DB_HOST:$DB_PORT"
    log "User: $DB_USER"
    log "Log file: $LOG_FILE"
    log ""
    
    local test_start_time=$(date +%s)
    local tests_passed=0
    local tests_failed=0
    
    # Setup
    setup_test_environment
    
    # Run all integration tests
    if test_complete_migration_workflow; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    if test_rollback_functionality; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    if test_performance_benchmarks; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    if test_data_integrity; then
        ((tests_passed++))
    else
        ((tests_failed++))
    fi
    
    # Cleanup
    cleanup_test_environment
    
    local test_end_time=$(date +%s)
    local total_test_time=$((test_end_time - test_start_time))
    
    log "========================================"
    log "INTEGRATION TEST SUITE COMPLETE"
    log "========================================"
    log "⏱️ Total test time: ${total_test_time} seconds"
    log "✅ Tests passed: $tests_passed"
    log "❌ Tests failed: $tests_failed"
    log "📊 Success rate: $(echo "scale=1; $tests_passed * 100 / ($tests_passed + $tests_failed)" | bc)%"
    log ""
    log "Log file: $LOG_FILE"
    
    if [[ $tests_failed -eq 0 ]]; then
        log "🎉 ALL INTEGRATION TESTS PASSED!"
        log "Migration is ready for production deployment."
        exit 0
    else
        log "❌ SOME INTEGRATION TESTS FAILED!"
        log "Review failures before proceeding to production."
        exit 1
    fi
}

# =============================================
# SCRIPT ENTRY POINT
# =============================================

case "${1:-}" in
    --help|-h)
        cat << EOF
Integration Testing Suite for Database Migration

Usage: $0 [options]

Options:
  --help, -h    Show this help message
  --setup-only  Only setup test environment, don't run tests
  --cleanup     Only cleanup test environment
  
Environment Variables:
  DB_NAME       Test database name (default: golf_parlay_db_test)
  DB_USER       Database user (default: postgres)
  DB_HOST       Database host (default: localhost)
  DB_PORT       Database port (default: 5432)

Examples:
  $0                    # Run complete integration test suite
  $0 --setup-only       # Just setup test environment
  $0 --cleanup          # Just cleanup test environment
  
EOF
        exit 0
        ;;
    --setup-only)
        setup_test_environment
        log "Test environment setup complete. Database: $DB_NAME"
        exit 0
        ;;
    --cleanup)
        cleanup_test_environment
        log "Test environment cleanup complete."
        exit 0
        ;;
    "")
        # No arguments - run full test suite
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac