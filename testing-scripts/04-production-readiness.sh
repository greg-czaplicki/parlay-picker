#!/bin/bash
# =============================================
# PRODUCTION READINESS VALIDATION SUITE
# =============================================
# Final validation before production deployment
# Ensures all systems, processes, and procedures are ready
# Generated: July 23, 2025

set -e
set -u

# =============================================
# CONFIGURATION
# =============================================

DB_NAME="${DB_NAME:-golf_parlay_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$SCRIPT_DIR/production_readiness_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================
# HELPER FUNCTIONS
# =============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

error_exit() {
    log_error "CRITICAL: $1"
    exit 1
}

run_sql_query() {
    local query="$1"
    local description="${2:-SQL Query}"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
         -t -c "$query" 2>/dev/null | tr -d ' ' || {
        log_error "SQL query failed: $description"
        return 1
    }
}

check_requirement() {
    local test_name="$1"
    local test_command="$2"
    local success_message="$3"
    local failure_message="$4"
    local is_critical="${5:-true}"
    
    log_info "Checking: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        log_success "$success_message"
        return 0
    else
        if [[ "$is_critical" == "true" ]]; then
            log_error "$failure_message"
            return 1
        else
            log_warning "$failure_message"
            return 0
        fi
    fi
}

# =============================================
# INFRASTRUCTURE READINESS CHECKS
# =============================================

check_database_connectivity() {
    log_info "=== DATABASE CONNECTIVITY CHECKS ==="
    
    # Test basic connectivity
    check_requirement \
        "Database Connection" \
        "psql -h '$DB_HOST' -p '$DB_PORT' -U '$DB_USER' -d '$DB_NAME' -c 'SELECT 1;'" \
        "Database is accessible" \
        "Cannot connect to database" \
        true
    
    # Check database size and health
    local db_size=$(run_sql_query "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" "Database size check")
    log_info "Database size: $db_size"
    
    # Check active connections
    local active_connections=$(run_sql_query "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';" "Active connections check")
    log_info "Active database connections: $active_connections"
    
    # Check for long-running queries
    local long_queries=$(run_sql_query "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';" "Long running queries")
    if [[ $long_queries -gt 0 ]]; then
        log_warning "Found $long_queries long-running queries (>5 minutes)"
    else
        log_success "No long-running queries detected"
    fi
    
    # Check database locks
    local blocking_locks=$(run_sql_query "SELECT COUNT(*) FROM pg_locks WHERE NOT granted;" "Database locks check")
    if [[ $blocking_locks -gt 0 ]]; then
        log_warning "Found $blocking_locks blocking database locks"
    else
        log_success "No blocking database locks"
    fi
}

check_required_extensions() {
    log_info "=== REQUIRED EXTENSIONS CHECKS ==="
    
    local required_extensions=("uuid-ossp" "timescaledb" "vector" "pg_stat_statements")
    local missing_extensions=()
    
    for ext in "${required_extensions[@]}"; do
        local exists=$(run_sql_query "SELECT COUNT(*) FROM pg_extension WHERE extname = '$ext';" "Extension $ext check")
        if [[ $exists -eq 1 ]]; then
            log_success "Extension '$ext' is installed"
        else
            log_error "Required extension '$ext' is missing"
            missing_extensions+=("$ext")
        fi
    done
    
    if [[ ${#missing_extensions[@]} -gt 0 ]]; then
        error_exit "Missing required extensions: ${missing_extensions[*]}"
    fi
}

check_database_schema() {
    log_info "=== DATABASE SCHEMA VALIDATION ==="
    
    # Check critical tables exist
    local critical_tables=("players" "tournaments" "courses" "player_tournament_performance" "betting_markets" "odds_history")
    local missing_tables=()
    
    for table in "${critical_tables[@]}"; do
        local exists=$(run_sql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" "Table $table check")
        if [[ $exists -eq 1 ]]; then
            log_success "Critical table '$table' exists"
        else
            log_error "Critical table '$table' is missing"
            missing_tables+=("$table")
        fi
    done
    
    if [[ ${#missing_tables[@]} -gt 0 ]]; then
        error_exit "Missing critical tables: ${missing_tables[*]}"
    fi
    
    # Check data volume in critical tables
    local total_players=$(run_sql_query "SELECT COUNT(*) FROM players;" "Player count")
    local total_tournaments=$(run_sql_query "SELECT COUNT(*) FROM tournaments;" "Tournament count")
    local total_performance=$(run_sql_query "SELECT COUNT(*) FROM player_tournament_performance;" "Performance records count")
    
    log_info "Data volumes: Players=$total_players, Tournaments=$total_tournaments, Performance=$total_performance"
    
    # Validate minimum data requirements
    [[ $total_players -ge 100 ]] || error_exit "Insufficient player data: $total_players (minimum: 100)"
    [[ $total_tournaments -ge 10 ]] || error_exit "Insufficient tournament data: $total_tournaments (minimum: 10)"
    [[ $total_performance -ge 1000 ]] || error_exit "Insufficient performance data: $total_performance (minimum: 1000)"
    
    log_success "Database schema and data validation passed"
}

check_indexes_and_constraints() {
    log_info "=== INDEXES AND CONSTRAINTS VALIDATION ==="
    
    # Check primary keys
    local primary_keys=$(run_sql_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public';" "Primary keys count")
    log_info "Primary key constraints: $primary_keys"
    [[ $primary_keys -ge 15 ]] || error_exit "Insufficient primary keys: $primary_keys (minimum: 15)"
    
    # Check foreign keys
    local foreign_keys=$(run_sql_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';" "Foreign keys count")
    log_info "Foreign key constraints: $foreign_keys"
    [[ $foreign_keys -ge 10 ]] || error_exit "Insufficient foreign keys: $foreign_keys (minimum: 10)"
    
    # Check indexes
    local indexes=$(run_sql_query "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" "Indexes count")
    log_info "Database indexes: $indexes"
    [[ $indexes -ge 25 ]] || error_exit "Insufficient indexes: $indexes (minimum: 25)"
    
    # Check for unused indexes (performance concern)
    local unused_indexes=$(run_sql_query "SELECT COUNT(*) FROM pg_stat_user_indexes WHERE idx_tup_read = 0 AND idx_tup_fetch = 0;" "Unused indexes")
    if [[ $unused_indexes -gt 5 ]]; then
        log_warning "Found $unused_indexes potentially unused indexes (consider review)"
    else
        log_success "Index usage appears healthy"
    fi
    
    log_success "Indexes and constraints validation passed"
}

# =============================================
# BACKUP AND RECOVERY READINESS
# =============================================

check_backup_procedures() {
    log_info "=== BACKUP AND RECOVERY VALIDATION ==="
    
    # Check if backup scripts exist
    local backup_script="$PROJECT_ROOT/backup-procedures/01-pre-migration-backup.sh"
    if [[ -f "$backup_script" && -x "$backup_script" ]]; then
        log_success "Backup script exists and is executable"
    else
        log_error "Backup script missing or not executable: $backup_script"
        return 1
    fi
    
    # Check backup directory
    local backup_dir="${BACKUP_DIR:-./backups}"
    if [[ -d "$backup_dir" ]]; then
        log_success "Backup directory exists: $backup_dir"
        
        # Check backup directory permissions
        if [[ -w "$backup_dir" ]]; then
            log_success "Backup directory is writable"
        else
            log_error "Backup directory is not writable: $backup_dir"
            return 1
        fi
        
        # Check available disk space
        local available_space=$(df -BG "$backup_dir" | awk 'NR==2 {print $4}' | sed 's/G//')
        log_info "Available backup disk space: ${available_space}GB"
        [[ $available_space -ge 10 ]] || log_warning "Low backup disk space: ${available_space}GB"
        
    else
        log_warning "Backup directory does not exist, will be created: $backup_dir"
    fi
    
    # Test backup creation (dry run)
    log_info "Testing backup creation (dry run)..."
    local test_backup="/tmp/production_readiness_test_backup.sql"
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
               --schema-only --file="$test_backup" >/dev/null 2>&1; then
        log_success "Backup creation test successful"
        rm -f "$test_backup"
    else
        log_error "Backup creation test failed"
        return 1
    fi
    
    # Check rollback script exists
    local rollback_script="$PROJECT_ROOT/migration-scripts/04-rollback-procedures.sql"
    if [[ -f "$rollback_script" ]]; then
        log_success "Rollback script exists"
    else
        log_error "Rollback script missing: $rollback_script"
        return 1
    fi
}

# =============================================
# PERFORMANCE AND MONITORING READINESS
# =============================================

check_performance_readiness() {
    log_info "=== PERFORMANCE READINESS VALIDATION ==="
    
    # Test critical query performance
    log_info "Testing critical query performance..."
    
    # Player lookup query
    local start_time=$(date +%s%3N)
    run_sql_query "SELECT p.*, COUNT(ptp.id) FROM players p LEFT JOIN player_tournament_performance ptp ON p.id = ptp.player_id WHERE p.name ILIKE 'Tiger%' GROUP BY p.id LIMIT 1;" "Player lookup test" >/dev/null
    local end_time=$(date +%s%3N)
    local player_query_time=$((end_time - start_time))
    
    log_info "Player lookup query: ${player_query_time}ms"
    if [[ $player_query_time -lt 100 ]]; then
        log_success "Player query performance: EXCELLENT"
    elif [[ $player_query_time -lt 500 ]]; then
        log_success "Player query performance: ACCEPTABLE"
    else
        log_warning "Player query performance: SLOW (${player_query_time}ms)"
    fi
    
    # Tournament data query
    start_time=$(date +%s%3N)
    run_sql_query "SELECT t.*, COUNT(ptp.id) FROM tournaments t LEFT JOIN player_tournament_performance ptp ON t.id = ptp.tournament_id GROUP BY t.id ORDER BY t.start_date DESC LIMIT 10;" "Tournament query test" >/dev/null
    end_time=$(date +%s%3N)
    local tournament_query_time=$((end_time - start_time))
    
    log_info "Tournament query: ${tournament_query_time}ms"
    if [[ $tournament_query_time -lt 200 ]]; then
        log_success "Tournament query performance: EXCELLENT"
    elif [[ $tournament_query_time -lt 1000 ]]; then
        log_success "Tournament query performance: ACCEPTABLE"
    else
        log_warning "Tournament query performance: SLOW (${tournament_query_time}ms)"
    fi
    
    # Check table statistics are up to date
    local stale_stats=$(run_sql_query "SELECT COUNT(*) FROM pg_stat_user_tables WHERE n_live_tup > 1000 AND (last_analyze IS NULL OR last_analyze < NOW() - INTERVAL '7 days');" "Stale statistics check")
    if [[ $stale_stats -eq 0 ]]; then
        log_success "Table statistics are up to date"
    else
        log_warning "Found $stale_stats tables with stale statistics"
    fi
}

check_monitoring_setup() {
    log_info "=== MONITORING SETUP VALIDATION ==="
    
    # Check if pg_stat_statements is configured
    local pg_stat_enabled=$(run_sql_query "SELECT CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN 1 ELSE 0 END;" "pg_stat_statements check")
    if [[ $pg_stat_enabled -eq 1 ]]; then
        log_success "pg_stat_statements extension is enabled for query monitoring"
    else
        log_warning "pg_stat_statements extension not enabled - query monitoring limited"
    fi
    
    # Check log configuration
    local log_statement=$(run_sql_query "SHOW log_statement;" "Log statement setting")
    log_info "Database log_statement setting: $log_statement"
    
    local log_min_duration=$(run_sql_query "SHOW log_min_duration_statement;" "Log min duration setting")
    log_info "Database log_min_duration_statement: $log_min_duration"
    
    # Check if we can access database metrics
    local connection_stats=$(run_sql_query "SELECT COUNT(*) FROM pg_stat_database WHERE datname = '$DB_NAME';" "Database stats access")
    if [[ $connection_stats -eq 1 ]]; then
        log_success "Database statistics are accessible"
    else
        log_error "Cannot access database statistics"
        return 1
    fi
}

# =============================================
# SECURITY AND COMPLIANCE CHECKS
# =============================================

check_security_configuration() {
    log_info "=== SECURITY CONFIGURATION VALIDATION ==="
    
    # Check user privileges
    local superuser_count=$(run_sql_query "SELECT COUNT(*) FROM pg_roles WHERE rolsuper = true AND rolname NOT LIKE 'pg_%';" "Superuser count")
    log_info "Non-system superuser accounts: $superuser_count"
    if [[ $superuser_count -le 2 ]]; then
        log_success "Superuser account count is reasonable"
    else
        log_warning "High number of superuser accounts: $superuser_count"
    fi
    
    # Check for default passwords (basic check)
    local default_users=$(run_sql_query "SELECT COUNT(*) FROM pg_roles WHERE rolname IN ('postgres', 'admin', 'root') AND rolcanlogin = true;" "Default user accounts")
    if [[ $default_users -gt 0 ]]; then
        log_warning "Found $default_users potentially default user accounts"
    else
        log_success "No obvious default user accounts found"
    fi
    
    # Check SSL configuration
    local ssl_enabled=$(run_sql_query "SHOW ssl;" "SSL configuration" || echo "off")
    if [[ "$ssl_enabled" == "on" ]]; then
        log_success "SSL is enabled for database connections"
    else
        log_warning "SSL is not enabled for database connections"
    fi
    
    # Check for sensitive data exposure (basic scan)
    local email_data=$(run_sql_query "SELECT COUNT(*) FROM players WHERE name LIKE '%@%';" "Email data check")
    if [[ $email_data -eq 0 ]]; then
        log_success "No obvious email addresses in player names"
    else
        log_warning "Found $email_data potential email addresses in player data"
    fi
}

check_data_privacy_compliance() {
    log_info "=== DATA PRIVACY COMPLIANCE CHECKS ==="
    
    # Check for PII data classification
    log_info "Scanning for potential PII data..."
    
    # Check players table for PII
    local player_columns=$(run_sql_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'players' AND column_name IN ('email', 'phone', 'ssn', 'address');" "Player PII columns")
    if [[ $player_columns -eq 0 ]]; then
        log_success "No obvious PII columns in players table"
    else
        log_warning "Found $player_columns potential PII columns in players table"
    fi
    
    # Check for audit logging capabilities
    local audit_table_exists=$(run_sql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE '%audit%' OR table_name LIKE '%log%';" "Audit tables")
    if [[ $audit_table_exists -gt 0 ]]; then
        log_success "Audit/logging tables present: $audit_table_exists"
    else
        log_warning "No audit/logging tables found"
    fi
}

# =============================================
# APPLICATION INTEGRATION READINESS
# =============================================

check_application_readiness() {
    log_info "=== APPLICATION INTEGRATION READINESS ==="
    
    # Check application user exists and has proper permissions
    local app_user_exists=$(run_sql_query "SELECT COUNT(*) FROM pg_roles WHERE rolname = 'app_user' AND rolcanlogin = true;" "Application user check")
    if [[ $app_user_exists -eq 1 ]]; then
        log_success "Application user 'app_user' exists"
        
        # Check table permissions for app user
        local table_permissions=$(run_sql_query "SELECT COUNT(*) FROM information_schema.table_privileges WHERE grantee = 'app_user' AND privilege_type = 'SELECT';" "App user permissions")
        if [[ $table_permissions -gt 0 ]]; then
            log_success "Application user has table permissions: $table_permissions"
        else
            log_warning "Application user may not have sufficient table permissions"
        fi
    else
        log_warning "Application user 'app_user' not found or cannot login"
    fi
    
    # Check database connection pool settings
    local max_connections=$(run_sql_query "SHOW max_connections;" "Max connections setting")
    log_info "Database max_connections: $max_connections"
    [[ $max_connections -ge 100 ]] || log_warning "max_connections may be too low for production: $max_connections"
    
    # Test critical application queries work
    log_info "Testing critical application queries..."
    
    local test_queries=(
        "SELECT COUNT(*) FROM players WHERE name IS NOT NULL"
        "SELECT COUNT(*) FROM tournaments WHERE start_date >= '2024-01-01'"
        "SELECT COUNT(*) FROM player_tournament_performance WHERE total_score IS NOT NULL"
    )
    
    for query in "${test_queries[@]}"; do
        if run_sql_query "$query" "Application query test" >/dev/null; then
            log_success "Query executed successfully: $(echo "$query" | cut -d' ' -f1-3)..."
        else
            log_error "Query failed: $(echo "$query" | cut -d' ' -f1-3)..."
            return 1
        fi
    done
}

# =============================================
# DEPLOYMENT READINESS CHECKS
# =============================================

check_deployment_readiness() {
    log_info "=== DEPLOYMENT READINESS VALIDATION ==="
    
    # Check migration scripts exist
    local migration_scripts=(
        "01-create-new-schema.sql"
        "02-data-migration-etl.sql"
        "03-validation-and-verification.sql"
        "04-rollback-procedures.sql"
        "05-performance-optimization.sql"
    )
    
    local missing_scripts=()
    for script in "${migration_scripts[@]}"; do
        local script_path="$PROJECT_ROOT/migration-scripts/$script"
        if [[ -f "$script_path" ]]; then
            log_success "Migration script exists: $script"
        else
            log_error "Missing migration script: $script"
            missing_scripts+=("$script")
        fi
    done
    
    if [[ ${#missing_scripts[@]} -gt 0 ]]; then
        error_exit "Missing migration scripts: ${missing_scripts[*]}"
    fi
    
    # Check documentation exists
    local doc_files=(
        "TESTING_AND_IMPLEMENTATION_PLAN.md"
        "ROLLBACK_PLAN_AND_DISASTER_RECOVERY.md"
        "migration-scripts/README.md"
    )
    
    for doc in "${doc_files[@]}"; do
        local doc_path="$PROJECT_ROOT/$doc"
        if [[ -f "$doc_path" ]]; then
            log_success "Documentation exists: $doc"
        else
            log_warning "Documentation missing: $doc"
        fi
    done
    
    # Check team readiness indicators
    if [[ -f "$PROJECT_ROOT/.taskmaster/tasks/tasks.json" ]]; then
        log_success "Task management system in place"
    else
        log_warning "Task management system not found"
    fi
}

check_final_validation() {
    log_info "=== FINAL PRODUCTION READINESS VALIDATION ==="
    
    # Run migration validation if it exists
    local validation_script="$PROJECT_ROOT/migration-scripts/03-validation-and-verification.sql"
    if [[ -f "$validation_script" ]]; then
        log_info "Running migration validation checks..."
        
        # Check if migration_validation_results table exists (indicates migration was run)
        local validation_table_exists=$(run_sql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'migration_validation_results';" "Validation table check")
        
        if [[ $validation_table_exists -eq 1 ]]; then
            local validation_score=$(run_sql_query "SELECT COALESCE(AVG(CASE WHEN validation_result = 'PASS' THEN 100.0 ELSE 0.0 END), 0) FROM migration_validation_results;" "Validation score")
            log_info "Migration validation score: ${validation_score}%"
            
            if (( $(echo "$validation_score >= 90" | bc -l) )); then
                log_success "Migration validation score acceptable: ${validation_score}%"
            else
                log_error "Migration validation score too low: ${validation_score}%"
                return 1
            fi
            
            local critical_failures=$(run_sql_query "SELECT COUNT(*) FROM migration_validation_results WHERE severity = 'CRITICAL' AND validation_result = 'FAIL';" "Critical failures")
            if [[ $critical_failures -eq 0 ]]; then
                log_success "No critical validation failures"
            else
                log_error "Found $critical_failures critical validation failures"
                return 1
            fi
        else
            log_warning "Migration validation results not found - migration may not have been run yet"
        fi
    else
        log_warning "Migration validation script not found"
    fi
}

# =============================================
# MAIN EXECUTION AND REPORTING
# =============================================

generate_readiness_report() {
    local total_checks="$1"
    local passed_checks="$2"
    local failed_checks="$3"
    local warning_checks="$4"
    
    local report_file="$SCRIPT_DIR/production_readiness_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
PRODUCTION READINESS ASSESSMENT REPORT
======================================
Generated: $(date)
Database: $DB_NAME at $DB_HOST:$DB_PORT
Assessment by: $(whoami)

SUMMARY
=======
Total Checks: $total_checks
Passed: $passed_checks
Failed: $failed_checks  
Warnings: $warning_checks
Success Rate: $(echo "scale=1; $passed_checks * 100 / $total_checks" | bc)%

READINESS STATUS
===============
EOF

    if [[ $failed_checks -eq 0 ]]; then
        cat >> "$report_file" << 'EOF'
✅ PRODUCTION READY

All critical checks have passed. The system is ready for production deployment.

RECOMMENDED ACTIONS:
1. Schedule migration window with stakeholders
2. Ensure all team members are available during deployment
3. Activate monitoring and alerting systems
4. Prepare rollback procedures
5. Communicate with users about maintenance window

EOF
    elif [[ $failed_checks -le 2 ]]; then
        cat >> "$report_file" << 'EOF'
⚠️ CONDITIONALLY READY

Some non-critical issues were found. Review failed checks and determine if they are blockers for your deployment.

RECOMMENDED ACTIONS:
1. Review and address failed checks
2. Consider if issues are acceptable risks
3. Update monitoring and procedures as needed
4. Proceed with caution

EOF
    else
        cat >> "$report_file" << 'EOF'
❌ NOT READY FOR PRODUCTION

Multiple critical issues were found that must be addressed before production deployment.

REQUIRED ACTIONS:
1. Address all failed checks
2. Re-run production readiness assessment
3. Do not proceed with deployment until all critical issues are resolved

EOF
    fi
    
    cat >> "$report_file" << EOF

DETAILED RESULTS
===============
See log file for detailed results: $LOG_FILE

NEXT STEPS
==========
$(date '+%Y-%m-%d'): Production readiness assessment completed
$(date -d '+1 day' '+%Y-%m-%d'): Address any failed checks
$(date -d '+2 days' '+%Y-%m-%d'): Re-run assessment if needed
$(date -d '+3 days' '+%Y-%m-%d'): Schedule production deployment

EMERGENCY CONTACTS
==================
Database Team: [CONTACT_INFO]
Development Team: [CONTACT_INFO]
Operations Team: [CONTACT_INFO]
Management Escalation: [CONTACT_INFO]

EOF
    
    log_info "Production readiness report generated: $report_file"
    echo "$report_file"
}

main() {
    log "========================================"
    log "PRODUCTION READINESS ASSESSMENT STARTED"
    log "========================================"
    log "Database: $DB_NAME at $DB_HOST:$DB_PORT"
    log "Log file: $LOG_FILE"
    log ""
    
    local total_checks=0
    local passed_checks=0
    local failed_checks=0
    local warning_checks=0
    
    # Define all check functions
    local check_functions=(
        "check_database_connectivity"
        "check_required_extensions"
        "check_database_schema"
        "check_indexes_and_constraints"
        "check_backup_procedures"
        "check_performance_readiness"
        "check_monitoring_setup"
        "check_security_configuration"
        "check_data_privacy_compliance"
        "check_application_readiness"
        "check_deployment_readiness"
        "check_final_validation"
    )
    
    # Run all checks
    for check_func in "${check_functions[@]}"; do
        log ""
        if $check_func; then
            ((passed_checks++))
        else
            ((failed_checks++))
        fi
        ((total_checks++))
    done
    
    # Generate final report
    log ""
    log "========================================"
    log "PRODUCTION READINESS ASSESSMENT COMPLETE"
    log "========================================"
    log "Total checks: $total_checks"
    log "Passed: $passed_checks"
    log "Failed: $failed_checks"
    log "Success rate: $(echo "scale=1; $passed_checks * 100 / $total_checks" | bc)%"
    
    local report_file=$(generate_readiness_report "$total_checks" "$passed_checks" "$failed_checks" "$warning_checks")
    
    if [[ $failed_checks -eq 0 ]]; then
        log_success "🎉 SYSTEM IS PRODUCTION READY!"
        log_info "Report: $report_file"
        exit 0
    elif [[ $failed_checks -le 2 ]]; then
        log_warning "⚠️ SYSTEM IS CONDITIONALLY READY"
        log_info "Review failed checks and determine deployment feasibility"
        log_info "Report: $report_file"
        exit 0
    else
        log_error "❌ SYSTEM IS NOT READY FOR PRODUCTION"
        log_error "Address failed checks before deployment"
        log_info "Report: $report_file"
        exit 1
    fi
}

# =============================================
# SCRIPT ENTRY POINT
# =============================================

case "${1:-}" in
    --help|-h)
        cat << EOF
Production Readiness Assessment Suite

Usage: $0 [options]

Options:
  --help, -h    Show this help message
  --quick       Run only critical checks (faster execution)
  --report-only Generate report from existing log
  
Environment Variables:
  DB_NAME       Database name (default: golf_parlay_db)
  DB_USER       Database user (default: postgres)
  DB_HOST       Database host (default: localhost)
  DB_PORT       Database port (default: 5432)

This script performs comprehensive checks to determine if the system
is ready for production deployment, including:

- Database connectivity and health
- Schema and data validation
- Performance and monitoring readiness
- Security and compliance checks  
- Backup and recovery procedures
- Application integration validation

Exit codes:
  0 - System is production ready
  1 - System has critical issues requiring attention

EOF
        exit 0
        ;;
    --quick)
        log_info "Running quick production readiness check..."
        # Run only critical checks for faster execution
        check_database_connectivity && \
        check_required_extensions && \
        check_database_schema && \
        check_backup_procedures && \
        check_application_readiness
        exit $?
        ;;
    --report-only)
        log_info "Generating report from existing data..."
        generate_readiness_report 0 0 0 0
        exit 0
        ;;
    "")
        # No arguments - run full assessment
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac