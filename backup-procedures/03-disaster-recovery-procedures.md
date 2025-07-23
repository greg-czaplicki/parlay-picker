# Disaster Recovery Procedures
*Emergency Response for Critical Database Failures*
*Generated: July 23, 2025*

## Emergency Contact Information

### Immediate Response Team
- **Database Engineer**: [PRIMARY CONTACT] - Available 24/7 during migration
- **Lead Developer**: [SECONDARY CONTACT] - Application expertise  
- **DevOps Engineer**: [INFRASTRUCTURE CONTACT] - System and network issues
- **Product Manager**: [BUSINESS CONTACT] - Business impact decisions

### Escalation Contacts
- **CTO/Technical Director**: [EXECUTIVE ESCALATION] - Major incidents
- **CEO**: [CRITICAL ESCALATION] - Business continuity threats
- **Legal/Compliance**: [REGULATORY CONTACT] - Data breach scenarios

---

## Disaster Scenarios and Response Procedures

### 🔴 **SCENARIO 1: Complete Database Loss**
*Database server crash, disk failure, or complete data corruption*

#### Immediate Response (0-10 minutes)
```bash
# 1. STOP - Prevent further damage
sudo systemctl stop postgresql
sudo systemctl stop your-application

# 2. ASSESS - Determine scope of damage
df -h                    # Check disk space
sudo dmesg | tail -20    # Check system errors
sudo journalctl -u postgresql -f  # Check PostgreSQL logs

# 3. ALERT - Notify all stakeholders immediately
echo "🚨 CRITICAL: Complete database failure detected
Time: $(date)
Scope: Full database unavailable
Action: Beginning disaster recovery
ETA: 2-4 hours" | slack-notify #critical-alerts
```

#### Recovery Procedure (10-240 minutes)
```bash
# Phase 1: Infrastructure Assessment (10-30 minutes)
# Check hardware status
sudo smartctl -a /dev/sda1  # Check disk health
free -h                     # Check memory
df -h                       # Check all filesystems

# Phase 2: Database Restoration (30-180 minutes)
# If hardware is functional, restore from backup
sudo systemctl start postgresql

# Restore from latest backup
BACKUP_FILE="/path/to/latest/backup_pre_migration_*.sql"
dropdb golf_parlay_db 2>/dev/null || true
createdb golf_parlay_db
pg_restore --verbose --dbname=golf_parlay_db "$BACKUP_FILE"

# Phase 3: Verification (180-210 minutes)
# Verify restoration success
psql -d golf_parlay_db -c "
SELECT 
    'Database restored successfully' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public';"

# Test critical functionality
curl -f http://localhost:3000/api/health || echo "App health check failed"

# Phase 4: Service Restoration (210-240 minutes)
sudo systemctl start your-application
# Monitor and verify all services operational
```

**Recovery Time Objective**: 4 hours  
**Recovery Point Objective**: 0 (complete backup restoration)

### 🔴 **SCENARIO 2: Backup File Corruption**
*Primary backup files are corrupted or inaccessible*

#### Immediate Response (0-5 minutes)
```bash
# 1. Verify backup corruption
pg_restore --list /path/to/backup.sql || echo "Backup corrupted"

# 2. Check all available backups
find /backup/locations -name "*.sql" -type f -exec pg_restore --list {} \; | grep -c "LIST OF"

# 3. Alert team with backup status
echo "⚠️ BACKUP CORRUPTION DETECTED
Primary backup: CORRUPTED
Checking secondary backups...
Status: INVESTIGATING" | slack-notify #database-alerts
```

#### Recovery Options (Priority Order)
```bash
# Option A: Secondary backup location
SECONDARY_BACKUP="/secondary/backup/location/backup_*.sql"
if pg_restore --list "$SECONDARY_BACKUP" >/dev/null 2>&1; then
    echo "Secondary backup valid - proceeding with restoration"
    pg_restore --verbose --dbname=golf_parlay_db "$SECONDARY_BACKUP"
fi

# Option B: Cloud backup
aws s3 cp s3://backup-bucket/latest-backup.sql ./
pg_restore --verbose --dbname=golf_parlay_db ./latest-backup.sql

# Option C: Table snapshots (last resort)
psql -d golf_parlay_db -c "
-- Restore from snapshot tables if they exist
INSERT INTO players_v2 SELECT * FROM players_v2_backup;
INSERT INTO tournaments_v2 SELECT * FROM tournaments_v2_backup;
-- Continue for all critical tables"

# Option D: Point-in-time recovery (if available)
# Use WAL logs for point-in-time recovery
pg_basebackup -D /tmp/recovery_base -Ft -z -P
# Follow PostgreSQL PITR procedures
```

**Recovery Time Objective**: 1-2 hours  
**Recovery Point Objective**: 0-30 minutes (depending on backup age)

### 🟡 **SCENARIO 3: Partial Data Loss**
*Some tables lost/corrupted but database server functional*

#### Assessment Procedure (0-15 minutes)
```sql
-- Identify affected tables
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    CASE 
        WHEN n_live_tup = 0 THEN '❌ EMPTY/MISSING'
        WHEN n_live_tup < 100 THEN '⚠️ SUSPICIOUSLY_LOW'
        ELSE '✅ HAS_DATA'
    END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup;

-- Check for missing tables
SELECT 
    'Missing Tables' as check_type,
    table_name
FROM (
    VALUES 
        ('players_v2'),
        ('tournaments_v2'),
        ('tournament_round_snapshots'),
        ('matchups_v2')
) AS expected(table_name)
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = expected.table_name
);
```

#### Selective Recovery Procedure
```bash
# For specific table restoration
AFFECTED_TABLE="players_v2"
BACKUP_FILE="/path/to/backup_pre_migration_*.sql"

# Create backup of current state
pg_dump golf_parlay_db --table=$AFFECTED_TABLE > "before_restore_${AFFECTED_TABLE}.sql"

# Restore specific table
pg_restore --verbose --table=$AFFECTED_TABLE --dbname=golf_parlay_db "$BACKUP_FILE"

# Verify restoration
psql -d golf_parlay_db -c "SELECT COUNT(*) as restored_rows FROM $AFFECTED_TABLE;"
```

**Recovery Time Objective**: 30-60 minutes per table  
**Recovery Point Objective**: 0 (complete table restoration)

### 🟡 **SCENARIO 4: Migration Script Failure**
*Migration scripts fail midway, leaving database in inconsistent state*

#### Immediate Response (0-5 minutes)
```bash
# 1. STOP all migration processes immediately
pkill -f "psql.*migration"
pkill -f "pg_restore"

# 2. Check current database state
psql -d golf_parlay_db -c "
SELECT 
    'Migration Status Check' as status,
    COUNT(CASE WHEN schemaname = 'public' AND tablename LIKE '%_v2' THEN 1 END) as old_tables,
    COUNT(CASE WHEN schemaname = 'public' AND tablename NOT LIKE '%_v2' AND tablename NOT LIKE '%_backup' THEN 1 END) as new_tables
FROM pg_stat_user_tables;"

# 3. Alert team
echo "🚨 MIGRATION FAILURE DETECTED
Time: $(date)
Status: Scripts stopped mid-execution
Database: Potentially inconsistent state
Action: Assessing rollback necessity" | slack-notify #migration-alerts
```

#### Recovery Decision Matrix
```bash
# Assess migration state and decide on recovery approach
psql -d golf_parlay_db -c "
WITH migration_assessment AS (
    SELECT 
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'players') as new_schema_exists,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'players_v2') as old_schema_exists,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_log') as migration_log_exists
)
SELECT 
    CASE 
        WHEN new_schema_exists AND old_schema_exists THEN 'PARTIAL_MIGRATION - Consider rollback'
        WHEN new_schema_exists AND NOT old_schema_exists THEN 'MIGRATION_ADVANCED - Rollback required'
        WHEN NOT new_schema_exists AND old_schema_exists THEN 'MIGRATION_FAILED_EARLY - Safe to retry'
        ELSE 'UNKNOWN_STATE - Manual investigation required'
    END as recommended_action
FROM migration_assessment;"
```

#### Recovery Actions
```bash
# Option A: Complete rollback (if new schema partially created)
psql -d golf_parlay_db -f migration-scripts/04-rollback-procedures.sql

# Option B: Clean slate retry (if migration failed early)
# Drop any partial new objects and retry
psql -d golf_parlay_db -c "
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
-- Drop other partial objects
"

# Option C: Fix-forward (if issue is minor and fixable)
# Analyze specific error and apply targeted fix
# Only if confident about the fix and business approves
```

**Recovery Time Objective**: 30-90 minutes  
**Recovery Point Objective**: 0 (rollback to pre-migration state)

### 🟡 **SCENARIO 5: Hardware Failure During Migration**
*Server crash, disk failure, or network issues during migration*

#### Immediate Assessment (0-10 minutes)
```bash
# 1. Check system status
sudo systemctl is-active postgresql
sudo systemctl is-active your-application
df -h  # Disk space
free -h  # Memory
ping -c 3 database-server  # Network connectivity

# 2. Check for hardware issues
sudo dmesg | grep -i error | tail -10
sudo smartctl -H /dev/sda1  # Disk health
sudo journalctl -p err -n 20  # System errors

# 3. Assess database integrity
psql -d golf_parlay_db -c "SELECT version();" || echo "Database inaccessible"
```

#### Recovery Strategy Selection
```bash
# Decision tree based on assessment
if [[ $(systemctl is-active postgresql) == "active" ]]; then
    echo "Database accessible - checking data integrity"
    # Run data integrity checks
    psql -d golf_parlay_db -f migration-scripts/03-validation-and-verification.sql
else
    echo "Database inaccessible - hardware recovery needed"
    # Follow complete database loss procedure
fi
```

**Recovery Time Objective**: 2-6 hours (depends on hardware issues)  
**Recovery Point Objective**: 0-60 minutes (depends on when failure occurred)

---

## Recovery Time and Point Objectives

### SLA Matrix

| Disaster Type | Business Impact | RTO Target | RTO Maximum | RPO Target | RPO Maximum |
|---------------|-----------------|------------|-------------|------------|-------------|
| Complete DB Loss | Critical | 2 hours | 4 hours | 0 | 0 |
| Backup Corruption | High | 1 hour | 2 hours | 0 | 30 min |
| Partial Data Loss | Medium | 30 min | 1 hour | 0 | 0 |
| Migration Failure | High | 45 min | 90 min | 0 | 0 |
| Hardware Failure | Critical | 3 hours | 6 hours | 0 | 60 min |

### Business Impact Definitions
- **Critical**: Core business operations completely stopped
- **High**: Major functionality impaired, significant user impact
- **Medium**: Some features unavailable, workarounds possible
- **Low**: Minor inconvenience, limited user impact

---

## Emergency Communication Procedures

### Incident Classification

#### CRITICAL (P0) - Complete Service Outage
```
🚨 CRITICAL INCIDENT - P0
Service: Golf Parlay Database
Status: COMPLETE OUTAGE
Impact: All users affected
ETA: [TIME]
Incident Commander: [NAME]
Next Update: 15 minutes
```

#### HIGH (P1) - Major Functionality Impaired
```
⚠️ HIGH PRIORITY INCIDENT - P1
Service: Golf Parlay Database
Status: DEGRADED SERVICE
Impact: [DESCRIPTION]
ETA: [TIME]
Next Update: 30 minutes
```

#### MEDIUM (P2) - Partial Functionality Issues
```
⚠️ INCIDENT - P2
Service: Golf Parlay Database
Status: PARTIAL OUTAGE
Impact: [SPECIFIC FEATURES]
ETA: [TIME]
Next Update: 1 hour
```

### Communication Channels

#### Immediate (< 5 minutes)
- **Slack**: #critical-alerts channel
- **Phone**: Primary on-call engineer
- **SMS**: Key stakeholders
- **Email**: Incident distribution list

#### Regular Updates
- **CRITICAL**: Every 15 minutes
- **HIGH**: Every 30 minutes
- **MEDIUM**: Every hour

#### Resolution Notice
- **All Channels**: Incident resolved message
- **Post-mortem**: Scheduled within 24 hours
- **Lessons Learned**: Documented within 1 week

### Status Page Updates
```bash
# Update external status page
curl -X POST "https://status-api.yourcompany.com/incidents" \
  -H "Authorization: Bearer $STATUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Database Migration Issues",
    "status": "investigating",
    "message": "We are investigating database connectivity issues affecting the golf parlay application.",
    "components": ["database", "api"]
  }'
```

---

## Recovery Validation Checklist

### Technical Validation
- [ ] **Database accessible and responsive**
- [ ] **All critical tables exist with expected data**
- [ ] **Foreign key constraints intact**
- [ ] **Indexes and performance acceptable**
- [ ] **Application connectivity restored**
- [ ] **API endpoints responding correctly**
- [ ] **No data corruption detected**

### Business Validation
- [ ] **User login and authentication working**
- [ ] **Player data displaying correctly**
- [ ] **Tournament information accurate**
- [ ] **Betting odds and markets functional**
- [ ] **Historical data accessible**
- [ ] **Reports and analytics working**
- [ ] **Performance meets SLA requirements**

### Security Validation
- [ ] **Access controls functioning properly**
- [ ] **Audit logging operational**
- [ ] **No unauthorized access detected**
- [ ] **Encryption and security measures intact**
- [ ] **Compliance requirements met**

### Operational Validation
- [ ] **Monitoring and alerting functional**
- [ ] **Backup procedures operational**
- [ ] **Scheduled jobs running correctly**
- [ ] **Log rotation and maintenance working**
- [ ] **Documentation updated**

---

## Post-Recovery Procedures

### Immediate (Within 1 Hour)
1. **Service Verification**
   - Test all critical user workflows
   - Verify data accuracy and completeness
   - Check performance metrics

2. **Stakeholder Notification**
   - Inform all teams of service restoration
   - Provide preliminary incident summary
   - Schedule post-incident review

3. **Monitoring Enhancement**
   - Increase monitoring frequency temporarily
   - Set up additional alerts for potential issues
   - Assign dedicated monitoring resources

### Short-term (Within 24 Hours)
1. **Incident Documentation**
   - Complete timeline of events
   - Root cause analysis
   - Impact assessment

2. **Process Review**
   - Evaluate response effectiveness
   - Identify improvement opportunities
   - Update procedures based on lessons learned

3. **Communication Follow-up**
   - Send detailed incident report to stakeholders
   - Update status page with final resolution
   - Schedule post-mortem meeting

### Long-term (Within 1 Week)
1. **System Improvements**
   - Implement preventive measures
   - Enhance monitoring and alerting
   - Update disaster recovery procedures

2. **Team Training**
   - Conduct incident response debrief
   - Update emergency procedures
   - Train team on lessons learned

3. **Documentation Updates**
   - Revise disaster recovery plans
   - Update contact information
   - Improve runbooks and procedures

---

## Testing and Validation

### Monthly Disaster Recovery Drills
```bash
# Scheduled DR test procedure
echo "🧪 MONTHLY DR DRILL - $(date)"

# 1. Create isolated test environment
createdb dr_test_$(date +%Y%m%d)

# 2. Simulate various failure scenarios
# Test backup restoration
# Test partial data loss recovery
# Test communication procedures

# 3. Measure and document results
# Record RTO/RPO achieved
# Note any procedure gaps
# Update documentation

# 4. Clean up test environment
dropdb dr_test_$(date +%Y%m%d)
```

### Annual Full-Scale DR Exercise
- **Scope**: Complete system failure simulation
- **Duration**: 4-6 hours
- **Participants**: All technical teams + business stakeholders
- **Objectives**: Validate entire DR capability
- **Success Criteria**: Meet all RTO/RPO objectives

---

## Continuous Improvement

### Metrics Tracking
| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| Mean Time to Detection | < 5 min | - | - |
| Mean Time to Response | < 10 min | - | - |
| Mean Time to Recovery | < RTO | - | - |
| Recovery Success Rate | > 95% | - | - |

### Quarterly Review Process
1. **Performance Analysis**
   - Review all incidents and response times
   - Analyze trends and patterns
   - Benchmark against industry standards

2. **Procedure Updates**
   - Incorporate lessons learned
   - Update contact information
   - Revise procedures based on system changes

3. **Training and Awareness**
   - Conduct team training sessions
   - Update emergency contact cards
   - Practice communication procedures

---

**⚠️ REMEMBER**: In any disaster scenario, the priority order is:
1. **Safety first** - Prevent further damage
2. **Assessment** - Understand the scope
3. **Communication** - Keep stakeholders informed
4. **Recovery** - Restore service systematically
5. **Learning** - Improve procedures for next time

**📞 EMERGENCY ESCALATION**: If recovery is not progressing as expected after 50% of RTO has elapsed, immediately escalate to executive team for additional resources or business decisions.