import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('raven_token')?.value;

    // No token found, redirect to admin login
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Token exists, let it through - the frontend will verify it's actually an admin
    // The API will reject if user isn't admin
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
