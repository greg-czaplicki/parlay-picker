require('dotenv').config({ path: '.env.local' });

import { GET } from '../../../../app/api/players/sync-skill-ratings/route';

jest.mock('@supabase/supabase-js', () => {
  // Chainable mock for Supabase query builder
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    neq: jest.fn().mockResolvedValue({ error: null }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    // For select().eq().limit() chain, return event_id for event_name
    mockReturnValueOnce: jest.fn(),
  };
  chain.select.mockImplementation(function() { return this; });
  chain.eq.mockImplementation(function() { return this; });
  chain.limit.mockImplementation(function() { return this; });
  chain.order.mockImplementation(function() { return this; });
  chain.lte.mockImplementation(function() { return this; });
  chain.gte.mockImplementation(function() { return this; });
  chain.from.mockImplementation(function() {
    // If select() is called after from(), return event_id for event_name
    chain.select.mockImplementation(function() {
      return {
        eq: jest.fn().mockImplementation(function(_, eventName) {
          return {
            limit: jest.fn().mockImplementation(function() {
              return Promise.resolve({ data: [{ event_id: 123 }], error: null });
            })
          };
        })
      };
    });
    return chain;
  });
  return {
    createClient: jest.fn(() => chain),
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
    expect(json.processedCount).toBe(3); // all players in mockSkills
    expect(json.mainEventName).toBe('Test Event');
    expect(json.message).toContain('Synced player fields');
  });

  it('should handle fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => Promise.resolve({ ok: false, text: () => Promise.resolve('fail') }))
    .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockSkills) }));
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Failed to fetch PGA field/);
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
