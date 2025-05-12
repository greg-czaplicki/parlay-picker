import 'next-logger'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
  throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_EURO_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=euro&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_2BALL_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_3BALL_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET(request: Request) {
  logger.info('Received debug/test-euro-tour request', { url: request.url });
  logger.info("Testing European Tour data fetching...");
  try {
    const supabase = createSupabaseClient();
    // Fetch European Tour schedule
    logger.info("Fetching European Tour schedule...");
    const scheduleRes = await fetch(DATA_GOLF_EURO_SCHEDULE_URL, { cache: 'no-store' });
    if (!scheduleRes.ok) {
      throw new Error(`Failed to fetch Euro schedule: ${scheduleRes.status}`);
    }
    const scheduleData = await scheduleRes.json();
    // Fetch 2-ball and 3-ball matchups
    logger.info("Fetching European Tour matchups...");
    const [twoBallRes, threeBallRes] = await Promise.all([
      fetch(DATA_GOLF_EURO_2BALL_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_EURO_3BALL_URL, { cache: 'no-store' })
    ]);
    let twoBallData = null;
    let threeBallData = null;
    try {
      if (twoBallRes.ok) {
        twoBallData = await twoBallRes.json();
      }
    } catch (error) {
      logger.error("Error parsing Euro 2-ball data:", error);
    }
    try {
      if (threeBallRes.ok) {
        threeBallData = await threeBallRes.json();
      }
    } catch (error) {
      logger.error("Error parsing Euro 3-ball data:", error);
    }
    // Get current tournaments from database
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name, tour")
      .eq("tour", "euro");
    logger.info('Returning debug/test-euro-tour response');
    return jsonSuccess({
      schedule: {
        tour: scheduleData.tour,
        season: scheduleData.current_season,
        eventCount: scheduleData.schedule?.length || 0,
        events: scheduleData.schedule?.slice(0, 5) || []
      },
      twoBall: {
        eventName: twoBallData?.event_name || null,
        roundNum: twoBallData?.round_num || null,
        lastUpdated: twoBallData?.last_updated || null,
        matchupCount: twoBallData?.match_list?.length || 0,
        sampleMatchups: twoBallData?.match_list?.slice(0, 3) || []
      },
      threeBall: {
        eventName: threeBallData?.event_name || null,
        roundNum: threeBallData?.round_num || null,
        lastUpdated: threeBallData?.last_updated || null,
        matchupCount: threeBallData?.match_list?.length || 0,
        sampleMatchups: threeBallData?.match_list?.slice(0, 3) || []
      },
      database: {
        euroTournamentsCount: tournaments?.length || 0,
        sampleTournaments: tournaments?.slice(0, 5) || []
      }
    });
  } catch (error) {
    logger.error('Error in debug/test-euro-tour endpoint', { error });
    return handleApiError(error)
  }
}