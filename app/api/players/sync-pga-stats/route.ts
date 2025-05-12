import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { handleApiError } from '@/lib/utils'
import 'next-logger'
import { logger } from '@/lib/logger'

// --- Supabase Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetches most recent player stats from the PGA Tour site
 */
export async function GET(request: Request) {
  logger.info('Received players/sync-pga-stats request', { url: request.url });
  console.log("Starting PGA Tour stats sync process...");
  
  try {
    // First check if the player_season_stats table exists
    try {
      // Use RPC query to check if table exists
      const { data, error } = await supabase.rpc('check_table_exists', { table_name: 'player_season_stats' });
      
      if (error) {
        // The RPC function might not exist - use fallback method
        console.warn("Error checking table with RPC:", error);
        
        // Fallback - try to query the information_schema directly
        const { data: schemaData, error: schemaError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', 'player_season_stats')
          .eq('table_schema', 'public');
        
        if (schemaError) {
          console.error("Error checking table existence:", schemaError);
          // We'll continue and see if we get a more specific error later
        } else if (!schemaData || schemaData.length === 0) {
          return NextResponse.json({
            success: false,
            error: "Database setup required: player_season_stats table does not exist. Please run the SQL setup script found in pga-stats-scraper/SETUP.md."
          }, { status: 400 });
        }
      } else if (!data) {
        return NextResponse.json({
          success: false,
          error: "Database setup required: player_season_stats table does not exist. Please run the SQL setup script found in pga-stats-scraper/SETUP.md."
        }, { status: 400 });
      }
    } catch (tableCheckError) {
      console.error("Error checking for table existence:", tableCheckError);
      // Continue and we'll get a more specific error if the table really doesn't exist
    }
    
    // Path to the pga-stats-scraper project (relative to the app root)
    const scraperPath = path.resolve(process.cwd(), 'pga-stats-scraper');
    console.log("Scraper path:", scraperPath);
    
    // Check if the directory exists
    try {
      const scraperDirExists = require('fs').existsSync(scraperPath);
      if (!scraperDirExists) {
        return NextResponse.json({
          success: false,
          error: `Scraper directory not found at: ${scraperPath}`
        }, { status: 500 });
      }
    } catch (fsError) {
      console.error("Error checking for scraper directory:", fsError);
    }
    
    // Execute the scraper as a separate process
    const result = await new Promise<string>((resolve, reject) => {
      console.log("Starting npm process in directory:", scraperPath);
      
      // Use npm start to run the compiled scraper
      const scraperProcess = spawn('npm', ['start'], { 
        cwd: scraperPath,
        shell: true,
        env: { ...process.env }
      });
      
      let output = '';
      let errorOutput = '';
      
      scraperProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(`[PGA Scraper]: ${chunk.trim()}`);
      });
      
      scraperProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.error(`[PGA Scraper Error]: ${chunk.trim()}`);
      });
      
      scraperProcess.on('close', (code) => {
        console.log(`Scraper process exited with code: ${code}`);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Scraper process exited with code ${code}: ${errorOutput}`));
        }
      });
      
      scraperProcess.on('error', (err) => {
        console.error("Failed to start scraper process:", err);
        reject(new Error(`Failed to start scraper process: ${err.message}`));
      });
    });
    
    let statsCount = 0;
    let lastUpdated = new Date().toISOString();
    
    try {
      // After scraper completes, fetch the latest stats from the database to return
      const { data: statsData, error: statsError } = await supabase
        .from('player_season_stats')
        .select('COUNT(*)')
        .single();
      
      if (statsError) {
        console.error('Error getting stats count:', statsError);
        // Continue using default values
      } else {
        statsCount = statsData?.count || 0;
      }
      
      // Get the last updated timestamp
      const { data: lastUpdatedData, error: lastUpdatedError } = await supabase
        .from('player_season_stats')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
        
      if (lastUpdatedError) {
        console.error('Error getting last updated date:', lastUpdatedError);
        // Continue using default values
      } else if (lastUpdatedData?.updated_at) {
        lastUpdated = lastUpdatedData.updated_at;
      }
    } catch (dbError) {
      console.error('Error retrieving stats info:', dbError);
      // Continue using default values
    }
    
    // Return success response with counts
    logger.info('Returning players/sync-pga-stats response');
    return NextResponse.json({
      success: true,
      message: `PGA Tour stats sync completed successfully`,
      processedCount: statsCount,
      sourceTimestamp: lastUpdated,
      source: "PGA Tour Website"
    });
    
  } catch (error) {
    logger.error('Error in players/sync-pga-stats endpoint', { error });
    return handleApiError(error)
  }
}