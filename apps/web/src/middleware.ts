import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Only handle root path redirect to swap
  if (request.nextUrl.pathname === '/') {
    const swapUrl = new URL('/swap', request.url)
    
    // Preserve ALL query parameters as-is to avoid any filtering issues
    // This is simpler and more reliable than parameter filtering
    if (request.nextUrl.search) {
      swapUrl.search = request.nextUrl.search
    }
    
    // Use 301 permanent redirect instead of 308 to avoid caching issues
    return NextResponse.redirect(swapUrl, 301)
  }

  // Let all other routes pass through unchanged
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Only match root path to avoid any routing conflicts
     * This is more explicit and safer than complex patterns
     */
    '/',
  ],
} 