import { NextResponse } from 'next/server';

/**
 * Standard shape for a successful API response
 */
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard shape for an error API response
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Format a successful API response
 * @param data - The response payload
 * @param message - Optional message
 */
export function formatSuccess<T>(data: T, message?: string): ApiSuccess<T> {
  return { success: true, data, ...(message ? { message } : {}) };
}

/**
 * Format an error API response
 * @param error - Error object or string
 * @param code - Optional error code (default: 'INTERNAL_ERROR')
 * @param details - Optional error details
 */
export function formatError(error: unknown, code = 'INTERNAL_ERROR', details?: unknown): ApiError {
  let message = 'An unknown error occurred.';
  if (typeof error === 'string') message = error;
  else if (error instanceof Error) message = error.message;
  else if (typeof error === 'object' && error && 'message' in error) message = String((error as any).message);
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  };
}

/**
 * Helper to return a NextResponse with a standardized success shape
 */
export function jsonSuccess<T>(data: T, message?: string, init?: ResponseInit) {
  return NextResponse.json(formatSuccess(data, message), init);
}

/**
 * Helper to return a NextResponse with a standardized error shape
 */
export function jsonError(error: unknown, code = 'INTERNAL_ERROR', details?: unknown, init?: ResponseInit) {
  return NextResponse.json(formatError(error, code, details), { status: 400, ...init });
} 