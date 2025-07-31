// Quick script to check if DataGolf has Wyndham data
const DATAGOLF_API_KEY = process.env.DATAGOLF_API_KEY;

async function checkWyndhamData() {
  // Check schedule first
  const scheduleUrl = `https://feeds.datagolf.com/get-schedule?tour=pga&file_format=json&key=${DATAGOLF_API_KEY}`;
  const scheduleResp = await fetch(scheduleUrl);
  const schedule = await scheduleResp.json();
  
  console.log('PGA Tour Schedule:', schedule.schedule.filter((e: any) => 
    e.event_name.toLowerCase().includes('wyndham') || 
    new Date(e.start_date) >= new Date('2025-07-25')
  ));
  
  // Try to fetch live stats directly
  const liveUrl = `https://feeds.datagolf.com/preds/live-tournament-stats?tour=pga&stats=sg_total&display=value&file_format=json&key=${DATAGOLF_API_KEY}&round=1`;
  const liveResp = await fetch(liveUrl);
  
  if (liveResp.ok) {
    const liveData = await liveResp.json();
    console.log('Current tournament from DataGolf:', {
      event_name: liveData.event_name,
      course_name: liveData.course_name,
      last_updated: liveData.last_updated
    });
  } else {
    console.log('No live tournament data available');
  }
}

checkWyndhamData().catch(console.error);