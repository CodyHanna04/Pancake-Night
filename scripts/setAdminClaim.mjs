// One-time script: grant (or revoke) the admin custom claim for a user.
//
// Usage:
//   node --env-file=.env.local scripts/setAdminClaim.mjs you@example.com
//   node --env-file=.env.local scripts/setAdminClaim.mjs you@example.com --revoke
//
// Requires the Firebase Admin credentials in .env.local (see .env.example).
// The user must sign out and back in for the new claim to take effect.
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!email || !email.includes('@')) {
  console.error('Usage: node --env-file=.env.local scripts/setAdminClaim.mjs <email> [--revoke]');
  process.exit(1);
}

const privateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.NEXT_FIREBASE_CLIENT_EMAIL;
const projectId =
  process.env.NEXT_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error(
    'Missing admin credentials. Make sure NEXT_FIREBASE_PRIVATE_KEY, ' +
      'NEXT_FIREBASE_CLIENT_EMAIL, and NEXT_FIREBASE_PROJECT_ID are set in ' +
      '.env.local, and run with: node --env-file=.env.local scripts/setAdminClaim.mjs <email>'
  );
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  }),
});

const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, revoke ? { admin: false } : { admin: true });

console.log(
  `${revoke ? 'Revoked admin from' : 'Granted admin to'} ${email} (uid: ${user.uid}).`
);
console.log('They must sign out and back in for the change to take effect.');
