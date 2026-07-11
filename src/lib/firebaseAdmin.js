// src/lib/firebaseAdmin.js — server-only Firebase Admin SDK singleton.
// Never import this from a "use client" component.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const privateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.NEXT_FIREBASE_CLIENT_EMAIL;
  const projectId =
    process.env.NEXT_FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    throw new Error(
      'Missing Firebase Admin credentials. Set NEXT_FIREBASE_PRIVATE_KEY, ' +
        'NEXT_FIREBASE_CLIENT_EMAIL, and NEXT_FIREBASE_PROJECT_ID in .env.local ' +
        '(see .env.example).'
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // Vercel/dotenv store the key with literal "\n" sequences
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
