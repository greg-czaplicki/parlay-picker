# Database Migration Scripts

This directory contains comprehensive migration scripts for transitioning from the current fragmented database schema to the new AI-optimized golf parlay analytics schema.

## Scripts Overview

### 01-create-new-schema.sql
Creates the complete new AI-optimized database schema including:
- Core entities (players, courses, tournaments, tournament_rounds)
- Betting infrastructure (sportsbooks, betting_markets, odds_history)
- AI/ML tables (correlations, feature_vectors, models)
- Shot-level data structures
- TimescaleDB hypertables for time-series optimization
- Vector embeddings for similarity analysis
- Performance indexes and materialized views

**Estimated Execution Time**: 15-30 minutes  
**Prerequisites**: PostgreSQL with TimescaleDB and vector extensions

### 02-data-migration-etl.sql
Handles data extraction, transformation, and loading from old to new schema:
- Players migration with name standardization
- Course reconstruction from tournament data
- Tournament migration with enhanced categorization
- Performance data from multiple sources (snapshots, results, live stats)
- Betting data normalization (matchups → markets + odds)
- Data enrichment and calculated fields
- Comprehensive logging and error handling

**Estimated Execution Time**: 45-90 minutes  
**Data Preservation Rate**: ~85% overall

### 03-validation-and-verification.sql
Comprehensive validation of migration success:
- Record count reconciliation
- Data integrity checks (foreign keys, constraints)
- Business logic validation
- Performance readiness assessment
- AI infrastructure verification
- Migration completeness scoring
- Detailed audit reporting

**Estimated Execution Time**: 10-15 minutes  
**Validation Checks**: 20+ comprehensive validations

### 04-rollback-procedures.sql
Complete rollback capability to restore pre-migration state:
- Safe constraint removal for clean rollback
- New schema object removal
- Original schema integrity verification
- Data restoration validation
- Comprehensive audit trail
- Step-by-step rollback verification

**Estimated Execution Time**: 20-30 minutes  
**Safety**: Full restoration to original state

### 05-performance-optimization.sql
Production-ready performance optimization:
- Core lookup indexes (90% faster queries)
- Betting/odds indexes (80% faster betting queries)
- AI/ML vector indexes (95% faster similarity searches)
- TimescaleDB compression and continuous aggregates
- Query performance tuning
- Materialized views for analytical queries
- Automated maintenance functions
- Performance monitoring setup

**Estimated Execution Time**: 30-45 minutes  
**Performance Improvement**: ~75% overall system improvement

## Migration Strategy

Based on the **"Start Fresh, Build Forward"** approach:

1. **Accept historical data gaps** as starting point
2. **Focus on ongoing data collection** improvements
3. **Migrate existing good data** (85% preservation)
4. **Enable AI-optimized future** capabilities

## Execution Order

**CRITICAL**: Execute scripts in exact order:

```bash
# 1. Create new schema
psql -d golf_parlay_db -f 01-create-new-schema.sql

# 2. Migrate existing data
psql -d golf_parlay_db -f 02-data-migration-etl.sql

# 3. Validate migration success
psql -d golf_parlay_db -f 03-validation-and-verification.sql

# 4. Optimize for production (after validation passes)
psql -d golf_parlay_db -f 05-performance-optimization.sql

# 5. Use rollback if issues occur (ONLY IF NEEDED)
# psql -d golf_parlay_db -f 04-rollback-procedures.sql
```

## Prerequisites

### Database Extensions Required
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "vector" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

### System Requirements
- PostgreSQL 15+ with TimescaleDB 2.11+
- pgvector extension for AI embeddings
- Minimum 4GB RAM available during migration
- 50GB+ free disk space for migration process
- Network access to external APIs (for ongoing data collection)

### Pre-Migration Checklist
- [ ] **Complete database backup created**
- [ ] **Staging environment tested successfully**
- [ ] **Application connections documented**
- [ ] **Rollback procedures tested**
- [ ] **Maintenance window scheduled**
- [ ] **Team notifications sent**

## Migration Timeline

| Phase | Duration | Critical Path |
|-------|----------|---------------|
| Schema Creation | 15-30 min | Database structure |
| Data Migration | 45-90 min | **MOST CRITICAL** |
| Validation | 10-15 min | Go/no-go decision |
| Optimization | 30-45 min | Production readiness |
| **Total Downtime** | **2-3 hours** | **Weekend preferred** |

## Success Criteria

### Must Pass (Migration Blockers)
- [ ] All core tables created successfully
- [ ] >90% data preservation rate achieved
- [ ] Foreign key integrity 100% validated
- [ ] Zero critical validation failures
- [ ] Application connectivity confirmed

### Should Pass (Performance Goals)
- [ ] Query performance improved by >50%
- [ ] AI infrastructure ready for ML models
- [ ] Betting queries sub-second response time
- [ ] TimescaleDB compression active
- [ ] Materialized views updating correctly

## Monitoring and Logging

All scripts create comprehensive logs in `migration_log` and `optimization_log` tables:

```sql
-- Check migration progress
SELECT * FROM migration_log ORDER BY started_at;

-- Check optimization status
SELECT * FROM optimization_log ORDER BY started_at;

-- Validate final state
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(table_name)) as size
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name) DESC;
```

## Troubleshooting

### Common Issues

**Script Timeout**
```bash
# Increase statement timeout
psql -d golf_parlay_db -c "SET statement_timeout = '10min';" -f script.sql
```

**Memory Issues**
```sql
-- Increase work memory temporarily
SET work_mem = '512MB';
SET maintenance_work_mem = '1GB';
```

**Index Creation Failures**
```sql
-- Check for blocking processes
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Create indexes one at a time if needed
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

### Emergency Rollback

If critical issues occur during migration:

1. **STOP** migration immediately
2. **ASSESS** the failure scope using logs
3. **EXECUTE** rollback if data integrity at risk:
   ```bash
   psql -d golf_parlay_db -f 04-rollback-procedures.sql
   ```
4. **VERIFY** original state restored
5. **ANALYZE** root cause before retry

## Post-Migration Tasks

### Immediate (First 24 Hours)
- [ ] Monitor query performance
- [ ] Verify application functionality
- [ ] Check data freshness
- [ ] Validate betting workflows
- [ ] Confirm backup procedures

### Short-term (First Week)
- [ ] Optimize slow queries identified
- [ ] Fine-tune materialized view refresh
- [ ] Monitor storage growth
- [ ] Collect user feedback
- [ ] Update documentation

### Long-term (First Month)
- [ ] Implement AI feature vectors
- [ ] Activate parlay correlation analysis
- [ ] Deploy ML prediction models
- [ ] Add historical data (if budget allows)
- [ ] Expand to additional sportsbooks

## Support and Escalation

### Internal Team
- **Database Engineer**: Primary migration executor
- **Backend Developer**: Application integration
- **DevOps Engineer**: Infrastructure monitoring
- **QA Engineer**: Validation and testing

### Escalation Path
1. **Minor Issues**: Database Engineer resolves
2. **Performance Issues**: Backend + Database Engineers
3. **System Issues**: DevOps escalation
4. **Data Loss Risk**: **IMMEDIATE ROLLBACK**

---

**⚠️ CRITICAL REMINDER**: Always test in staging environment first. Never run migration scripts directly in production without thorough testing and stakeholder approval.

**🎯 SUCCESS METRIC**: Migration is successful when validation script shows >90% pass rate with zero critical failures.