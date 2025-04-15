require('dotenv').config({ path: '.env.local' });
import { GET } from "../../../../app/api/matchups/3ball/route";

// Mock fetch and Supabase
jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({ data: [{ event_id: 1, event_name: "Test Event" }], error: null })),
        insert: jest.fn(() => ({ error: null })),
        upsert: jest.fn(() => ({ error: null })),
      })),
    })),
  };
});

global.fetch = jest.fn((url) =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        event_name: "Test Event",
        last_updated: "2025-04-10 11:30:00 UTC",
        market: "3_balls",
        match_list: [
          {
            odds: {
              fanduel: { p1: 2.1, p2: 3.2, p3: 4.3 },
              draftkings: { p1: 2.2, p2: 3.3, p3: 4.4 },
            },
            p1_dg_id: 101,
            p1_player_name: "Player 1",
            p2_dg_id: 102,
            p2_player_name: "Player 2",
            p3_dg_id: 103,
            p3_player_name: "Player 3",
            ties: "none",
          },
        ],
        round_num: 1,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  )
) as jest.Mock;

describe("GET /api/matchups/3ball", () => {
  it("should fetch and store 3-ball matchups and return success", async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.results[0].event).toBe("Test Event");
    expect(json.results[0].processedCount).toBeGreaterThan(0);
  });
});