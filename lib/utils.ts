import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TrendIndicator } from "@/types/definitions"
import { NextResponse } from 'next/server'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "";
  const now = new Date();
  const past = new Date(isoTimestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 120) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  return `${diffInHours}h ago`;
}

export function formatPlayerName(name: string): string {
  if (!name || typeof name !== 'string') return 'Unknown Player';
  return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
}

// Detects divergence between FanDuel and Data Golf favorites in a 3-ball matchup
export function detect3BallDivergence(matchup: any) {
  if (!matchup?.odds?.fanduel || !matchup?.odds?.datagolf) return null;
  const fanduelOdds = matchup.odds.fanduel;
  const datagolfOdds = matchup.odds.datagolf;

  // Find the favorite (lowest odds) for each source
  const datagolfFavorite = Object.entries(datagolfOdds)
    .reduce<{ key: string | null, value: number }>(
      (fav, [key, value]) =>
        typeof value === "number" && value < fav.value
          ? { key, value }
          : fav,
      { key: null, value: Infinity }
    ).key;

  // If ANY FanDuel or Data Golf odds are missing, do NOT calculate divergence (return null)
  if (
    fanduelOdds.p1 == null || fanduelOdds.p2 == null || fanduelOdds.p3 == null ||
    datagolfOdds.p1 == null || datagolfOdds.p2 == null || datagolfOdds.p3 == null
  ) {
    return null;
  }

  // Check for unique lowest odds for FanDuel
  const fanduelValues = [fanduelOdds.p1, fanduelOdds.p2, fanduelOdds.p3];
  const minFanduel = Math.min(...fanduelValues);
  const fanduelMinCount = fanduelValues.filter(v => v === minFanduel).length;
  if (fanduelMinCount !== 1) {
    return null;
  }

  // Check for unique lowest odds for Data Golf
  const datagolfValues = [datagolfOdds.p1, datagolfOdds.p2, datagolfOdds.p3];
  const minDatagolf = Math.min(...datagolfValues);
  const datagolfMinCount = datagolfValues.filter(v => v === minDatagolf).length;
  if (datagolfMinCount !== 1) {
    return null;
  }

  const fanduelFavorite = Object.entries(fanduelOdds)
    .reduce<{ key: string | null, value: number }>(
      (fav, [key, value]) =>
        typeof value === "number" && value < fav.value
          ? { key, value }
          : fav,
      { key: null, value: Infinity }
    ).key;

  return {
    fanduelFavorite,
    datagolfFavorite,
    isDivergence: fanduelFavorite !== datagolfFavorite
  };
}

/**
 * Standardized API error handler for Next.js API routes.
 * @param error - The error object (unknown or Error)
 * @param diagnostic - Optional extra diagnostic info (object)
 * @param status - HTTP status code (default 500)
 * @returns NextResponse with standardized error JSON
 * @example
 *   return handleApiError(error, { extra: 'info' }, 400)
 */
export function handleApiError(
  error: unknown,
  diagnostic?: Record<string, unknown>,
  status = 500
) {
  const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error')
  // Only log in development, not in production
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    // console.error('API Error:', error)
  }
  return NextResponse.json(
    { success: false, error: errorMessage, ...(diagnostic || {}) },
    { status }
  )
}
