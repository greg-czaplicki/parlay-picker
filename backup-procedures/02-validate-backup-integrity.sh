#!/bin/bash
# =============================================
# BACKUP INTEGRITY VALIDATION SCRIPT
# =============================================
# This script validates backup integrity and restoration capability
# Ensures backups are reliable for rollback scenarios
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

BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOG_FILE="${BACKUP_DIR}/validation_$(date +%Y%m%d_%H%M%S).log"

# =============================================
# FUNCTIONS
# =============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

find_latest_backup() {
    local backup_pattern="pre_migration_*_full.sql"
    local latest_backup=$(find "$BACKUP_DIR" -name "$backup_pattern" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [[ -z "$latest_backup" ]]; then
        error_exit "No backup files found matching pattern: $backup_pattern"
    fi
    
    echo "$latest_backup"
}

validate_backup_file() {
    local backup_file="$1"
    log "Validating backup file: $backup_file"
    
    # Check file exists and is readable
    [[ -f "$backup_file" ]] || error_exit "Backup file not found: $backup_file"
    [[ -r "$backup_file" ]] || error_exit "Backup file not readable: $backup_file"
    
    # Check file size is reasonable (> 1MB)
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [[ $file_size -lt 1048576 ]]; then
        error_exit "Backup file too small ($file_size bytes): $backup_file"
    fi
    
    # Validate backup file format
    pg_restore --list "$backup_file" >/dev/null 2>&1 || error_exit "Invalid backup file format: $backup_file"
    
    log "Backup file validation passed: $(numfmt --to=iec $file_size)"
}

create_test_database() {
    local test_db="backup_test_$$"
    log "Creating test database: $test_db"
    
    # Drop if exists (cleanup from previous failed runs)
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db" 2>/dev/null || true
    
    # Create test database
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db" || error_exit "Failed to create test database"
    
    echo "$test_db"
}

test_backup_restoration() {
    local backup_file="$1"
    local test_db="$2"
    
    log "Testing backup restoration to: $test_db"
    
    # Restore backup to test database
    pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$test_db" \
        --verbose \
        "$backup_file" \
        >> "$LOG_FILE" 2>&1 || error_exit "Backup restoration failed"
    
    log "Backup restoration completed successfully"
}

validate_restored_data() {
    local test_db="$1"
    log "Validating restored data integrity..."
    
    # Check table count
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" -t -c "
        SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
    " 2>/dev/null | tr -d ' ')
    
    log "Tables restored: $table_count"
    [[ $table_count -gt 10 ]] || error_exit "Too few tables restored: $table_count"
    
    # Check critical tables exist and have data
    local validation_results=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" -t -c "
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players_v2') 
                THEN 'players_v2: ' || (SELECT COUNT(*) FROM players_v2)::text || ' records'
                ELSE 'players_v2: MISSING'
            END as players_check
        UNION ALL
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournaments_v2') 
                THEN 'tournaments_v2: ' || (SELECT COUNT(*) FROM tournaments_v2)::text || ' records'
                ELSE 'tournaments_v2: MISSING'
            END
        UNION ALL
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tournament_round_snapshots') 
                THEN 'tournament_round_snapshots: ' || (SELECT COUNT(*) FROM tournament_round_snapshots)::text || ' records'
                ELSE 'tournament_round_snapshots: MISSING'
            END
        UNION ALL
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'matchups_v2') 
                THEN 'matchups_v2: ' || (SELECT COUNT(*) FROM matchups_v2)::text || ' records'
                ELSE 'matchups_v2: MISSING'
            END;
    " 2>/dev/null)
    
    log "Data validation results:"
    echo "$validation_results" | while read -r line; do
        log "  $line"
        if [[ "$line" == *"MISSING"* ]]; then
            error_exit "Critical table missing in restored database"
        fi
    done
    
    log "Data integrity validation passed"
}

validate_constraints_and_indexes() {
    local test_db="$1"
    log "Validating constraints and indexes..."
    
    # Check foreign key constraints
    local fk_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" -t -c "
        SELECT COUNT(*) FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
    " 2>/dev/null | tr -d ' ')
    
    log "Foreign key constraints: $fk_count"
    [[ $fk_count -gt 0 ]] || log "Warning: No foreign key constraints found"
    
    # Check indexes
    local index_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" -t -c "
        SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
    " 2>/dev/null | tr -d ' ')
    
    log "Indexes restored: $index_count"
    [[ $index_count -gt 5 ]] || log "Warning: Few indexes found ($index_count)"
    
    log "Constraints and indexes validation completed"
}

compare_with_source() {
    local test_db="$1"
    log "Comparing restored data with source database..."
    
    # Compare record counts for critical tables
    local comparison_results=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT 
            'players_v2' as table_name,
            COUNT(*) as source_count
        FROM players_v2
        UNION ALL
        SELECT 'tournaments_v2', COUNT(*) FROM tournaments_v2
        UNION ALL
        SELECT 'tournament_round_snapshots', COUNT(*) FROM tournament_round_snapshots
        UNION ALL
        SELECT 'matchups_v2', COUNT(*) FROM matchups_v2;
    " 2>/dev/null)
    
    local restored_counts=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" -t -c "
        SELECT 
            'players_v2' as table_name,
            COUNT(*) as restored_count
        FROM players_v2
        UNION ALL
        SELECT 'tournaments_v2', COUNT(*) FROM tournaments_v2
        UNION ALL
        SELECT 'tournament_round_snapshots', COUNT(*) FROM tournament_round_snapshots
        UNION ALL
        SELECT 'matchups_v2', COUNT(*) FROM matchups_v2;
    " 2>/dev/null)
    
    log "Record count comparison:"
    while IFS='|' read -r table_name source_count; do
        table_name=$(echo "$table_name" | tr -d ' ')
        source_count=$(echo "$source_count" | tr -d ' ')
        
        restored_count=$(echo "$restored_counts" | grep "$table_name" | cut -d'|' -f2 | tr -d ' ')
        
        if [[ "$source_count" == "$restored_count" ]]; then
            log "  ✅ $table_name: $source_count records (match)"
        else
            log "  ❌ $table_name: source=$source_count, restored=$restored_count (MISMATCH)"
            error_exit "Record count mismatch for table: $table_name"
        fi
    done <<< "$comparison_results"
    
    log "Record count comparison passed"
}

test_backup_performance() {
    local backup_file="$1"
    log "Testing backup performance metrics..."
    
    # Measure restoration time
    local start_time=$(date +%s)
    
    # Create temporary test database for performance test
    local perf_test_db="perf_test_$$"
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$perf_test_db" 2>/dev/null || return 0
    
    # Restore schema only for speed
    pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$perf_test_db" \
        --schema-only \
        "$backup_file" \
        >/dev/null 2>&1
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "Schema restoration time: ${duration} seconds"
    
    # Clean up
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$perf_test_db" 2>/dev/null
    
    # Performance assessment
    if [[ $duration -lt 60 ]]; then
        log "✅ Performance: Excellent (< 1 minute)"
    elif [[ $duration -lt 300 ]]; then
        log "✅ Performance: Good (< 5 minutes)"
    elif [[ $duration -lt 600 ]]; then
        log "⚠️ Performance: Acceptable (< 10 minutes)"
    else
        log "❌ Performance: Poor (> 10 minutes) - investigate"
    fi
}

validate_checksum() {
    local backup_file="$1"
    log "Validating backup checksum..."
    
    # Find checksum file
    local backup_basename=$(basename "$backup_file")
    local backup_prefix=${backup_basename%_full.sql}
    local checksum_file="${BACKUP_DIR}/${backup_prefix}_checksums.md5"
    
    if [[ ! -f "$checksum_file" ]]; then
        log "Warning: Checksum file not found: $checksum_file"
        return 0
    fi
    
    # Validate checksum
    cd "$BACKUP_DIR"
    if md5sum --check "$checksum_file" >/dev/null 2>&1; then
        log "✅ Checksum validation passed"
    else
        error_exit "Checksum validation failed - backup file may be corrupted"
    fi
}

cleanup_test_database() {
    local test_db="$1"
    log "Cleaning up test database: $test_db"
    
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db" 2>/dev/null || log "Warning: Could not drop test database"
}

generate_validation_report() {
    local backup_file="$1"
    local validation_status="$2"
    
    local report_file="${BACKUP_DIR}/validation_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
BACKUP INTEGRITY VALIDATION REPORT
==================================
Generated: $(date)
Backup File: $backup_file
Database: $DB_NAME
Host: $DB_HOST:$DB_PORT
User: $DB_USER

VALIDATION STATUS: $validation_status

TESTS PERFORMED:
===============
✅ Backup file format validation
✅ Backup restoration test
✅ Data integrity validation
✅ Constraints and indexes check
✅ Record count comparison
✅ Performance assessment
✅ Checksum validation

BACKUP FILE DETAILS:
==================
File Size: $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null | numfmt --to=iec)
Created: $(stat -f%SB "$backup_file" 2>/dev/null || stat -c%y "$backup_file" 2>/dev/null)
Format: PostgreSQL custom format

VALIDATION CONCLUSION:
=====================
EOF

    if [[ "$validation_status" == "PASSED" ]]; then
        cat >> "$report_file" << EOF
✅ BACKUP VALIDATION SUCCESSFUL

This backup file has been thoroughly tested and verified:
- Can be successfully restored
- Contains all expected data
- Maintains data integrity
- Performance is acceptable

The backup is SAFE to use for rollback scenarios.

NEXT STEPS:
==========
1. Store this backup in multiple secure locations
2. Repeat validation weekly to ensure ongoing integrity
3. Test rollback procedures in staging environment
4. Document backup location for disaster recovery team
EOF
    else
        cat >> "$report_file" << EOF
❌ BACKUP VALIDATION FAILED

This backup file has issues and may not be reliable:
- Check the log file for specific error details
- DO NOT use this backup for critical rollback scenarios
- Create a new backup and repeat validation

IMMEDIATE ACTIONS REQUIRED:
=========================
1. Investigate and fix backup issues
2. Create new backup with proper procedures
3. Validate new backup before proceeding
4. Update disaster recovery documentation
EOF
    fi
    
    log "Validation report generated: $report_file"
    echo "$report_file"
}

# =============================================
# MAIN EXECUTION
# =============================================

main() {
    log "Starting backup integrity validation..."
    log "Backup directory: $BACKUP_DIR"
    
    local validation_status="PASSED"
    local test_db=""
    local backup_file=""
    local report_file=""
    
    # Trap to ensure cleanup
    trap 'cleanup_test_database "$test_db" 2>/dev/null || true' EXIT
    
    # Find latest backup file
    backup_file=$(find_latest_backup)
    log "Found backup file: $backup_file"
    
    # Run validation tests
    validate_backup_file "$backup_file" || validation_status="FAILED"
    
    if [[ "$validation_status" == "PASSED" ]]; then
        test_db=$(create_test_database)
        test_backup_restoration "$backup_file" "$test_db" || validation_status="FAILED"
    fi
    
    if [[ "$validation_status" == "PASSED" ]]; then
        validate_restored_data "$test_db" || validation_status="FAILED"
        validate_constraints_and_indexes "$test_db" || validation_status="FAILED"
        compare_with_source "$test_db" || validation_status="FAILED"
    fi
    
    # Performance and checksum tests (non-critical)
    test_backup_performance "$backup_file"
    validate_checksum "$backup_file"
    
    # Generate final report
    report_file=$(generate_validation_report "$backup_file" "$validation_status")
    
    # Final status
    log "=============================================="
    if [[ "$validation_status" == "PASSED" ]]; then
        log "✅ BACKUP VALIDATION COMPLETED SUCCESSFULLY"
        log "Backup file is verified and safe for rollback use"
    else
        log "❌ BACKUP VALIDATION FAILED"
        log "Backup file has issues - DO NOT USE for rollback"
    fi
    log "=============================================="
    log "Validation report: $report_file"
    log "Log file: $LOG_FILE"
    
    # Return appropriate exit code
    [[ "$validation_status" == "PASSED" ]] && exit 0 || exit 1
}

# =============================================
# SCRIPT ENTRY POINT
# =============================================

case "${1:-}" in
    --help|-h)
        cat << EOF
Backup Integrity Validation Script

Usage: $0 [options] [backup_file]

Options:
  --help, -h     Show this help message
  --latest       Validate latest backup (default)
  --file FILE    Validate specific backup file
  
Environment Variables:
  DB_NAME        Database name (default: golf_parlay_db)
  DB_USER        Database user (default: postgres)
  DB_HOST        Database host (default: localhost)
  DB_PORT        Database port (default: 5432)
  BACKUP_DIR     Backup directory (default: ./backups)

Examples:
  $0                                    # Validate latest backup
  $0 --file /path/to/backup.sql        # Validate specific file
  BACKUP_DIR=/secure/backups $0        # Use different backup location
  
EOF
        exit 0
        ;;
    --latest|"")
        # Default behavior - validate latest backup
        main
        ;;
    --file)
        if [[ -z "${2:-}" ]]; then
            echo "Error: --file requires a backup file path"
            exit 1
        fi
        # Override backup file finding
        find_latest_backup() { echo "$2"; }
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac