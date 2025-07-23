-- AI-Optimized Golf Parlay Analytics Schema
-- Phase 6: Optimization Structures
-- Materialized views, indexes, and performance enhancements for real-time analytics

-- =========================================
-- PERFORMANCE MATERIALIZED VIEWS
-- =========================================

-- Player Performance Dashboard - Real-time player stats for quick lookup
CREATE MATERIALIZED VIEW player_performance_dashboard AS
SELECT 
    p.id as player_id,
    p.name as player_name,
    p.country,
    p.dg_id,
    
    -- Recent performance (last 10 rounds)
    recent_stats.avg_sg_total as recent_sg_total,
    recent_stats.avg_score_to_par as recent_score_to_par,
    recent_stats.rounds_played as recent_rounds,
    recent_stats.cuts_made as recent_cuts_made,
    recent_stats.top_10s as recent_top_10s,
    
    -- Season totals
    season_stats.season_rounds,
    season_stats.season_cuts_made,
    season_stats.season_top_10s,
    season_stats.season_earnings,
    
    -- SG breakdowns (season)
    season_stats.avg_sg_off_tee,
    season_stats.avg_sg_approach,
    season_stats.avg_sg_around_green,
    season_stats.avg_sg_putting,
    
    -- Consistency metrics
    season_stats.scoring_variance,
    season_stats.missed_cut_percentage,
    
    -- Current form indicators
    momentum.momentum_score,
    momentum.trending_direction,
    momentum.confidence_level,
    
    -- Betting relevance
    edge_opportunities.high_value_bets,
    edge_opportunities.avg_betting_edge,
    
    -- Last updated
    GREATEST(
        recent_stats.last_round_date,
        season_stats.last_updated,
        momentum.calculated_at
    ) as last_updated

FROM players p

-- Recent performance (last 10 rounds)
LEFT JOIN (
    SELECT 
        player_id,
        AVG(sg_total) as avg_sg_total,
        AVG(score_to_par) as avg_score_to_par,
        COUNT(*) as rounds_played,
        COUNT(*) FILTER (WHERE position_numeric IS NOT NULL) as cuts_made,
        COUNT(*) FILTER (WHERE position_numeric <= 10) as top_10s,
        MAX(round_date) as last_round_date
    FROM tournament_rounds 
    WHERE round_date > NOW() - INTERVAL '60 days'
    AND holes_completed = 18
    GROUP BY player_id
) recent_stats ON p.id = recent_stats.player_id

-- Season statistics  
LEFT JOIN (
    SELECT 
        tr.player_id,
        COUNT(DISTINCT tr.tournament_id) as season_rounds,
        COUNT(DISTINCT tr.tournament_id) FILTER (WHERE tr.position_numeric IS NOT NULL) as season_cuts_made,
        COUNT(DISTINCT tr.tournament_id) FILTER (WHERE tr.position_numeric <= 10) as season_top_10s,
        AVG(tr.sg_off_tee) as avg_sg_off_tee,
        AVG(tr.sg_approach) as avg_sg_approach,
        AVG(tr.sg_around_green) as avg_sg_around_green,
        AVG(tr.sg_putting) as avg_sg_putting,
        STDDEV(tr.score_to_par) as scoring_variance,
        (COUNT(*) FILTER (WHERE tr.position = 'CUT') * 100.0 / COUNT(*)) as missed_cut_percentage,
        0 as season_earnings, -- Placeholder for earnings calculation
        MAX(tr.round_date) as last_updated
    FROM tournament_rounds tr
    WHERE tr.round_date >= DATE_TRUNC('year', NOW())
    AND tr.holes_completed = 18
    GROUP BY tr.player_id
) season_stats ON p.id = season_stats.player_id

-- Momentum analysis
LEFT JOIN (
    SELECT 
        player_id,
        AVG(momentum_score) as momentum_score,
        CASE 
            WHEN AVG(momentum_score) > 0.6 THEN 'up'
            WHEN AVG(momentum_score) < 0.4 THEN 'down'
            ELSE 'stable'
        END as trending_direction,
        AVG(data_quality_score) as confidence_level,
        MAX(round_date) as calculated_at
    FROM tournament_rounds
    WHERE round_date > NOW() - INTERVAL '30 days'
    AND momentum_score IS NOT NULL
    GROUP BY player_id
) momentum ON p.id = momentum.player_id

-- Betting edge opportunities
LEFT JOIN (
    SELECT 
        ed.player_id,
        COUNT(*) FILTER (WHERE ed.edge_percentage > 10) as high_value_bets,
        AVG(ed.edge_percentage) as avg_betting_edge
    FROM edge_detection ed
    WHERE ed.detected_at > NOW() - INTERVAL '7 days'
    AND ed.edge_percentage > 0
    GROUP BY ed.player_id
) edge_opportunities ON p.id = edge_opportunities.player_id

WHERE p.active = true;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_player_dashboard_player_id ON player_performance_dashboard(player_id);
CREATE INDEX idx_player_dashboard_recent_sg ON player_performance_dashboard(recent_sg_total DESC NULLS LAST);
CREATE INDEX idx_player_dashboard_momentum ON player_performance_dashboard(momentum_score DESC NULLS LAST);

-- Tournament Betting Opportunities - Live tournament betting dashboard
CREATE MATERIALIZED VIEW tournament_betting_opportunities AS
SELECT 
    t.id as tournament_id,
    t.name as tournament_name,
    t.start_date,
    t.status as tournament_status,
    c.name as course_name,
    
    -- Field analysis
    field_metrics.avg_world_ranking,
    field_metrics.field_strength_score,
    field_metrics.total_players,
    
    -- Current leaderboard insights
    leaderboard.leader_score,
    leaderboard.cut_line_projected,
    leaderboard.leaders_count,
    
    -- Betting market summary
    market_summary.total_markets,
    market_summary.active_sportsbooks,
    market_summary.total_edges_detected,
    market_summary.avg_edge_percentage,
    market_summary.high_value_opportunities,
    
    -- Parlay opportunities
    parlay_ops.optimal_parlays_available,
    parlay_ops.avg_parlay_ev,
    parlay_ops.low_correlation_combos,
    
    -- Weather and conditions
    conditions.weather_impact_score,
    conditions.playing_conditions,
    
    -- AI insights summary
    ai_insights.key_storylines,
    ai_insights.betting_recommendations,
    ai_insights.confidence_level,
    
    -- Real-time updates
    GREATEST(
        market_summary.last_updated,
        parlay_ops.last_calculated,
        ai_insights.last_generated
    ) as last_updated

FROM tournaments t
LEFT JOIN courses c ON t.course_id = c.id

-- Field strength analysis
LEFT JOIN (
    SELECT 
        tournament_id,
        AVG(field_strength) as avg_world_ranking,
        field_strength as field_strength_score,
        COUNT(*) as total_players
    FROM tournaments
    WHERE status IN ('active', 'scheduled')
    GROUP BY tournament_id, field_strength
) field_metrics ON t.id = field_metrics.tournament_id

-- Current leaderboard
LEFT JOIN (
    SELECT 
        tournament_id,
        MIN(score_to_par) as leader_score,
        PERCENTILE_CONT(0.65) WITHIN GROUP (ORDER BY score_to_par) as cut_line_projected,
        COUNT(DISTINCT player_id) FILTER (WHERE position_numeric = 1) as leaders_count
    FROM tournament_rounds
    WHERE round_date > NOW() - INTERVAL '7 days'
    GROUP BY tournament_id
) leaderboard ON t.id = leaderboard.tournament_id

-- Market summary
LEFT JOIN (
    SELECT 
        bm.tournament_id,
        COUNT(*) as total_markets,
        COUNT(DISTINCT bm.sportsbook_id) as active_sportsbooks,
        COUNT(ed.id) as total_edges_detected,
        AVG(ed.edge_percentage) as avg_edge_percentage,
        COUNT(*) FILTER (WHERE ed.edge_percentage > 15) as high_value_opportunities,
        MAX(ed.detected_at) as last_updated
    FROM betting_markets bm
    LEFT JOIN edge_detection ed ON bm.id = ed.market_id
    WHERE bm.status = 'active'
    AND ed.detected_at > NOW() - INTERVAL '6 hours'
    GROUP BY bm.tournament_id
) market_summary ON t.id = market_summary.tournament_id

-- Parlay opportunities
LEFT JOIN (
    SELECT 
        tournament_id,
        COUNT(*) as optimal_parlays_available,
        AVG(expected_value) as avg_parlay_ev,
        COUNT(*) FILTER (WHERE independence_score > 0.8) as low_correlation_combos,
        MAX(generated_at) as last_calculated
    FROM optimal_parlay_combinations
    WHERE generated_at > NOW() - INTERVAL '4 hours'
    AND status = 'generated'
    GROUP BY tournament_id
) parlay_ops ON t.id = parlay_ops.tournament_id

-- Weather and conditions
LEFT JOIN (
    SELECT 
        tournament_id,
        COALESCE(
            (weather_conditions->>'impact_score')::DECIMAL, 
            5.0
        ) as weather_impact_score,
        weather_conditions->>'description' as playing_conditions
    FROM tournaments
    WHERE weather_conditions IS NOT NULL
) conditions ON t.id = conditions.tournament_id

-- AI insights
LEFT JOIN (
    SELECT 
        tournament_id,
        key_storylines,
        betting_market_insights as betting_recommendations,
        confidence_levels->>'overall' as confidence_level,
        MAX(generation_timestamp) as last_generated
    FROM tournament_insights
    WHERE insight_type = 'betting_market_analysis'
    AND generation_timestamp > NOW() - INTERVAL '12 hours'
    GROUP BY tournament_id, key_storylines, betting_market_insights, confidence_levels
) ai_insights ON t.id = ai_insights.tournament_id

WHERE t.status IN ('active', 'scheduled')
AND t.start_date >= NOW() - INTERVAL '7 days'
AND t.start_date <= NOW() + INTERVAL '14 days';

-- Indexes for betting opportunities
CREATE UNIQUE INDEX idx_betting_ops_tournament ON tournament_betting_opportunities(tournament_id);
CREATE INDEX idx_betting_ops_edges ON tournament_betting_opportunities(total_edges_detected DESC);
CREATE INDEX idx_betting_ops_parlay_ev ON tournament_betting_opportunities(avg_parlay_ev DESC NULLS LAST);

-- =========================================
-- REAL-TIME ANALYTICS VIEWS
-- =========================================

-- Live Tournament Leaderboard - Real-time tournament standings
CREATE MATERIALIZED VIEW live_tournament_leaderboard AS
SELECT 
    tr.tournament_id,
    t.name as tournament_name,
    t.status as tournament_status,
    
    -- Player info
    tr.player_id,
    p.name as player_name,
    p.country,
    
    -- Current position
    tr.position,
    tr.position_numeric,
    
    -- Scoring
    SUM(tr.strokes) as total_strokes,
    SUM(tr.score_to_par) as total_score_to_par,
    tr.round_number as rounds_completed,
    
    -- Latest round performance
    latest_round.latest_sg_total,
    latest_round.latest_round_score,
    latest_round.round_momentum,
    
    -- Strokes gained totals
    AVG(tr.sg_total) as avg_sg_total,
    AVG(tr.sg_off_tee) as avg_sg_off_tee,
    AVG(tr.sg_approach) as avg_sg_approach,
    AVG(tr.sg_putting) as avg_sg_putting,
    
    -- Position changes
    position_changes.position_change_rd1_to_current,
    position_changes.biggest_move_up,
    position_changes.biggest_move_down,
    
    -- Cut projection
    cut_analysis.cut_projected,
    cut_analysis.cushion_from_cut,
    
    -- Betting implications
    betting_data.current_odds,
    betting_data.odds_movement,
    betting_data.betting_interest,
    
    -- Last updated
    MAX(tr.round_date) as last_updated

FROM tournament_rounds tr
JOIN tournaments t ON tr.tournament_id = t.id
JOIN players p ON tr.player_id = p.id

-- Latest round performance
LEFT JOIN (
    SELECT 
        tournament_id,
        player_id,
        sg_total as latest_sg_total,
        score_to_par as latest_round_score,
        momentum_score as round_momentum,
        ROW_NUMBER() OVER (PARTITION BY tournament_id, player_id ORDER BY round_date DESC) as rn
    FROM tournament_rounds
    WHERE holes_completed = 18
) latest_round ON tr.tournament_id = latest_round.tournament_id 
    AND tr.player_id = latest_round.player_id 
    AND latest_round.rn = 1

-- Position change analysis
LEFT JOIN (
    SELECT 
        tournament_id,
        player_id,
        (
            SELECT position_numeric 
            FROM tournament_rounds tr2 
            WHERE tr2.tournament_id = tr.tournament_id 
            AND tr2.player_id = tr.player_id 
            AND tr2.round_number = 1
        ) - position_numeric as position_change_rd1_to_current,
        MAX(position_numeric) - MIN(position_numeric) as biggest_move_up,
        MIN(position_numeric) - MAX(position_numeric) as biggest_move_down
    FROM tournament_rounds tr
    WHERE position_numeric IS NOT NULL
    GROUP BY tournament_id, player_id
) position_changes ON tr.tournament_id = position_changes.tournament_id 
    AND tr.player_id = position_changes.player_id

-- Cut analysis
LEFT JOIN (
    SELECT 
        tournament_id,
        player_id,
        CASE 
            WHEN position_numeric IS NOT NULL THEN true
            ELSE false
        END as cut_projected,
        CASE 
            WHEN position_numeric IS NOT NULL THEN 
                position_numeric - (
                    SELECT PERCENTILE_CONT(0.7) WITHIN GROUP (ORDER BY position_numeric)
                    FROM tournament_rounds tr3 
                    WHERE tr3.tournament_id = tr.tournament_id
                    AND tr3.position_numeric IS NOT NULL
                )
            ELSE NULL
        END as cushion_from_cut
    FROM tournament_rounds tr
    WHERE round_number = (
        SELECT MAX(round_number) 
        FROM tournament_rounds tr2 
        WHERE tr2.tournament_id = tr.tournament_id
    )
) cut_analysis ON tr.tournament_id = cut_analysis.tournament_id 
    AND tr.player_id = cut_analysis.player_id

-- Betting data
LEFT JOIN (
    SELECT 
        bm.tournament_id,
        oh.player_id,
        oh.decimal_odds as current_odds,
        oh.odds_movement,
        oh.volume as betting_interest,
        ROW_NUMBER() OVER (
            PARTITION BY bm.tournament_id, oh.player_id 
            ORDER BY oh.timestamp DESC
        ) as rn
    FROM betting_markets bm
    JOIN odds_history oh ON bm.id = oh.market_id
    WHERE bm.market_type = 'outright_winner'
    AND oh.timestamp > NOW() - INTERVAL '2 hours'
) betting_data ON tr.tournament_id = betting_data.tournament_id 
    AND tr.player_id = betting_data.player_id 
    AND betting_data.rn = 1

WHERE t.status = 'active'
AND tr.holes_completed = 18
GROUP BY 
    tr.tournament_id, t.name, t.status, tr.player_id, p.name, p.country,
    tr.position, tr.position_numeric, tr.round_number,
    latest_round.latest_sg_total, latest_round.latest_round_score, latest_round.round_momentum,
    position_changes.position_change_rd1_to_current, position_changes.biggest_move_up, position_changes.biggest_move_down,
    cut_analysis.cut_projected, cut_analysis.cushion_from_cut,
    betting_data.current_odds, betting_data.odds_movement, betting_data.betting_interest;

-- Indexes for leaderboard
CREATE INDEX idx_leaderboard_tournament_position ON live_tournament_leaderboard(tournament_id, position_numeric);
CREATE INDEX idx_leaderboard_player ON live_tournament_leaderboard(player_id, tournament_id);
CREATE INDEX idx_leaderboard_scoring ON live_tournament_leaderboard(total_score_to_par, avg_sg_total);

-- =========================================
-- ADVANCED AGGREGATION VIEWS
-- =========================================

-- Player Course Fit Analysis - Historical course performance
CREATE MATERIALIZED VIEW player_course_fit_analysis AS
SELECT 
    p.id as player_id,
    p.name as player_name,
    c.id as course_id,
    c.name as course_name,
    c.course_type,
    
    -- Historical performance
    COUNT(DISTINCT t.id) as tournaments_played,
    AVG(final_pos.position_numeric) as avg_finish_position,
    COUNT(*) FILTER (WHERE final_pos.position_numeric <= 10) as top_10_finishes,
    COUNT(*) FILTER (WHERE final_pos.position_numeric <= 5) as top_5_finishes,
    COUNT(*) FILTER (WHERE final_pos.position_numeric = 1) as wins,
    
    -- Scoring analysis
    AVG(scoring.avg_score_to_par) as avg_tournament_score,
    AVG(scoring.best_round) as avg_best_round,
    AVG(scoring.worst_round) as avg_worst_round,
    STDDEV(scoring.avg_score_to_par) as scoring_consistency,
    
    -- Strokes gained analysis
    AVG(sg_stats.avg_sg_total) as avg_sg_total,
    AVG(sg_stats.avg_sg_off_tee) as avg_sg_off_tee,
    AVG(sg_stats.avg_sg_approach) as avg_sg_approach,
    AVG(sg_stats.avg_sg_putting) as avg_sg_putting,
    
    -- Course-specific insights
    course_fit.driving_advantage,
    course_fit.approach_advantage,
    course_fit.putting_advantage,
    course_fit.overall_fit_score,
    
    -- Recent performance trend
    recent_trend.recent_avg_finish,
    recent_trend.trend_direction,
    
    -- Betting implications
    betting_value.historical_overlay_percentage,
    betting_value.avg_closing_line_value,
    
    -- Last tournament at this course
    MAX(t.start_date) as last_played_date,
    
    -- Data quality
    CASE 
        WHEN COUNT(DISTINCT t.id) >= 5 THEN 'high'
        WHEN COUNT(DISTINCT t.id) >= 3 THEN 'medium'
        ELSE 'low'
    END as data_confidence_level

FROM players p
CROSS JOIN courses c

-- Tournament participation
LEFT JOIN tournaments t ON t.course_id = c.id
LEFT JOIN tournament_rounds tr ON t.id = tr.tournament_id AND p.id = tr.player_id

-- Final positions
LEFT JOIN (
    SELECT 
        tournament_id,
        player_id,
        position_numeric
    FROM tournament_rounds
    WHERE round_number = 4 -- Final round
    OR (round_number = (
        SELECT MAX(round_number) 
        FROM tournament_rounds tr2 
        WHERE tr2.tournament_id = tournament_rounds.tournament_id
    ))
) final_pos ON t.id = final_pos.tournament_id AND p.id = final_pos.player_id

-- Scoring statistics
LEFT JOIN (
    SELECT 
        tournament_id,
        player_id,
        AVG(score_to_par) as avg_score_to_par,
        MIN(score_to_par) as best_round,
        MAX(score_to_par) as worst_round
    FROM tournament_rounds
    WHERE holes_completed = 18
    GROUP BY tournament_id, player_id
) scoring ON t.id = scoring.tournament_id AND p.id = scoring.player_id

-- Strokes gained statistics
LEFT JOIN (
    SELECT 
        tournament_id,
        player_id,
        AVG(sg_total) as avg_sg_total,
        AVG(sg_off_tee) as avg_sg_off_tee,
        AVG(sg_approach) as avg_sg_approach,
        AVG(sg_putting) as avg_sg_putting
    FROM tournament_rounds
    WHERE holes_completed = 18
    AND sg_total IS NOT NULL
    GROUP BY tournament_id, player_id
) sg_stats ON t.id = sg_stats.tournament_id AND p.id = sg_stats.player_id

-- Course fit calculation
LEFT JOIN (
    SELECT 
        tr.player_id,
        c2.id as course_id,
        AVG(tr.sg_off_tee) - (
            SELECT AVG(sg_off_tee) 
            FROM tournament_rounds tr3 
            WHERE tr3.player_id = tr.player_id 
            AND tr3.sg_off_tee IS NOT NULL
        ) as driving_advantage,
        AVG(tr.sg_approach) - (
            SELECT AVG(sg_approach) 
            FROM tournament_rounds tr4 
            WHERE tr4.player_id = tr.player_id 
            AND tr4.sg_approach IS NOT NULL
        ) as approach_advantage,
        AVG(tr.sg_putting) - (
            SELECT AVG(sg_putting) 
            FROM tournament_rounds tr5 
            WHERE tr5.player_id = tr.player_id 
            AND tr5.sg_putting IS NOT NULL
        ) as putting_advantage,
        AVG(tr.sg_total) - (
            SELECT AVG(sg_total) 
            FROM tournament_rounds tr6 
            WHERE tr6.player_id = tr.player_id 
            AND tr6.sg_total IS NOT NULL
        ) as overall_fit_score
    FROM tournament_rounds tr
    JOIN tournaments t2 ON tr.tournament_id = t2.id
    JOIN courses c2 ON t2.course_id = c2.id
    WHERE tr.sg_total IS NOT NULL
    GROUP BY tr.player_id, c2.id
) course_fit ON p.id = course_fit.player_id AND c.id = course_fit.course_id

-- Recent performance trend (last 3 tournaments at course)
LEFT JOIN (
    SELECT 
        player_id,
        course_id,
        AVG(position_numeric) as recent_avg_finish,
        CASE 
            WHEN AVG(position_numeric) < LAG(AVG(position_numeric)) OVER (
                PARTITION BY player_id, course_id 
                ORDER BY MAX(tournament_date)
            ) THEN 'improving'
            WHEN AVG(position_numeric) > LAG(AVG(position_numeric)) OVER (
                PARTITION BY player_id, course_id 
                ORDER BY MAX(tournament_date)
            ) THEN 'declining'
            ELSE 'stable'
        END as trend_direction
    FROM (
        SELECT 
            tr.player_id,
            t.course_id,
            tr.position_numeric,
            t.start_date as tournament_date,
            ROW_NUMBER() OVER (
                PARTITION BY tr.player_id, t.course_id 
                ORDER BY t.start_date DESC
            ) as recency_rank
        FROM tournament_rounds tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE tr.round_number = 4
        AND tr.position_numeric IS NOT NULL
    ) recent_tournaments
    WHERE recency_rank <= 3
    GROUP BY player_id, course_id
) recent_trend ON p.id = recent_trend.player_id AND c.id = recent_trend.course_id

-- Betting value analysis
LEFT JOIN (
    SELECT 
        oh.player_id,
        bm.tournament_id,
        t.course_id,
        AVG(
            CASE WHEN oh.implied_probability < (
                1.0 / NULLIF(final_pos.position_numeric, 0)
            ) THEN 1 ELSE 0 END
        ) * 100 as historical_overlay_percentage,
        AVG(oh.decimal_odds - closing_odds.decimal_odds) as avg_closing_line_value
    FROM odds_history oh
    JOIN betting_markets bm ON oh.market_id = bm.id
    JOIN tournaments t ON bm.tournament_id = t.id
    LEFT JOIN tournament_rounds final_pos ON t.id = final_pos.tournament_id 
        AND oh.player_id = final_pos.player_id 
        AND final_pos.round_number = 4
    LEFT JOIN (
        SELECT DISTINCT ON (market_id, player_id)
            market_id,
            player_id,
            decimal_odds
        FROM odds_history
        ORDER BY market_id, player_id, timestamp DESC
    ) closing_odds ON oh.market_id = closing_odds.market_id 
        AND oh.player_id = closing_odds.player_id
    WHERE bm.market_type = 'outright_winner'
    GROUP BY oh.player_id, bm.tournament_id, t.course_id
) betting_value ON p.id = betting_value.player_id AND c.id = betting_value.course_id

WHERE tr.tournament_id IS NOT NULL -- Only include players who have played the course
GROUP BY 
    p.id, p.name, c.id, c.name, c.course_type,
    course_fit.driving_advantage, course_fit.approach_advantage, 
    course_fit.putting_advantage, course_fit.overall_fit_score,
    recent_trend.recent_avg_finish, recent_trend.trend_direction,
    betting_value.historical_overlay_percentage, betting_value.avg_closing_line_value
HAVING COUNT(DISTINCT t.id) >= 2; -- Minimum 2 tournaments for inclusion

-- Indexes for course fit analysis
CREATE INDEX idx_course_fit_player_course ON player_course_fit_analysis(player_id, course_id);
CREATE INDEX idx_course_fit_overall_score ON player_course_fit_analysis(overall_fit_score DESC NULLS LAST);
CREATE INDEX idx_course_fit_course_type ON player_course_fit_analysis(course_type, avg_finish_position);

-- =========================================
-- REFRESH FUNCTIONS AND AUTOMATION
-- =========================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS TEXT AS $$
DECLARE
    start_time TIMESTAMPTZ;
    result_message TEXT = '';
BEGIN
    start_time := NOW();
    
    -- Refresh views in dependency order
    REFRESH MATERIALIZED VIEW CONCURRENTLY player_performance_dashboard;
    result_message := result_message || 'Player dashboard refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY tournament_betting_opportunities;
    result_message := result_message || 'Betting opportunities refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY live_tournament_leaderboard;
    result_message := result_message || 'Leaderboard refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY player_course_fit_analysis;
    result_message := result_message || 'Course fit analysis refreshed. ';
    
    -- Also refresh key views from other modules
    REFRESH MATERIALIZED VIEW CONCURRENTLY current_market_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY hot_parlay_opportunities;
    REFRESH MATERIALIZED VIEW CONCURRENTLY player_prediction_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY parlay_opportunity_heatmap;
    
    result_message := result_message || 'All views refreshed in ' || 
        EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER || ' seconds.';
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh views during active tournaments only
CREATE OR REPLACE FUNCTION smart_refresh_analytics_views()
RETURNS TEXT AS $$
DECLARE
    active_tournaments INTEGER;
    start_time TIMESTAMPTZ;
    result_message TEXT = '';
BEGIN
    start_time := NOW();
    
    -- Check if we have active tournaments
    SELECT COUNT(*) INTO active_tournaments
    FROM tournaments 
    WHERE status = 'active';
    
    IF active_tournaments = 0 THEN
        RETURN 'No active tournaments - skipping refresh to save resources.';
    END IF;
    
    -- Refresh high-priority views first
    REFRESH MATERIALIZED VIEW CONCURRENTLY live_tournament_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY tournament_betting_opportunities;
    result_message := 'Priority views refreshed. ';
    
    -- Refresh other views if we have time/resources
    REFRESH MATERIALIZED VIEW CONCURRENTLY player_performance_dashboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY current_market_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY hot_parlay_opportunities;
    
    result_message := result_message || 'Smart refresh completed for ' || 
        active_tournaments || ' active tournaments in ' ||
        EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER || ' seconds.';
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- PERFORMANCE MONITORING VIEWS
-- =========================================

-- Database Performance Monitor
CREATE MATERIALIZED VIEW database_performance_monitor AS
SELECT 
    'materialized_views' as metric_category,
    schemaname || '.' || matviewname as metric_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
    CASE WHEN ispopulated THEN 'populated' ELSE 'not_populated' END as status,
    NULL::TEXT as additional_info,
    NOW() as measured_at
FROM pg_matviews 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'table_sizes' as metric_category,
    schemaname || '.' || tablename as metric_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    'active' as status,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as additional_info,
    NOW() as measured_at
FROM pg_tables 
WHERE schemaname = 'public'
AND pg_total_relation_size(schemaname||'.'||tablename) > 1048576 -- > 1MB

UNION ALL

SELECT 
    'index_usage' as metric_category,
    schemaname || '.' || indexname as metric_name,
    idx_scan::TEXT as size,
    CASE WHEN idx_scan > 0 THEN 'used' ELSE 'unused' END as status,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as additional_info,
    NOW() as measured_at
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY metric_category, metric_name;

-- =========================================
-- AUTOMATED REFRESH SCHEDULING
-- =========================================

-- View refresh schedule configuration
CREATE TABLE view_refresh_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    view_name TEXT NOT NULL UNIQUE,
    refresh_interval INTERVAL NOT NULL,
    last_refreshed TIMESTAMPTZ,
    next_refresh TIMESTAMPTZ,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    active BOOLEAN DEFAULT true,
    refresh_condition TEXT, -- SQL condition to check before refreshing
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default refresh schedules
INSERT INTO view_refresh_schedule (view_name, refresh_interval, priority, refresh_condition) VALUES
('live_tournament_leaderboard', INTERVAL '5 minutes', 1, 'EXISTS(SELECT 1 FROM tournaments WHERE status = ''active'')'),
('tournament_betting_opportunities', INTERVAL '10 minutes', 2, 'EXISTS(SELECT 1 FROM tournaments WHERE status IN (''active'', ''scheduled''))'),
('player_performance_dashboard', INTERVAL '30 minutes', 3, NULL),
('current_market_overview', INTERVAL '15 minutes', 2, 'EXISTS(SELECT 1 FROM betting_markets WHERE status = ''active'')'),
('hot_parlay_opportunities', INTERVAL '20 minutes', 2, 'EXISTS(SELECT 1 FROM parlay_combinations WHERE status = ''pending'')'),
('player_course_fit_analysis', INTERVAL '4 hours', 4, NULL),
('database_performance_monitor', INTERVAL '1 hour', 5, NULL);

-- Comments
COMMENT ON MATERIALIZED VIEW player_performance_dashboard IS 'Real-time player performance metrics and betting relevance';
COMMENT ON MATERIALIZED VIEW tournament_betting_opportunities IS 'Live tournament betting opportunities with AI insights';
COMMENT ON MATERIALIZED VIEW live_tournament_leaderboard IS 'Real-time tournament standings with betting context';
COMMENT ON MATERIALIZED VIEW player_course_fit_analysis IS 'Historical player-course performance analysis for predictive modeling';

SELECT 'Optimization structures created successfully! Database is now ready for high-performance analytics.' as result;