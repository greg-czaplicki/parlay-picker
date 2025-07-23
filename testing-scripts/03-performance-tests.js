// =============================================
// PERFORMANCE TESTING SUITE
// =============================================
// Load testing and performance validation for migrated database
// Tests API endpoints and database performance under load
// Generated: July 23, 2025

const axios = require('axios');
const fs = require('fs');
const { performance } = require('perf_hooks');

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000/api',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/golf_parlay_db',
    CONCURRENT_USERS: parseInt(process.env.CONCURRENT_USERS) || 20,
    TEST_DURATION_SECONDS: parseInt(process.env.TEST_DURATION_SECONDS) || 300, // 5 minutes
    ACCEPTABLE_RESPONSE_TIME_MS: parseInt(process.env.ACCEPTABLE_RESPONSE_TIME_MS) || 2000,
    ERROR_RATE_THRESHOLD: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 0.05, // 5%
    LOG_FILE: `./performance_test_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`
};

// =============================================
// LOGGING AND UTILITIES
// =============================================

class Logger {
    constructor(logFile) {
        this.logFile = logFile;
        this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level}: ${message}\n`;
        console.log(`${level}: ${message}`);
        this.logStream.write(logMessage);
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    warn(message) {
        this.log(message, 'WARN');
    }

    success(message) {
        this.log(message, 'SUCCESS');
    }

    close() {
        this.logStream.end();
    }
}

const logger = new Logger(CONFIG.LOG_FILE);

// =============================================
// PERFORMANCE METRICS COLLECTOR
// =============================================

class MetricsCollector {
    constructor() {
        this.requests = [];
        this.errors = [];
        this.startTime = null;
        this.endTime = null;
    }

    startTest() {
        this.startTime = performance.now();
        logger.log('Performance test started');
    }

    endTest() {
        this.endTime = performance.now();
        logger.log('Performance test completed');
    }

    recordRequest(endpoint, responseTime, statusCode, error = null) {
        this.requests.push({
            endpoint,
            responseTime,
            statusCode,
            timestamp: performance.now(),
            error
        });

        if (error || statusCode >= 400) {
            this.errors.push({
                endpoint,
                statusCode,
                error: error?.message || `HTTP ${statusCode}`,
                timestamp: performance.now()
            });
        }
    }

    getStatistics() {
        if (this.requests.length === 0) {
            return null;
        }

        const responseTimes = this.requests.map(r => r.responseTime);
        const totalDuration = (this.endTime - this.startTime) / 1000; // seconds

        // Calculate percentiles
        const sortedTimes = responseTimes.sort((a, b) => a - b);
        const getPercentile = (p) => {
            const index = Math.ceil((p / 100) * sortedTimes.length) - 1;
            return sortedTimes[index];
        };

        return {
            totalRequests: this.requests.length,
            totalErrors: this.errors.length,
            errorRate: this.errors.length / this.requests.length,
            averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
            minResponseTime: Math.min(...responseTimes),
            maxResponseTime: Math.max(...responseTimes),
            p50ResponseTime: getPercentile(50),
            p95ResponseTime: getPercentile(95),
            p99ResponseTime: getPercentile(99),
            requestsPerSecond: this.requests.length / totalDuration,
            testDuration: totalDuration
        };
    }

    generateReport() {
        const stats = this.getStatistics();
        if (!stats) {
            logger.error('No performance data to report');
            return;
        }

        logger.log('========================================');
        logger.log('PERFORMANCE TEST REPORT');
        logger.log('========================================');
        logger.log(`Test Duration: ${stats.testDuration.toFixed(2)} seconds`);
        logger.log(`Total Requests: ${stats.totalRequests}`);
        logger.log(`Total Errors: ${stats.totalErrors}`);
        logger.log(`Error Rate: ${(stats.errorRate * 100).toFixed(2)}%`);
        logger.log(`Requests per Second: ${stats.requestsPerSecond.toFixed(2)}`);
        logger.log('');
        logger.log('Response Time Statistics:');
        logger.log(`  Average: ${stats.averageResponseTime.toFixed(2)}ms`);
        logger.log(`  Min: ${stats.minResponseTime.toFixed(2)}ms`);
        logger.log(`  Max: ${stats.maxResponseTime.toFixed(2)}ms`);
        logger.log(`  50th percentile: ${stats.p50ResponseTime.toFixed(2)}ms`);
        logger.log(`  95th percentile: ${stats.p95ResponseTime.toFixed(2)}ms`);
        logger.log(`  99th percentile: ${stats.p99ResponseTime.toFixed(2)}ms`);
        logger.log('');

        // Performance assessment
        const passedCriteria = [];
        const failedCriteria = [];

        if (stats.errorRate <= CONFIG.ERROR_RATE_THRESHOLD) {
            passedCriteria.push(`✅ Error rate (${(stats.errorRate * 100).toFixed(2)}%) within threshold`);
        } else {
            failedCriteria.push(`❌ Error rate (${(stats.errorRate * 100).toFixed(2)}%) exceeds threshold (${(CONFIG.ERROR_RATE_THRESHOLD * 100)}%)`);
        }

        if (stats.p95ResponseTime <= CONFIG.ACCEPTABLE_RESPONSE_TIME_MS) {
            passedCriteria.push(`✅ 95th percentile response time (${stats.p95ResponseTime.toFixed(2)}ms) acceptable`);
        } else {
            failedCriteria.push(`❌ 95th percentile response time (${stats.p95ResponseTime.toFixed(2)}ms) exceeds threshold (${CONFIG.ACCEPTABLE_RESPONSE_TIME_MS}ms)`);
        }

        if (stats.requestsPerSecond >= 10) {
            passedCriteria.push(`✅ Throughput (${stats.requestsPerSecond.toFixed(2)} req/s) acceptable`);
        } else {
            failedCriteria.push(`❌ Throughput (${stats.requestsPerSecond.toFixed(2)} req/s) below acceptable level`);
        }

        logger.log('Performance Assessment:');
        passedCriteria.forEach(criteria => logger.log(criteria));
        failedCriteria.forEach(criteria => logger.log(criteria));

        if (failedCriteria.length === 0) {
            logger.success('🎉 ALL PERFORMANCE CRITERIA PASSED!');
            return true;
        } else {
            logger.error('❌ SOME PERFORMANCE CRITERIA FAILED!');
            return false;
        }
    }
}

// =============================================
// API TEST SCENARIOS
// =============================================

class APITestScenarios {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.axiosInstance = axios.create({
            baseURL: baseUrl,
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'Performance-Test-Suite/1.0'
            }
        });
    }

    async testHealthEndpoint() {
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get('/health');
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testPlayersEndpoint() {
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get('/players?limit=50');
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testPlayerDetailsEndpoint() {
        const playerId = Math.floor(Math.random() * 1000) + 1; // Random player ID
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get(`/players/${playerId}`);
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testTournamentsEndpoint() {
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get('/tournaments?limit=20');
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testTournamentDetailsEndpoint() {
        const tournamentId = Math.floor(Math.random() * 100) + 1; // Random tournament ID
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get(`/tournaments/${tournamentId}`);
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testBettingMarketsEndpoint() {
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get('/betting-markets?limit=100');
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testOddsEndpoint() {
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get('/odds/current?limit=50');
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    async testSearchEndpoint() {
        const searchTerms = ['tiger', 'masters', 'pga', 'golf', 'tournament'];
        const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        const start = performance.now();
        try {
            const response = await this.axiosInstance.get(`/search?q=${searchTerm}&limit=20`);
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: response.status };
        } catch (error) {
            const responseTime = performance.now() - start;
            return { responseTime, statusCode: error.response?.status || 0, error };
        }
    }

    // Weighted random selection of test scenarios
    async runRandomScenario() {
        const scenarios = [
            { name: 'health', weight: 5, fn: () => this.testHealthEndpoint() },
            { name: 'players', weight: 20, fn: () => this.testPlayersEndpoint() },
            { name: 'player-details', weight: 15, fn: () => this.testPlayerDetailsEndpoint() },
            { name: 'tournaments', weight: 20, fn: () => this.testTournamentsEndpoint() },
            { name: 'tournament-details', weight: 15, fn: () => this.testTournamentDetailsEndpoint() },
            { name: 'betting-markets', weight: 10, fn: () => this.testBettingMarketsEndpoint() },
            { name: 'odds', weight: 10, fn: () => this.testOddsEndpoint() },
            { name: 'search', weight: 5, fn: () => this.testSearchEndpoint() }
        ];

        // Weighted random selection
        const totalWeight = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const scenario of scenarios) {
            random -= scenario.weight;
            if (random <= 0) {
                const result = await scenario.fn();
                return { ...result, endpoint: scenario.name };
            }
        }

        // Fallback to health check
        const result = await this.testHealthEndpoint();
        return { ...result, endpoint: 'health' };
    }
}

// =============================================
// LOAD TEST RUNNER
// =============================================

class LoadTestRunner {
    constructor(scenarios, metrics) {
        this.scenarios = scenarios;
        this.metrics = metrics;
        this.isRunning = false;
        this.userPromises = [];
    }

    async simulateUser(userId, durationMs) {
        const endTime = Date.now() + durationMs;
        let requestCount = 0;

        logger.log(`User ${userId} started simulation`);

        while (Date.now() < endTime && this.isRunning) {
            try {
                const result = await this.scenarios.runRandomScenario();
                this.metrics.recordRequest(result.endpoint, result.responseTime, result.statusCode, result.error);
                requestCount++;

                // Random delay between requests (100ms to 1000ms to simulate human behavior)
                const delay = Math.random() * 900 + 100;
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error) {
                logger.error(`User ${userId} encountered error: ${error.message}`);
                this.metrics.recordRequest('unknown', 0, 0, error);
            }
        }

        logger.log(`User ${userId} completed ${requestCount} requests`);
        return requestCount;
    }

    async runLoadTest(concurrentUsers, durationSeconds) {
        logger.log(`Starting load test with ${concurrentUsers} concurrent users for ${durationSeconds} seconds`);
        
        this.isRunning = true;
        this.metrics.startTest();

        // Start all virtual users
        this.userPromises = [];
        for (let i = 1; i <= concurrentUsers; i++) {
            const userPromise = this.simulateUser(i, durationSeconds * 1000);
            this.userPromises.push(userPromise);
        }

        // Wait for all users to complete
        try {
            const userResults = await Promise.all(this.userPromises);
            const totalUserRequests = userResults.reduce((sum, count) => sum + count, 0);
            logger.log(`All users completed. Total user requests: ${totalUserRequests}`);
        } catch (error) {
            logger.error(`Load test error: ${error.message}`);
        }

        this.isRunning = false;
        this.metrics.endTest();
    }

    stop() {
        logger.log('Stopping load test...');
        this.isRunning = false;
    }
}

// =============================================
// DATABASE PERFORMANCE TESTS
// =============================================

const { Client } = require('pg');

class DatabasePerformanceTests {
    constructor(databaseUrl) {
        this.databaseUrl = databaseUrl;
    }

    async runDatabaseTests() {
        logger.log('Running database performance tests...');
        
        const client = new Client({ connectionString: this.databaseUrl });
        
        try {
            await client.connect();
            logger.log('Connected to database for performance testing');

            // Test 1: Simple player lookup
            await this.testPlayerLookup(client);
            
            // Test 2: Tournament leaderboard query
            await this.testTournamentLeaderboard(client);
            
            // Test 3: Betting odds aggregation
            await this.testBettingOddsAggregation(client);
            
            // Test 4: Complex analytical query
            await this.testComplexAnalyticalQuery(client);

        } catch (error) {
            logger.error(`Database test error: ${error.message}`);
        } finally {
            await client.end();
        }
    }

    async testPlayerLookup(client) {
        logger.log('Testing player lookup performance...');
        
        const query = `
            SELECT p.*, 
                   COUNT(ptp.id) as tournament_count,
                   AVG(ptp.total_score) as avg_score
            FROM players p
            LEFT JOIN player_tournament_performance ptp ON p.id = ptp.player_id
            WHERE p.name ILIKE $1
            GROUP BY p.id
            ORDER BY tournament_count DESC
            LIMIT 10;
        `;

        const testNames = ['Tiger%', 'Rory%', 'Jon%', 'Justin%', 'Scottie%'];
        let totalTime = 0;
        let queryCount = 0;

        for (const name of testNames) {
            const start = performance.now();
            await client.query(query, [name]);
            const responseTime = performance.now() - start;
            totalTime += responseTime;
            queryCount++;
            
            logger.log(`Player lookup for "${name}": ${responseTime.toFixed(2)}ms`);
        }

        const avgTime = totalTime / queryCount;
        logger.log(`Average player lookup time: ${avgTime.toFixed(2)}ms`);
        
        if (avgTime < 100) {
            logger.success('✅ Player lookup performance: EXCELLENT');
        } else if (avgTime < 500) {
            logger.log('✅ Player lookup performance: ACCEPTABLE');
        } else {
            logger.warn('⚠️ Player lookup performance: NEEDS OPTIMIZATION');
        }
    }

    async testTournamentLeaderboard(client) {
        logger.log('Testing tournament leaderboard performance...');
        
        const query = `
            SELECT 
                p.name,
                ptp.total_score,
                ptp.position,
                ptp.prize_money,
                t.name as tournament_name
            FROM player_tournament_performance ptp
            JOIN players p ON ptp.player_id = p.id
            JOIN tournaments t ON ptp.tournament_id = t.id
            WHERE t.year = 2024
            AND ptp.position IS NOT NULL
            ORDER BY t.start_date DESC, ptp.position ASC
            LIMIT 100;
        `;

        const start = performance.now();
        const result = await client.query(query);
        const responseTime = performance.now() - start;
        
        logger.log(`Tournament leaderboard query: ${responseTime.toFixed(2)}ms (${result.rows.length} rows)`);
        
        if (responseTime < 200) {
            logger.success('✅ Tournament leaderboard performance: EXCELLENT');
        } else if (responseTime < 1000) {
            logger.log('✅ Tournament leaderboard performance: ACCEPTABLE');
        } else {
            logger.warn('⚠️ Tournament leaderboard performance: NEEDS OPTIMIZATION');
        }
    }

    async testBettingOddsAggregation(client) {
        logger.log('Testing betting odds aggregation performance...');
        
        const query = `
            SELECT 
                bm.market_type,
                p.name as player_name,
                t.name as tournament_name,
                COUNT(oh.id) as odds_updates,
                AVG(oh.odds_decimal) as avg_odds,
                MIN(oh.odds_decimal) as min_odds,
                MAX(oh.odds_decimal) as max_odds
            FROM betting_markets bm
            JOIN players p ON bm.player_id = p.id
            LEFT JOIN tournaments t ON bm.tournament_id = t.id
            LEFT JOIN odds_history oh ON bm.id = oh.market_id
            WHERE oh.recorded_at >= NOW() - INTERVAL '30 days'
            GROUP BY bm.id, bm.market_type, p.name, t.name
            HAVING COUNT(oh.id) > 0
            ORDER BY odds_updates DESC
            LIMIT 50;
        `;

        const start = performance.now();
        const result = await client.query(query);
        const responseTime = performance.now() - start;
        
        logger.log(`Betting odds aggregation: ${responseTime.toFixed(2)}ms (${result.rows.length} rows)`);
        
        if (responseTime < 500) {
            logger.success('✅ Betting odds aggregation performance: EXCELLENT');
        } else if (responseTime < 2000) {
            logger.log('✅ Betting odds aggregation performance: ACCEPTABLE');
        } else {
            logger.warn('⚠️ Betting odds aggregation performance: NEEDS OPTIMIZATION');
        }
    }

    async testComplexAnalyticalQuery(client) {
        logger.log('Testing complex analytical query performance...');
        
        const query = `
            WITH player_stats AS (
                SELECT 
                    p.id,
                    p.name,
                    COUNT(ptp.id) as tournaments_played,
                    AVG(ptp.total_score) as avg_score,
                    AVG(ptp.position::numeric) as avg_position,
                    SUM(ptp.prize_money) as total_earnings
                FROM players p
                JOIN player_tournament_performance ptp ON p.id = ptp.player_id
                JOIN tournaments t ON ptp.tournament_id = t.id
                WHERE t.year >= 2023
                GROUP BY p.id, p.name
                HAVING COUNT(ptp.id) >= 5
            ),
            betting_stats AS (
                SELECT 
                    bm.player_id,
                    COUNT(DISTINCT bm.id) as markets_available,
                    AVG(oh.odds_decimal) as avg_odds
                FROM betting_markets bm
                LEFT JOIN odds_history oh ON bm.id = oh.market_id
                WHERE oh.recorded_at >= NOW() - INTERVAL '90 days'
                GROUP BY bm.player_id
            )
            SELECT 
                ps.name,
                ps.tournaments_played,
                ps.avg_score,
                ps.avg_position,
                ps.total_earnings,
                bs.markets_available,
                bs.avg_odds,
                CASE 
                    WHEN ps.avg_position <= 10 AND ps.total_earnings > 1000000 THEN 'Elite'
                    WHEN ps.avg_position <= 25 AND ps.total_earnings > 500000 THEN 'Strong'
                    WHEN ps.avg_position <= 50 THEN 'Average'
                    ELSE 'Developing'
                END as player_tier
            FROM player_stats ps
            LEFT JOIN betting_stats bs ON ps.id = bs.player_id
            ORDER BY ps.total_earnings DESC
            LIMIT 25;
        `;

        const start = performance.now();
        const result = await client.query(query);
        const responseTime = performance.now() - start;
        
        logger.log(`Complex analytical query: ${responseTime.toFixed(2)}ms (${result.rows.length} rows)`);
        
        if (responseTime < 1000) {
            logger.success('✅ Complex analytical query performance: EXCELLENT');
        } else if (responseTime < 5000) {
            logger.log('✅ Complex analytical query performance: ACCEPTABLE');
        } else {
            logger.warn('⚠️ Complex analytical query performance: NEEDS OPTIMIZATION');
        }
    }
}

// =============================================
// MAIN TEST EXECUTION
// =============================================

async function runPerformanceTests() {
    logger.log('========================================');
    logger.log('STARTING PERFORMANCE TEST SUITE');
    logger.log('========================================');
    logger.log(`API Base URL: ${CONFIG.API_BASE_URL}`);
    logger.log(`Concurrent Users: ${CONFIG.CONCURRENT_USERS}`);
    logger.log(`Test Duration: ${CONFIG.TEST_DURATION_SECONDS} seconds`);
    logger.log(`Log File: ${CONFIG.LOG_FILE}`);
    logger.log('');

    try {
        // Initialize components
        const metrics = new MetricsCollector();
        const scenarios = new APITestScenarios(CONFIG.API_BASE_URL);
        const loadTestRunner = new LoadTestRunner(scenarios, metrics);
        const dbTests = new DatabasePerformanceTests(CONFIG.DATABASE_URL);

        // Test 1: API Health Check
        logger.log('Performing initial API health check...');
        const healthResult = await scenarios.testHealthEndpoint();
        if (healthResult.statusCode !== 200) {
            throw new Error(`API health check failed: ${healthResult.statusCode}`);
        }
        logger.success('✅ API is accessible and responding');

        // Test 2: Database Performance Tests
        await dbTests.runDatabaseTests();

        // Test 3: Load Testing
        logger.log('Starting load test...');
        await loadTestRunner.runLoadTest(CONFIG.CONCURRENT_USERS, CONFIG.TEST_DURATION_SECONDS);

        // Generate final report
        const testPassed = metrics.generateReport();

        logger.log('========================================');
        if (testPassed) {
            logger.success('🎉 PERFORMANCE TESTS COMPLETED SUCCESSFULLY!');
            logger.log('System is ready for production load.');
            process.exit(0);
        } else {
            logger.error('❌ PERFORMANCE TESTS FAILED!');
            logger.log('System requires optimization before production deployment.');
            process.exit(1);
        }

    } catch (error) {
        logger.error(`Performance test suite failed: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    } finally {
        logger.close();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.log('Received SIGINT, shutting down gracefully...');
    logger.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.log('Received SIGTERM, shutting down gracefully...');
    logger.close();
    process.exit(0);
});

// =============================================
// SCRIPT ENTRY POINT
// =============================================

if (require.main === module) {
    runPerformanceTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    MetricsCollector,
    APITestScenarios,
    LoadTestRunner,
    DatabasePerformanceTests,
    CONFIG
};