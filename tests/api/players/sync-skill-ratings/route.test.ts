require('dotenv').config({ path: '.env.local' });

import { GET } from '../../../../app/api/players/sync-skill-ratings/route';

jest.mock('@supabase/supabase-js', () => {
  const mClient = {
    from: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    neq: jest.fn().mockResolvedValue({ error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    insert: jest.fn().mockResolvedValue({ error: null }),
  };
  return {
    createClient: jest.fn(() => mClient),
  };
});

global.fetch = jest.fn();

describe('GET /api/players/sync-skill-ratings', () => {
  const mockField = {
    event_name: 'Test Event',
    field: [
      { dg_id: 1 },
      { dg_id: 2 },
    ],
  };
  const mockSkills = {
    last_updated: '2025-04-15 12:00:00 UTC',
    players: [
      {
        player_name: 'Player 1',
        dg_id: 1,
        sg_putt: 0.1,
        sg_arg: 0.2,
        sg_app: 0.3,
        sg_ott: 0.4,
        sg_total: 1.0,
        driving_acc: 60,
        driving_dist: 300,
      },
      {
        player_name: 'Player 2',
        dg_id: 2,
        sg_putt: 0.2,
        sg_arg: 0.3,
        sg_app: 0.4,
        sg_ott: 0.5,
        sg_total: 1.4,
        driving_acc: 65,
        driving_dist: 310,
      },
      {
        player_name: 'Player 3',
        dg_id: 3,
        sg_putt: 0.3,
        sg_arg: 0.4,
        sg_app: 0.5,
        sg_ott: 0.6,
        sg_total: 1.8,
        driving_acc: 70,
        driving_dist: 320,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('field-updates')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockField) });
      }
      if (url.includes('skill-ratings')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkills) });
      }
      return Promise.resolve({ ok: false, text: () => Promise.resolve('Not found') });
    });
  });

  it('should sync skill ratings and return success', async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.processedCount).toBe(2);
    expect(json.eventName).toBe('Test Event');
    expect(json.message).toContain('Synced skill ratings');
  });

  it('should handle fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => Promise.resolve({ ok: false, text: () => Promise.resolve('fail') }))
    .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkills) }));
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Failed to fetch field data/);
  });

  it('should handle supabase upsert error', async () => {
    const { createClient } = require('@supabase/supabase-js');
    const mClient = createClient();
    mClient.upsert.mockResolvedValueOnce({ error: { message: 'upsert failed' } });
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/upsert failed/);
  });
});
