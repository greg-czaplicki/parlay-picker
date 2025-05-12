/**
 * API Utilities for Next.js App Router routes
 *
 * Usage examples:
 *
 *   const params = getQueryParams(request, mySchema)
 *   const { limit, offset } = getPaginationParams(request)
 *   const { sortBy, order } = getSortParams(request)
 *   const filters = getFilterParams(request, ['eventId', 'tour'])
 *   const supabase = createSupabaseClient()
 *   try { ... } catch (e) { return handleApiError(e) }
 *   return jsonSuccess(data)
 *   return jsonError('message', 'CODE')
 */
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { jsonSuccess, jsonError } from '@/lib/api-response'

/**
 * Parse and validate query params using a Zod object schema.
 */
export function getQueryParams<T extends z.ZodRawShape>(request: Request, schema: z.ZodObject<T>): z.infer<z.ZodObject<T>> {
  const url = new URL(request.url)
  const params: Record<string, string | undefined> = {}
  for (const key of Object.keys(schema.shape)) {
    params[key] = url.searchParams.get(key) ?? undefined
  }
  return schema.parse(params)
}

/**
 * Extract pagination params from query string.
 */
export function getPaginationParams(request: Request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '', 10)
  const offset = parseInt(url.searchParams.get('offset') || '', 10)
  const page = parseInt(url.searchParams.get('page') || '', 10)
  return {
    limit: isNaN(limit) ? undefined : limit,
    offset: isNaN(offset) ? undefined : offset,
    page: isNaN(page) ? undefined : page,
  }
}

/**
 * Extract sort params from query string.
 */
export function getSortParams(request: Request) {
  const url = new URL(request.url)
  return {
    sortBy: url.searchParams.get('sort') || undefined,
    order: url.searchParams.get('order') || 'asc',
  }
}

/**
 * Extract allowed filter params from query string.
 */
export function getFilterParams(request: Request, allowed: string[]) {
  const url = new URL(request.url)
  const filters: Record<string, string | undefined> = {}
  for (const key of allowed) {
    filters[key] = url.searchParams.get(key) ?? undefined
  }
  return filters
}

/**
 * Centralized Supabase client creation with env checks.
 */
export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase URL or Service Role Key is missing in environment variables.')
  return createClient(url, key)
}

/**
 * Standard error handler for API routes.
 */
export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    return jsonError(error.message, 'INTERNAL_ERROR')
  }
  return jsonError('Unknown error', 'INTERNAL_ERROR')
}

export { jsonSuccess, jsonError } 