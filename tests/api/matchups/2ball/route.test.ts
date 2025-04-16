require('dotenv').config({ path: '.env.local' });

import { GET } from "../../../../app/api/matchups/2ball/route";

// Define a type for Supabase responses
interface SupabaseResponse {
  error: { message: string } | null;
  data?: any;
}

// Enhanced Supabase mock to handle per-table upsert/insert
const upsertMock: jest.Mock<Promise<SupabaseResponse>, any> = jest.fn(() => Promise.resolve({ error: null }));
const insertMock: jest.Mock<Promise<SupabaseResponse>, any> = jest.fn(() => Promise.resolve({ error: null }));
const selectMock: jest.Mock<Promise<SupabaseResponse>, any> = jest.fn(() => Promise.resolve({ data: [{ event_id: 1, event_name: "Test Event" }], error: null }));

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: selectMock,
        insert: insertMock,
        upsert: upsertMock,
      })),
    })),
  };
});

global.fetch = jest.fn((url) => {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        event_name: "Test Event",
        last_updated: "2025-04-10 11:30:00 UTC",
        market: "round_matchups",
        match_list: [
          {
            odds: {
              fanduel: { p1: 2.1, p2: 3.2 },
              draftkings: { p1: 2.2, p2: 3.3 },
            },
            p1_dg_id: 101,
            p1_player_name: "Player 1",
            p2_dg_id: 102,
            p2_player_name: "Player 2",
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
  );
});

describe("GET /api/matchups/2ball", () => {
  it("should fetch and store 2-ball matchups and return success", async () => {
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.results[0].event).toBe("Test Event");
    expect(json.results[0].processedCount).toBeGreaterThan(0);
  });

  it("should handle fetch error gracefully", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(new Response("fail", { status: 500 }))
    );
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Failed to fetch/);
  });

  it("should handle supabase upsert error", async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: "upsert failed" } });
    const response = await GET();
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/upsert failed/);
  });
});
