-- Live Tournament Stats Data Cleanup and Validation Functions
-- This prevents stale data issues like the Knapp -10 score bug

-- 1. Function to clean up stale tournament data
CREATE OR REPLACE FUNCTION cleanup_stale_live_stats(days_threshold INTEGER DEFAULT 3)
RETURNS TABLE (
  event_name TEXT,
  records_deleted BIGINT
) AS $$
BEGIN
  -- Delete data for tournaments that are no longer active
  -- and older than the threshold
  DELETE FROM live_tournament_stats
  WHERE event_name NOT IN (
    SELECT t.event_name 
    FROM tournaments_v2 t 
    WHERE t.end_date >= CURRENT_DATE - INTERVAL '1 day'
  )
  AND data_golf_updated_at < (NOW() - (days_threshold || ' days')::INTERVAL);
  
  -- Return summary of what was cleaned
  GET DIAGNOSTICS records_deleted = ROW_COUNT;
  
  RETURN QUERY
  SELECT 'CLEANUP_COMPLETE'::TEXT, records_deleted;
END;
$$ LANGUAGE plpgsql;

-- 2. Function to validate live stats data integrity
CREATE OR REPLACE FUNCTION validate_live_stats_integrity()
RETURNS TABLE (
  check_name TEXT,
  issue_count BIGINT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: Impossible scores (> 20 or < -20 for a single round)
  RETURN QUERY
  SELECT 
    'impossible_round_scores'::TEXT,
    COUNT(*)::BIGINT,
    'Scores outside reasonable range (-20 to +20 for a round)'::TEXT
  FROM live_tournament_stats
  WHERE today IS NOT NULL 
  AND (today > 20 OR today < -20)
  AND round_num NOT IN ('event_avg');

  -- Check 2: Players with data in multiple active tournaments
  RETURN QUERY
  SELECT 
    'cross_tournament_contamination'::TEXT,
    COUNT(*)::BIGINT,
    'Players appearing in multiple active tournaments'::TEXT
  FROM (
    SELECT dg_id, COUNT(DISTINCT event_name) as tournament_count
    FROM live_tournament_stats lst
    WHERE EXISTS (
      SELECT 1 FROM tournaments_v2 t 
      WHERE t.event_name = lst.event_name 
      AND t.end_date >= CURRENT_DATE
    )
    GROUP BY dg_id
    HAVING COUNT(DISTINCT event_name) > 1
  ) cross_contamination;

  -- Check 3: Data older than active tournament end dates
  RETURN QUERY
  SELECT 
    'stale_data_in_active_tournaments'::TEXT,
    COUNT(*)::BIGINT,
    'Live stats older than 24 hours for active tournaments'::TEXT
  FROM live_tournament_stats lst
  JOIN tournaments_v2 t ON t.event_name = lst.event_name
  WHERE t.end_date >= CURRENT_DATE
  AND lst.data_golf_updated_at < (NOW() - INTERVAL '24 hours');

END;
$$ LANGUAGE plpgsql;

-- 3. Function to be called before each sync to ensure clean data
CREATE OR REPLACE FUNCTION prepare_live_stats_sync(target_event_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Clean up any existing data for this event that's more than 1 hour old
  -- This prevents accumulation of stale round data
  DELETE FROM live_tournament_stats
  WHERE event_name = target_event_name
  AND data_golf_updated_at < (NOW() - INTERVAL '1 hour');
  
  -- Verify the tournament is active
  IF NOT EXISTS (
    SELECT 1 FROM tournaments_v2 
    WHERE event_name = target_event_name 
    AND end_date >= CURRENT_DATE - INTERVAL '1 day'
  ) THEN
    RAISE WARNING 'Tournament % is not active or not found', target_event_name;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger function to validate data on insert/update
CREATE OR REPLACE FUNCTION validate_live_stats_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate reasonable scores
  IF NEW.today IS NOT NULL AND (NEW.today > 25 OR NEW.today < -25) THEN
    RAISE WARNING 'Unusual round score detected: % for player % in %', 
      NEW.today, NEW.player_name, NEW.event_name;
  END IF;
  
  -- Ensure tournament exists and is reasonably current
  IF NOT EXISTS (
    SELECT 1 FROM tournaments_v2 
    WHERE event_name = NEW.event_name 
    AND end_date >= CURRENT_DATE - INTERVAL '7 days'
  ) THEN
    RAISE WARNING 'Data being inserted for inactive tournament: %', NEW.event_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS validate_live_stats_trigger ON live_tournament_stats;
CREATE TRIGGER validate_live_stats_trigger
  BEFORE INSERT OR UPDATE ON live_tournament_stats
  FOR EACH ROW
  EXECUTE FUNCTION validate_live_stats_insert();

-- 5. Daily cleanup job (to be called by cron)
CREATE OR REPLACE FUNCTION daily_live_stats_maintenance()
RETURNS TEXT AS $$
DECLARE
  cleanup_result RECORD;
  validation_results RECORD;
  report TEXT := '';
BEGIN
  -- Run cleanup
  SELECT * INTO cleanup_result 
  FROM cleanup_stale_live_stats(3);
  
  report := report || format('Cleaned up %s records', cleanup_result.records_deleted) || E'\n';
  
  -- Run validation and report issues
  FOR validation_results IN 
    SELECT * FROM validate_live_stats_integrity()
  LOOP
    IF validation_results.issue_count > 0 THEN
      report := report || format('WARNING: %s issues found - %s', 
        validation_results.issue_count, validation_results.details) || E'\n';
    END IF;
  END LOOP;
  
  -- Log the maintenance report
  INSERT INTO live_stats_maintenance_log (maintenance_date, report)
  VALUES (NOW(), report)
  ON CONFLICT (maintenance_date) 
  DO UPDATE SET report = EXCLUDED.report, updated_at = NOW();
  
  RETURN report;
END;
$$ LANGUAGE plpgsql;

-- Create maintenance log table if it doesn't exist
CREATE TABLE IF NOT EXISTS live_stats_maintenance_log (
  maintenance_date DATE PRIMARY KEY,
  report TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION cleanup_stale_live_stats(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_live_stats_integrity() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION prepare_live_stats_sync(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION daily_live_stats_maintenance() TO anon, authenticated;