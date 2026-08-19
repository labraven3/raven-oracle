import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes (except /admin/login).
  // Admin authentication uses a dedicated cookie so a normal user session
  // can never satisfy the admin page gate.
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('raven_admin_token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
