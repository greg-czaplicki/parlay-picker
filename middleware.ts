import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Skip auth for API routes and static files
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/_next/') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/auth')
  ) {
    return NextResponse.next()
  }

  // Check if user is already authenticated
  const authCookie = request.cookies.get('golf-parlay-auth')
  
  if (authCookie?.value === 'authenticated') {
    return NextResponse.next()
  }

  // If requesting auth page, allow it
  if (request.nextUrl.pathname === '/auth') {
    return NextResponse.next()
  }

  // Redirect to auth page
  return NextResponse.redirect(new URL('/auth', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 