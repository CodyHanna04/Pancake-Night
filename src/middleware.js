// src/middleware.js — server-side gate for admin pages.
// Cryptographically verifies the __session cookie (minted by
// /api/sessionLogin, admins only) before the page even renders.
// Client guards + Firestore rules are the second and third layers.
import { NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/verifySessionCookie';

export async function middleware(request) {
  const session = request.cookies.get('__session')?.value;
  const loginUrl = new URL('/login', request.url);

  if (!session) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const payload = await verifySessionCookie(session);
    if (payload.admin !== true) {
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  } catch (err) {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/kitchen-display/:path*',
    '/order-submission/:path*',
  ],
};
