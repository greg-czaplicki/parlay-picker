-- =============================================
-- DATA MIGRATION ETL SCRIPT
-- =============================================
-- This script handles the extraction, transformation, and loading of data
-- from the old schema to the new AI-optimized schema
-- Based on the "Start Fresh, Build Forward" strategy
-- Generated: July 23, 2025

-- =============================================
-- MIGRATION SETUP AND LOGGING
-- =============================================

-- Insert migration start log
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('data_migration', 'started', '{"script": "02-data-migration-etl.sql"}');

-- Create temporary staging tables for data validation
CREATE TEMP TABLE migration_stats (
    table_name VARCHAR(100),
    source_count INTEGER,
    target_count INTEGER,
    success_rate DECIMAL(5,2),
    errors TEXT[]
);

-- =============================================
-- PHASE 1: CORE ENTITIES MIGRATION
-- =============================================

-- PLAYERS MIGRATION
-- Migrate from players_v2 to players with data enrichment placeholders
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('players_migration', 'started', '{"phase": "core_entities"}');

INSERT INTO players (
    dg_id, name, country, country_code, created_at, updated_at, data_sources
)
SELECT 
    dg_id,
    TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')) as name, -- Standardize names
    COALESCE(country, 'Unknown') as country, -- Will be updated by ongoing collection
    COALESCE(country_code, 'UNK') as country_code, -- Will be updated by ongoing collection
    created_at,
    updated_at,
    ARRAY['dataGolf', 'legacy_migration']
FROM players_v2
ON CONFLICT (dg_id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Record migration stats for players
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
SELECT 
    'players',
    (SELECT COUNT(*) FROM players_v2),
    (SELECT COUNT(*) FROM players WHERE 'legacy_migration' = ANY(data_sources)),
    ROUND((SELECT COUNT(*) FROM players WHERE 'legacy_migration' = ANY(data_sources)) * 100.0 / 
          (SELECT COUNT(*) FROM players_v2), 2);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'players_migration' AND status = 'started';

-- COURSES MIGRATION
-- Create basic course records from tournament data (addresses 98.8% missing course data)
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('courses_migration', 'started', '{"phase": "core_entities"}');

-- First, migrate existing courses from courses_v2
INSERT INTO courses (
    name, location, country, par, created_at, updated_at
)
SELECT 
    course_name as name,
    COALESCE(location, 'Location TBD') as location,
    COALESCE(country, 'USA') as country, -- Default assumption, will be verified
    COALESCE(par, 72) as par,
    created_at,
    updated_at
FROM courses_v2
ON CONFLICT DO NOTHING;

-- Create courses from tournament venue data (reconstruction strategy)
INSERT INTO courses (
    name, location, country, par
)
SELECT DISTINCT 
    course_name as name,
    'Location TBD' as location, -- To be updated by ongoing collection
    'USA' as country, -- Default assumption for PGA Tour
    COALESCE(course_par, 72) as par
FROM tournaments_v2 
WHERE course_name IS NOT NULL 
AND course_name NOT IN (SELECT name FROM courses)
ON CONFLICT DO NOTHING;

-- Record migration stats for courses
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
SELECT 
    'courses',
    (SELECT COUNT(DISTINCT course_name) FROM tournaments_v2 WHERE course_name IS NOT NULL),
    (SELECT COUNT(*) FROM courses),
    ROUND((SELECT COUNT(*) FROM courses) * 100.0 / 
          GREATEST((SELECT COUNT(DISTINCT course_name) FROM tournaments_v2 WHERE course_name IS NOT NULL), 1), 2);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'courses_migration' AND status = 'started';

-- TOURNAMENTS MIGRATION
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('tournaments_migration', 'started', '{"phase": "core_entities"}');

INSERT INTO tournaments (
    event_id, name, course_id, start_date, end_date, tour, tournament_type, status,
    created_at, updated_at
)
SELECT 
    t.event_id,
    TRIM(t.event_name) as name,
    c.id as course_id,
    t.start_date,
    t.end_date,
    COALESCE(LOWER(t.tour), 'pga') as tour,
    CASE 
        WHEN LOWER(t.event_name) LIKE '%masters%' THEN 'major'
        WHEN LOWER(t.event_name) LIKE '%open%' AND LOWER(t.event_name) LIKE '%championship%' THEN 'major'
        WHEN LOWER(t.event_name) LIKE '%pga championship%' THEN 'major'
        WHEN LOWER(t.event_name) LIKE '%us open%' THEN 'major'
        WHEN LOWER(t.event_name) LIKE '%wgc%' THEN 'wgc'
        WHEN LOWER(t.event_name) LIKE '%players%' THEN 'flagship'
        ELSE 'regular'
    END as tournament_type,
    CASE 
        WHEN t.end_date < CURRENT_DATE THEN 'completed'
        WHEN t.start_date <= CURRENT_DATE AND t.end_date >= CURRENT_DATE THEN 'active'
        ELSE 'upcoming'
    END as status,
    t.created_at,
    t.updated_at
FROM tournaments_v2 t
LEFT JOIN courses c ON TRIM(LOWER(t.course_name)) = TRIM(LOWER(c.name))
ON CONFLICT (event_id) DO UPDATE SET
    name = EXCLUDED.name,
    course_id = EXCLUDED.course_id,
    tournament_type = EXCLUDED.tournament_type,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Record migration stats for tournaments
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
SELECT 
    'tournaments',
    (SELECT COUNT(*) FROM tournaments_v2),
    (SELECT COUNT(*) FROM tournaments),
    ROUND((SELECT COUNT(*) FROM tournaments) * 100.0 / 
          (SELECT COUNT(*) FROM tournaments_v2), 2);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'tournaments_migration' AND status = 'started';

-- =============================================
-- PHASE 2: PERFORMANCE DATA MIGRATION
-- =============================================

-- TOURNAMENT ROUND SNAPSHOTS MIGRATION (Highest Quality Data - 95% preservation)
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('round_snapshots_migration', 'started', '{"phase": "performance_data", "source": "tournament_round_snapshots"}');

INSERT INTO tournament_rounds (
    tournament_id, player_id, round_number, round_date,
    score_to_par, position, position_numeric,
    sg_total, sg_off_tee, sg_approach, sg_around_green, sg_putting,
    driving_distance, driving_accuracy, greens_in_regulation, putts,
    created_at, updated_at, data_source
)
SELECT 
    t.id as tournament_id,
    p.id as player_id,
    CASE 
        WHEN trs.round_num ~ '^[0-9]+$' THEN trs.round_num::INTEGER
        ELSE NULL -- Skip aggregate records like 'event_avg'
    END as round_number,
    trs.snapshot_timestamp::DATE as round_date,
    
    -- Score data
    trs.today_score as score_to_par,
    trs.current_position as position,
    CASE 
        WHEN trs.current_position ~ '^[0-9]+$' THEN trs.current_position::INTEGER
        WHEN trs.current_position LIKE 'T%' THEN SUBSTRING(trs.current_position FROM 2)::INTEGER
        ELSE NULL
    END as position_numeric,
    
    -- Strokes Gained data (highest quality in our database)
    trs.sg_total,
    trs.sg_ott as sg_off_tee,
    trs.sg_app as sg_approach,
    trs.sg_arg as sg_around_green,
    trs.sg_putt as sg_putting,
    
    -- Traditional statistics
    trs.driving_distance,
    CASE 
        WHEN trs.driving_accuracy > 1 THEN trs.driving_accuracy / 100.0 -- Convert percentage
        ELSE trs.driving_accuracy
    END as driving_accuracy,
    CASE 
        WHEN trs.gir > 1 THEN trs.gir / 100.0 -- Convert percentage
        ELSE trs.gir
    END as greens_in_regulation,
    trs.putts_per_round as putts,
    
    -- Metadata
    NOW() as created_at,
    NOW() as updated_at,
    'tournament_round_snapshots' as data_source
FROM tournament_round_snapshots trs
JOIN tournaments t ON trs.event_id = t.event_id
JOIN players p ON trs.player_dg_id = p.dg_id
WHERE trs.round_num ~ '^[0-9]+$' -- Only include actual round data, not averages
ON CONFLICT DO NOTHING;

-- Record migration stats for round snapshots
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
SELECT 
    'tournament_rounds_from_snapshots',
    (SELECT COUNT(*) FROM tournament_round_snapshots WHERE round_num ~ '^[0-9]+$'),
    (SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_round_snapshots'),
    ROUND((SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_round_snapshots') * 100.0 / 
          (SELECT COUNT(*) FROM tournament_round_snapshots WHERE round_num ~ '^[0-9]+$'), 2);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'round_snapshots_migration' AND status = 'started';

-- TOURNAMENT RESULTS MIGRATION (Complex Denormalization)
-- Note: Only 3.2% have final positions, but we migrate what we can for historical context
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('tournament_results_migration', 'started', '{"phase": "performance_data", "source": "tournament_results_v2"}');

-- Create rounds from tournament_results_v2 (denormalization: 1 result -> 4 round records)
WITH round_data AS (
    SELECT 
        tr.event_id,
        tr.player_dg_id,
        t.start_date,
        rounds.round_number,
        rounds.score as strokes,
        tr.final_position,
        tr.made_cut
    FROM tournament_results_v2 tr
    JOIN tournaments_v2 tv ON tr.event_id = tv.event_id
    JOIN tournaments t ON tv.event_id = t.event_id
    CROSS JOIN (
        VALUES 
            (1, tr.round1_score),
            (2, tr.round2_score), 
            (3, tr.round3_score),
            (4, tr.round4_score)
    ) AS rounds(round_number, score)
    WHERE rounds.score IS NOT NULL
    AND rounds.score BETWEEN 50 AND 100 -- Reasonable score validation
)
INSERT INTO tournament_rounds (
    tournament_id, player_id, round_number, round_date, strokes, 
    position, made_cut, created_at, updated_at, data_source
)
SELECT 
    t.id as tournament_id,
    p.id as player_id,
    rd.round_number,
    rd.start_date + (rd.round_number - 1) * INTERVAL '1 day' as round_date,
    rd.strokes,
    CASE WHEN rd.round_number = 4 THEN rd.final_position ELSE NULL END as position,
    rd.made_cut,
    NOW() as created_at,
    NOW() as updated_at,
    'tournament_results_v2' as data_source
FROM round_data rd
JOIN tournaments t ON rd.event_id = t.event_id
JOIN players p ON rd.player_dg_id = p.dg_id
-- Only insert if not already exists from better source (round snapshots)
WHERE NOT EXISTS (
    SELECT 1 FROM tournament_rounds tr2 
    WHERE tr2.tournament_id = t.id 
    AND tr2.player_id = p.id 
    AND tr2.round_number = rd.round_number
    AND tr2.data_source = 'tournament_round_snapshots'
)
ON CONFLICT DO NOTHING;

-- Record migration stats for tournament results
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
SELECT 
    'tournament_rounds_from_results',
    (SELECT COUNT(*) FROM tournament_results_v2) * 4, -- Potential rounds (4 per result)
    (SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_results_v2'),
    ROUND((SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'tournament_results_v2') * 100.0 / 
          ((SELECT COUNT(*) FROM tournament_results_v2) * 4), 2);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'tournament_results_migration' AND status = 'started';

-- LIVE TOURNAMENT STATS MIGRATION
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('live_stats_migration', 'started', '{"phase": "performance_data", "source": "live_tournament_stats"}');

INSERT INTO tournament_rounds (
    tournament_id, player_id, round_number, round_date,
    strokes, score_to_par, position, position_numeric,
    sg_total, sg_off_tee, sg_approach, sg_around_green, sg_putting,
    driving_distance, driving_accuracy, greens_in_regulation, putts,
    created_at, updated_at, data_source
)
SELECT 
    t.id as tournament_id,
    p.id as player_id,
    COALESCE(lts.round_number, 1) as round_number, -- Default to round 1 if null
    lts.data_golf_updated_at::DATE as round_date,
    
    -- Score information
    lts.total_strokes as strokes,
    lts.total_to_par as score_to_par,
    lts.position,
    CASE 
        WHEN lts.position ~ '^[0-9]+$' THEN lts.position::INTEGER
        WHEN lts.position LIKE 'T%' THEN SUBSTRING(lts.position FROM 2)::INTEGER
        ELSE NULL
    END as position_numeric,
    
    -- Strokes Gained
    lts.sg_putt as sg_putting,
    lts.sg_arg as sg_around_green,
    lts.sg_app as sg_approach,
    lts.sg_ott as sg_off_tee,
    lts.sg_total,
    
    -- Traditional stats
    lts.distance as driving_distance,
    CASE 
        WHEN lts.accuracy BETWEEN 0 AND 1 THEN lts.accuracy
        WHEN lts.accuracy > 1 THEN lts.accuracy / 100.0
        ELSE NULL
    END as driving_accuracy,
    CASE 
        WHEN lts.gir BETWEEN 0 AND 1 THEN lts.gir
        WHEN lts.gir > 1 THEN lts.gir / 100.0
        ELSE NULL
    END as greens_in_regulation,
    lts.putts,
    
    -- Metadata
    NOW() as created_at,
    NOW() as updated_at,
    'live_tournament_stats' as data_source
FROM live_tournament_stats lts
JOIN tournaments t ON lts.tourney_id = t.event_id
JOIN players p ON lts.dg_id = p.dg_id
-- Only insert if not already exists from better sources
WHERE NOT EXISTS (
    SELECT 1 FROM tournament_rounds tr2 
    WHERE tr2.tournament_id = t.id 
    AND tr2.player_id = p.id 
    AND tr2.round_date = lts.data_golf_updated_at::DATE
    AND tr2.data_source IN ('tournament_round_snapshots', 'tournament_results_v2')
)
ON CONFLICT DO NOTHING;

-- Record migration stats for live stats
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
SELECT 
    'tournament_rounds_from_live',
    (SELECT COUNT(*) FROM live_tournament_stats),
    (SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'live_tournament_stats'),
    ROUND((SELECT COUNT(*) FROM tournament_rounds WHERE data_source = 'live_tournament_stats') * 100.0 / 
          (SELECT COUNT(*) FROM live_tournament_stats), 2);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'live_stats_migration' AND status = 'started';

-- =============================================
-- PHASE 3: BETTING DATA MIGRATION
-- =============================================

-- BETTING MARKETS CREATION from matchups_v2
INSERT INTO migration_log (migration_step, status, details) 
VALUES ('betting_migration', 'started', '{"phase": "betting_data"}');

-- Create betting markets for each unique matchup
INSERT INTO betting_markets (
    tournament_id, sportsbook_id, market_type, market_name, players_involved,
    round_number, status, created_at, updated_at
)
SELECT DISTINCT
    t.id as tournament_id,
    sb.id as sportsbook_id,
    CASE 
        WHEN m.player3_dg_id IS NOT NULL THEN 'three_ball'
        ELSE 'head_to_head'
    END as market_type,
    CASE 
        WHEN m.player3_dg_id IS NOT NULL THEN 
            p1.name || ' vs ' || p2.name || ' vs ' || p3.name
        ELSE 
            p1.name || ' vs ' || p2.name
    END as market_name,
    CASE 
        WHEN m.player3_dg_id IS NOT NULL THEN 
            ARRAY[p1.id, p2.id, p3.id]
        ELSE 
            ARRAY[p1.id, p2.id]
    END as players_involved,
    CASE 
        WHEN m.round_num ~ '^[0-9]+$' THEN m.round_num::INTEGER 
        ELSE NULL 
    END as round_number,
    'closed' as status, -- Historical markets are closed
    m.created_at,
    m.updated_at
FROM matchups_v2 m
JOIN tournaments t ON m.event_id = t.event_id
JOIN players p1 ON m.player1_dg_id = p1.dg_id
JOIN players p2 ON m.player2_dg_id = p2.dg_id
LEFT JOIN players p3 ON m.player3_dg_id = p3.dg_id
CROSS JOIN (
    SELECT id, name FROM sportsbooks WHERE name IN ('fanduel', 'bet365', 'draftkings')
) sb
ON CONFLICT DO NOTHING;

-- Create odds history records from matchup odds
-- FanDuel odds
INSERT INTO odds_history (
    market_id, player_id, sportsbook_id, decimal_odds, american_odds, 
    implied_probability, timestamp, created_at, data_source
)
SELECT 
    bm.id as market_id,
    p.id as player_id,
    sb.id as sportsbook_id,
    CASE 
        WHEN odds_data.american_odds > 0 THEN (odds_data.american_odds / 100.0) + 1
        ELSE (100.0 / ABS(odds_data.american_odds)) + 1
    END as decimal_odds,
    odds_data.american_odds,
    CASE 
        WHEN odds_data.american_odds > 0 THEN 100.0 / (odds_data.american_odds + 100)
        ELSE ABS(odds_data.american_odds) / (ABS(odds_data.american_odds) + 100)
    END as implied_probability,
    COALESCE(m.updated_at, m.created_at) as timestamp,
    NOW() as created_at,
    'matchups_v2_migration' as data_source
FROM matchups_v2 m
JOIN betting_markets bm ON (
    bm.tournament_id IN (SELECT id FROM tournaments WHERE event_id = m.event_id)
    AND bm.market_name LIKE '%' || (SELECT name FROM players WHERE dg_id = m.player1_dg_id) || '%'
    AND bm.market_name LIKE '%' || (SELECT name FROM players WHERE dg_id = m.player2_dg_id) || '%'
)
JOIN sportsbooks sb ON sb.name = odds_data.sportsbook
JOIN players p ON p.dg_id = odds_data.player_dg_id
CROSS JOIN LATERAL (
    VALUES 
        ('fanduel', m.player1_dg_id, m.fanduel_player1_odds),
        ('fanduel', m.player2_dg_id, m.fanduel_player2_odds),
        ('bet365', m.player1_dg_id, m.bet365_player1_odds),
        ('bet365', m.player2_dg_id, m.bet365_player2_odds),
        ('draftkings', m.player1_dg_id, m.dg_odds1),
        ('draftkings', m.player2_dg_id, m.dg_odds2)
) AS odds_data(sportsbook, player_dg_id, american_odds)
WHERE odds_data.american_odds IS NOT NULL
AND odds_data.american_odds BETWEEN -2000 AND 2000 -- Reasonable odds validation
ON CONFLICT DO NOTHING;

-- Record betting migration stats
INSERT INTO migration_stats (table_name, source_count, target_count, success_rate)
VALUES 
    ('betting_markets', 
     (SELECT COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id, COALESCE(player3_dg_id, -1))) FROM matchups_v2),
     (SELECT COUNT(*) FROM betting_markets),
     ROUND((SELECT COUNT(*) FROM betting_markets) * 100.0 / 
           (SELECT COUNT(DISTINCT (event_id, round_num, player1_dg_id, player2_dg_id, COALESCE(player3_dg_id, -1))) FROM matchups_v2), 2)),
    ('odds_history',
     (SELECT COUNT(*) FROM matchups_v2) * 6, -- Up to 6 odds per matchup
     (SELECT COUNT(*) FROM odds_history WHERE data_source = 'matchups_v2_migration'),
     ROUND((SELECT COUNT(*) FROM odds_history WHERE data_source = 'matchups_v2_migration') * 100.0 / 
           ((SELECT COUNT(*) FROM matchups_v2) * 6), 2));

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'betting_migration' AND status = 'started';

-- =============================================
-- PHASE 4: DATA ENRICHMENT AND CALCULATIONS
-- =============================================

INSERT INTO migration_log (migration_step, status, details) 
VALUES ('data_enrichment', 'started', '{"phase": "calculations"}');

-- Calculate tournament field strength
UPDATE tournaments SET field_strength = (
    SELECT COALESCE(AVG(p.world_ranking), 50) -- Default to 50 if no ranking data
    FROM tournament_rounds tr
    JOIN players p ON tr.player_id = p.id
    WHERE tr.tournament_id = tournaments.id
    AND p.world_ranking IS NOT NULL
    AND p.world_ranking > 0
);

-- Calculate player career statistics from migrated data
UPDATE players SET 
    pga_tour_wins = (
        SELECT COUNT(DISTINCT tr.tournament_id)
        FROM tournament_rounds tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE tr.player_id = players.id 
        AND tr.position_numeric = 1
        AND t.tour = 'pga'
    ),
    major_wins = (
        SELECT COUNT(DISTINCT tr.tournament_id)
        FROM tournament_rounds tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE tr.player_id = players.id 
        AND tr.position_numeric = 1
        AND t.tournament_type = 'major'
    );

-- Update course par from tournament data where missing
UPDATE courses SET par = (
    SELECT mode() WITHIN GROUP (ORDER BY course_par)
    FROM tournaments_v2 
    WHERE course_name = courses.name
    AND course_par IS NOT NULL
)
WHERE par = 72 -- Only update default values
AND EXISTS (
    SELECT 1 FROM tournaments_v2 
    WHERE course_name = courses.name 
    AND course_par IS NOT NULL
);

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'data_enrichment' AND status = 'started';

-- =============================================
-- PHASE 5: REFRESH MATERIALIZED VIEWS
-- =============================================

INSERT INTO migration_log (migration_step, status, details) 
VALUES ('materialized_views_refresh', 'started', '{"phase": "optimization"}');

-- Refresh materialized views
REFRESH MATERIALIZED VIEW current_tournament_leaderboard;
REFRESH MATERIALIZED VIEW player_recent_form;

UPDATE migration_log 
SET status = 'completed', completed_at = NOW()
WHERE migration_step = 'materialized_views_refresh' AND status = 'started';

-- =============================================
-- MIGRATION COMPLETION AND STATISTICS
-- =============================================

-- Final migration statistics
SELECT 
    table_name,
    source_count,
    target_count,
    success_rate,
    CASE 
        WHEN success_rate >= 95 THEN '✅ EXCELLENT'
        WHEN success_rate >= 85 THEN '✅ GOOD'
        WHEN success_rate >= 70 THEN '⚠️ ACCEPTABLE'
        ELSE '❌ NEEDS_REVIEW'
    END as status
FROM migration_stats
ORDER BY success_rate DESC;

-- Update final migration log
UPDATE migration_log 
SET status = 'completed', completed_at = NOW(),
    details = details || jsonb_build_object(
        'total_records_migrated', (SELECT SUM(target_count) FROM migration_stats),
        'average_success_rate', (SELECT ROUND(AVG(success_rate), 2) FROM migration_stats),
        'migration_summary', (
            SELECT jsonb_object_agg(table_name, jsonb_build_object(
                'source_count', source_count,
                'target_count', target_count,
                'success_rate', success_rate
            ))
            FROM migration_stats
        )
    )
WHERE migration_step = 'data_migration' AND status = 'started';

-- Final success message
SELECT 
    'DATA MIGRATION COMPLETED' as status,
    COUNT(*) as total_steps_completed,
    (SELECT SUM(target_count) FROM migration_stats) as total_records_migrated,
    ROUND((SELECT AVG(success_rate) FROM migration_stats), 2) as average_success_rate,
    NOW() as completed_at
FROM migration_log 
WHERE status = 'completed';