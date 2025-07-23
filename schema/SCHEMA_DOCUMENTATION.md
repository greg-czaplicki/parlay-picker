# AI-Optimized Golf Parlay Analytics Database Schema

*Version 1.0 - July 23, 2025*

## Overview

This database schema is designed from the ground up for **AI-powered golf analytics and parlay betting optimization**. It provides a comprehensive, DataGolf-style system optimized for machine learning, LLM integration, and sophisticated betting analysis.

### Key Design Principles

- **AI-First Architecture**: Built for machine learning and LLM integration
- **Parlay Optimization**: Specialized for correlation analysis and betting edges
- **Time-Series Optimized**: Uses TimescaleDB for efficient historical analysis
- **Real-Time Analytics**: Materialized views for sub-second query performance  
- **Scalable Design**: Handles millions of shots, thousands of tournaments
- **Data Quality Focus**: Built-in validation and quality scoring

## Schema Structure

The schema is organized into **6 core phases**:

```
01_core_entities.sql       → Players, Courses, Tournaments, Rounds
02_betting_markets.sql     → Sportsbooks, Markets, Odds, Parlays
03_ai_ml_tables.sql        → Correlations, ML Models, Predictions
04_shot_level_data.sql     → Individual Shot Tracking & Analysis
05_llm_integration.sql     → AI Content, Narratives, Knowledge Base
06_optimization_structures.sql → Materialized Views, Indexes, Performance
```

---

## 📊 Phase 1: Core Entities

### Core Tables

#### `players` - Enhanced Player Profiles
- **Purpose**: AI-optimized player information with embeddings
- **Key Features**: Style embeddings, performance embeddings, playing characteristics
- **AI Integration**: Vector similarity search for player matching
- **Records**: ~600 active players

```sql
-- Example: Find similar players using embeddings
SELECT p2.name, p1.style_embedding <=> p2.style_embedding as similarity
FROM players p1, players p2 
WHERE p1.name = 'Tiger Woods' AND p1.id != p2.id
ORDER BY similarity LIMIT 5;
```

#### `courses` - Comprehensive Course Analysis
- **Purpose**: Detailed course characteristics for player-course fit analysis
- **Key Features**: Course DNA, hole details, weather patterns
- **AI Integration**: Course embeddings for similarity matching
- **Records**: ~50 major tournament courses

#### `tournaments` - Tournament Metadata & Context
- **Purpose**: Tournament information with field strength and conditions
- **Key Features**: Field quality metrics, weather analysis, tournament embeddings
- **Time-Series**: Hypertable for efficient historical queries

#### `tournament_rounds` - Individual Round Performance
- **Purpose**: Round-by-round performance with comprehensive stats
- **Key Features**: Strokes Gained breakdown, momentum scoring, AI narratives
- **Scale**: Time-series optimized for millions of rounds
- **Real-Time**: Updated during active tournaments

---

## 🎰 Phase 2: Betting Markets

### Betting Infrastructure

#### `sportsbooks` - Multi-Sportsbook Support
- **Purpose**: Track multiple betting providers and their characteristics
- **Features**: API integration, liquidity ratings, margin analysis

#### `betting_markets` - Available Markets
- **Purpose**: Define all available betting markets per tournament
- **Market Types**: Outright winner, top-5/10/20, make cut, head-to-head, three-ball
- **Real-Time**: Market status tracking and settlement

#### `odds_history` - Time-Series Odds Tracking
- **Purpose**: Historical odds for line movement analysis
- **Scale**: TimescaleDB hypertable, millions of odds points
- **Features**: Sharp money detection, steam moves, reverse line movement

#### `parlay_combinations` - Parlay Bet Tracking
- **Purpose**: Track parlay bets with AI analysis
- **Features**: Correlation penalties, EV calculations, AI embeddings
- **Risk Analysis**: Kelly criterion, variance calculations

### Market Analysis

#### `edge_detection` - Real-Time Value Detection
- **Purpose**: Identify betting edges in real-time
- **Features**: Model vs market probability, Kelly recommendations
- **Scale**: TimescaleDB for high-frequency edge detection
- **Alerts**: Automated edge detection with threshold alerts

---

## 🤖 Phase 3: AI/ML Tables

### Correlation Analysis

#### `player_correlations` - Player Performance Correlations
- **Purpose**: Track correlations between player performances for parlay optimization
- **Features**: Multiple correlation types, confidence intervals, parlay suitability scores
- **Use Case**: Build anti-correlated parlays for better risk/reward

#### `market_correlations` - Market Relationship Analysis
- **Purpose**: Understand correlations between different betting markets
- **Features**: Diversification benefits, hedge strategies, risk multipliers

### Machine Learning Infrastructure

#### `ml_feature_vectors` - Pre-Computed Features
- **Purpose**: Store feature vectors for ML models
- **Features**: 256-dimensional vectors, feature importance, data completeness
- **Scale**: TimescaleDB hypertable for efficient time-based queries

#### `ml_models` - Model Registry
- **Purpose**: Track different prediction models and their performance
- **Features**: Hyperparameters, performance metrics, business metrics (ROI, Sharpe ratio)
- **Model Types**: Cut prediction, finish position, head-to-head, parlay optimization

#### `ml_predictions` - Model Output Storage
- **Purpose**: Store and evaluate model predictions
- **Features**: Feature attribution (SHAP values), confidence intervals, betting performance
- **Evaluation**: Automated accuracy tracking and model comparison

### Parlay Optimization

#### `optimal_parlay_combinations` - AI-Generated Parlays
- **Purpose**: Store AI-optimized parlay suggestions
- **Features**: Expected value, correlation analysis, risk metrics (VaR, CVaR)
- **Optimization**: Genetic algorithms, Kelly criterion, independence scoring

#### `player_similarity_matrix` - Player Style Matching
- **Purpose**: Find similar players for modeling and analysis
- **Features**: Multi-dimensional similarity (style, performance, demographics)
- **Applications**: Transfer learning, injury replacements, rookie projections

---

## 🎯 Phase 4: Shot-Level Data

### Granular Shot Tracking

#### `shot_tracking` - Individual Shot Analysis
- **Purpose**: Store every shot with spatial coordinates and context
- **Features**: GPS coordinates, club selection, environmental factors
- **Scale**: Millions of shots with TimescaleDB optimization
- **Analytics**: Strokes gained per shot, trajectory analysis

#### `hole_statistics` - Hole-Level Aggregation
- **Purpose**: Aggregated performance per hole
- **Features**: Comprehensive hole analysis, pin positions, weather impact
- **Use Cases**: Course management analysis, hole difficulty ranking

#### `course_hole_details` - Static Hole Information
- **Purpose**: Course design and characteristics per hole
- **Features**: Hazard locations, strategic elements, historical performance

### Pattern Recognition

#### `shot_patterns` - Player Behavioral Analysis
- **Purpose**: Identify patterns in player shot selection and execution
- **Features**: Pattern strength, situational context, betting implications
- **AI Integration**: Behavioral insights for market inefficiencies

#### `shot_clusters` - Shot Similarity Analysis
- **Purpose**: Group similar shots for pattern recognition
- **Features**: K-means clustering, success factors, strategic insights

---

## 🧠 Phase 5: LLM Integration

### AI Content Generation

#### `player_narratives` - AI-Generated Player Stories
- **Purpose**: Generate player insights and betting analysis
- **Features**: Multiple narrative types, betting implications, engagement tracking
- **AI Models**: Claude-3.5, GPT-4, custom fine-tuned models

#### `tournament_insights` - Tournament Analysis
- **Purpose**: AI-generated tournament previews and analysis
- **Features**: Predictions, market analysis, parlay recommendations
- **Distribution**: Web, email, API, social media optimization

#### `ai_conversations` - Chat Interaction Storage
- **Purpose**: Store AI chat interactions for learning and improvement
- **Features**: Context tracking, quality metrics, user feedback
- **Learning**: Training data generation, model improvement

### Knowledge Management

#### `knowledge_base` - Structured Golf Knowledge
- **Purpose**: Store golf knowledge for AI context and retrieval
- **Features**: Semantic embeddings, concept relationships, practical applications
- **Retrieval**: Vector similarity search for relevant context

#### `ai_prompt_templates` - Reusable AI Prompts
- **Purpose**: Standardized prompts for consistent AI interactions
- **Features**: Template versioning, A/B testing, performance tracking
- **Quality**: Validation rules, post-processing, fallback handling

#### `semantic_search_index` - AI Content Retrieval
- **Purpose**: Enable semantic search across all content
- **Features**: Multi-dimensional embeddings, relevance scoring
- **Performance**: Optimized vector indexes for fast retrieval

---

## ⚡ Phase 6: Optimization Structures

### Real-Time Analytics Views

#### `player_performance_dashboard` - Live Player Stats
- **Refresh**: Every 30 minutes (5 minutes during tournaments)
- **Purpose**: Real-time player performance metrics
- **Features**: Recent form, season stats, momentum indicators, betting edges

#### `tournament_betting_opportunities` - Live Betting Dashboard
- **Refresh**: Every 10 minutes during active tournaments
- **Purpose**: Current tournament betting opportunities
- **Features**: Market analysis, parlay opportunities, AI insights

#### `live_tournament_leaderboard` - Real-Time Standings
- **Refresh**: Every 5 minutes during active tournaments
- **Purpose**: Live tournament leaderboards with betting context
- **Features**: Position changes, cut analysis, odds movement

#### `player_course_fit_analysis` - Historical Course Performance
- **Refresh**: Every 4 hours
- **Purpose**: Player-course fit analysis for predictions
- **Features**: Historical performance, course advantages, betting value

### Performance Optimization

#### Smart Refresh System
- **Conditional Refreshing**: Only refresh during active tournaments
- **Priority-Based**: Critical views refresh first
- **Resource Management**: Automatic resource allocation

#### Index Strategy
- **Vector Indexes**: IVFFlat indexes for embedding similarity
- **Time-Series Indexes**: Optimized for TimescaleDB queries
- **Composite Indexes**: Multi-column indexes for common query patterns

---

## 🔄 Data Flow Architecture

### Real-Time Data Pipeline

```
External APIs → Raw Data Ingestion → Validation & Enrichment → Core Tables
                                                                     ↓
AI Processing ← Feature Engineering ← Data Transformation ← Materialized Views
     ↓
Insights Generation → Content Creation → User Interfaces → Betting Decisions
```

### Key Data Sources

1. **Tournament Data**: DataGolf API, PGA Tour API
2. **Odds Data**: Multiple sportsbook APIs
3. **Weather Data**: Weather service APIs
4. **Shot Data**: ShotLink, TrackMan integration
5. **AI Models**: Claude, GPT-4, custom models

---

## 📈 Performance Characteristics

### Query Performance Targets

- **Player Lookup**: < 1ms (indexed primary keys)
- **Tournament Leaderboard**: < 50ms (materialized views)
- **Correlation Analysis**: < 500ms (pre-computed matrices)
- **ML Feature Retrieval**: < 100ms (TimescaleDB optimization)
- **Semantic Search**: < 200ms (vector indexes)

### Scalability Metrics

- **Tournament Rounds**: 10M+ records (growing by ~50K monthly)
- **Shot Tracking**: 100M+ shots (growing by ~2M monthly)
- **Odds History**: 50M+ odds points (growing by ~500K daily during tournaments)
- **AI Conversations**: Unlimited (auto-archived after 1 year)

---

## 🔧 Usage Examples

### Finding Parlay Opportunities

```sql
-- Find optimal 3-leg parlay with low correlation
SELECT 
    opc.selected_players,
    opc.selected_markets,
    opc.expected_value,
    opc.independence_score,
    opc.combined_odds
FROM optimal_parlay_combinations opc
WHERE opc.status = 'generated'
AND ARRAY_LENGTH(opc.selected_players, 1) = 3
AND opc.independence_score > 0.8
AND opc.expected_value > 0.15
ORDER BY opc.expected_value DESC
LIMIT 10;
```

### Player Course Fit Analysis

```sql
-- Find players with best course fit for upcoming tournament
SELECT 
    pcfa.player_name,
    pcfa.avg_finish_position,
    pcfa.overall_fit_score,
    pcfa.recent_avg_finish,
    pcfa.data_confidence_level
FROM player_course_fit_analysis pcfa
JOIN tournaments t ON pcfa.course_id = t.course_id
WHERE t.name = 'The Open Championship'
AND t.start_date > NOW()
AND pcfa.data_confidence_level IN ('high', 'medium')
ORDER BY pcfa.overall_fit_score DESC
LIMIT 20;
```

### Real-Time Edge Detection

```sql
-- Find current betting edges above 10%
SELECT 
    p.name as player_name,
    bm.market_type,
    ed.model_probability,
    ed.market_probability,
    ed.edge_percentage,
    ed.kelly_fraction,
    ed.recommended_stake
FROM edge_detection ed
JOIN players p ON ed.player_id = p.id
JOIN betting_markets bm ON ed.market_id = bm.id
WHERE ed.detected_at > NOW() - INTERVAL '1 hour'
AND ed.edge_percentage > 10
AND ed.alert_triggered = true
ORDER BY ed.edge_percentage DESC;
```

### AI-Generated Insights

```sql
-- Get latest tournament insights with betting implications
SELECT 
    ti.headline,
    ti.executive_summary,
    ti.betting_market_insights,
    ti.parlay_recommendations,
    ti.generation_timestamp
FROM tournament_insights ti
JOIN tournaments t ON ti.tournament_id = t.id
WHERE t.status = 'active'
AND ti.insight_type = 'betting_market_analysis'
AND ti.generation_timestamp > NOW() - INTERVAL '6 hours'
ORDER BY ti.generation_timestamp DESC;
```

---

## 🚀 Getting Started

### 1. Database Setup

```bash
-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;
CREATE EXTENSION IF NOT EXISTS "vector" CASCADE;

-- Run schema files in order
\i schema/01_core_entities.sql
\i schema/02_betting_markets.sql
\i schema/03_ai_ml_tables.sql
\i schema/04_shot_level_data.sql
\i schema/05_llm_integration.sql
\i schema/06_optimization_structures.sql
```

### 2. Initial Data Migration

```sql
-- Migrate existing players
INSERT INTO players (dg_id, name, country) 
SELECT dg_id, name, country FROM players_v2;

-- Migrate tournament data
-- (See migration scripts for detailed procedures)
```

### 3. Configure Refresh Schedules

```sql
-- Set up automated view refresh
SELECT refresh_analytics_views();

-- Monitor performance
SELECT * FROM database_performance_monitor;
```

---

## 🛡️ Data Quality & Governance

### Data Validation

- **Automatic Triggers**: Score validation, date consistency checks
- **Quality Scoring**: Data completeness and confidence metrics
- **Source Tracking**: Full lineage of data sources and transformations

### Performance Monitoring

- **View Refresh Tracking**: Automatic monitoring of materialized view freshness
- **Query Performance**: Built-in performance monitoring and alerting
- **Index Usage**: Automated index usage analysis and optimization

### Security & Privacy

- **Access Control**: Role-based access to sensitive betting data
- **PII Protection**: Anonymization of user conversation data
- **Audit Logging**: Complete audit trail of data modifications

---

## 📚 Additional Resources

### Related Documentation

- `DATABASE_AUDIT_REPORT.md` - Analysis of existing schema
- `Migration_Strategy.md` - Detailed migration procedures
- `API_Integration_Guide.md` - External API integration patterns
- `ML_Model_Documentation.md` - Machine learning model specifications

### Performance Tuning

- Regular `ANALYZE` and `VACUUM` scheduling
- Materialized view refresh optimization
- Vector index maintenance procedures
- TimescaleDB chunk management

---

**This schema represents a complete, production-ready system for AI-powered golf analytics and parlay betting optimization. It's designed to scale from startup to enterprise-level operations while maintaining sub-second query performance for real-time betting decisions.**