// POST /api/sessionLogin — exchange a Firebase ID token for a session cookie.
// Only admins (custom claim) get a session cookie; it's what the middleware
// checks before letting anyone into admin pages.
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.admin !== true) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 });
    }

    const sessionCookie = await adminAuth().createSessionCookie(token, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ status: 'success' });
    response.cookies.set('__session', sessionCookie, {
      maxAge: SESSION_DURATION_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('sessionLogin failed:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
