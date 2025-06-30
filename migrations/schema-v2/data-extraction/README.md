# Golf Parlay Picker - Data Extraction and Validation Scripts

This package contains comprehensive data extraction and validation scripts for migrating from the current database schema to the new v2 schema.

## Overview

The migration pipeline consists of three main phases:

1. **Data Extraction**: Extract all data from current database tables
2. **Score Format Analysis**: Analyze score formats to determine actual vs relative-to-par scores
3. **Data Validation**: Validate data quality and assess migration readiness

## Prerequisites

1. Node.js 18+ with ES modules support
2. Access to the Supabase database
3. Environment variables configured (see Configuration section)

## Installation

```bash
# Navigate to the data extraction directory
cd migrations/schema-v2/data-extraction

# Install dependencies
npm install

# Set up environment variables (copy from main project)
cp ../../../.env.local ./.env.local
```

## Configuration

### Environment Variables

Create a `.env.local` file or ensure these variables are available:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# OR
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Migration Settings

Edit `config.js` to adjust migration settings:

- `batchSize`: Number of records to process at once
- `outputDir`: Directory for output files  
- `backupDir`: Directory for backup files
- `dryRun`: Set to true for testing without data changes
- `scoreThresholds`: Thresholds for score format detection
- `parInference`: Course par inference settings

## Usage

### Quick Start - Full Analysis Pipeline

Run the complete analysis pipeline:

```bash
npm run analyze
# OR
node run-full-analysis.js
```

This will:
1. Extract all data from current database
2. Analyze score formats across tournaments
3. Validate data quality and migration readiness
4. Generate comprehensive reports

### Individual Scripts

#### 1. Data Extraction

Extract all data from current database:

```bash
npm run extract
# OR
node extract-all-data.js
```

**Output**: 
- `migration-output/extracted-data.json` - Complete extracted dataset
- `migration-output/tournaments.json` - Tournaments data
- `migration-output/players.json` - Players data
- `migration-output/tournamentResults.json` - Tournament results
- `migration-output/liveStats.json` - Live tournament stats
- `migration-output/seasonStats.json` - Season statistics

#### 2. Score Format Analysis

Analyze score formats across all tournaments:

```bash
node analyze-score-formats.js
```

**Output**:
- `migration-output/score-format-analysis.json` - Detailed format analysis
- Analysis includes:
  - Format detection (actual vs relative scores)
  - Confidence levels for each tournament
  - Course par inference
  - Migration recommendations

#### 3. Data Validation

Validate extracted data quality:

```bash
npm run validate
# OR
node validate-data.js
```

**Output**:
- `migration-output/validation-results.json` - Comprehensive validation results
- Validation includes:
  - Data integrity checks
  - Cross-reference validation
  - Migration readiness assessment
  - Detailed issue reports

## Output Files

### Main Output Directory: `migration-output/`

| File | Description |
|------|-------------|
| `extracted-data.json` | Complete extracted dataset with metadata |
| `score-format-analysis.json` | Score format analysis for all tournaments |
| `validation-results.json` | Data validation results and migration readiness |
| `full-analysis-results.json` | Combined results from full pipeline |
| `migration-readiness-report.md` | Human-readable summary report |

### Individual Data Files

| File | Description |
|------|-------------|
| `tournaments.json` | Tournament data for tournaments_v2 |
| `players.json` | Player data for players_v2 |
| `tournamentResults.json` | Results data for tournament_results_v2 |
| `liveStats.json` | Live stats for player_round_scores_v2 |
| `seasonStats.json` | Season stats for player_advanced_stats_v2 |

### Backup Directory: `migration-backup/`

Timestamped backups of all analysis runs for historical reference.

## Understanding the Results

### Migration Readiness Status

- **✅ READY**: Data quality is sufficient for migration
- **❌ NOT READY**: Critical issues must be resolved first

### Score Format Analysis

- **actual**: Scores stored as actual values (68, 71, 74)
- **relative**: Scores stored relative to par (-2, +1, +2)
- **unknown**: Format could not be determined
- **mixed**: Mixed formats within the same tournament

### Data Quality Issues

- **Critical Issues**: Must be resolved before migration
- **Warnings**: Should be reviewed but don't block migration
- **Cross-reference Issues**: Inconsistencies between tables

## Common Issues and Solutions

### 1. Mixed Score Formats

**Issue**: Some tournaments have both actual and relative scores.

**Solution**: The analysis will identify these tournaments and provide tournament-specific conversion recommendations.

### 2. Missing Player Country Data

**Issue**: Most players are missing country information.

**Solution**: This is a warning, not a blocker. Country data can be enriched later.

### 3. Incomplete Round Scores

**Issue**: Some tournament results have incomplete round score arrays.

**Solution**: The validation will identify these and recommend data cleaning procedures.

### 4. Course Par Inference Failures

**Issue**: Cannot determine course par from score distributions.

**Solution**: The system will use default par values (72) for these courses.

## Advanced Configuration

### Score Detection Thresholds

Adjust in `config.js`:

```javascript
scoreThresholds: {
  minActualScore: 55,    // Minimum expected actual score
  maxActualScore: 100,   // Maximum expected actual score
  minRelativeScore: -20, // Minimum relative to par score
  maxRelativeScore: 25,  // Maximum relative to par score
}
```

### Par Inference Settings

```javascript
parInference: {
  defaultPar: 72,                    // Default par when inference fails
  minPar: 68,                        // Minimum allowed par
  maxPar: 74,                        // Maximum allowed par
  scoreDistributionThreshold: 0.7    // Confidence threshold for inference
}
```

### Validation Rules

```javascript
playerValidation: {
  minNameLength: 2,              // Minimum player name length
  maxNameLength: 50,             // Maximum player name length
  requiredFields: ['dg_id', 'name'] // Required player fields
}
```

## Troubleshooting

### Database Connection Issues

1. Verify Supabase URL and key in environment variables
2. Check network connectivity to Supabase
3. Ensure service role key has sufficient permissions

### Memory Issues with Large Datasets

1. Reduce `batchSize` in config.js
2. Process tables individually instead of full pipeline
3. Increase Node.js memory limit: `node --max-old-space-size=4096`

### Score Format Detection Issues

1. Review score distribution in analysis results
2. Adjust score thresholds in config.js
3. Manually classify problematic tournaments

## Next Steps After Analysis

Once the analysis is complete and migration readiness is confirmed:

1. **Review Results**: Examine the migration readiness report
2. **Resolve Issues**: Address any critical issues identified
3. **Create Migration Scripts**: Build data transformation scripts based on findings
4. **Execute Migration**: Run the actual data migration to v2 schema
5. **Validate Migration**: Verify migrated data in v2 schema

## Support

For issues or questions:

1. Check the logs in `migration-output/migration.log`
2. Review error logs in `migration-output/migration-error.log`
3. Examine the detailed validation results for specific issues
4. Consult the score format analysis for tournament-specific recommendations

The analysis pipeline provides comprehensive insights into data quality and migration requirements, enabling a safe and successful transition to the v2 schema.