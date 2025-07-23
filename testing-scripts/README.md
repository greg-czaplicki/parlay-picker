# Testing Scripts Suite
*Comprehensive Testing Framework for Database Migration*
*Generated: July 23, 2025*

## Overview

This directory contains a complete testing framework for validating the database migration from the current fragmented schema to the new AI-optimized golf parlay analytics schema. The testing suite ensures thorough validation at every level before production deployment.

## Testing Scripts

### 01-unit-tests.sql
**Unit Testing Suite for Individual Migration Components**

- **Purpose**: Tests individual migration scripts and components
- **Execution**: Run after each migration script execution
- **Coverage**: 25+ comprehensive unit tests
- **Duration**: 5-10 minutes

```bash
# Execute unit tests
psql -d golf_parlay_db -f testing-scripts/01-unit-tests.sql

# Check results
psql -d golf_parlay_db -c "SELECT * FROM test_summary;"
```

**Test Categories:**
- Schema creation validation (7 tests)
- Data migration accuracy (7 tests)  
- Validation completeness (3 tests)
- Performance readiness (3 tests)
- Rollback preparedness (2 tests)
- Integration checks (3 tests)

### 02-integration-tests.sh
**End-to-End Integration Testing Suite**

- **Purpose**: Tests complete migration workflow from start to finish
- **Execution**: Automated test environment setup and teardown
- **Coverage**: Full migration process validation
- **Duration**: 30-60 minutes

```bash
# Run complete integration test suite
./testing-scripts/02-integration-tests.sh

# Setup test environment only
./testing-scripts/02-integration-tests.sh --setup-only

# Cleanup test environment
./testing-scripts/02-integration-tests.sh --cleanup
```

**Test Scenarios:**
- Complete migration workflow (4 phases)
- Rollback functionality validation
- Performance benchmarking
- Data integrity verification

### 03-performance-tests.js
**Load Testing and Performance Validation**

- **Purpose**: Tests system performance under realistic load conditions
- **Execution**: Simulates concurrent users and API load
- **Coverage**: API endpoints and database performance
- **Duration**: 5-15 minutes (configurable)

```bash
# Install dependencies
npm install axios pg

# Run performance tests with defaults
node testing-scripts/03-performance-tests.js

# Run with custom configuration
CONCURRENT_USERS=50 TEST_DURATION_SECONDS=600 node testing-scripts/03-performance-tests.js
```

**Test Types:**
- API endpoint load testing
- Database query performance
- Concurrent user simulation
- Response time validation

### 04-production-readiness.sh  
**Final Production Deployment Validation**

- **Purpose**: Comprehensive readiness assessment before production
- **Execution**: Validates all systems and procedures
- **Coverage**: Infrastructure, security, monitoring, documentation
- **Duration**: 10-15 minutes

```bash
# Run complete production readiness assessment
./testing-scripts/04-production-readiness.sh

# Quick critical checks only
./testing-scripts/04-production-readiness.sh --quick

# Generate report from existing data
./testing-scripts/04-production-readiness.sh --report-only
```

**Assessment Areas:**
- Database connectivity and health
- Schema and data validation
- Backup and recovery procedures
- Performance and monitoring
- Security and compliance
- Application integration

## Execution Workflow

### Pre-Migration Testing

```bash
# 1. Unit test individual migration scripts
psql -d staging_db -f migration-scripts/01-create-new-schema.sql
psql -d staging_db -f testing-scripts/01-unit-tests.sql

# 2. Run integration tests in isolated environment  
./testing-scripts/02-integration-tests.sh

# 3. Performance validation
node testing-scripts/03-performance-tests.js

# 4. Final production readiness check
./testing-scripts/04-production-readiness.sh
```

### During Migration

```bash
# Execute unit tests after each migration phase
psql -d golf_parlay_db -f testing-scripts/01-unit-tests.sql

# Check specific test results
psql -d golf_parlay_db -c "
SELECT test_result, status, details 
FROM run_test('TC-SCHEMA-001: New Tables Created', 
              'SELECT COUNT(*) >= 25 FROM information_schema.tables 
               WHERE table_schema = ''public''');
"
```

### Post-Migration Validation

```bash
# Complete validation suite
./testing-scripts/04-production-readiness.sh

# Monitor performance over time
node testing-scripts/03-performance-tests.js
```

## Configuration

### Environment Variables

**Database Connection:**
```bash
export DB_NAME="golf_parlay_db"
export DB_USER="postgres"  
export DB_HOST="localhost"
export DB_PORT="5432"
export DATABASE_URL="postgresql://postgres@localhost:5432/golf_parlay_db"
```

**Performance Testing:**
```bash
export API_BASE_URL="http://localhost:3000/api"
export CONCURRENT_USERS="20"
export TEST_DURATION_SECONDS="300"
export ACCEPTABLE_RESPONSE_TIME_MS="2000"
export ERROR_RATE_THRESHOLD="0.05"
```

**Backup Configuration:**
```bash
export BACKUP_DIR="./backups"
```

### Test Data Requirements

**For Integration Tests:**
- Minimum 5 players in `players_v2`
- Minimum 3 tournaments in `tournaments_v2`  
- Minimum 3 courses in `courses_v2`
- Performance data across multiple tournaments
- Sample betting/odds data

**For Performance Tests:**
- 100+ players for realistic load testing
- 20+ tournaments with full performance data
- Active betting markets with odds history
- Sufficient data volume for meaningful performance metrics

## Success Criteria

### Unit Tests
- **Pass Rate**: ≥95% of all unit tests must pass
- **Critical Failures**: Zero critical test failures allowed
- **Data Preservation**: ≥85% data preservation rate required

### Integration Tests  
- **Migration Time**: Complete migration in <2 hours
- **Rollback Time**: Complete rollback in <30 minutes
- **Data Integrity**: 100% data integrity validation
- **Performance**: Query times within acceptable limits

### Performance Tests
- **Error Rate**: <5% error rate under load
- **Response Time**: 95th percentile <2 seconds
- **Throughput**: ≥10 requests/second sustained
- **Database Performance**: Core queries <500ms

### Production Readiness
- **Overall Score**: ≥90% overall readiness score
- **Critical Checks**: 100% of critical checks must pass
- **Security**: All security validations passed
- **Monitoring**: Monitoring and alerting functional

## Troubleshooting

### Common Issues

**Unit Test Failures:**
```bash
# Check test framework setup
psql -d golf_parlay_db -c "\df run_test"

# Review specific test failure
psql -d golf_parlay_db -c "
SELECT * FROM run_test('failing_test_name', 'SELECT true;');
"
```

**Integration Test Failures:**
```bash
# Check test database connectivity
psql -h localhost -p 5432 -U postgres -d golf_parlay_db_test -c "SELECT 1;"

# Review detailed logs
tail -f testing-scripts/integration_test_*.log
```

**Performance Test Issues:**
```bash
# Check API accessibility
curl -f http://localhost:3000/api/health

# Verify database connections
psql -c "SELECT COUNT(*) FROM pg_stat_activity;"
```

**Production Readiness Failures:**
```bash
# Review detailed assessment  
./testing-scripts/04-production-readiness.sh --quick

# Check specific component
psql -c "SELECT version();" # Database version
psql -c "SHOW max_connections;" # Connection limits
```

### Performance Tuning

**If Queries Are Slow:**
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;

-- Update table statistics
ANALYZE;

-- Check for missing indexes
SELECT * FROM pg_stat_user_tables WHERE n_live_tup > 1000 AND idx_tup_fetch = 0;
```

**If Load Tests Fail:**
```bash
# Increase database connections
psql -c "ALTER SYSTEM SET max_connections = 200;"
psql -c "SELECT pg_reload_conf();"

# Check system resources
top
iostat -x 1
```

## Logging and Reporting

All testing scripts generate comprehensive logs:

**Log Locations:**
- Unit tests: Database `test_summary` view
- Integration tests: `testing-scripts/integration_test_*.log`
- Performance tests: `testing-scripts/performance_test_*.log`  
- Production readiness: `testing-scripts/production_readiness_*.log`

**Report Generation:**
```bash
# Generate comprehensive test report
./testing-scripts/04-production-readiness.sh --report-only

# View test summaries
psql -d golf_parlay_db -c "SELECT * FROM test_summary;"
```

## Automation Integration

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Database Migration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v2
    - name: Run Unit Tests
      run: psql -f testing-scripts/01-unit-tests.sql
    - name: Run Integration Tests  
      run: ./testing-scripts/02-integration-tests.sh
    - name: Performance Validation
      run: node testing-scripts/03-performance-tests.js
```

### Monitoring Integration

```bash
# Set up automated testing schedule
crontab -e

# Add daily performance tests
0 2 * * * cd /path/to/project && node testing-scripts/03-performance-tests.js

# Add weekly production readiness checks
0 6 * * 0 cd /path/to/project && ./testing-scripts/04-production-readiness.sh --quick
```

## Support and Maintenance

### Regular Maintenance

**Weekly:**
- Run performance tests to establish baselines
- Review production readiness scores
- Update test data as needed

**Monthly:**  
- Full integration test execution
- Performance benchmark updates
- Test script maintenance and updates

**Before Major Changes:**
- Complete test suite execution
- Performance impact assessment
- Production readiness validation

### Team Training

**Database Team:**
- Unit test execution and interpretation
- Integration test troubleshooting
- Performance benchmark analysis

**Development Team:**
- API performance test integration
- Application-level test coverage
- Test data management

**Operations Team:**
- Production readiness assessment
- Monitoring and alerting validation
- Emergency response procedures

---

**🎯 Success Metric**: All testing phases pass with ≥95% success rate, indicating the system is ready for safe production deployment with minimal risk of data loss or performance degradation.