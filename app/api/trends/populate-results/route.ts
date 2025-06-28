import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();

    // Get recent tournaments from the tournaments table
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('event_id, event_name, start_date, end_date')
      .gte('start_date', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 6 months
      .order('start_date', { ascending: false });

    if (tournamentsError) {
      return Response.json({ success: false, error: tournamentsError.message }, { status: 500 });
    }

    if (!tournaments || tournaments.length === 0) {
      return Response.json({ success: true, message: 'No recent tournaments found' });
    }

    const resultsToInsert = [];
    let processedTournaments = 0;

    for (const tournament of tournaments) {
      // Check if we already have results for this tournament
      const { data: existingResults, error: checkError } = await supabase
        .from('tournament_results')
        .select('id')
        .eq('event_id', tournament.event_id)
        .limit(1);

      if (checkError) {
        console.warn(`Error checking existing results for ${tournament.event_name}:`, checkError);
        continue;
      }

      if (existingResults && existingResults.length > 0) {
        console.log(`Results already exist for ${tournament.event_name}, skipping`);
        continue;
      }

      // Get live stats data for this tournament to extract final results
      const { data: liveStats, error: liveStatsError } = await supabase
        .from('latest_live_tournament_stats_view')
        .select(`
          dg_id,
          player_name,
          event_name,
          round_num,
          position,
          total,
          thru
        `)
        .eq('event_name', tournament.event_name)
        .not('position', 'is', null);

      if (liveStatsError) {
        console.warn(`Error fetching live stats for ${tournament.event_name}:`, liveStatsError);
        continue;
      }

      if (!liveStats || liveStats.length === 0) {
        console.log(`No live stats found for ${tournament.event_name}`);
        continue;
      }

      // Process each player's final results
      const playerResults = new Map();
      
      liveStats.forEach(stat => {
        const playerId = stat.dg_id;
        if (!playerResults.has(playerId)) {
          playerResults.set(playerId, {
            dg_id: playerId,
            player_name: stat.player_name,
            rounds: new Map()
          });
        }
        
        if (stat.round_num && !isNaN(Number(stat.round_num))) {
          playerResults.get(playerId).rounds.set(Number(stat.round_num), {
            position: stat.position,
            total: stat.total,
            today: stat.today,
            thru: stat.thru
          });
        }
      });

      // Convert to tournament results format
      for (const [playerId, playerData] of playerResults) {
        const rounds = Array.from(playerData.rounds.entries()).sort((a, b) => a[0] - b[0]);
        const finalRound = rounds[rounds.length - 1];
        
        if (finalRound && finalRound[1]) {
          const finalData = finalRound[1];
          const finishPosition = finalData.position ? parseInt(finalData.position.toString()) : null;
          const totalScore = finalData.total;
          const roundsPlayed = rounds.length;
          
          // Determine if missed cut (typically if rounds < 4 and position is null or very high)
          const missedCut = roundsPlayed < 4 || (finishPosition && finishPosition > 150);

          // Calculate individual round scores (approximation)
          const roundScores = [];
          let previousTotal = 0;
          for (const [roundNum, roundData] of rounds) {
            if (roundData.total !== null && roundData.total !== undefined) {
              const roundScore = roundData.total - previousTotal;
              roundScores.push(roundScore);
              previousTotal = roundData.total;
            }
          }

          resultsToInsert.push({
            dg_id: playerId,
            player_name: playerData.player_name,
            event_id: tournament.event_id,
            event_name: tournament.event_name,
            start_date: tournament.start_date,
            end_date: tournament.end_date,
            finish_position: finishPosition,
            total_score: totalScore,
            missed_cut: missedCut,
            rounds_played: roundsPlayed,
            round_scores: roundScores.length > 0 ? roundScores : null
          });
        }
      }

      processedTournaments++;
      console.log(`Processed ${tournament.event_name}: ${playerResults.size} players`);
    }

    // Insert results in batches
    if (resultsToInsert.length > 0) {
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < resultsToInsert.length; i += batchSize) {
        const batch = resultsToInsert.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('tournament_results')
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
          // Continue with next batch instead of failing completely
        } else {
          insertedCount += batch.length;
        }
      }

      return Response.json({ 
        success: true, 
        message: `Populated tournament results for ${processedTournaments} tournaments`,
        tournaments_processed: processedTournaments,
        results_inserted: insertedCount,
        total_results: resultsToInsert.length
      });
    } else {
      return Response.json({ 
        success: true, 
        message: 'No new tournament results to populate',
        tournaments_processed: processedTournaments
      });
    }

  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}