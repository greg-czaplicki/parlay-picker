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