require('dotenv').config({ path: '.env.local' });

import { GET } from '../../../../app/api/schedule/sync/route';

jest.mock('@supabase/supabase-js', () => {
  const mClient = {
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  };
  return {
    createClient: jest.fn(() => mClient),
  };
});

global.fetch = jest.fn();

describe('GET /api/schedule/sync', () => {
  const mockSchedule = {
    tour: 'pga',
    current_season: 2025,
    schedule: [
      {
        event_id: 1,
        event_name: 'Masters Tournament',
        course: 'Augusta National',
        course_key: 'augusta',
        start_date: '2025-04-10',
      },
      {
        event_id: 2,
        event_name: 'PGA Championship',
        course: 'Valhalla',
        course_key: 'valhalla',
        start_date: '2025-05-15',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockSchedule) })
    );
  });

  it('should sync schedule and return success', async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.processedCount).toBe(2);
    expect(json.tour).toBe('pga');
    expect(json.season).toBe(2025);
    expect(json.message).toContain('Synced schedule');
    expect(json.sourceTimestamp).toBeDefined();
  });

  it('should handle fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ ok: false, text: () => Promise.resolve('fail') })
    );
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Failed to fetch schedule/);
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
