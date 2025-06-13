# 🤖 Automated Tournament Data Collection Setup

## 🎯 **THE PROBLEM WE'RE SOLVING**

Without automation, your tournament snapshot system **ONLY collects data when someone visits your app**. This means:
- ❌ If you don't visit on Friday during a tournament → **YOU LOSE ALL FRIDAY DATA FOREVER**
- ❌ Tournament states at specific moments can't be recreated later
- ❌ ML training data has gaps and inconsistencies
- ❌ Parlay analytics miss critical performance windows

## 🚀 **THE SOLUTION: 24/7 AUTOMATED DATA COLLECTION**

We've created **GitHub Actions workflows** that automatically:
- ✅ Collect tournament data **every 30 minutes** during tournament hours
- ✅ Run **daily system maintenance** and cleanup
- ✅ Monitor **system health** and alert on issues
- ✅ Apply **data retention policies** to manage storage
- ✅ Work **completely independently** of your app usage

---

## 📋 **SETUP INSTRUCTIONS**

### **Step 1: Configure Your App URL**

1. Go to your GitHub repository settings
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **"New repository secret"**
4. Add this secret:
   ```
   Name: APP_URL
   Value: https://your-actual-app-domain.vercel.app
   ```
   
   **Replace with your real domain!** Examples:
   - `https://golf-parlay-picker.vercel.app`
   - `https://my-golf-app.netlify.app`
   - `https://yourdomain.com`

### **Step 2: Enable GitHub Actions**

1. In your repository, go to the **"Actions"** tab
2. If prompted, click **"Enable GitHub Actions"**
3. You should see the workflows we just created:
   - 🏌️ **Tournament Data Collection**
   - 🧹 **Daily System Maintenance**

### **Step 3: Test the Setup**

1. Go to **Actions** tab in your GitHub repo
2. Click on **"Tournament Data Collection"**
3. Click **"Run workflow"** button
4. Choose these settings:
   ```
   Force sync: true
   Specific tour: both
   ```
5. Click **"Run workflow"**
6. Wait 2-3 minutes and check the logs

---

## ⏰ **AUTOMATION SCHEDULE**

### **🏌️ Tournament Data Collection**
```yaml
Peak Tournament Hours (Thu-Sun):  Every 30 minutes, 6 AM - 8 PM EST
Off-Peak Hours (Mon-Wed):        Every hour, 8 AM - 6 PM EST  
Emergency Fallback:               Every 2 hours, overnight (all days)
```

### **🧹 Daily System Maintenance**
```yaml
Daily Cleanup:    3 AM EST (every day)
Weekly Deep Clean: 2 AM EST (every Monday)
```

**Why these times?**
- **Tournament hours**: Most PGA/European tour action happens Thu-Sun
- **Maintenance hours**: 2-3 AM EST is lowest traffic time
- **Emergency collection**: Catches international tournaments in different timezones

---

## 🔍 **MONITORING & ALERTS**

### **What Gets Monitored:**
- ✅ **Data Collection Success**: Are we successfully syncing tournament data?
- ✅ **Snapshot Creation**: Are snapshots being created automatically?
- ✅ **System Health**: Is the snapshot system operational?
- ✅ **Storage Usage**: How much data are we storing?
- ✅ **Error Detection**: Any failures in the collection process?

### **Where to Check Status:**
1. **GitHub Actions Tab**: See all automation runs and their logs
2. **Your App**: Visit `/api/snapshots?action=system_health` for live status
3. **Workflow Logs**: Detailed information about each collection run

### **Understanding the Logs:**
```bash
✅ PGA Sync completed: 312 records processed for U.S. Open
📸 Total Snapshots: 45
🟢 System Status: active
💾 Storage Usage: 0.45MB
```

---

## 🚨 **WHAT TO DO IF SOMETHING BREAKS**

### **Data Collection Fails:**
1. Check the **Actions** tab for error logs
2. Verify your `APP_URL` secret is correct
3. Ensure your app is deployed and accessible
4. Manually trigger the workflow to test

### **No Snapshots Being Created:**
1. Check if tournament data is being synced (should see records > 0)
2. Visit `/api/snapshots?action=system_health` to check snapshot system
3. Look for snapshot trigger errors in the automation logs

### **High Storage Usage:**
1. The system will automatically suggest cleanup actions
2. You can manually run maintenance with aggressive settings:
   - Go to **Actions → Daily System Maintenance**
   - Run workflow with `maintenance_type: weekly` and `dry_run: false`

### **Emergency Manual Collection:**
If automation fails during a critical tournament:
```bash
# Visit these URLs manually or in a browser:
https://your-app.vercel.app/api/live-stats/sync
https://your-app.vercel.app/api/live-stats/sync-tour?tour=pga
```

---

## 📊 **SYSTEM CAPABILITIES**

### **Data Collection:**
- **Frequency**: Up to **48 collections per day** during peak periods
- **Coverage**: PGA Tour, European Tour, and multi-tour events
- **Reliability**: 3-attempt retry system with exponential backoff
- **Monitoring**: Comprehensive health checks and error reporting

### **Storage Management:**
- **Production Policy**: Keep data for 365 days
- **Development Policy**: Keep data for 90 days (for testing)
- **Automatic Cleanup**: Removes old snapshots based on policy
- **Storage Estimation**: ~10KB per snapshot (very efficient)

### **Disaster Recovery:**
- **Fallback Systems**: Live data access when snapshots fail
- **Multiple Collection Methods**: Different sync endpoints as backups
- **Health Monitoring**: Automatic detection of system issues
- **Manual Override**: Easy manual triggering when needed

---

## 🎛️ **ADVANCED CONFIGURATION**

### **Customize Collection Frequency:**
Edit `.github/workflows/tournament-data-collection.yml`:
```yaml
schedule:
  # More frequent during majors (every 15 minutes)
  - cron: '*/15 6-20 * * 4-7'  
  
  # Less frequent during off-season (every 2 hours)  
  - cron: '0 */2 * * 1-3'
```

### **Adjust Retention Policies:**
The system automatically chooses between:
- **Production**: Conservative (365 days, keep every 4th snapshot)
- **Development**: Aggressive (90 days, keep every 10th snapshot)

### **Add Notifications (Optional):**
You can extend the workflows to send notifications to Slack, Discord, or email when:
- Data collection fails
- Storage usage is high
- System health issues detected

---

## ✅ **VERIFICATION CHECKLIST**

After setup, verify everything is working:

- [ ] **APP_URL secret** is configured with your real domain
- [ ] **GitHub Actions** are enabled in your repository
- [ ] **Test workflow run** completes successfully
- [ ] **System health endpoint** returns operational status
- [ ] **Tournament data** is being collected (check for recent records)
- [ ] **Snapshots** are being created automatically
- [ ] **Maintenance workflows** are scheduled and working

---

## 🎉 **WHAT THIS GIVES YOU**

With this automation system, you now have:

### **🔄 Continuous Data Collection**
- Tournament data collected **every 30 minutes** during active periods
- **Zero dependency** on app visits or manual intervention
- **Complete historical preservation** of tournament states

### **🧠 ML-Ready Data Pipeline**
- Consistent, gap-free data for training models
- Historical snapshots for time-series analysis
- Quality-scored data with validation checks

### **📈 Comprehensive Analytics**
- Round-by-round player performance tracking
- Position change momentum indicators
- Form analysis and trend identification

### **🚀 Production-Ready Infrastructure**
- Automated maintenance and cleanup
- Health monitoring and alerting
- Disaster recovery and fallback systems

**Your golf parlay prediction system now runs completely autonomously! 🏌️‍♂️📊** 