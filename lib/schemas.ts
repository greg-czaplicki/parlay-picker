import { z } from "zod";

// Add more schemas here as needed for other API routes 

export const twoBallMatchupsQuerySchema = z.object({
  eventId: z.string().regex(/^\d+$/).optional(),
  tour: z.enum(["pga", "opp", "euro"]).optional(),
});

export const threeBallMatchupsQuerySchema = z.object({
  eventId: z.string().regex(/^\d+$/).optional(),
  tour: z.enum(["pga", "opp", "euro"]).optional(),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(/^\d+$/),
});

export const debugCheckQuerySchema = z.object({
  eventId: z.string().regex(/^\d+$/).optional(),
  type: z.string().optional(),
});

export const tableEventQuerySchema = z.object({
  table: z.string().optional(),
  event: z.string().regex(/^\d+$/).optional(),
});

export const tourParamSchema = z.object({
  tour: z.enum(["pga", "opp", "euro"]).optional(),
});