const fs = require('fs');

const data = JSON.parse(fs.readFileSync('migration-backup/extracted-data-2025-06-28T15-08-14-097Z.json', 'utf8'));

if (data.seasonStats) {
  console.log('Total season stats records:', data.seasonStats.length);
  
  // Find records with null/undefined dg_id
  const nullDgIds = data.seasonStats.filter(s => !s.dg_id && s.dg_id !== 0);
  console.log(`\nTotal records with null/undefined dg_id: ${nullDgIds.length}`);
  
  console.log('\nProblem records:');
  nullDgIds.forEach(r => {
    console.log(`ID: ${r.id}, dg_id: ${r.dg_id}, name: ${r.player_name || 'N/A'}, avg: ${r.scoring_average}`);
  });
  
  // Show the structure of one record
  if (data.seasonStats.length > 0) {
    console.log('\nSample season stats record structure:');
    console.log(JSON.stringify(data.seasonStats[0], null, 2));
  }
}