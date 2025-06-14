# 🚀 Golf Parlay Picker - Quick Reference

## 📡 **API ENDPOINTS** (Replace `your-domain.com` with your actual domain)

### **Data Collection**
```bash
# Sync all tournaments (PGA + Euro)
GET https://your-domain.com/api/live-stats/sync

# Sync specific tour
GET https://your-domain.com/api/live-stats/sync-tour?tour=pga
GET https://your-domain.com/api/live-stats/sync-tour?tour=euro
```

### **System Health**
```bash
# Complete system health check
GET https://your-domain.com/api/snapshots?action=system_health

# Retention policy status
GET https://your-domain.com/api/snapshots?action=retention_status

# Parlay analytics recommendations
GET https://your-domain.com/api/snapshots?action=parlay_recommendations
```

### **ML Data Extraction**
```bash
# API documentation
GET https://your-domain.com/api/ml-data

# Historical snapshots (CSV format)
GET https://your-domain.com/api/ml-data?endpoint=historical_snapshots&format=csv&limit=1000

# Player features for specific player
GET https://your-domain.com/api/ml-data?endpoint=player_features&player_id=9999

# Matchup training data
GET https://your-domain.com/api/ml-data?endpoint=matchup_training_data&matchup_type=3ball&format=csv
```

### **Manual Snapshot Operations**
```bash
# Create snapshot for specific event/round
POST https://your-domain.com/api/snapshots
Content-Type: application/json
{
  "event_id": 123,
  "round_number": 2,
  "snapshot_type": "manual"
}

# Test retention policy (dry run)
POST https://your-domain.com/api/snapshots
Content-Type: application/json
{
  "action": "apply_retention",
  "policy": "development",
  "dry_run": true
}
```

---

## 🏌️ **PARLAY ANALYTICS**

### **Player Analysis**
```bash
# Get player parlay profile
GET https://your-domain.com/api/snapshots?action=player_profile&player_id=9999

# Bulk player profiles
PATCH https://your-domain.com/api/snapshots
Content-Type: application/json
{
  "player_ids": [9999, 8888, 7777],
  "include_matchup_analysis": true
}
```

### **Matchup Analysis**
```bash
# Analyze 3-ball matchup
POST https://your-domain.com/api/snapshots
Content-Type: application/json
{
  "action": "analyze_matchup",
  "player_ids": [9999, 8888, 7777],
  "matchup_type": "3ball",
  "course_context": "Pebble Beach"
}
```

---

## 🎯 **SG (STROKES GAINED) ANALYSIS POWERHOUSE**

### **Course DNA Profiling**
```bash
# Get course skill requirements breakdown
GET https://your-domain.com/api/sg-analysis/course-dna?course=U.S. Open&years=5

# Get course DNA with player fit analysis  
GET https://your-domain.com/api/sg-analysis/course-dna?course=U.S. Open&includePlayerFit=true&playerId=18417

# Example Response:
{
  "success": true,
  "data": {
    "course": "U.S. Open",
    "dna_profile": {
      "skill_requirements": {
        "approach_play": {
          "importance": 55,
          "description": "Critical skill - Precision iron play essential"
        },
        "around_green": {
          "importance": 28,
          "description": "High importance - Short game critical"
        },
        "off_tee": {
          "importance": 17,
          "description": "Lower importance - Other skills more critical"
        },
        "putting": {
          "importance": 0,
          "description": "Moderate importance - Average putting acceptable"
        }
      },
      "course_characteristics": {
        "primary_skill": "APP",
        "type": "unknown",
        "difficulty": 5,
        "weather_sensitivity": "medium"
      },
      "analysis_metadata": {
        "rounds_analyzed": 156,
        "confidence_score": 0.8,
        "processing_time_ms": 298
      }
    }
  }
}

# Compare courses by skill requirements (Coming Soon)
GET https://your-domain.com/api/sg-analysis/course-comparison?courses=Pebble_Beach,Augusta_National,TPC_Sawgrass

# Get venue-specific round progressions (Coming Soon)
GET https://your-domain.com/api/sg-analysis/round-requirements?course=Bay_Hill&year=2024
```

### **Advanced Player SG Profiling**
```bash
# Player archetype classification
GET https://your-domain.com/api/sg-analysis/player-archetype?player_id=9999

# SG performance by course type
GET https://your-domain.com/api/sg-analysis/player-course-fit?player_id=9999&course_type=links

# Historical SG momentum patterns
GET https://your-domain.com/api/sg-analysis/momentum-tracking?player_id=9999&lookback_rounds=8
```

### **Weather & Conditions Context**
```bash
# Course DNA modified by conditions
GET https://your-domain.com/api/sg-analysis/conditions-impact?course=TPC_Sawgrass&wind_speed=20&conditions=wet

# Player performance in specific conditions
GET https://your-domain.com/api/sg-analysis/weather-performance?player_id=9999&conditions=windy&min_wind=15
```

### **Field Strength Analysis**
```bash
# SG relative to field quality
GET https://your-domain.com/api/sg-analysis/field-adjusted?event_id=123&player_id=9999

# Historical field strength by tournament
GET https://your-domain.com/api/sg-analysis/tournament-field-strength?tournament=PLAYERS&years=10
```

### **Live Tournament SG Analysis**
```bash
# Real-time course conditions impact
GET https://your-domain.com/api/sg-analysis/live-conditions?event_id=123&round=2

# Live SG momentum tracking
GET https://your-domain.com/api/sg-analysis/live-momentum?event_id=123&round=2&player_id=9999

# Pin position difficulty analysis
GET https://your-domain.com/api/sg-analysis/pin-difficulty?event_id=123&round=2
```

---

## 🧠 **SG STRATEGIC QUERIES**

### **Player Archetype Examples**
```bash
🎯 BOMBERS: Elite off-tee, average approach, variable putting
GET https://your-domain.com/api/sg-analysis/archetype-players?type=bomber&active=true

🎯 PRECISION: Average off-tee, elite approach, consistent putting  
GET https://your-domain.com/api/sg-analysis/archetype-players?type=precision&min_approach_sg=1.0

🎯 GRINDERS: Below-average distance, elite short game, clutch putting
GET https://your-domain.com/api/sg-analysis/archetype-players?type=grinder&clutch_factor=high
```

### **Course DNA Examples**
```bash
🏌️ TRAVELERS CHAMPIONSHIP DNA:
- Approach Play: 45% of success
- Putting: 30% of success  
- Off-Tee: 20% of success
- Short Game: 5% of success

🏌️ AUGUSTA NATIONAL DNA:
- Approach Play: 40% of success
- Short Game: 25% of success
- Putting: 20% of success
- Off-Tee: 15% of success

🏌️ PEBBLE BEACH DNA:
- Off-Tee: 35% of success (wind management)
- Approach Play: 35% of success
- Putting: 20% of success
- Short Game: 10% of success
```

### **Advanced Correlation Analysis**
```bash
# Which SG categories predict success at specific venues
GET https://your-domain.com/api/sg-analysis/success-correlations?course=Augusta_National&min_finish=20

# Round-by-round SG requirements
GET https://your-domain.com/api/sg-analysis/round-progression?course=TPC_Sawgrass&target_finish=top10

# Cut line SG thresholds
GET https://your-domain.com/api/sg-analysis/cut-requirements?course=US_Open_courses&difficulty=high
```

### **Predictive SG Models**
```bash
# Player expected performance given course fit
POST https://your-domain.com/api/sg-analysis/predict-performance
Content-Type: application/json
{
  "player_id": 9999,
  "course": "TPC_River_Highlands", 
  "conditions": "normal",
  "field_strength": "strong",
  "form_lookback": 6
}

# Matchup probability with SG context
POST https://your-domain.com/api/sg-analysis/matchup-probability
Content-Type: application/json
{
  "player_ids": [9999, 8888, 7777],
  "matchup_type": "3ball",
  "course": "Pebble_Beach",
  "round": 3,
  "conditions": "windy"
}
```

---

## 📈 **SG DATA ACCUMULATION TIMELINE**

### **Phase 1: Foundation (Weeks 1-4)**
- ✅ **Basic SG Collection**: Off-tee, approach, short game, putting
- ✅ **Course Identification**: Venue-specific data tagging
- ✅ **Round Tracking**: R1-R4 SG progressions
- ✅ **Weather Context**: Basic conditions logging

### **Phase 2: Pattern Recognition (Months 1-3)**
- 🔄 **Course DNA Emergence**: Skill requirement patterns
- 🔄 **Player Archetypes**: Clustering by SG signatures  
- 🔄 **Conditions Impact**: Weather modification factors
- 🔄 **Round Correlations**: R1 performance → R4 outcomes

### **Phase 3: Predictive Power (Months 3-12)**
- 🚀 **Tournament Profiles**: Robust venue analytics
- 🚀 **Momentum Models**: Multi-round SG cascades
- 🚀 **Field Adjustments**: Strength-relative performance
- 🚀 **Cut Predictions**: SG-based cut line models

### **Phase 4: Mastery (Year 1+)**
- 🏆 **Multi-Year Trends**: Career trajectory analysis
- 🏆 **Course Evolution**: How venues change over time
- 🏆 **Elite Predictors**: Sub-1% edge identification
- 🏆 **Real-time Optimization**: Live tournament adjustments

---

## 🎯 **SG MONITORING & VALIDATION**

### **Data Quality Checks**
```bash
# Verify SG data completeness
GET https://your-domain.com/api/sg-analysis/data-quality?event_id=123

# Check for SG outliers
GET https://your-domain.com/api/sg-analysis/outlier-detection?player_id=9999&lookback=20

# Validate course DNA consistency
GET https://your-domain.com/api/sg-analysis/dna-validation?course=Augusta_National&years=5
```

### **Performance Metrics**
```bash
📊 KEY SG METRICS TO MONITOR:
   🎯 Course DNA Stability: Should converge after 10+ rounds
   📈 Prediction Accuracy: Target >65% for top-10 finishes
   🔄 Data Freshness: SG updates within 2 hours of round completion
   💾 Historical Depth: Minimum 3 years for reliable course DNA
   ⚡ Query Performance: <500ms for standard SG analysis
```

---

## 🤖 **GITHUB ACTIONS AUTOMATION**

### **Manual Workflow Triggers**

1. **Go to GitHub → Actions tab**
2. **Select workflow to run**
3. **Click "Run workflow"**

### **Tournament Data Collection**
- **When**: Every 30 min (Thu-Sun), hourly (Mon-Wed)
- **Manual Options**:
  - `force_sync`: true/false
  - `specific_tour`: both/pga/euro

### **Daily Maintenance**
- **When**: Daily 3 AM EST, Weekly 2 AM EST (Monday)
- **Manual Options**:
  - `maintenance_type`: daily/weekly/retention_only/health_check_only
  - `dry_run`: true/false

---

## 🔧 **TROUBLESHOOTING COMMANDS**

### **Check System Status**
```bash
# Quick health check
curl "https://your-domain.com/api/snapshots?action=system_health" | jq '.'

# Check if tournaments are active
curl "https://your-domain.com/api/live-stats/sync" | jq '.data.eventNames'

# Get retention recommendations
curl "https://your-domain.com/api/snapshots?action=retention_status" | jq '.'
```

### **Emergency Data Collection**
```bash
# Force sync all tours
curl "https://your-domain.com/api/live-stats/sync"

# Force sync specific tour
curl "https://your-domain.com/api/live-stats/sync-tour?tour=pga"

# Check ML data availability
curl "https://your-domain.com/api/ml-data?endpoint=live_context&limit=10" | jq '.'
```

### **Storage Management**
```bash
# Check current storage usage
curl "https://your-domain.com/api/snapshots?action=retention_status" | jq '.data.retention_policy'

# Dry run cleanup (see what would be deleted)
curl -X POST "https://your-domain.com/api/snapshots" \
  -H "Content-Type: application/json" \
  -d '{"action": "apply_retention", "policy": "development", "dry_run": true}' | jq '.'
```

---

## 📊 **MONITORING DASHBOARD**

### **Key Metrics to Watch**
- **Total Snapshots**: Should increase during tournaments
- **System Status**: Should be "active" when tournaments running
- **Storage Usage**: Monitor for excessive growth
- **Error Count**: Should be 0 or minimal
- **Data Freshness**: Should be "very_fresh" or "fresh"

### **Normal vs Problem Indicators**
```bash
✅ HEALTHY SYSTEM:
   📸 Total Snapshots: Growing during tournaments
   🟢 System Status: active
   💾 Storage Usage: <100MB 
   ⚠️ Errors: 0
   🕒 Data Freshness: very_fresh

❌ PROBLEM INDICATORS:
   📸 Total Snapshots: 0 (during active tournaments)
   🔴 System Status: error
   💾 Storage Usage: >1000MB
   ⚠️ Errors: >0
   🕒 Data Freshness: historical (during tournaments)
```

---

## 🚨 **EMERGENCY PROCEDURES**

### **If Automation Stops Working**
1. **Check GitHub Actions**: Look for failed workflows
2. **Verify APP_URL**: Ensure secret is correct in GitHub settings
3. **Manual Collection**: Run data sync commands above
4. **Test Endpoints**: Verify app is accessible

### **If Storage Gets Too High**
1. **Check Current Usage**: Use retention status endpoint
2. **Run Dry Run**: See what would be cleaned up
3. **Apply Cleanup**: Run retention policy with `dry_run: false`

### **If Snapshots Stop Creating**
1. **Verify Data Sync**: Ensure tournaments are being collected
2. **Check Trigger Logic**: Look for errors in automation logs
3. **Manual Snapshot**: Create snapshot manually for testing

### **If ML Data Missing**
1. **Check Snapshots**: Ensure historical data exists
2. **Test ML Endpoints**: Verify extraction APIs work
3. **Fallback to Live**: System automatically uses live data

---

## 📞 **SUPPORT CHECKLIST**

When troubleshooting, gather this info:
- [ ] **Current system health** (from health endpoint)
- [ ] **Recent automation logs** (from GitHub Actions)
- [ ] **Error messages** (exact text from logs)
- [ ] **Timeline** (when did it stop working?)
- [ ] **Tournament status** (are tournaments currently active?)

**Your system is designed to be self-healing and autonomous! 🏌️‍♂️🤖** 