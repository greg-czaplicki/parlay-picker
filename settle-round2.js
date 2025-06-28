// Script to trigger round-based settlement
const baseUrl = 'http://localhost:3000';

async function settleRounds() {
  try {
    console.log('Triggering round-based settlement...');
    
    const response = await fetch(`${baseUrl}/api/settle-rounds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    console.log('Settlement response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error settling rounds:', error);
  }
}

// Also trigger specific event settlement for Rocket Classic
async function settleRocketClassic() {
  try {
    console.log('Triggering settlement for Rocket Classic (event 524)...');
    
    const response = await fetch(`${baseUrl}/api/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: 524,
        method: 'automatic'
      })
    });

    const data = await response.json();
    console.log('Rocket Classic settlement response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error settling Rocket Classic:', error);
  }
}

// Run both
(async () => {
  await settleRounds();
  await settleRocketClassic();
})();