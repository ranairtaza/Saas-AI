import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Add paths that require authentication here
const protectedPaths = [
  '/dashboard',
  '/settings',
  '/api/leads', 
];

// Add paths that should not be accessible if already authenticated
const authPaths = [
  '/login',
  '/register',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  if (!isProtectedPath && !isAuthPath) {
    return NextResponse.next();
  }

  // Broad edge protection: Check for the presence of the session cookie.
  const sessionCookie = request.cookies.get('session')?.value;
  let hasSessionCookie = false;
  
  if (sessionCookie) {
    try {
      const { jwtVerify } = await import('jose');
      const secretVal = process.env.JWT_SECRET || process.env.SESSION_SECRET;
      if (!secretVal) {
        if (process.env.NODE_ENV === 'production') {
          hasSessionCookie = false;
        } else {
          const secret = new TextEncoder().encode('fallback_secret_for_dev_only');
          await jwtVerify(sessionCookie, secret);
          hasSessionCookie = true;
        }
      } else {
        const secret = new TextEncoder().encode(secretVal);
        await jwtVerify(sessionCookie, secret);
        hasSessionCookie = true;
      }
    } catch (e) {
      // Fallback for existing opaque session tokens (64-char hex strings)
      if (sessionCookie.length === 64) {
        hasSessionCookie = true;
      } else {
        hasSessionCookie = false;
      }
    }
  }

  // Handle protected paths: Redirect to login if no valid cookie is present
  if (isProtectedPath && !hasSessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Handle auth paths: Redirect to dashboard if cookie is present (soft check)
  if (isAuthPath && hasSessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
