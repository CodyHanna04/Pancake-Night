// One-time backfill: grant the `approved` custom claim to every EXISTING
// auth user, so the approval requirement only applies to new signups.
//
// Usage: node --env-file=.env.local scripts/approveAllUsers.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const privateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.NEXT_FIREBASE_CLIENT_EMAIL;
const projectId =
  process.env.NEXT_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error('Missing NEXT_FIREBASE_* vars. Run with: node --env-file=.env.local scripts/approveAllUsers.mjs');
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
const db = getFirestore();

let approved = 0;
let skipped = 0;
let pageToken;

do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    const claims = user.customClaims || {};
    if (claims.approved === true) {
      skipped++;
      continue;
    }
    await auth.setCustomUserClaims(user.uid, { ...claims, approved: true });
    await db.doc(`users/${user.uid}`).set(
      { email: user.email ?? null, approved: true },
      { merge: true }
    );
    approved++;
    console.log('approved:', user.email ?? user.uid);
  }
  pageToken = page.pageToken;
} while (pageToken);

console.log(`\nDone. Approved ${approved} user(s), ${skipped} already approved.`);
console.log('Users must sign out/in (or wait up to 1h) for the claim to load.');
