/**
 * Tournament timezone mappings and conversion utilities
 */

// Tournament timezone mappings based on tournament location
const TOURNAMENT_TIMEZONES: Record<string, string> = {
  // Major Championships
  "The Open Championship": "Europe/London",
  "U.S. Open": "America/New_York", // Usually East Coast
  "Masters Tournament": "America/New_York", // Augusta, GA
  "PGA Championship": "America/New_York", // Varies but usually US
  
  // PGA Tour Regular Events
  "Genesis Invitational": "America/Los_Angeles",
  "WM Phoenix Open": "America/Phoenix",
  "AT&T Pebble Beach Pro-Am": "America/Los_Angeles",
  "The American Express": "America/Los_Angeles", // Palm Desert, CA
  "Sony Open in Hawaii": "Pacific/Honolulu",
  "Sentry": "Pacific/Honolulu", // Maui
  "The Players Championship": "America/New_York", // Florida
  "Arnold Palmer Invitational": "America/New_York", // Florida
  "THE PLAYERS Championship": "America/New_York", // Florida
  "Valspar Championship": "America/New_York", // Florida
  "WGC-Dell Technologies Match Play": "America/Chicago", // Austin, TX
  "Valero Texas Open": "America/Chicago", // San Antonio, TX
  "RBC Heritage": "America/New_York", // South Carolina
  "Zurich Classic of New Orleans": "America/Chicago",
  "Wells Fargo Championship": "America/New_York", // Charlotte, NC
  "Byron Nelson": "America/Chicago", // Dallas, TX
  "Charles Schwab Challenge": "America/Chicago", // Fort Worth, TX
  "the Memorial Tournament": "America/New_York", // Ohio
  "RBC Canadian Open": "America/Toronto",
  "U.S. Open": "America/New_York",
  "Travelers Championship": "America/New_York", // Connecticut
  "Rocket Mortgage Classic": "America/Detroit",
  "John Deere Classic": "America/Chicago", // Illinois
  "The Open Championship": "Europe/London",
  "3M Open": "America/Chicago", // Minnesota
  "WGC-FedEx St. Jude Invitational": "America/Chicago", // Memphis, TN
  "Wyndham Championship": "America/New_York", // North Carolina
  "THE NORTHERN TRUST": "America/New_York",
  "BMW Championship": "America/Chicago",
  "TOUR Championship": "America/New_York", // Georgia
  "Fortinet Championship": "America/Los_Angeles", // Napa, CA
  "Sanderson Farms Championship": "America/Chicago", // Mississippi
  "Shriners Children's Open": "America/Los_Angeles", // Las Vegas
  "CJ CUP": "America/Los_Angeles", // Usually Las Vegas
  "ZOZO CHAMPIONSHIP": "Asia/Tokyo",
  "World Wide Technology Championship": "America/Phoenix", // Mexico
  "Butterfield Bermuda Championship": "Atlantic/Bermuda",
  "Mayakoba Golf Classic": "America/Cancun",
  "Houston Open": "America/Chicago",
  "RSM Classic": "America/New_York", // Georgia
  "Hero World Challenge": "America/Nassau", // Bahamas
  "Tournament of Champions": "Pacific/Honolulu", // Maui
  "Farmers Insurance Open": "America/Los_Angeles", // San Diego
  "Waste Management Phoenix Open": "America/Phoenix",
  "AT&T Byron Nelson": "America/Chicago",
  "Memorial Tournament": "America/New_York",
  "Workday Championship": "America/New_York", // Florida
  "Honda Classic": "America/New_York", // Florida
  "Puerto Rico Open": "America/Puerto_Rico",
  "Corales Puntacana Championship": "America/Santo_Domingo",
  "Texas Open": "America/Chicago",
  "Mexico Open": "America/Mexico_City",
  "Cognizant Classic": "America/New_York", // Florida
  "The CJ CUP Byron Nelson": "America/Chicago",
  "Barracuda Championship": "America/Los_Angeles", // Lake Tahoe, CA/NV
  
  // European Tour Events
  "BMW International Open": "Europe/Berlin",
  "DP World Tour Championship": "Asia/Dubai",
  "Alfred Dunhill Links Championship": "Europe/London", // Scotland
  "BMW PGA Championship": "Europe/London", // England
  "Italian Open": "Europe/Rome",
  "Spanish Open": "Europe/Madrid",
  "French Open": "Europe/Paris",
  "Irish Open": "Europe/Dublin",
  "Scottish Open": "Europe/London",
  "Omega European Masters": "Europe/Zurich",
  "Rolex Series": "Europe/London", // Default for European events
  "Investec South African Open Championship": "Africa/Johannesburg",
  
  // Opposite Field Events
  "Puerto Rico Open": "America/Puerto_Rico",
  "Corales Puntacana Championship": "America/Santo_Domingo",
  "Barracuda Championship": "America/Los_Angeles"
};

// Course-specific timezone overrides for tournaments that move venues
const COURSE_TIMEZONES: Record<string, string> = {
  // PGA Championship venues
  "Whistling Straits": "America/Chicago", // Wisconsin
  "TPC Harding Park": "America/Los_Angeles", // San Francisco
  "Bethpage Black": "America/New_York", // New York
  "Bellerive Country Club": "America/Chicago", // Missouri
  "Quail Hollow Club": "America/New_York", // North Carolina
  
  // U.S. Open venues
  "Pebble Beach Golf Links": "America/Los_Angeles",
  "Winged Foot Golf Club": "America/New_York",
  "Torrey Pines Golf Course": "America/Los_Angeles",
  "Oakmont Country Club": "America/New_York", // Pennsylvania
  "Chambers Bay": "America/Los_Angeles", // Washington
  
  // Open Championship venues
  "Royal Portrush Golf Club": "Europe/London", // Northern Ireland
  "Royal St. George's": "Europe/London", // England
  "Royal Liverpool": "Europe/London", // England
  "Carnoustie Golf Links": "Europe/London", // Scotland
  "Royal Birkdale": "Europe/London", // England
  
  // Other notable courses
  "Augusta National Golf Club": "America/New_York", // Georgia
  "TPC Sawgrass": "America/New_York", // Florida
  "Bay Hill Club": "America/New_York", // Florida
  "Riviera Country Club": "America/Los_Angeles", // California
  "TPC Scottsdale": "America/Phoenix", // Arizona
};

/**
 * Get the timezone for a tournament based on its name and course
 */
export function getTournamentTimezone(tournamentName: string, courseName?: string): string {
  // First check course-specific overrides
  if (courseName && COURSE_TIMEZONES[courseName]) {
    return COURSE_TIMEZONES[courseName];
  }
  
  // Then check tournament name mappings
  if (TOURNAMENT_TIMEZONES[tournamentName]) {
    return TOURNAMENT_TIMEZONES[tournamentName];
  }
  
  // Default fallbacks based on tour or location keywords
  if (tournamentName.toLowerCase().includes('european') || 
      tournamentName.toLowerCase().includes('dp world')) {
    return "Europe/London";
  }
  
  if (tournamentName.toLowerCase().includes('asian') || 
      tournamentName.toLowerCase().includes('japan') ||
      tournamentName.toLowerCase().includes('zozo')) {
    return "Asia/Tokyo";
  }
  
  if (tournamentName.toLowerCase().includes('hawaii')) {
    return "Pacific/Honolulu";
  }
  
  if (tournamentName.toLowerCase().includes('mexico')) {
    return "America/Mexico_City";
  }
  
  if (tournamentName.toLowerCase().includes('canada')) {
    return "America/Toronto";
  }
  
  // Default to US Eastern Time for PGA Tour events
  return "America/New_York";
}

/**
 * Convert a DataGolf local time string to UTC ISO string
 * DataGolf provides times like "2025-07-17 14:59" in local tournament time
 */
export function convertTournamentTimeToUTC(
  localTimeString: string,
  tournamentName: string,
  courseName?: string
): string | null {
  if (!localTimeString) return null;
  
  const timezone = getTournamentTimezone(tournamentName, courseName);
  
  try {
    // Parse the local time string
    // DataGolf gives us "2025-07-17 14:59" format
    const dateTimeParts = localTimeString.split(' ');
    if (dateTimeParts.length !== 2) {
      throw new Error('Invalid time format');
    }
    
    const [datePart, timePart] = dateTimeParts;
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    
    // Create date in the tournament timezone using a simpler approach
    // We'll use the fact that we know specific timezone offsets
    const localDateTime = new Date(
      parseInt(year), 
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day), 
      parseInt(hour), 
      parseInt(minute), 
      0
    );
    
    // Get the timezone offset in minutes for this date
    const utcOffset = getTimezoneOffset(timezone, localDateTime);
    
    // Convert to UTC by subtracting the offset
    const utcTime = localDateTime.getTime() - (utcOffset * 60 * 1000);
    
    return new Date(utcTime).toISOString();
  } catch (error) {
    console.error(`Failed to convert time "${localTimeString}" for tournament "${tournamentName}":`, error);
    // Fallback to treating as UTC (current behavior)
    return new Date(localTimeString).toISOString();
  }
}

/**
 * Get timezone offset in minutes for a given timezone and date
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  try {
    // Create a date formatter for the target timezone
    const utcDate = new Date(date.getTime());
    
    // Format the date in both UTC and the target timezone
    const utcString = utcDate.toLocaleString('sv-SE', { timeZone: 'UTC' });
    const localString = utcDate.toLocaleString('sv-SE', { timeZone: timezone });
    
    // Parse both strings back to dates
    const utcParsed = new Date(utcString);
    const localParsed = new Date(localString);
    
    // Calculate the difference in minutes
    const offsetMs = localParsed.getTime() - utcParsed.getTime();
    return offsetMs / (60 * 1000);
  } catch (error) {
    console.error('Failed to get timezone offset:', error);
    // Default fallbacks for known timezones
    const knownOffsets: Record<string, number> = {
      'Europe/London': 60, // BST in summer (UTC+1)
      'America/New_York': -240, // EDT in summer (UTC-4)
      'America/Chicago': -300, // CDT in summer (UTC-5)
      'America/Los_Angeles': -420, // PDT in summer (UTC-7)
      'America/Phoenix': -420, // MST (no DST, UTC-7)
      'Pacific/Honolulu': -600, // HST (no DST, UTC-10)
    };
    
    return knownOffsets[timezone] || 0;
  }
}

/**
 * Convert a local date to UTC given a timezone
 * Uses a simpler, more reliable approach
 */
function convertLocalToUTC(localDate: Date, timezone: string): Date {
  try {
    // Format the local date components
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    
    // Create a date string in ISO format but interpret it as being in the tournament timezone
    const isoString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    
    // Parse the date string as if it's in the tournament timezone
    // This uses a workaround: create a date representing this time in UTC,
    // then calculate what UTC time would produce this local time in the target timezone
    const utcDate = new Date(`${isoString}Z`);
    
    // Get what time it is in the target timezone when it's this UTC time
    const timeInTimezone = new Date(utcDate.toLocaleString("sv-SE", { timeZone: timezone }));
    
    // Calculate the offset and apply it
    const offset = utcDate.getTime() - timeInTimezone.getTime();
    const correctUtcTime = utcDate.getTime() + offset;
    
    return new Date(correctUtcTime);
  } catch (error) {
    console.error('Timezone conversion failed:', error);
    // Fallback to the original date treated as UTC
    return localDate;
  }
}

/**
 * Convert UTC time to Eastern Time for display
 */
export function convertUTCToEastern(utcTimeString: string): string {
  if (!utcTimeString) return '';
  
  try {
    const utcDate = new Date(utcTimeString);
    const easternTime = utcDate.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return easternTime;
  } catch (error) {
    console.error('Failed to convert UTC to Eastern:', error);
    return '';
  }
}

/**
 * Get both local tournament time and Eastern time for display
 */
export function getDisplayTimes(utcTimeString: string, tournamentName: string, courseName?: string): {
  tournamentTime: string;
  easternTime: string;
  tournamentTimezone: string;
} {
  if (!utcTimeString) {
    return { tournamentTime: '', easternTime: '', tournamentTimezone: '' };
  }
  
  try {
    const utcDate = new Date(utcTimeString);
    const tournamentTimezone = getTournamentTimezone(tournamentName, courseName);
    const tournamentTimezoneDisplay = getTournamentTimezoneDisplay(tournamentName, courseName);
    
    // Get tournament local time
    const tournamentTime = utcDate.toLocaleString('en-US', {
      timeZone: tournamentTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Get Eastern time
    const easternTime = convertUTCToEastern(utcTimeString);
    
    return {
      tournamentTime,
      easternTime,
      tournamentTimezone: tournamentTimezoneDisplay
    };
  } catch (error) {
    console.error('Failed to get display times:', error);
    return { tournamentTime: '', easternTime: '', tournamentTimezone: '' };
  }
}

/**
 * Get a human-readable timezone name for display
 */
export function getTournamentTimezoneDisplay(tournamentName: string, courseName?: string): string {
  const timezone = getTournamentTimezone(tournamentName, courseName);
  
  const timezoneDisplayNames: Record<string, string> = {
    "America/New_York": "ET",
    "America/Chicago": "CT", 
    "America/Denver": "MT",
    "America/Los_Angeles": "PT",
    "America/Phoenix": "MST",
    "Pacific/Honolulu": "HST",
    "Europe/London": "GMT/BST",
    "Europe/Berlin": "CET/CEST",
    "Asia/Tokyo": "JST",
    "Asia/Dubai": "GST",
    "America/Toronto": "ET",
    "America/Mexico_City": "CST",
    "Atlantic/Bermuda": "ADT",
    "America/Nassau": "EST",
    "America/Puerto_Rico": "AST",
    "America/Santo_Domingo": "AST",
    "Africa/Johannesburg": "SAST"
  };
  
  return timezoneDisplayNames[timezone] || timezone;
}