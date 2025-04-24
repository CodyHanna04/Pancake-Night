// /app/middleware.js
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';

const firebasePrivateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Initialize Firebase Admin once
const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_FIREBASE_PROJECT_ID,
    clientEmail: process.env.NEXT_FIREBASE_CLIENT_EMAIL,
    privateKey: firebasePrivateKey,
  }),
});

// Your allowed admin emails
const ADMIN_EMAILS = ['codyhanna8@gmail.com', ];

export async function middleware(request) {
  const session = request.cookies.get('__session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const decoded = await getAuth(app).verifySessionCookie(session, true);
    const userEmail = decoded.email;

    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch (err) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
