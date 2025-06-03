# Universal Matchup Ingestion

This guide explains how to ingest matchup data for any tour (PGA, Euro, Opposite Field, Alternative) in your golf parlay picker application.

## Prerequisites

1. Make sure your development server is running:
   ```bash
   pnpm dev
   ```

2. Ensure you have the `INGEST_SECRET` environment variable set in your `.env.local` file:
   ```bash
   INGEST_SECRET=your-secret-here
   ```

## Ingesting Matchup Data

### Using npm scripts (Recommended)

```bash
# Ingest PGA tour (default)
pnpm run ingest

# Ingest specific tours
pnpm run ingest:pga      # PGA Tour
pnpm run ingest:euro     # European Tour  
pnpm run ingest:opp      # Opposite Field events
pnpm run ingest:alt      # Alternative events

# Ingest all tours at once
pnpm run ingest:all
```

### Direct script execution

```bash
# Default (PGA tour)
node ingest-matchups.js

# Specific tours
node ingest-matchups.js euro
node ingest-matchups.js pga opp euro
node ingest-matchups.js all

# Help
node ingest-matchups.js --help
```

### Manual API calls

```bash
# Euro tour
curl -X POST "http://localhost:3000/api/matchups/ingest?tour=euro" \
  -H "Authorization: Bearer your-secret-here" \
  -H "Content-Type: application/json"

# PGA tour  
curl -X POST "http://localhost:3000/api/matchups/ingest?tour=pga" \
  -H "Authorization: Bearer your-secret-here" \
  -H "Content-Type: application/json"
```

## Supported Tours

The ingestion system supports four tours:
- `pga` - PGA Tour (default)
- `opp` - Opposite Field events  
- `euro` - European Tour
- `alt` - Alternative events

## What the ingestion includes

- **3-ball matchups** with odds from multiple bookmakers (FanDuel, DraftKings, Bet365, etc.)
- **2-ball matchups** with odds from major sportsbooks
- **DataGolf model odds** for comparison and analysis
- **Player information** automatically synced to the database
- **Event mapping** to tournament schedule
- **Tee times and pairings** when available
- **Data freshness validation** - automatically skips tours with stale data (older than 7 days)

## Data Freshness Protection

The ingestion system includes automatic validation to prevent importing outdated tournament data:

### ✅ **Automatic Validation:**
- **7-day freshness window** - only ingests data updated within the last week
- **Pre-ingestion checks** - validates data age before processing
- **Smart skipping** - automatically skips stale data with clear warnings

### 📊 **Enhanced Reporting:**
```bash
🏌️ Starting PGA tour matchup ingestion...
📅 PGA tour data is recent (0 days ago)
   Event: RBC Canadian Open
✅ PGA tour matchups ingested successfully!

🏌️ Starting OPP tour matchup ingestion...
⚠️  OPP tour data is stale (23 days ago)
   Event: ONEflight Myrtle Beach Classic
   Last updated: 2025-05-11 13:40:00 UTC
   Skipping ingestion (data older than 7 days)
```

### 🎯 **Result Categories:**
- **✅ Successful tours** - Fresh data ingested successfully
- **⏭️ Skipped tours** - Stale data automatically skipped
- **❌ Failed tours** - API or technical errors

## Example Usage

### Ingest all tours for maximum coverage
```bash
pnpm run ingest:all
```

### Ingest only current week's main events
```bash
pnpm run ingest:pga
pnpm run ingest:euro
```

### Quick Euro tour update
```bash
pnpm run ingest:euro
```

## Viewing Ingested Data

1. After ingesting the data, refresh your application
2. Navigate to the Matchups tab
3. Use the Event selector to choose any available event
4. Events are marked with badges:
   - 🟢 **Main** - Primary PGA events
   - 🔵 **Opposite** - Opposite field PGA events  
   - 🟣 **Euro** - European Tour events

## Troubleshooting

### "No 3-ball matchups found"
- Make sure you've run the ingestion for the relevant tour first
- Check that the event exists in your tournament schedule
- Verify the `INGEST_SECRET` is correct in `.env.local`

### Ingestion fails
- Check your internet connection
- Verify the DataGolf API key is valid and has access to the tour
- Ensure the development server is running
- Try ingesting one tour at a time to isolate issues

### Authorization errors
- Make sure `INGEST_SECRET` in your `.env.local` matches the server configuration
- Check that the environment variable is loaded properly
- Restart the development server after changing `.env.local`

### No data for specific tour
- Some tours may not have active events at all times
- Check the DataGolf API directly to see if data is available
- Verify the tour parameter is supported

## Automation

For production, you might want to set up automated ingestion for all tours:

```bash
# Add to crontab for automatic updates every 4 hours during tournament season
0 */4 * * * cd /path/to/your/app && node ingest-matchups.js all

# Or separate jobs for different tours
0 8,12,16,20 * * * cd /path/to/your/app && node ingest-matchups.js pga
0 9,13,17,21 * * * cd /path/to/your/app && node ingest-matchups.js euro
```

## Advanced Usage

### Multiple specific tours
```bash
node ingest-matchups.js pga euro opp
```

### With detailed output for debugging
```bash
node ingest-matchups.js all 2>&1 | tee ingestion.log
```

## API Endpoint Details

**Endpoint:** `POST /api/matchups/ingest`

**Query Parameters:**
- `tour` (optional): `pga`, `opp`, `euro`, or `alt` (defaults to `pga`)

**Headers:**
- `Authorization: Bearer <INGEST_SECRET>`
- `Content-Type: application/json`

**Response Example:**
```json
{
  "inserted": 118,
  "three_ball": 48,
  "two_ball": 70,
  "tour": "euro", 
  "debug": {
    "tour": "euro",
    "eventName": "KLM Open",
    "sampleMain": {...},
    "oddsSamples": [...]
  }
}
```

## Script Output Example

When ingesting all tours:
```
🚀 Starting multi-tour ingestion for: PGA, OPP, EURO, ALT

🏌️ Starting PGA tour matchup ingestion...
✅ PGA tour matchups ingested successfully!
🎯 Inserted 156 total matchups
   - 3-ball: 64
   - 2-ball: 92
   - Event: The Memorial Tournament

   ⏱️ Waiting 2 seconds before next tour...

🏌️ Starting EURO tour matchup ingestion...
✅ EURO tour matchups ingested successfully!
🎯 Inserted 118 total matchups
   - 3-ball: 48
   - 2-ball: 70
   - Event: KLM Open

🏆 Multi-tour ingestion completed!
📊 Grand totals across all tours:
   - Total matchups: 274
   - 3-ball matchups: 112
   - 2-ball matchups: 162
✅ Successful tours: PGA, EURO
``` 