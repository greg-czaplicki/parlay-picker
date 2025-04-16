require('dotenv').config({ path: '.env.local' });

import { GET } from '../../../../app/api/live-stats/sync/route';

// Mock fetch and supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => ({ error: null })),
    })),
  })),
}));

global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    course_name: 'Test Course',
    event_name: 'Test Event',
    last_updated: '2025-04-15 12:00:00 UTC',
    stat_display: 'value',
    stat_round: '1',
    live_stats: [
      {
        dg_id: 1,
        player_name: 'Player 1',
        sg_app: 1.1,
        sg_ott: 0.5,
        sg_putt: 0.2,
        sg_arg: 0.1,
        sg_t2g: 1.7,
        sg_total: 1.9,
        accuracy: 70,
        distance: 300,
        gir: 15,
        prox_fw: 25,
        scrambling: 60,
        position: '1',
        thru: 18,
        round: -2,
        total: -2,
      },
    ],
  }),
})) as jest.Mock;

describe('GET /api/live-stats/sync', () => {
  it('returns success and processes stats', async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.processedCount).toBeGreaterThan(0);
    expect(json.errors.length).toBe(0);
    expect(json.eventName).toBe('Test Event');
  });
});